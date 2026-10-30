@echo off
setlocal
set "DIR=%LOCALAPPDATA%\Balcao"
if not exist "%DIR%" mkdir "%DIR%"
set "SRC=%~dp0Balcao-Impressora.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -Uri 'https://tendajl-automatic.grok.me/impressora/Balcao-Impressora.ps1' -OutFile '%DIR%\Balcao-Impressora.ps1' } catch { exit 1 }"
if errorlevel 1 (
  if exist "%SRC%" (
    copy /Y "%SRC%" "%DIR%\Balcao-Impressora.ps1" >nul
  ) else (
    echo Nao consegui baixar o programa novo. Publique o Balcao e tente de novo.
    pause
    exit /b 1
  )
)
powershell -NoProfile -ExecutionPolicy Bypass -STA -File "%DIR%\Balcao-Impressora.ps1"
echo.
echo O programa parou. Abra de novo para a impressora voltar.
pause