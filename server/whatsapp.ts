import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  Browsers,
  type WASocket,
  type proto,
} from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";
import { GoogleGenAI } from "@google/genai";

export type WaStatus = "off" | "qr" | "connecting" | "open";

export interface WaLinkState {
  status: WaStatus;
  qrDataUrl: string | null;
  phone: string;
  note: string;
  pairingCode?: string | null;
}

export interface StoredThread {
  id: number;
  waId: string;
  remoteJid: string;
  name: string;
  botPaused: boolean;
  preview: string;
  updatedAt: string;
  unreadCount: number;
}

export interface StoredMessage {
  id: number;
  contactId: number;
  direction: "in" | "out";
  kind: "text" | "audio" | "image" | "pdf" | "nota";
  body: string;
  mediaUrl?: string;
  filename?: string;
  audioDuration?: number;
  createdAt: string;
}

export interface StoredReceipt {
  id: number;
  contactId: number | null;
  contactName: string;
  waId: string;
  payerName: string;
  favorecido: string;
  banco: string;
  amountCents: number | null;
  paidAtText: string;
  paidDate: string;
  e2eId: string;
  confidence: string;
  nameMatches: boolean | null;
  decision: string;
  status: "liberado" | "duvida" | "recusado" | "conferido" | "nao_caiu";
  note: string;
  mediaDataUrl: string | null;
  createdAt: string;
}

const DATA_DIR = process.env.VERCEL
  ? path.resolve("/tmp", "balcao-data")
  : path.resolve(process.cwd(), "data");
const AUTH_DIR = path.resolve(DATA_DIR, "wa-auth");
const STORE_FILE = path.resolve(DATA_DIR, "wa-store.json");

class WhatsAppManager {
  private sock: WASocket | null = null;
  private status: WaStatus = "off";
  private qrDataUrl: string | null = null;
  private phone = "";
  private note = "Ainda não conectado ao WhatsApp. Escaneie o QR Code ou use código de 8 dígitos.";
  private pairingCode: string | null = null;
  private isStarting = false;
  private isRegistered = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  private deskGetter: (() => any) | null = null;
  private replyGenerator: ((input: any) => Promise<string>) | null = null;
  private pixAnalyzer: ((input: any) => Promise<any>) | null = null;

  // Real WhatsApp Conversations & Receipts store
  private threads: StoredThread[] = [];
  private messagesMap: Record<number, StoredMessage[]> = {};
  private receipts: StoredReceipt[] = [];

  constructor() {
    this.ensureDirs().then(async () => {
      await this.loadStore();
      await this.autoConnectIfSaved();
    });
  }

  private async ensureDirs() {
    try {
      if (!existsSync(AUTH_DIR)) {
        await mkdir(AUTH_DIR, { recursive: true });
      }
    } catch (e) {
      console.warn("[WhatsApp] Could not create dirs:", e);
    }
  }

  // Auto-reconnect on server startup if credentials are already registered
  private async autoConnectIfSaved() {
    try {
      const credsFile = path.join(AUTH_DIR, "creds.json");
      if (existsSync(credsFile)) {
        const raw = JSON.parse(await readFile(credsFile, "utf-8"));
        if (raw && (raw.registered || raw.me)) {
          this.isRegistered = true;
          this.status = "connecting";
          this.note = "Sessão salva encontrada. Reconectando automaticamente ao seu WhatsApp...";
          console.log("[WhatsApp] Sessão existente no disco detectada. Reconectando sem QR Code...");
          void this.start();
        }
      }
    } catch (e) {
      console.warn("[WhatsApp] Erro ao verificar credenciais salvas:", e);
    }
  }

  private async loadStore() {
    try {
      if (existsSync(STORE_FILE)) {
        const raw = await readFile(STORE_FILE, "utf-8");
        const data = JSON.parse(raw);
        this.threads = Array.isArray(data.threads) ? data.threads : [];
        this.messagesMap = data.messagesMap && typeof data.messagesMap === "object" ? data.messagesMap : {};
        this.receipts = Array.isArray(data.receipts) ? data.receipts : [];

        // Purge any accidental mock threads from previous tests
        const mockNames = ["mariana santos", "carlos mecânica", "dra. juliana", "roberto silva"];
        this.threads = this.threads.filter(
          (t) => !mockNames.some((m) => t.name.toLowerCase().includes(m))
        );
      }
    } catch (e) {
      console.warn("[WhatsApp] Could not load wa-store.json:", e);
    }
  }

