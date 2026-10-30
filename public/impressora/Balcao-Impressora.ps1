# Balcao: imprime na impressora do Windows, sem janela do Chrome.
# Deixe esta janela aberta enquanto a loja estiver funcionando.
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$Port = 3921
$Dir = Join-Path $env:LOCALAPPDATA "Balcao"
New-Item -ItemType Directory -Force -Path $Dir | Out-Null
$PrinterFile = Join-Path $Dir "impressora.txt"
$MaxBody = 8000000

function Convert-NameList([string[]]$names) {
  $parts = @()
  foreach ($name in $names) {
    $parts += ($name | ConvertTo-Json -Compress)
  }
  return "[" + ($parts -join ",") + "]"
}
function Get-PrinterNames {
  $names = New-Object System.Collections.Generic.List[string]
  foreach ($name in [System.Drawing.Printing.PrinterSettings]::InstalledPrinters) {
    $names.Add([string]$name)
  }
  return $names
}

function Get-SavedPrinter {
  $names = @(Get-PrinterNames)
  if (Test-Path -LiteralPath $PrinterFile) {
    $saved = (Get-Content -LiteralPath $PrinterFile -Encoding UTF8 | Select-Object -First 1)
    if ($saved) { $saved = $saved.Trim() }
    if ($saved -and ($names -contains $saved)) { return $saved }
  }
  $settings = New-Object System.Drawing.Printing.PrinterSettings
  return [string]$settings.PrinterName
}

function Set-SavedPrinter([string]$name) {
  $names = @(Get-PrinterNames)
  if ($names -notcontains $name) { throw "Impressora nao encontrada." }
  Set-Content -LiteralPath $PrinterFile -Value $name -Encoding UTF8
}

function Convert-ToBitmap([byte[]]$bytes) {
  $clean = New-Object byte[] $bytes.Length
  [System.Buffer]::BlockCopy($bytes, 0, $clean, 0, $clean.Length)
  $stream = New-Object System.IO.MemoryStream
  $stream.Write($clean, 0, $clean.Length)
  $stream.Position = 0
  $image = $null
  try {
    $image = [System.Drawing.Image]::FromStream($stream)
    $bmp = New-Object System.Drawing.Bitmap $image.Width, $image.Height
    $draw = [System.Drawing.Graphics]::FromImage($bmp)
    try { $draw.DrawImage($image, 0, 0, $image.Width, $image.Height) } finally { $draw.Dispose() }
    return $bmp
  } catch {
    throw "Nao abri esta foto. Mande de novo como imagem."
  } finally {
    if ($image) { $image.Dispose() }
    $stream.Dispose()
  }
}

function Test-PdfBytes([byte[]]$bytes) {
  return $bytes.Length -gt 5 -and $bytes[0] -eq 37 -and $bytes[1] -eq 80 -and $bytes[2] -eq 68 -and $bytes[3] -eq 70
}

function Wait-WinRt($task, $resultType) {
  $method = $script:BalcaoAsTask
  if ($resultType) { $method = $script:BalcaoAsTask.MakeGenericMethod($resultType) }
  $net = $method.Invoke($null, @($task))
  $net.Wait(20000) | Out-Null
  if ($resultType) { return $net.Result }
}

