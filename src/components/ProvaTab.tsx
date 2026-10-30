import { useEffect, useRef, useState } from "react";
import {
  Mic,
  Square,
  Upload,
  Image as ImageIcon,
  FileText,
  Send,
  Trash2,
  Sparkles,
  Receipt,
  Headphones,
  Info,
} from "lucide-react";
import type { ChatMessage, Desk } from "@/types/balcao";
import { bytesToBase64, downsample, encodeWavPCM } from "@/utils/wav";
import { Bubbles } from "./Bubbles";
import { btnGhost, btnPrimary, btnClay, inputClass } from "./Ui";

interface ProvaTabProps {
  desk: Desk;
  messages: ChatMessage[];
  onSendUserMessage: (payload: {
    text: string;
    attachment?: { kind: "audio" | "image" | "pdf"; base64: string; mime: string; filename: string };
  }) => Promise<void>;
  onClearProva: () => void;
}

export function ProvaTab({ desk, messages, onSendUserMessage, onClearProva }: ProvaTabProps) {
  const [text, setText] = useState("");
  const [busyState, setBusyState] = useState<string>("");
  const [err, setErr] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const chunksRef = useRef<Float32Array[]>([]);
  const audioContextRef = useRef<{ ctx: AudioContext; stream: MediaStream } | null>(null);
  const timerRef = useRef<number | null>(null);

  // Audio recording toggle
  async function toggleRecording() {
    if (isRecording && audioContextRef.current) {
      // Stop recording
      if (timerRef.current) window.clearInterval(timerRef.current);
      const { ctx, stream } = audioContextRef.current;
      const rate = ctx.sampleRate;
      stream.getTracks().forEach((track) => track.stop());
      await ctx.close().catch(() => {});
      audioContextRef.current = null;
      setIsRecording(false);
      setRecordingSeconds(0);

      const length = chunksRef.current.reduce((sum, chunk) => sum + chunk.length, 0);
      const merged = new Float32Array(length);
      let offset = 0;
      for (const chunk of chunksRef.current) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      chunksRef.current = [];

      if (merged.length < rate / 4) {
        setErr("Áudio muito curto (mínimo 1 segundo).");
        return;
      }

      setBusyState("Ouvindo áudio e pensando…");
      try {
        const wav = encodeWavPCM(downsample(merged, rate, 16000), 16000);
        await onSendUserMessage({
          text: "",
          attachment: {
            kind: "audio",
            base64: bytesToBase64(wav),
            mime: "audio/wav",
            filename: "audio_gravado.wav",
          },
        });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Erro ao processar áudio.");
      } finally {
        setBusyState("");
      }
      return;
    }

    // Start recording
    try {
      setErr("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      await ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      processor.onaudioprocess = (event) => {
        chunksRef.current.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(gain);
      gain.connect(ctx.destination);
      audioContextRef.current = { ctx, stream };
      chunksRef.current = [];
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      setErr("Microfone não disponível ou permissão negada. Use os testes de áudio simulados abaixo!");
      setIsRecording(false);
    }
  }

  async function handleSendText() {
    if (!text.trim() || busyState) return;
    const toSend = text;
    setText("");
    setBusyState("Pensando na resposta…");
    try {
      await onSendUserMessage({ text: toSend });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao enviar.");
    } finally {
      setBusyState("");
    }
  }

  async function handleFileUpload(file: File, kind: "image" | "pdf") {
    setBusyState(kind === "image" ? "Analisando foto..." : "Lendo documento...");
    try {
      const base64 = await fileToBase64(file);
      await onSendUserMessage({
        text: "",
        attachment: {
          kind,
          base64,
          mime: file.type || (kind === "pdf" ? "application/pdf" : "image/jpeg"),
          filename: file.name,
        },
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao enviar arquivo.");
    } finally {
      setBusyState("");
    }
  }

  // Pre-configured simulation tests for quick evaluation
  async function simulatePreset(type: "pix_correto" | "pix_divergente" | "audio_pergunta" | "pdf_trabalho") {
    setBusyState("Simulando envio do cliente…");
    try {
      if (type === "pix_correto") {
        await onSendUserMessage({
          text: "Acabei de fazer o Pix de 25 reais para pagar as cópias. Segue o comprovante em anexo!",
          attachment: {
            kind: "image",
            base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            mime: "image/png",
            filename: "comprovante_pix_25reais.png",
          },
        });
      } else if (type === "pix_divergente") {
        await onSendUserMessage({
          text: "Mandei o Pix de R$ 50,00 aqui!",
          attachment: {
            kind: "image",
            base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            mime: "image/png",
            filename: "comprovante_pix_divergente.png",
          },
        });
      } else if (type === "audio_pergunta") {
        await onSendUserMessage({
          text: "Opa bom dia, vocês abrem hoje no feriado? Preciso imprimir um boleto com urgência.",
          attachment: {
            kind: "audio",
            base64: "UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=",
            mime: "audio/wav",
            filename: "audio_pergunta.wav",
          },
        });
      } else if (type === "pdf_trabalho") {
        await onSendUserMessage({
          text: "Olá! Gostaria de imprimir esse documento em PDF, são 15 páginas frente e verso. Quanto fica?",
          attachment: {
            kind: "pdf",
            base64: "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCg==",
            mime: "application/pdf",
            filename: "Trabalho_Academico_15pag.pdf",
          },
        });
      }
    } finally {
      setBusyState("");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Intro box */}
      <section className="rounded-2xl border border-line bg-surface p-4 shadow-xs">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-pine/10 text-pine">
                <Sparkles size={14} />
              </span>
              <h2 className="font-display text-xl font-bold text-ink">Prova do Atendente</h2>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Teste o atendente como se você fosse um cliente real no WhatsApp. Envie mensagens de texto, fale pelo microfone, envie fotos de comprovantes Pix ou documentos PDF. Nada do que você mandar aqui sai para clientes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClearProva}
            className="flex items-center gap-1 rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs text-muted hover:text-clay hover:border-clay/40 transition shrink-0"
            title="Limpar mensagens do teste"
          >
            <Trash2 size={13} />
            <span className="hidden sm:inline">Limpar</span>
          </button>
        </div>
      </section>

      {/* Chat messages viewport */}
      <div className="rounded-2xl border border-line bg-[#efeae2]/50 p-4 shadow-inner min-h-[340px]">
        <Bubbles messages={messages} timeZone={desk.shop.timezone} />
        {busyState && (
          <div className="flex items-center gap-2 text-xs text-pine font-medium p-2">
            <span className="h-2 w-2 rounded-full bg-pine animate-ping" />
            <span>{busyState}</span>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="rounded-2xl border border-line bg-surface p-3.5 shadow-xs flex flex-col gap-3">
        <div className="flex gap-2">
          <textarea
            className={inputClass}
            rows={2}
            value={text}
            placeholder="Digite como um cliente (ex: 'Quanto custa a xerox colorida?')"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSendText();
              }
            }}
          />
          <button
            type="button"
            disabled={!text.trim() || Boolean(busyState)}
            onClick={() => void handleSendText()}
            className="flex h-auto w-12 shrink-0 items-center justify-center rounded-xl bg-pine text-pine-ink transition hover:bg-pine/90 disabled:opacity-50"
            title="Enviar mensagem"
          >
            <Send size={18} />
          </button>
        </div>

        {/* Media action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Audio recording */}
          <button
            type="button"
            onClick={() => void toggleRecording()}
            className={
              isRecording
                ? "inline-flex min-h-11 items-center gap-2 rounded-xl bg-clay px-4 text-xs font-semibold text-clay-ink animate-pulse"
                : btnGhost
            }
          >
            {isRecording ? (
              <>
                <Square size={14} className="fill-current" />
                <span>Parar ({recordingSeconds}s) e enviar</span>
              </>
            ) : (
              <>
                <Mic size={15} className="text-pine" />
                <span>Gravar áudio</span>
              </>
            )}
          </button>

          {/* Photo upload */}
          <label className={`${btnGhost} cursor-pointer`}>
            <ImageIcon size={15} className="text-pine" />
            <span>Enviar foto</span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void handleFileUpload(f, "image");
              }}
            />
          </label>

          {/* PDF upload */}
          <label className={`${btnGhost} cursor-pointer`}>
            <FileText size={15} className="text-clay" />
            <span>Enviar PDF</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void handleFileUpload(f, "pdf");
              }}
            />
          </label>
        </div>

        {/* Quick Test Presets (1-click testing) */}
        <div className="border-t border-line/60 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Testes com 1 clique:
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => void simulatePreset("pix_correto")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-sand/70 px-2.5 py-1 text-xs text-ink hover:border-pine hover:bg-moss/40 transition"
            >
              <Receipt size={13} className="text-pine" />
              <span>🧾 Pix R$ 25 (Correto)</span>
            </button>

            <button
              type="button"
              onClick={() => void simulatePreset("pix_divergente")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-sand/70 px-2.5 py-1 text-xs text-ink hover:border-clay hover:bg-clay/10 transition"
            >
              <Receipt size={13} className="text-clay" />
              <span>⚠️ Pix R$ 50 (Divergente)</span>
            </button>

            <button
              type="button"
              onClick={() => void simulatePreset("audio_pergunta")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-sand/70 px-2.5 py-1 text-xs text-ink hover:border-pine hover:bg-moss/40 transition"
            >
              <Headphones size={13} className="text-pine" />
              <span>🎙️ Simular áudio de cliente</span>
            </button>

            <button
              type="button"
              onClick={() => void simulatePreset("pdf_trabalho")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-sand/70 px-2.5 py-1 text-xs text-ink hover:border-pine hover:bg-moss/40 transition"
            >
              <FileText size={13} className="text-muted" />
              <span>📄 Simular PDF para impressão</span>
            </button>
          </div>
        </div>

        {err && <p className="text-xs text-warn bg-warn-bg p-2 rounded-lg">{err}</p>}
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const comma = res.indexOf(",");
      resolve(comma >= 0 ? res.slice(comma + 1) : res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