  private async saveStore() {
    try {
      await writeFile(
        STORE_FILE,
        JSON.stringify(
          {
            threads: this.threads,
            messagesMap: this.messagesMap,
            receipts: this.receipts,
          },
          null,
          2
        )
      );
    } catch (e) {
      console.warn("[WhatsApp] Could not save wa-store.json:", e);
    }
  }

  public setAiCallbacks(
    deskGetter: () => any,
    replyGenerator: (input: any) => Promise<string>,
    pixAnalyzer?: (input: any) => Promise<any>
  ) {
    this.deskGetter = deskGetter;
    this.replyGenerator = replyGenerator;
    if (pixAnalyzer) this.pixAnalyzer = pixAnalyzer;
  }

  public getState(): WaLinkState {
    return {
      status: this.status,
      qrDataUrl: this.qrDataUrl,
      phone: this.phone,
      note: this.note,
      pairingCode: this.pairingCode,
    };
  }

  public getRealThreads(): StoredThread[] {
    return this.threads;
  }

  public getRealMessages(contactId: number): StoredMessage[] {
    return this.messagesMap[contactId] || [];
  }

  public getRealReceipts(): StoredReceipt[] {
    return this.receipts;
  }

  public updateReceiptStatus(id: number, status: StoredReceipt["status"]) {
    this.receipts = this.receipts.map((r) => (r.id === id ? { ...r, status } : r));
    void this.saveStore();
  }

  public toggleBotPause(contactId: number, paused: boolean): boolean {
    const thread = this.threads.find((t) => t.id === contactId);
    if (!thread) return false;
    thread.botPaused = paused;

    const noteMsg: StoredMessage = {
      id: Date.now(),
      contactId,
      direction: "out",
      kind: "nota",
      body: paused
        ? "Nota do sistema: Você assumiu esta conversa. O atendente automático não responderá a este cliente."
        : "Nota do sistema: Atendimento devolvido para a IA.",
      createdAt: new Date().toISOString(),
    };

    if (!this.messagesMap[contactId]) this.messagesMap[contactId] = [];
    this.messagesMap[contactId].push(noteMsg);
    void this.saveStore();
    return true;
  }

  public async sendManualMessage(contactId: number, text: string): Promise<{ ok: boolean; error?: string }> {
    const thread = this.threads.find((t) => t.id === contactId);
    if (!thread) return { ok: false, error: "Conversa não encontrada." };

    if (!this.sock || this.status !== "open") {
      return { ok: false, error: "O WhatsApp não está conectado no momento. Verifique na aba Conectar." };
    }

    const jid = thread.remoteJid || `${thread.waId}@s.whatsapp.net`;
    try {
      await this.sock.sendMessage(jid, { text: text.trim() });

      const outMsg: StoredMessage = {
        id: Date.now(),
        contactId,
        direction: "out",
        kind: "text",
        body: text.trim(),
        createdAt: new Date().toISOString(),
      };

      if (!this.messagesMap[contactId]) this.messagesMap[contactId] = [];
      this.messagesMap[contactId].push(outMsg);
      thread.preview = text.trim();
      thread.updatedAt = new Date().toISOString();
      thread.unreadCount = 0;
      void this.saveStore();
      return { ok: true };
    } catch (e: any) {
      console.error("[WhatsApp] Erro ao enviar mensagem manual:", e);
      return { ok: false, error: e?.message || "Erro ao enviar mensagem no WhatsApp." };
    }
  }

  public async start(phoneForPairingCode?: string): Promise<WaLinkState> {
    if (this.isStarting) {
      return this.getState();
    }
    this.isStarting = true;

    // Clear any pending reconnect timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.status !== "qr") {
      this.status = "connecting";
      this.note = this.isRegistered
        ? "Reconectando com suas credenciais salvas..."
        : "Iniciando conexão segura com os servidores do WhatsApp...";
    }