function Send-PdfBytes([byte[]]$bytes, [string]$printerName, [int]$copies) {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
  $null = [Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime]
  $null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
  $null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]
  if (-not $script:BalcaoAsTask) {
    $methods = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq "AsTask" -and $_.GetParameters().Count -eq 1 }
    $script:BalcaoAsTask = $methods | Where-Object { -not $_.IsGenericMethod -and $_.GetParameters()[0].ParameterType.Name -eq "IAsyncAction" } | Select-Object -First 1
    $op = "IAsyncOperation" + [char]96 + "1"
    $script:BalcaoAsTaskGeneric = $methods | Where-Object { $_.IsGenericMethod -and $_.GetParameters()[0].ParameterType.Name -eq $op } | Select-Object -First 1
  }
  $temp = Join-Path $env:TEMP ("balcao-" + [guid]::NewGuid().ToString("n") + ".pdf")
  [System.IO.File]::WriteAllBytes($temp, $bytes)
  $pdf = $null
  try {
    $fileTask = [Windows.Storage.StorageFile]::GetFileFromPathAsync($temp)
    $file = $script:BalcaoAsTaskGeneric.MakeGenericMethod([Windows.Storage.StorageFile]).Invoke($null, @($fileTask))
    $file.Wait(20000) | Out-Null
    $pdfTask = [Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file.Result)
    $pdfWait = $script:BalcaoAsTaskGeneric.MakeGenericMethod([Windows.Data.Pdf.PdfDocument]).Invoke($null, @($pdfTask))
    $pdfWait.Wait(20000) | Out-Null
    $pdf = $pdfWait.Result
    $total = [Math]::Min([int]$pdf.PageCount, 8)
    if ($total -lt 1) { throw "PDF sem paginas." }
    Write-Host "PDF com $total pagina(s)"
    $sheets = New-Object System.Collections.Generic.List[object]
    for ($i = 0; $i -lt $total; $i++) {
      $page = $pdf.GetPage([uint32]$i)
      $inchW = [double]$page.Size.Width / 96.0
      $inchH = [double]$page.Size.Height / 96.0
      $ras = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
      $options = New-Object Windows.Data.Pdf.PdfPageRenderOptions
      $options.DestinationWidth = [uint32]([Math]::Max(1, [Math]::Round($inchW * 300)))
      $options.DestinationHeight = [uint32]([Math]::Max(1, [Math]::Round($inchH * 300)))
      $render = $page.RenderToStreamAsync($ras, $options)
      $renderWait = $script:BalcaoAsTask.Invoke($null, @($render))
      $renderWait.Wait(20000) | Out-Null
      $ras.Seek(0)
      $size = [uint32]$ras.Size
      $reader = New-Object Windows.Storage.Streams.DataReader($ras.GetInputStreamAt(0))
      $load = $reader.LoadAsync($size)
      $loadWait = $script:BalcaoAsTaskGeneric.MakeGenericMethod([uint32]).Invoke($null, @($load))
      $loadWait.Wait(20000) | Out-Null
      $png = New-Object byte[] $size
      $reader.ReadBytes($png)
      $reader.Dispose()
      try { $page.Dispose() } catch { }
      try { $ras.Dispose() } catch { }
      Write-Host ("Pagina " + ($i + 1))
      $null = $sheets.Add(@{ Bytes = $png; W = $inchW; H = $inchH })
    }
    if ($copies -lt 1) { $copies = 1 }
    if ($copies -gt 10) { $copies = 10 }
    for ($copy = 1; $copy -le $copies; $copy++) {
      Write-Host "Copia $copy de $copies"
      foreach ($sheet in $sheets) {
        Send-ImageBytes $sheet.Bytes $printerName $sheet.W $sheet.H ("Balcao " + $copy)
        Start-Sleep -Milliseconds 700
      }
    }
  } finally {
    Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
  }
}

function Send-PrintBytes([byte[]]$bytes, [string]$printerName, [int]$copies) {
  if ($copies -lt 1) { $copies = 1 }
  if ($copies -gt 10) { $copies = 10 }
  if (Test-PdfBytes $bytes) {
    Send-PdfBytes $bytes $printerName $copies
    return
  }
  for ($copy = 1; $copy -le $copies; $copy++) {
    Write-Host "Copia $copy de $copies"
    Send-ImageBytes $bytes $printerName 0 0 ("Balcao " + $copy)
    if ($copy -lt $copies) { Start-Sleep -Milliseconds 700 }
  }
}

