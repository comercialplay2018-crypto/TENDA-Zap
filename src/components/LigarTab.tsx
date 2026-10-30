import { useEffect, useState } from "react";
import {
  Cable,
  Check,
  Copy,
  QrCode,
  Smartphone,
  Send,
  RefreshCw,
  Power,
  ShieldCheck,
  ExternalLink,
  Sparkles,
  KeyRound,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import type { Desk, WaLinkStatus } from "@/types/balcao";
import { Card, Field, btnGhost, btnPrimary, btnClay, inputClass } from "./Ui";

interface LigarTabProps {
  desk: Desk;
  linkStatus: WaLinkStatus;
  onUpdateLinkStatus: (updater: (prev: WaLinkStatus) => WaLinkStatus) => void;
  onSaveCloudConnection: (conn: Desk["connection"]) => void;
}

export function LigarTab({
  desk,
  linkStatus,
  onUpdateLinkStatus,
  onSaveCloudConnection,
}: LigarTabProps) {
  const [isStartingWa, setIsStartingWa] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [pairingPhone, setPairingPhone] = useState("");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Test send states
  const [testTo, setTestTo] = useState("5511999998888");
  const [testText, setTestText] = useState("Oi! Teste de envio do atendente Balcão.");
  const [testResult, setTestResult] = useState<string>("");
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Cloud API states
  const [phoneNumberId, setPhoneNumberId] = useState(desk.connection.phoneNumberId);
  const [displayPhone, setDisplayPhone] = useState(desk.connection.displayPhone);
  const [verifyToken, setVerifyToken] = useState(desk.connection.verifyToken);
  const [accessToken, setAccessToken] = useState("");
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [cloudSaved, setCloudSaved] = useState(false);

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/whatsapp/webhook/${desk.connection.verifyToken}`
      : `/api/whatsapp/webhook/${desk.connection.verifyToken}`;

  // Poll server for live WhatsApp connection status every 2 seconds
  useEffect(() => {
    let active = true;

    async function checkStatus() {
      try {
        const res = await fetch("/api/whatsapp/status");
        if (res.ok && active) {
          const data = await res.json();
          onUpdateLinkStatus((prev) => ({
            ...prev,
            status: data.status || prev.status,
            qrDataUrl: data.qrDataUrl,
            phone: data.phone || prev.phone,
            note: data.note || prev.note,
          }));
          if (data.pairingCode) {
            setPairingCode(data.pairingCode);
          }
        }
      } catch {
        // server might be booting
      }
    }

    checkStatus();
    const timer = window.setInterval(checkStatus, 2000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [onUpdateLinkStatus]);

  // Start real Baileys connection on the server for QR Code
  async function handleStartRealQr() {
    setIsStartingWa(true);
    setPairingCode(null);
    onUpdateLinkStatus((prev) => ({
      ...prev,
      status: "connecting",
      note: "Conectando aos servidores do WhatsApp para gerar um QR Code criptográfico autêntico...",
    }));

    try {
      const res = await fetch("/api/whatsapp/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ desk }),
      });
      if (res.ok) {
        const data = await res.json();
        onUpdateLinkStatus((prev) => ({
          ...prev,
          status: data.status || prev.status,
          qrDataUrl: data.qrDataUrl,
          phone: data.phone || prev.phone,
          note: data.note || prev.note,
        }));
      }
    } catch (e: any) {
      onUpdateLinkStatus((prev) => ({
        ...prev,
        status: "off",
        note: `Erro ao iniciar WhatsApp: ${e?.message || "falha de rede"}`,
      }));
    } finally {
      setIsStartingWa(false);
    }
  }

  // Request 8-digit Pairing Code without needing a camera
  async function handleRequestPairingCode() {
    if (!pairingPhone.trim()) return;
    setIsRequestingCode(true);
    setPairingCode(null);
    onUpdateLinkStatus((prev) => ({
      ...prev,
      status: "connecting",
      note: `Solicitando código de pareamento de 8 dígitos para o número ${pairingPhone}...`,
    }));

    try {
      const res = await fetch("/api/whatsapp/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: pairingPhone, desk }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.pairingCode) {
          setPairingCode(data.pairingCode);
        }
        onUpdateLinkStatus((prev) => ({
          ...prev,
          status: data.status || prev.status,
          qrDataUrl: data.qrDataUrl,
          phone: data.phone || prev.phone,
          note: data.note || prev.note,
        }));
      }
    } catch (e: any) {
      onUpdateLinkStatus((prev) => ({
        ...prev,
        status: "off",
        note: `Erro ao gerar código: ${e?.message || "falha"}`,
      }));
    } finally {
      setIsRequestingCode(false);
    }
  }

  // Disconnect WhatsApp
  async function handleDisconnect() {
    setIsDisconnecting(true);
    try {
      await fetch("/api/whatsapp/stop", { method: "POST" });
      onUpdateLinkStatus(() => ({
        status: "off",
        qrDataUrl: null,
        phone: "",
        note: "WhatsApp desconectado com sucesso.",
      }));
      setPairingCode(null);
    } catch {
      // fallback
    } finally {
      setIsDisconnecting(false);
    }
  }

  // Simulate instant pairing for preview demonstration
  function handleSimulateConnect() {
    onUpdateLinkStatus(() => ({
      status: "open",
      qrDataUrl: null,
      phone: "5511987654321",
      note: "Conectado como aparelho de WhatsApp comercial da loja.",
    }));
  }

  async function handleSendTest() {
    if (!testTo.trim() || !testText.trim()) return;
    setIsSendingTest(true);
    setTestResult("");
    try {
      const res = await fetch("/api/whatsapp/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo, text: testText }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResult(`Mensagem enviada com sucesso para ${testTo}!`);
      } else {
        setTestResult(data.error || "Não foi possível enviar.");
      }
    } catch (e: any) {
      setTestResult(e?.message || "Erro ao conectar com servidor.");
    } finally {
      setIsSendingTest(false);
      setTimeout(() => setTestResult(""), 5000);
    }
  }

  function handleSaveCloud() {
    onSaveCloudConnection({
      phoneNumberId,
      displayPhone,
      verifyToken,
      tokenSet: Boolean(accessToken) || desk.connection.tokenSet,
      tokenTail: accessToken ? accessToken.slice(-4) : desk.connection.tokenTail,
      secretSet: desk.connection.secretSet,
    });
    setCloudSaved(true);
    setTimeout(() => setCloudSaved(false), 2500);
  }

  function copyWebhook() {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  }

  function copyPairingCode() {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* WhatsApp Web Connection (QR Code & Pairing Code) */}
      <Card
        title="Ligar WhatsApp do Comércio"
        hint="O Balcão funciona como um Aparelho Conectado (WhatsApp Web). Você continua usando o WhatsApp normalmente no celular e a IA atende os clientes em tempo real."
      >
        <div className="flex items-center gap-2">
          <span
            className={`flex h-2.5 w-2.5 rounded-full ${
              linkStatus.status === "open"
                ? "bg-pine"
                : linkStatus.status === "qr"
                ? "bg-warn animate-pulse"
                : linkStatus.status === "connecting"
                ? "bg-warn animate-ping"
                : "bg-clay"
            }`}
          />
          <span className="text-xs font-semibold text-ink">
            {linkStatus.status === "open"
              ? `Conectado no número +${linkStatus.phone || "5511987654321"}`
              : linkStatus.status === "qr"
              ? "Aguardando leitura do QR Code"
              : linkStatus.status === "connecting"
              ? "Conectando ao WhatsApp..."
              : "WhatsApp Desconectado"}
          </span>
        </div>

        <p className="text-xs leading-relaxed text-muted">{linkStatus.note}</p>

        {/* Connected Banner with Auto-Reconnect Info */}
        {linkStatus.status === "open" && (
          <div className="my-3 rounded-2xl border border-pine/30 bg-moss/60 p-4 shadow-2xs">
            <div className="flex items-center gap-2 text-pine font-semibold text-sm">
              <ShieldCheck size={18} />
              <span>Conexão Permanente &amp; Reconexão Automática Ativa</span>
            </div>
            <p className="mt-1 text-xs text-ink/80 leading-relaxed">
              As credenciais do seu WhatsApp estão salvas com segurança. Se houver oscilação de internet ou o servidor reiniciar, o Balcão <strong>reconecta sozinho automaticamente</strong> sem precisar escanear o QR Code de novo.
            </p>
          </div>
        )}

        {/* Stable Real QR Code Display */}
        {linkStatus.status !== "open" && linkStatus.qrDataUrl && (
          <div className="mx-auto my-3 flex flex-col items-center gap-2.5 rounded-2xl border border-line bg-surface p-4 shadow-sm animate-fade-in">
            <span className="text-xs font-semibold text-pine flex items-center gap-1">
              <ShieldCheck size={14} /> QR Code Oficial Gerado com Sucesso
            </span>
            <div className="relative">
              <img
                src={linkStatus.qrDataUrl}
                alt="QR Code WhatsApp Web Oficial"
                className="h-60 w-60 rounded-xl border border-line p-2 shadow-xs bg-white"
              />
            </div>
            <div className="text-center text-xs leading-relaxed text-ink max-w-sm">
              <p className="font-semibold text-pine">Passo a passo no seu celular:</p>
              <ol className="list-decimal list-inside text-left mt-1 text-muted space-y-0.5">
                <li>Abra o <strong>WhatsApp</strong> no celular</li>
                <li>Toque nos <strong>3 pontinhos</strong> (Android) ou <strong>Configurações</strong> (iPhone)</li>
                <li>Toque em <strong>Aparelhos conectados</strong></li>
                <li>Toque no botão verde <strong>Conectar um aparelho</strong></li>
                <li>Aponte a câmera para este QR Code</li>
              </ol>
            </div>
          </div>
        )}

        {/* 8-Digit Pairing Code Display */}
        {pairingCode && (
          <div className="my-2 rounded-2xl border border-pine/30 bg-moss/70 p-4 text-center">
            <span className="text-xs font-semibold text-pine flex items-center justify-center gap-1">
              <KeyRound size={15} /> Código de Pareamento de 8 Dígitos:
            </span>
            <div className="my-2 flex items-center justify-center gap-2">
              <span className="font-mono text-3xl font-extrabold tracking-widest text-ink bg-surface px-4 py-1.5 rounded-xl border border-pine/40 shadow-xs">
                {pairingCode}
              </span>
              <button
                type="button"
                onClick={copyPairingCode}
                className="rounded-xl border border-line bg-surface p-2 text-ink hover:bg-sand transition"
                title="Copiar código"
              >
                {copiedCode ? <Check size={18} className="text-pine" /> : <Copy size={18} />}
              </button>
            </div>
            <p className="text-xs text-ink/80 leading-relaxed max-w-md mx-auto">
              No seu celular: Abra <strong>Aparelhos Conectados</strong> &gt; toque em <strong>Conectar com número de telefone</strong> &gt; digite este código acima!
            </p>
          </div>
        )}

        {/* Connection Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {linkStatus.status === "open" ? (
            <button
              type="button"
              className={btnGhost}
              disabled={isDisconnecting}
              onClick={handleDisconnect}
            >
              <Power size={14} className="text-clay" />
              <span>{isDisconnecting ? "Desconectando..." : "Desconectar WhatsApp"}</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                className={btnPrimary}
                disabled={isStartingWa}
                onClick={handleStartRealQr}
              >
                <QrCode size={15} />
                <span>{isStartingWa ? "Conectando ao WhatsApp..." : "Gerar QR Code Real"}</span>
              </button>

              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-sand px-4 text-xs font-semibold text-ink hover:bg-line/70 transition"
                onClick={handleSimulateConnect}
                title="Simula a conexão para teste imediato de interface"
              >
                <Sparkles size={14} className="text-pine" />
                <span>Simular Conexão (Demonstração)</span>
              </button>
            </>
          )}
        </div>

        {/* Alternative: Connect via Phone Number & 8-Digit Code */}
        {linkStatus.status !== "open" && (
          <div className="mt-4 border-t border-line/60 pt-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-ink mb-1.5">
              <Smartphone size={14} className="text-pine" />
              <span>Não quer usar a câmera? Conecte por Código de 8 Dígitos:</span>
            </div>
            <p className="text-xs text-muted mb-2">
              Digite seu número com DDI e DDD (ex: 5511999998888). O WhatsApp gera um código que você digita direto no celular.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                className={inputClass}
                placeholder="Ex: 5511999998888"
                value={pairingPhone}
                onChange={(e) => setPairingPhone(e.target.value)}
              />
              <button
                type="button"
                className={`${btnGhost} shrink-0 text-xs font-semibold`}
                disabled={isRequestingCode || !pairingPhone.trim()}
                onClick={handleRequestPairingCode}
              >
                <KeyRound size={14} />
                <span>{isRequestingCode ? "Gerando..." : "Gerar Código"}</span>
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Test Message Sending */}
      <Card
        title="Teste de Envio de Mensagem"
        hint="Envie uma mensagem de teste para qualquer número para verificar o envio do WhatsApp."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Número com DDI e DDD">
            <input
              type="text"
              className={inputClass}
              placeholder="Ex: 5511999998888"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
          </Field>
          <Field label="Mensagem de teste">
            <input
              type="text"
              className={inputClass}
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
            />
          </Field>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            className={btnPrimary}
            disabled={isSendingTest || !testTo.trim()}
            onClick={handleSendTest}
          >
            <Send size={15} />
            <span>{isSendingTest ? "Enviando…" : "Enviar mensagem de teste"}</span>
          </button>
          {testResult && (
            <span className="text-xs font-semibold text-pine flex items-center gap-1">
              <Check size={14} /> {testResult}
            </span>
          )}
        </div>
      </Card>

      {/* Meta WhatsApp Cloud API (Alternative) */}
      <Card
        title="WhatsApp Cloud API (Meta Oficial)"
        hint="Caso prefira usar a API Oficial da Meta / Facebook em vez do pareamento Web por QR Code."
      >
        <div className="rounded-xl border border-line bg-sand/60 p-3">
          <span className="block text-xs font-semibold text-ink mb-1">URL de Webhook gerada:</span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={webhookUrl}
              className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 font-mono text-xs text-muted"
            />
            <button
              type="button"
              onClick={copyWebhook}
              className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-sand transition shrink-0"
            >
              {copiedWebhook ? <Check size={13} className="text-pine" /> : <Copy size={13} />}
              <span>{copiedWebhook ? "Copiado!" : "Copiar"}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
          <Field label="Phone Number ID (Meta)">
            <input
              type="text"
              className={inputClass}
              value={phoneNumberId}
              placeholder="Ex: 109283746592817"
              onChange={(e) => setPhoneNumberId(e.target.value)}
            />
          </Field>
          <Field label="Telefone de exibição">
            <input
              type="text"
              className={inputClass}
              value={displayPhone}
              placeholder="Ex: +55 (11) 98765-4321"
              onChange={(e) => setDisplayPhone(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Token de Verificação do Webhook">
          <input
            type="text"
            className={inputClass}
            value={verifyToken}
            onChange={(e) => setVerifyToken(e.target.value)}
          />
        </Field>

        <Field label="Access Token Permanente (Meta Graph API)" hint="Fica protegido">
          <input
            type="password"
            className={inputClass}
            placeholder={desk.connection.tokenSet ? `Token configurado (termina em ...${desk.connection.tokenTail})` : "Cole seu token aqui"}
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
          />
        </Field>

        <div className="flex items-center gap-3 pt-1">
          <button type="button" className={btnPrimary} onClick={handleSaveCloud}>
            Salvar configurações da Meta
          </button>
          {cloudSaved && (
            <span className="text-xs font-semibold text-pine flex items-center gap-1">
              <Check size={14} /> Salvo com sucesso!
            </span>
          )}
        </div>
      </Card>

      {/* Version and System Info Footer */}
      <div className="flex items-center justify-between px-2 pt-1 text-[11px] text-muted">
        <span>Balcão · Atendente WhatsApp com Inteligência Artificial</span>
        <span className="inline-flex items-center gap-1 rounded-md bg-sand px-2 py-0.5 font-mono text-[10px] font-semibold text-ink">
          <span className="h-1.5 w-1.5 rounded-full bg-pine" />
          Build v2.4.0 (Vercel Ready)
        </span>
      </div>
    </div>
  );
}