    try {
      await this.ensureDirs();

      if (this.sock) {
        try {
          this.sock.ev.removeAllListeners("connection.update");
          this.sock.ev.removeAllListeners("messages.upsert");
          this.sock.ev.removeAllListeners("creds.update");
          this.sock.end(new Error("Refreshing socket"));
        } catch {
          // ignore
        }
        this.sock = null;
      }

      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

      // Check if credentials on disk are already registered
      if (state.creds.registered || state.creds.me) {
        this.isRegistered = true;
      }

      let version: [number, number, number] | undefined;
      try {
        const v = await fetchLatestBaileysVersion();
        version = v.version;
      } catch {
        version = undefined;
      }

      const logger = pino({ level: "silent" });

      const sock = makeWASocket({
        auth: state,
        version,
        logger,
        printQRInTerminal: false,
        browser: Browsers.ubuntu("Chrome"),
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        syncFullHistory: false,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: false,
      });

      this.sock = sock;

      // Handle 8-digit Pairing Code
      if (phoneForPairingCode && !state.creds.registered) {
        setTimeout(async () => {
          try {
            const clean = phoneForPairingCode.replace(/\D/g, "");
            if (clean.length >= 10 && sock.requestPairingCode) {
              const code = await sock.requestPairingCode(clean);
              this.pairingCode = code;
              this.note = `Código de pareamento gerado: ${code}. No celular, abra Aparelhos Conectados > Conectar com número de telefone e digite o código.`;
            }
          } catch (e: any) {
            console.warn("[WhatsApp] Pairing code error:", e?.message);
          }
        }, 2000);
      }

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // New QR Code emitted by WhatsApp
        if (qr) {
          try {
            this.qrDataUrl = await QRCode.toDataURL(qr, {
              margin: 1,
              width: 320,
              color: {
                dark: "#1c1915",
                light: "#ffffff",
              },
            });
            this.status = "qr";
            this.note = "QR Code oficial do WhatsApp gerado! Aponte a câmera do WhatsApp para conectar.";
            console.log("[WhatsApp] QR Code emitido com sucesso e mantido na tela.");
          } catch (qrErr) {
            console.error("[WhatsApp] Erro ao renderizar QR Code:", qrErr);
          }
        }

        // WhatsApp connected successfully
        if (connection === "open") {
          this.status = "open";
          this.isRegistered = true;
          this.qrDataUrl = null;
          this.pairingCode = null;
          const userJid = sock.user?.id || "";
          this.phone = userJid.split(":")[0]?.split("@")[0] || "";
          this.note = `WhatsApp conectado no número +${this.phone}! O atendente Balcão está ativo respondendo clientes.`;
          console.log(`[WhatsApp] CONECTADO COM SUCESSO! Número: +${this.phone}`);
        }

        // Connection closed / disconnected
        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          console.log(`[WhatsApp] Conexão encerrada. Código: ${statusCode}. Registrado: ${this.isRegistered}`);

          // SCENARIO A: Already registered, but user explicitly logged out from mobile phone
          if (this.isRegistered && isLoggedOut) {
            console.log("[WhatsApp] Desconectado no celular pelo usuário. Limpando credenciais.");
            this.status = "off";
            this.isRegistered = false;
            this.qrDataUrl = null;
            this.phone = "";
            this.note = "Aparelho desconectado pelo celular. Gere um novo QR Code para reconectar.";
            await this.clearAuthFiles();
            return;
          }

          // SCENARIO B: Already registered, and connection dropped (network glitch, sleep, 515 restartRequired, 408 timedOut, etc.)
          // AUTO-RECONNECT AUTOMATICALLY WITHOUT REQUIRING QR CODE!
          if (this.isRegistered) {
            this.status = "connecting";
            this.note = "Conexão oscilou. Reconectando automaticamente ao WhatsApp sem precisar de QR Code...";
            console.log("[WhatsApp] Reconexão automática em andamento...");
            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => {
              void this.start();
            }, 3000);
            return;
          }