function Send-ImageBytes([byte[]]$bytes, [string]$printerName, [double]$inchW = 0, [double]$inchH = 0, [string]$docName = "Balcao") {
  $bmp = Convert-ToBitmap $bytes
  $doc = $null
  $script:BalcaoInchW = $inchW
  $script:BalcaoInchH = $inchH
  try {
    $script:BalcaoImage = $bmp
    $doc = New-Object System.Drawing.Printing.PrintDocument
    $doc.PrinterSettings.PrinterName = $printerName
    if (-not $doc.PrinterSettings.IsValid) { throw "A impressora '$printerName' nao esta disponivel." }
    $doc.DocumentName = $docName
    $doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController
    $sharp = $null
    foreach ($res in $doc.PrinterSettings.PrinterResolutions) {
      if ($res.X -ge 300 -and $res.X -le 600 -and (-not $sharp -or $res.X -gt $sharp.X)) { $sharp = $res }
    }
    if ($sharp) { $doc.DefaultPageSettings.PrinterResolution = $sharp }
    $hx = [int][Math]::Ceiling($doc.DefaultPageSettings.HardMarginX)
    $hy = [int][Math]::Ceiling($doc.DefaultPageSettings.HardMarginY)
    if ($hx -lt 8) { $hx = 8 }
    if ($hy -lt 8) { $hy = 8 }
    $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins($hx, $hx, $hy, $hy)
    $handler = {
      param($sender, $eventArgs)
      $g = $eventArgs.Graphics
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $area = $eventArgs.MarginBounds
      $pic = $script:BalcaoImage
      if ($script:BalcaoInchW -gt 0 -and $script:BalcaoInchH -gt 0) {
        $wantW = $script:BalcaoInchW * 100
        $wantH = $script:BalcaoInchH * 100
        $scale = [Math]::Min(1.0, [Math]::Min($area.Width / $wantW, $area.Height / $wantH))
        $w = [int]($wantW * $scale)
        $h = [int]($wantH * $scale)
      } else {
        $ratio = [Math]::Min($area.Width / $pic.Width, $area.Height / $pic.Height)
        $w = [int]($pic.Width * $ratio)
        $h = [int]($pic.Height * $ratio)
      }
      $x = $area.Left + [int](($area.Width - $w) / 2)
      $y = $area.Top + [int](($area.Height - $h) / 2)
      $dest = New-Object System.Drawing.Rectangle($x, $y, $w, $h)
      $g.DrawImage($pic, $dest)
      $eventArgs.HasMorePages = $false
    }
    $doc.add_PrintPage($handler)
    $doc.Print()
    $doc.remove_PrintPage($handler)
  } finally {
    if ($doc) { $doc.Dispose() }
    if ($bmp) { $bmp.Dispose() }
    $script:BalcaoImage = $null
    $script:BalcaoInchW = 0
    $script:BalcaoInchH = 0
  }
}

function New-TestPng([string]$printerName) {
  $bmp = New-Object System.Drawing.Bitmap 1000, 420
  $graphics = [System.Drawing.Graphics]::FromImage($bmp)
  $memory = New-Object System.IO.MemoryStream
  try {
    $graphics.Clear([System.Drawing.Color]::White)
    $font = New-Object System.Drawing.Font "Arial", 28
    $small = New-Object System.Drawing.Font "Arial", 18
    $graphics.DrawString("Balcao - teste da impressora", $font, [System.Drawing.Brushes]::Black, 40, 70)
    $graphics.DrawString((Get-Date).ToString("dd/MM/yyyy HH:mm"), $small, [System.Drawing.Brushes]::Black, 40, 160)
    $graphics.DrawString($printerName, $small, [System.Drawing.Brushes]::Black, 40, 220)
    $bmp.Save($memory, [System.Drawing.Imaging.ImageFormat]::Png)
    return $memory.ToArray()
  } finally {
    $graphics.Dispose()
    $bmp.Dispose()
    $memory.Dispose()
  }
}

function Read-Request([System.Net.Sockets.NetworkStream]$stream) {
  $stream.ReadTimeout = 2500
  $bucket = New-Object System.IO.MemoryStream
  $tmp = New-Object byte[] 16384
  $split = -1
  while ($split -lt 0 -and $bucket.Length -lt 65536) {
    try { $n = $stream.Read($tmp, 0, $tmp.Length) } catch { return $null }
    if ($n -le 0) { return $null }
    $bucket.Write($tmp, 0, $n)
    $raw = $bucket.ToArray()
    $limit = $raw.Length - 4
    for ($i = 0; $i -le $limit; $i++) {
      if ($raw[$i] -eq 13 -and $raw[$i + 1] -eq 10 -and $raw[$i + 2] -eq 13 -and $raw[$i + 3] -eq 10) {
        $split = $i
        break
      }
    }
  }
  if ($split -lt 0) { return $null }
  $raw = $bucket.ToArray()
  $headerText = [Text.Encoding]::ASCII.GetString($raw, 0, $split)
  $lines = $headerText -split "`r`n"
  $first = $lines[0].Split(" ")
  if ($first.Length -lt 2) { return $null }
  $length = 0
  $origin = "*"
  $expect = ""
  foreach ($line in $lines) {
    if ($line -match "^Content-Length:\s*(\d+)") { $length = [int]$Matches[1] }
    elseif ($line -match "^Origin:\s*(\S+)") { $origin = $Matches[1].Trim() }
    elseif ($line -match "^Expect:\s*(.+)$") { $expect = $Matches[1].Trim() }
  }
  if ($length -gt $MaxBody) { $length = -1 }
  $already = $raw.Length - ($split + 4)
  if ($expect -like "*100-continue*" -and $already -lt $length) {
    $go = [Text.Encoding]::ASCII.GetBytes("HTTP/1.1 100 Continue`r`n`r`n")
    $stream.Write($go, 0, $go.Length)
  }
  $bodyBytes = New-Object System.IO.MemoryStream
  if ($already -gt 0) { $bodyBytes.Write($raw, $split + 4, $already) }
  if ($length -gt 0) {
    $stream.ReadTimeout = 60000
    while ($bodyBytes.Length -lt $length) {
      $need = [Math]::Min(16384, $length - [int]$bodyBytes.Length)
      try { $n = $stream.Read($tmp, 0, $need) } catch { break }
      if ($n -le 0) { break }
      $bodyBytes.Write($tmp, 0, $n)
    }
  }
  return @{
    Method = $first[0].ToUpperInvariant()
    Path = $first[1].Split("?")[0]
    Origin = $origin
    Length = $length
    Body = [Text.Encoding]::UTF8.GetString($bodyBytes.ToArray())
    Got = [int]$bodyBytes.Length
  }
}

function Write-Http([System.Net.Sockets.NetworkStream]$stream, [int]$code, [string]$json, [string]$origin) {
  if (-not $origin) { $origin = "*" }
  $text = if ($code -eq 204) { "" } else { $json }
  $payload = [Text.Encoding]::UTF8.GetBytes($text)
  $reason = "OK"
  if ($code -eq 400) { $reason = "Bad Request" }
  elseif ($code -eq 404) { $reason = "Not Found" }
  elseif ($code -eq 500) { $reason = "Error" }
  elseif ($code -eq 204) { $reason = "No Content" }
  $head = "HTTP/1.1 $code $reason`r`nAccess-Control-Allow-Origin: $origin`r`nAccess-Control-Allow-Private-Network: true`r`nAccess-Control-Allow-Methods: GET, POST, OPTIONS`r`nAccess-Control-Allow-Headers: Content-Type`r`nAccess-Control-Max-Age: 600`r`nVary: Origin`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($payload.Length)`r`nConnection: close`r`n`r`n"
  $headBytes = [Text.Encoding]::ASCII.GetBytes($head)
  $stream.Write($headBytes, 0, $headBytes.Length)
  if ($payload.Length -gt 0) { $stream.Write($payload, 0, $payload.Length) }
}