          // SCENARIO C: Not registered yet (QR code phase)
          // The close here is just a QR refresh cycle. DO NOT clear auth files and DO NOT blank the QR code.
          console.log("[WhatsApp] Atualizando QR Code para manter a validade...");
          if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => {
            if (this.status !== "open" && !this.isRegistered) {
              void this.start();
            }
          }, 1500);
        }
      });

      // INCOMING REAL WHATSAPP MESSAGES LISTENER
      sock.ev.on("messages.upsert", async ({ messages }) => {
        if (!messages || messages.length === 0) return;

        for (const msg of messages) {
          try {
            if (msg.key.remoteJid === "status@broadcast") continue;

            const remoteJid = msg.key.remoteJid;
            if (!remoteJid) continue;

            const isUserChat =
              remoteJid.endsWith("@s.whatsapp.net") ||
              remoteJid.endsWith("@lid") ||
              remoteJid.endsWith("@c.us");

            if (!isUserChat) continue;

            const rawMsg = msg.message;
            if (!rawMsg) continue;

            const m: proto.IMessage =
              rawMsg.ephemeralMessage?.message ||
              rawMsg.viewOnceMessage?.message ||
              rawMsg.viewOnceMessageV2?.message ||
              rawMsg.documentWithCaptionMessage?.message ||
              rawMsg;

            const isFromMe = Boolean(msg.key.fromMe);
            const waId = remoteJid.split("@")[0] || "";
            const pushName = msg.pushName || (isFromMe ? "Você (Comerciante)" : `Cliente ${waId.slice(-4)}`);

            let thread = this.threads.find(
              (t) => t.remoteJid === remoteJid || t.waId === waId
            );

            if (!thread) {
              thread = {
                id: Date.now() + Math.floor(Math.random() * 1000),
                waId,
                remoteJid,
                name: pushName,
                botPaused: false,
                preview: "",
                updatedAt: new Date().toISOString(),
                unreadCount: 0,
              };
              this.threads.unshift(thread);
            } else {
              thread.remoteJid = remoteJid;
              if (msg.pushName && (!thread.name || thread.name.startsWith("Cliente"))) {
                thread.name = msg.pushName;
              }
            }

            const contactId = thread.id;
            if (!this.messagesMap[contactId]) this.messagesMap[contactId] = [];

            if (isFromMe) {
              let outBody = "";
              if (m.conversation) outBody = m.conversation;
              else if (m.extendedTextMessage?.text) outBody = m.extendedTextMessage.text;
              else if (m.imageMessage) outBody = "[Foto enviada por você]";
              else if (m.audioMessage) outBody = "[Áudio enviado por você]";
              else outBody = "[Mensagem enviada]";

              const outMessage: StoredMessage = {
                id: Date.now(),
                contactId,
                direction: "out",
                kind: "text",
                body: outBody,
                createdAt: new Date().toISOString(),
              };
              this.messagesMap[contactId].push(outMessage);
              thread.preview = outBody;
              thread.updatedAt = new Date().toISOString();
              void this.saveStore();
              continue;
            }

            console.log(`[WhatsApp] Mensagem recebida de ${thread.name} (${remoteJid})`);

            let messageKind: StoredMessage["kind"] = "text";
            let messageBody = "";
            let mediaDataUrl: string | undefined = undefined;
            let filename: string | undefined = undefined;
            let audioDuration: number | undefined = undefined;
            let audioTranscription: string | undefined = undefined;
            let pixAnalysisResult: any = null;

            // 1. Audio Message
            if (m.audioMessage) {
              messageKind = "audio";
              audioDuration = m.audioMessage.seconds || undefined;
              messageBody = "[Áudio de voz recebido]";

              try {
                console.log(`[WhatsApp] Baixando áudio de voz de ${thread.name}...`);
                let buffer: Buffer | null = null;

                try {
                  buffer = (await downloadMediaMessage(
                    msg as any,
                    "buffer",
                    {},
                    {
                      logger,
                      reuploadRequest: async (cur: any) =>
                        sock.updateMediaMessage ? sock.updateMediaMessage(cur) : cur,
                    } as any
                  )) as Buffer;
                } catch (downloadErr) {
                  buffer = (await downloadMediaMessage(
                    { key: msg.key, message: m } as any,
                    "buffer",
                    {},
                    { logger } as any
                  )) as Buffer;
                }

                if (buffer && buffer.length > 0) {
                  const rawMime = m.audioMessage.mimetype || "audio/ogg; codecs=opus";
                  const cleanMime = rawMime.split(";")[0].trim() || "audio/ogg";
                  const b64Audio = buffer.toString("base64");
                  mediaDataUrl = `data:${cleanMime};base64,${b64Audio}`;

                  console.log(`[WhatsApp] Transcrevendo áudio via Gemini (${buffer.length} bytes)...`);
                  const genAi = new GoogleGenAI({
                    apiKey: process.env.GEMINI_API_KEY,
                    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
                  });

                  try {
                    const transcribeRes = await genAi.models.generateContent({
                      model: "gemini-3.5-transcribe",
                      contents: [
                        {
                          inlineData: {
                            mimeType: cleanMime.includes("ogg") ? "audio/ogg" : cleanMime,
                            data: b64Audio,
                          },
                        },
                        {
                          text: "Transcreva a fala deste áudio em português com fidelidade. Retorne exclusivamente o texto falado, sem introduções.",
                        },
                      ],
                    });
                    audioTranscription = transcribeRes.text?.trim() || "";
                  } catch (transcribeErr) {
                    console.warn("[WhatsApp] gemini-3.5-transcribe falhou, tentando gemini-3.8-flash:", transcribeErr);
                  }

                  if (!audioTranscription) {
                    try {
                      const fallbackRes = await genAi.models.generateContent({
                        model: "gemini-3.8-flash",
                        contents: [
                          {
                            inlineData: {
                              mimeType: cleanMime.includes("ogg") ? "audio/ogg" : cleanMime,
                              data: b64Audio,
                            },
                          },
                          {
                            text: "Transcreva com exatidão a fala deste áudio de WhatsApp em português. Retorne apenas o texto transcrito.",
                          },
                        ],
                      });
                      audioTranscription = fallbackRes.text?.trim() || "";
                    } catch (fbErr) {
                      console.warn("[WhatsApp] Transcrição com gemini-3.8-flash falhou:", fbErr);
                    }
                  }

                  if (audioTranscription) {
                    console.log(`[WhatsApp] Áudio transcrito com sucesso: "${audioTranscription}"`);
                    messageBody = `🎙️ "${audioTranscription}"`;
                  } else {
                    messageBody = "[Áudio de voz recebido]";
                  }
                }
              } catch (mediaErr) {
                console.error("[WhatsApp] Erro no processamento do áudio:", mediaErr);
                messageBody = "[Áudio de voz recebido]";
              }
            }
            // 2. Image Message
            else if (m.imageMessage) {
              messageKind = "image";
              messageBody = m.imageMessage.caption
                ? `[Foto]: ${m.imageMessage.caption}`
                : "[Foto enviada pelo cliente]";

              try {
                const buffer = (await downloadMediaMessage(
                  msg as any,
                  "buffer",
                  {},
                  {
                    logger,
                    reuploadRequest: async (cur: any) =>
                      sock.updateMediaMessage ? sock.updateMediaMessage(cur) : cur,
                  } as any
                )) as Buffer;

                if (buffer && buffer.length > 0) {
                  const mime = m.imageMessage.mimetype?.split(";")[0] || "image/jpeg";
                  const b64 = buffer.toString("base64");
                  mediaDataUrl = `data:${mime};base64,${b64}`;

                  if (this.pixAnalyzer) {
                    try {
                      pixAnalysisResult = await this.pixAnalyzer({
                        bytesBase64: b64,
                        mime,
                        textExtracted: m.imageMessage.caption || "",
                      });
                    } catch (e) {
                      // ignore
                    }
                  }
                }
              } catch (err) {
                console.warn("[WhatsApp] Erro ao baixar imagem:", err);
              }
            }
            // 3. Document Message
            else if (m.documentMessage) {
              messageKind = "pdf";
              filename = m.documentMessage.fileName || "documento.pdf";
              messageBody = m.documentMessage.caption
                ? `[Documento ${filename}]: ${m.documentMessage.caption}`
                : `[Documento PDF]: ${filename}`;
            }
            // 4. Text Message
            else if (m.conversation) {
              messageKind = "text";
              messageBody = m.conversation;
            } else if (m.extendedTextMessage?.text) {
              messageKind = "text";
              messageBody = m.extendedTextMessage.text;
            } else {
              messageKind = "text";
              messageBody = "[Mensagem recebida]";
            }

            const inMsg: StoredMessage = {
              id: Date.now() + Math.floor(Math.random() * 100),
              contactId,
              direction: "in",
              kind: messageKind,
              body: messageBody,
              mediaUrl: mediaDataUrl,
              filename,
              audioDuration,
              createdAt: new Date().toISOString(),
            };

            this.messagesMap[contactId].push(inMsg);
            thread.preview = messageBody;
            thread.updatedAt = new Date().toISOString();
            thread.unreadCount += 1;

            if (pixAnalysisResult && pixAnalysisResult.isReceipt) {
              const newRec: StoredReceipt = {
                id: Date.now(),
                contactId,
                contactName: thread.name,
                waId,
                payerName: pixAnalysisResult.payerName || thread.name,
                favorecido: pixAnalysisResult.favorecido || "—",
                banco: pixAnalysisResult.banco || "—",
                amountCents: pixAnalysisResult.amountCents || null,
                paidAtText: pixAnalysisResult.paidAtText || "Agora",
                paidDate: pixAnalysisResult.paidDate || new Date().toISOString().slice(0, 10),
                e2eId: pixAnalysisResult.e2eId || "E" + Date.now().toString(16),
                confidence: pixAnalysisResult.confidence || "alta",
                nameMatches: pixAnalysisResult.decision?.nameMatches ?? true,
                decision: pixAnalysisResult.decision?.decision || "Comprovante recebido no WhatsApp",
                status: pixAnalysisResult.decision?.status || "liberado",
                note: `Recebido de ${thread.name}`,
                mediaDataUrl: mediaDataUrl || null,
                createdAt: new Date().toISOString(),
              };
              this.receipts.unshift(newRec);
            }

            void this.saveStore();

            // Automated AI reply
            if (!thread.botPaused && this.replyGenerator && this.deskGetter) {
              const desk = this.deskGetter();
              const isBotActive = desk?.shop?.botEnabled !== false;

              if (isBotActive) {
                try {
                  await sock.sendPresenceUpdate("composing", remoteJid).catch(() => {});

                  const history = this.messagesMap[contactId].slice(-6).map((x) => ({
                    direction: x.direction,
                    body: x.body,
                    kind: x.kind,
                  }));

                  const customerQuery = audioTranscription
                    ? `[Áudio transcrito do cliente]: ${audioTranscription}`
                    : messageBody;

                  const replyText = await this.replyGenerator({
                    desk,
                    history,
                    customerText: customerQuery,
                    pix: pixAnalysisResult,
                    transcription: audioTranscription,
                  });

                  await new Promise((r) => setTimeout(r, 1500));

                  if (replyText && replyText.trim()) {
                    try {
                      await sock.sendMessage(remoteJid, { text: replyText.trim() }, { quoted: msg });
                    } catch (sendErr) {
                      await sock.sendMessage(remoteJid, { text: replyText.trim() });
                    }

                    console.log(`[WhatsApp] Resposta enviada para ${thread.name}: "${replyText.trim()}"`);

                    const outMsg: StoredMessage = {
                      id: Date.now() + 1,
                      contactId,
                      direction: "out",
                      kind: "text",
                      body: replyText.trim(),
                      createdAt: new Date().toISOString(),
                    };

                    this.messagesMap[contactId].push(outMsg);
                    thread.preview = replyText.trim();
                    thread.updatedAt = new Date().toISOString();
                    void this.saveStore();
                  }

                  await sock.sendPresenceUpdate("paused", remoteJid).catch(() => {});
                } catch (aiErr) {
                  console.error("[WhatsApp] Erro ao gerar resposta automática:", aiErr);
                }
              }
            }
          } catch (itemErr) {
            console.error("[WhatsApp] Erro ao processar mensagem:", itemErr);
          }
        }
      });
    } catch (err: any) {
      console.error("[WhatsApp] Erro ao inicializar Baileys:", err);
      this.status = "off";
      this.note = `Erro ao ligar WhatsApp: ${err?.message || "falha de inicialização"}`;
    } finally {
      this.isStarting = false;
    }

    return this.getState();
  }

  public async disconnect(): Promise<WaLinkState> {
    this.status = "off";
    this.isRegistered = false;
    this.qrDataUrl = null;
    this.phone = "";
    this.pairingCode = null;
    this.note = "WhatsApp desconectado.";

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.sock) {
      try {
        this.sock.ev.removeAllListeners("connection.update");
        this.sock.ev.removeAllListeners("messages.upsert");
        this.sock.ev.removeAllListeners("creds.update");
        await this.sock.logout();
      } catch {
        try {
          this.sock.end(new Error("Logged out"));
        } catch {
          // ignore
        }
      }
      this.sock = null;
    }

    await this.clearAuthFiles();
    return this.getState();
  }

  public async sendTestMessage(to: string, text: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.sock || this.status !== "open") {
      return { ok: false, error: "O WhatsApp ainda não está conectado no servidor." };
    }

    const clean = to.replace(/\D/g, "");
    if (clean.length < 10) {
      return { ok: false, error: "Número inválido. Inclua DDI e DDD (ex: 5511999998888)." };
    }

    const jid = `${clean}@s.whatsapp.net`;
    try {
      await this.sock.sendMessage(jid, { text });
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || "Falha ao enviar mensagem." };
    }
  }

  private async clearAuthFiles() {
    try {
      if (existsSync(AUTH_DIR)) {
        const files = await readdir(AUTH_DIR);
        for (const file of files) {
          await rm(path.join(AUTH_DIR, file), { recursive: true, force: true });
        }
      }
    } catch (e) {
      console.warn("[WhatsApp] Could not clear wa-auth files:", e);
    }
  }
}

export const waManager = new WhatsAppManager();