function Handle-Client([System.Net.Sockets.TcpClient]$client) {
  $stream = $client.GetStream()
  $req = Read-Request $stream
  if (-not $req) { return }
  $origin = [string]$req.Origin
  Write-Host ("> " + $req.Method + " " + $req.Path)
  if ([int]$req.Length -lt 0) {
    Write-Http $stream 400 '{"ok":false,"error":"Arquivo grande demais."}' $origin
    return
  }
  if ($req.Method -eq "OPTIONS") {
    Write-Http $stream 204 "" $origin
    return
  }
  if ([int]$req.Length -gt 0 -and [int]$req.Got -lt [int]$req.Length) {
    Write-Http $stream 400 '{"ok":false,"error":"O arquivo nao chegou inteiro."}' $origin
    return
  }
  $body = [string]$req.Body
  try {
    if ($req.Method -eq "GET" -and $req.Path -eq "/health") {
      $printer = Get-SavedPrinter
      $json = (@{ ok = $true; printer = $printer } | ConvertTo-Json -Compress)
      Write-Http $stream 200 $json $origin
      return
    }
    if ($req.Method -eq "GET" -and $req.Path -eq "/printers") {
      $names = @(Get-PrinterNames)
      $current = Get-SavedPrinter | ConvertTo-Json -Compress
      $json = '{"printers":' + (Convert-NameList $names) + ',"current":' + $current + '}'
      Write-Http $stream 200 $json $origin
      return
    }
    if ($req.Method -eq "POST" -and $req.Path -eq "/printer") {
      $data = $body | ConvertFrom-Json
      Set-SavedPrinter ([string]$data.name)
      Write-Http $stream 200 '{"ok":true}' $origin
      Write-Host "Impressora escolhida: $($data.name)"
      return
    }
    if ($req.Method -eq "POST" -and $req.Path -eq "/test") {
      $printer = Get-SavedPrinter
      Write-Host "Teste em $printer"
      Send-ImageBytes (New-TestPng $printer) $printer
      Write-Http $stream 200 '{"ok":true}' $origin
      return
    }
    if ($req.Method -eq "POST" -and $req.Path -eq "/print") {
      $data = $body | ConvertFrom-Json
      $dataUrl = [string]$data.dataUrl
      $mark = $dataUrl.IndexOf(";base64,")
      if ($mark -lt 0) { throw "Arquivo sem imagem." }
      $bytes = [Convert]::FromBase64String($dataUrl.Substring($mark + 8))
      $printer = Get-SavedPrinter
      $copies = 1
      if ($data.copies) {
        $n = [int]$data.copies
        if ($n -ge 1 -and $n -le 10) { $copies = $n }
      }
      Write-Host "Imprimindo $copies copia(s) em $printer ($($bytes.Length) bytes)"
      Send-PrintBytes $bytes $printer $copies
      Write-Http $stream 200 '{"ok":true}' $origin
      return
    }
    Write-Http $stream 404 '{"ok":false,"error":"Nao achei."}' $origin
  } catch {
    $msg = $_.Exception.Message.Replace("\", "\\").Replace('"', "'")
    Write-Host "Erro: $msg"
    try { Write-Http $stream 500 (@{ ok = $false; error = $msg } | ConvertTo-Json -Compress) $origin } catch { }
  }
}

$startup = [Environment]::GetFolderPath("Startup")
$link = Join-Path $startup "Balcao Impressora.lnk"
if (-not (Test-Path -LiteralPath $link)) {
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($link)
  $shortcut.TargetPath = "powershell.exe"
  $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Minimized -File `"$PSCommandPath`""
  $shortcut.WorkingDirectory = $Dir
  $shortcut.Save()
}

function Stop-OldBalcao {
  $lines = netstat -ano -p tcp | Select-String "127.0.0.1:$Port\s"
  $ids = @()
  foreach ($line in $lines) {
    $parts = ($line.ToString().Trim() -split "\s+")
    $procId = $parts[-1]
    if ($procId -match "^\d+$" -and [int]$procId -ne $PID) { $ids += [int]$procId }
  }
  foreach ($procId in ($ids | Select-Object -Unique)) {
    try {
      $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$procId"
      $cmd = [string]$proc.CommandLine
      if ($cmd -like "*Balcao-Impressora*") {
        Write-Host "Fechei a janela antiga do programa."
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
      }
    } catch { }
  }
  Start-Sleep -Milliseconds 700
}

Stop-OldBalcao
$listener = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Parse("127.0.0.1"), $Port)
try {
  $listener.Start()
} catch {
  Write-Host "A porta da impressora ja esta em uso por outro programa."
  Write-Host "Feche as janelas pretas do Balcao e abra esta de novo."
  exit 1
}
Write-Host "Balcao impressora 10 ligado em 127.0.0.1:$Port"
Write-Host "Impressora: $(Get-SavedPrinter)"
Write-Host "Deixe esta janela aberta."
while ($true) {
  $client = $listener.AcceptTcpClient()
  try { Handle-Client $client } catch { } finally { $client.Close() }
}
