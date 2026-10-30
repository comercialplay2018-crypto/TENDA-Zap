import express, { Request, Response } from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { GoogleGenAI, type LiveServerMessage, Modality } from "@google/genai";
import { WebSocketServer, WebSocket } from "ws";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Server-side initialization of Gemini API
const hasValidKey = Boolean(
  process.env.GEMINI_API_KEY &&
  process.env.GEMINI_API_KEY.trim() &&
  process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY"
);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { waManager } from "./server/whatsapp.ts";

const DATA_DIR = process.env.VERCEL
  ? path.resolve("/tmp", "balcao-data")
  : path.resolve(process.cwd(), "data");
const DESK_CONFIG_FILE = path.resolve(DATA_DIR, "desk-config.json");

let latestDeskState: any = {
  shop: {
    name: "Papelaria & Gráfica Balcão",
    attendantName: "Carla",
    about: "Impressões rápidas, cópias PB e coloridas, encadernações, plastificação, elaboração de currículos e artigos de escritório.",
    voice: "Educada, solta e direta como gente de verdade no balcão. Sem enrolação, sem menu numerado e sem papo de robô.",
    pixKey: "11987654321",
    pixFavorecido: "CARLA REGINA SILVA BALCAO",
    pixBanco: "Nubank (260)",
    timezone: "America/Sao_Paulo",
    botEnabled: true,
  },
  products: [
    { name: "Impressão P&B A4", priceCents: 75, unit: "folha", available: true },
    { name: "Impressão Colorida A4", priceCents: 250, unit: "folha", available: true },
    { name: "Plastificação A4", priceCents: 600, unit: "un", available: true },
    { name: "Encadernação Espiral", priceCents: 800, unit: "un", available: true },
  ],
};

// Load saved desk configuration from disk if exists
try {
  if (existsSync(DESK_CONFIG_FILE)) {
    const raw = readFileSync(DESK_CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && parsed.shop?.name) {
      latestDeskState = parsed;
      console.log(`[Balcão] Configurações da loja carregadas do disco: ${latestDeskState.shop.name}`);
    }
  }
} catch (e) {
  console.warn("Could not load desk-config.json:", e);
}

// Wire up AI generator for live incoming WhatsApp messages
waManager.setAiCallbacks(
  () => latestDeskState,
  async (input) => {
    try {
      const who = latestDeskState?.shop?.attendantName
        ? `Você é ${latestDeskState.shop.attendantName} e atende no WhatsApp`
        : "Você atende no balcão e no WhatsApp";
      const place = latestDeskState?.shop?.name ? ` da ${latestDeskState.shop.name}` : " deste comércio";

      let pixBlock = "";
      if (input.pix?.isReceipt) {
        const amount = input.pix.amountCents != null ? formatBrl(input.pix.amountCents) : "valor não lido";
        pixBlock = `COMPROVANTE PIX: status ${String(input.pix.decision?.status || "").toUpperCase()}, valor ${amount}, favorecido ${input.pix.favorecido || "?"}. Se liberado, avise que recebeu e que segue o pedido com conferência no app do banco.`;
      }

      const systemPrompt = `${who}${place}.
Você fala como uma pessoa de verdade atendendo clientes no WhatsApp no Brasil: simpática, rápida, prática e sem frescura.
Responda em no máximo 1 a 3 frases curtas. Sem enrolação de robô. Sem asteriscos de markdown.
Se o cliente mandou áudio (já transcrito), responda diretamente à dúvida dele com naturalidade e acolhimento.

FATOS DA LOJA:
${buildFactsPrompt(latestDeskState)}

${pixBlock}`;

      const customerText = input.transcription
        ? `[Cliente enviou áudio]: "${input.transcription}"`
        : input.customerText;

      const contents: any[] = [];

      if (Array.isArray(input.history)) {
        for (const msg of input.history.slice(-5)) {
          contents.push({
            role: msg.direction === "out" ? "model" : "user",
            parts: [{ text: msg.body }],
          });
        }
      }

      contents.push({
        role: "user",
        parts: [{ text: customerText }],
      });

      if (hasValidKey) {
        console.log(`[AI Server] Gerando resposta para WhatsApp com gemini-3.8-flash: "${customerText}"`);
        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents,
          config: {
            systemInstruction: systemPrompt,
          },
        });
        const clean = cleanReply(response.text || "");
        if (clean) return clean;
      }
    } catch (err) {
      console.warn("AI generation for WhatsApp message error:", err);
    }
    return generateServerFallbackReply(latestDeskState, input.customerText, input.pix);
  }
);

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    version: "2.4.0",
    serverSideGemini: true,
    hasApiKey: hasValidKey,
    whatsapp: waManager.getState().status,
  });
});

// WhatsApp Live Connection Routes
app.get("/api/whatsapp/status", (_req: Request, res: Response) => {
  res.json(waManager.getState());
});

app.post("/api/whatsapp/start", async (req: Request, res: Response) => {
  const { phone, desk } = req.body || {};
  if (desk) latestDeskState = desk;
  const state = await waManager.start(phone);
  res.json(state);
});

app.post("/api/whatsapp/stop", async (_req: Request, res: Response) => {
  const state = await waManager.disconnect();
  res.json(state);
});

app.post("/api/whatsapp/send-test", async (req: Request, res: Response) => {
  const { to, text } = req.body || {};
  const result = await waManager.sendTestMessage(to || "", text || "Teste Balcão");
  res.json(result);
});

// REAL WHATSAPP THREADS & MESSAGES ENDPOINTS
app.get("/api/whatsapp/threads", (_req: Request, res: Response) => {
  res.json(waManager.getRealThreads());
});

app.get("/api/whatsapp/messages/:contactId", (req: Request, res: Response) => {
  const id = Number(req.params.contactId);
  res.json(waManager.getRealMessages(id));
});

app.post("/api/whatsapp/send-message", async (req: Request, res: Response) => {
  const { contactId, text } = req.body || {};
  const result = await waManager.sendManualMessage(Number(contactId), String(text || ""));
  res.json(result);
});

app.post("/api/whatsapp/toggle-pause", (req: Request, res: Response) => {
  const { contactId, paused } = req.body || {};
  const ok = waManager.toggleBotPause(Number(contactId), Boolean(paused));
  res.json({ ok });
});

app.get("/api/whatsapp/receipts", (_req: Request, res: Response) => {
  res.json(waManager.getRealReceipts());
});

app.post("/api/whatsapp/update-receipt", (req: Request, res: Response) => {
  const { id, status } = req.body || {};
  waManager.updateReceiptStatus(Number(id), status);
  res.json({ ok: true });
});

app.get("/api/desk", (_req: Request, res: Response) => {
  res.json(latestDeskState);
});

app.post("/api/desk", (req: Request, res: Response) => {
  if (req.body?.desk) {
    latestDeskState = req.body.desk;
    try {
      if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true });
      }
      writeFileSync(DESK_CONFIG_FILE, JSON.stringify(latestDeskState, null, 2), "utf-8");
    } catch (e) {
      console.warn("Could not save desk-config.json:", e);
    }
  }
  res.json({ ok: true });
});

app.post("/api/whatsapp/sync-desk", (req: Request, res: Response) => {
  if (req.body?.desk) {
    latestDeskState = req.body.desk;
    try {
      if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true });
      }
      writeFileSync(DESK_CONFIG_FILE, JSON.stringify(latestDeskState, null, 2), "utf-8");
    } catch (e) {
      console.warn("Could not save desk-config.json:", e);
    }
  }
  res.json({ ok: true });
});

function formatBrl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function buildFactsPrompt(desk: any): string {
  if (!desk) return "Nenhum dado cadastrado.";
  const lines: string[] = [];
  const shopName = desk.shop?.name || "Comércio";
  lines.push(`Nome do estabelecimento: ${shopName}.`);
  if (desk.shop?.attendantName) lines.push(`Quem atende se chama ${desk.shop.attendantName}.`);
  if (desk.shop?.about) lines.push(`O que a loja faz: ${desk.shop.about}`);
  if (desk.shop?.voice) lines.push(`Tom de voz e instruções do dono: ${desk.shop.voice}`);

  if (Array.isArray(desk.products) && desk.products.length > 0) {
    lines.push("Produtos e Serviços disponíveis no catálogo:");
    for (const p of desk.products) {
      const flag = p.available ? "disponível" : "em falta / esgotado";
      lines.push(`- ${p.name}: ${formatBrl(p.priceCents)} por ${p.unit} (${flag})${p.details ? ` — ${p.details}` : ""}`);
    }
  } else {
    lines.push("Nenhum produto cadastrado no momento. Não invente preços.");
  }

  if (Array.isArray(desk.promos) && desk.promos.length > 0) {
    lines.push("Promoções:");
    for (const pr of desk.promos) {
      if (pr.active) lines.push(`- Promoção: ${pr.title}: ${pr.details}`);
    }
  }

  if (Array.isArray(desk.notices) && desk.notices.length > 0) {
    lines.push("Avisos importantes:");
    for (const n of desk.notices) {
      if (n.active) lines.push(`- ${n.body}`);
    }
  }

  if (desk.shop?.pixFavorecido || desk.shop?.pixKey) {
    lines.push(
      `Dados Pix: Chave "${desk.shop?.pixKey || ""}", Favorecido "${desk.shop?.pixFavorecido || ""}", Banco "${desk.shop?.pixBanco || ""}". Passe a chave apenas se o cliente pedir para pagar.`
    );
  }

  return lines.join("\n");
}

function cleanReply(text: string): string {
  let out = (text || "")
    .replace(/^["“]|["”]$/g, "")
    .replace(/\*\*/g, "")
    .trim();
  out = out.replace(/^(atendente|assistente|balcão|carla)\s*:\s*/i, "");
  if (out.length > 600) out = out.slice(0, 600).trim();
  return out;
}

// 1. API: Server-side Gemini Content Generation
app.post("/api/ai/chat", async (req: Request, res: Response) => {
  try {
    const { desk, history, customerText, pix, transcription } = req.body;
    if (desk) latestDeskState = desk;

    const who = desk?.shop?.attendantName
      ? `Você é ${desk.shop.attendantName} e atende no WhatsApp`
      : "Você atende no balcão e no WhatsApp";
    const place = desk?.shop?.name ? ` da ${desk.shop.name}` : " deste comércio";

    let pixBlock = "Nenhum comprovante enviado nesta mensagem.";
    if (pix?.isReceipt) {
      const amount = pix.amountCents != null ? formatBrl(pix.amountCents) : "valor não lido";
      pixBlock = [
        `PARECER DO COMPROVANTE: ${String(pix.decision?.status || "").toUpperCase()}.`,
        `Motivo: ${pix.decision?.decision || ""}`,
        `Valor identificado: ${amount}. Data/Hora: ${pix.paidAtText || "sem data"}. Favorecido no comprovante: "${pix.favorecido || "?"}". Banco: ${pix.banco || "?"}. Pagador: ${pix.payerName || "?"}.`,
        "REGRA DE PIX: Nunca diga que o dinheiro já caiu na conta. Se o status for LIBERADO, avise que recebeu o comprovante e que o pedido segue para preparação enquanto é feita a conferência no aplicativo do banco. Se for DÚVIDA ou RECUSADO, explique educadamente o motivo e peça para o cliente conferir ou reenviar, sem grosseria.",
      ].join(" ");
    } else if (pix?.description) {
      pixBlock = `O cliente enviou um arquivo ou foto que não é comprovante: ${pix.description}`;
    }

    const systemPrompt = `${who}${place}.
Você fala como uma pessoa de verdade atendendo clientes no WhatsApp no Brasil: simpática, rápida, prática e sem frescura.

REGRAS OBRIGATÓRIAS:
1. Responda em no máximo 1 a 3 frases curtas (20 a 45 palavras). Apenas liste mais detalhes se o cliente pedir preços de vários itens ou cardápio.
2. NUNCA use frases robóticas como: "Olá! Como posso ajudar?", "Claro, certamente!", "Fico à disposição para dúvidas", "Sou um assistente de inteligência artificial", "menu de opções 1, 2, 3".
3. Use o tom de balcão brasileiro. Varie o cumprimento ("Oi!", "Opa, boa tarde!", "Fala!", "Tudo bem?").
4. Se a loja estiver fechada agora segundo o horário dos FATOS, avise com naturalidade e não prometa entrega imediata.
5. Nunca invente produtos, valores ou prazos que não estão nos FATOS.
6. Se o cliente mandou áudio (já transcrito), responda normalmente.
7. Use no máximo 1 emoji e na maioria das vezes nenhum.
8. Sem formatação pesada de markdown (sem asteriscos em excesso).
9. Se perguntarem se é robô, responda de forma descontraída e volte direto pro assunto: "Sou eu mesma cuidando do WhatsApp aqui da loja! O que vai ser?".

FATOS DA LOJA:
${buildFactsPrompt(desk)}

${pixBlock}`;

    const messageToSend = transcription
      ? `[Mensagem de Áudio enviada pelo cliente]: "${transcription}"`
      : customerText || (pix?.isReceipt ? "[Enviou comprovante de Pix]" : "Oi!");

    const contents: any[] = [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Entendido. Vou responder no tom exato do balcão da loja, curto e natural." }] },
    ];

    if (Array.isArray(history)) {
      for (const msg of history.slice(-6)) {
        contents.push({
          role: msg.direction === "out" ? "model" : "user",
          parts: [{ text: msg.body }],
        });
      }
    }

    contents.push({
      role: "user",
      parts: [{ text: messageToSend }],
    });

    if (hasValidKey) {
      try {
        const response = await Promise.race([
          ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents,
            config: {
              temperature: 0.85,
              maxOutputTokens: 250,
            },
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 10000)
          ),
        ]);

        const text = cleanReply(response.text || "");
        if (text) {
          res.json({ text });
          return;
        }
      } catch (geminiErr) {
        console.warn("Gemini server call failed, using natural fallback:", geminiErr);
      }
    }

    // Natural commercial reply fallback
    const fallbackText = generateServerFallbackReply(desk, customerText, pix);
    res.json({ text: fallbackText });
  } catch (err: any) {
    console.error("Error in /api/ai/chat:", err);
    res.json({ text: "Opa, tudo bem? Como posso te ajudar aqui na loja hoje?" });
  }
});

// 2. API: Server-side Gemini Content Streaming (SSE)
app.post("/api/ai/chat/stream", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const { desk, history, customerText, pix, transcription } = req.body;

    const who = desk?.shop?.attendantName
      ? `Você é ${desk.shop.attendantName} e atende no WhatsApp`
      : "Você atende no balcão e no WhatsApp";
    const place = desk?.shop?.name ? ` da ${desk.shop.name}` : " deste comércio";

    const systemPrompt = `${who}${place}.
Você fala como uma pessoa de verdade atendendo clientes no WhatsApp no Brasil: simpática, rápida, prática e sem frescura. Responda em 1 a 3 frases curtas.

FATOS DA LOJA:
${buildFactsPrompt(desk)}`;

    const messageToSend = transcription
      ? `[Mensagem de Áudio enviada pelo cliente]: "${transcription}"`
      : customerText || "Oi!";

    const contents: any[] = [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Entendido." }] },
    ];

    if (Array.isArray(history)) {
      for (const msg of history.slice(-6)) {
        contents.push({
          role: msg.direction === "out" ? "model" : "user",
          parts: [{ text: msg.body }],
        });
      }
    }

    contents.push({
      role: "user",
      parts: [{ text: messageToSend }],
    });

    if (hasValidKey) {
      try {
        const stream = await ai.models.generateContentStream({
          model: "gemini-3.8-flash",
          contents,
          config: {
            temperature: 0.85,
            maxOutputTokens: 250,
          },
        });

        for await (const chunk of stream) {
          const chunkText = chunk.text || "";
          if (chunkText) {
            res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
          }
        }
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      } catch (streamErr) {
        console.warn("Gemini stream error, falling back to simulated stream:", streamErr);
      }
    }

    const fallback = generateServerFallbackReply(desk, customerText, pix);
    const words = fallback.split(" ");
    for (const w of words) {
      res.write(`data: ${JSON.stringify({ text: w + " " })}\n\n`);
      await new Promise((r) => setTimeout(r, 40));
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err: any) {
    console.error("Error in /api/ai/chat/stream:", err);
    res.write(`data: ${JSON.stringify({ text: "Opa, tudo bem? Como posso te ajudar?" })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

// 3. API: Server-side Gemini Pix Multimodal Analysis
app.post("/api/ai/pix", async (req: Request, res: Response) => {
  try {
    const { bytesBase64, mime, textExtracted } = req.body;

    const PIX_INSTRUCTION = `Você é um leitor especialista em comprovantes de Pix brasileiros e análise de imagens enviadas no WhatsApp do comércio.
Analise os dados e responda ESTRITAMENTE em formato JSON puro, sem crases de markdown e sem explicações:
{
  "isReceipt": true/false,
  "description": "descrição curta do arquivo ou comprovante",
  "amount": "valor exatamente como impresso, ex: 50,00 ou 25,50",
  "paidAt": "data e hora impressas, ex: 29/10/2026 14:15",
  "paidDate": "data em formato AAAA-MM-DD",
  "payerName": "nome do pagador/cliente",
  "favorecido": "nome do favorecido (quem recebeu o dinheiro)",
  "banco": "nome da instituição bancária de destino",
  "e2eId": "código de autenticação/id da transação E2E",
  "confidence": "alta" ou "media" ou "baixa"
}`;

    const parts: any[] = [{ text: PIX_INSTRUCTION }];
    if (textExtracted) {
      parts.push({ text: `Texto extraído do documento/PDF:\n${textExtracted}` });
    }
    if (bytesBase64 && mime) {
      parts.push({
        inlineData: {
          mimeType: mime.split(";")[0],
          data: bytesBase64,
        },
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: parts,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (err: any) {
    console.error("Error in /api/ai/pix:", err);
    res.status(500).json({ error: err.message || "Erro ao analisar comprovante." });
  }
});

// 4. API: Server-side Gemini Audio Transcription
app.post("/api/ai/transcribe", async (req: Request, res: Response) => {
  try {
    const { audioBase64, mime } = req.body;
    if (!audioBase64) {
      res.status(400).json({ error: "audioBase64 is required." });
      return;
    }

    const audioPart = {
      inlineData: {
        mimeType: mime ? mime.split(";")[0] : "audio/wav",
        data: audioBase64,
      },
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-transcribe",
      contents: [
        audioPart,
        { text: "Transcreva este áudio em português do Brasil com pontuação natural. Retorne apenas o texto falado." },
      ],
    });

    res.json({ text: (response.text || "").trim() });
  } catch (err: any) {
    console.error("Error in /api/ai/transcribe:", err);
    // fallback with gemini-3.8-flash multimodal
    try {
      const audioPart = {
        inlineData: {
          mimeType: req.body.mime ? req.body.mime.split(";")[0] : "audio/wav",
          data: req.body.audioBase64,
        },
      };
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [
          audioPart,
          { text: "Transcreva com fidelidade a fala deste áudio em português." },
        ],
      });
      res.json({ text: (response.text || "").trim() });
    } catch (fallbackErr: any) {
      res.status(500).json({ error: fallbackErr.message || "Erro ao transcrever áudio." });
    }
  }
});

// 5. WebSocket Server for Live API Voice Conversations
const wss = new WebSocketServer({ server, path: "/live" });

wss.on("connection", async (clientWs: WebSocket) => {
  let session: any = null;
  try {
    session = await ai.live.connect({
      model: "gemini-3.8-live",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
        },
        systemInstruction: "Você é o atendente de WhatsApp da loja. Responda em português brasileiro de forma amigável, concisa e natural.",
      },
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audio && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ audio }));
          }
          if (message.serverContent?.interrupted && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ interrupted: true }));
          }
        },
      },
    });

    clientWs.on("message", (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.audio && session) {
          session.sendRealtimeInput({
            audio: { data: parsed.audio, mimeType: "audio/pcm;rate=16000" },
          });
        }
      } catch (err) {
        console.error("Live WebSocket client message error:", err);
      }
    });

    clientWs.on("close", () => {
      if (session && typeof session.close === "function") {
        session.close();
      }
    });
  } catch (err) {
    console.warn("Live API connection failed (falling back to standard audio endpoints):", err);
  }
});

// Mount Vite or serve static dist
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }
}

function generateServerFallbackReply(desk: any, customerText: string, pix: any): string {
  const text = (customerText || "").toLowerCase();
  const attendant = desk?.shop?.attendantName ? `Aqui é a ${desk.shop.attendantName}. ` : "";

  if (pix?.isReceipt) {
    if (pix.decision?.status === "liberado") {
      const valor = pix.amountCents ? formatBrl(pix.amountCents) : "seu pagamento";
      return `Recebi o comprovante de ${valor}! Já estou conferindo no banco e separando aqui para você.`;
    } else if (pix.decision?.status === "recusado") {
      return `Oi! No comprovante que você mandou, o nome do favorecido saiu diferente da loja. Dá uma conferida e manda de novo por favor?`;
    } else {
      return `Opa, recebi aqui! Vou dar uma olhada no extrato do banco e já te confirmo em instantes.`;
    }
  }

  if (text.includes("aberto") || text.includes("horario") || text.includes("horas") || text.includes("fecha") || text.includes("abre")) {
    return `Estamos abertos sim! Hoje funcionamos normalmente. Como posso te atender?`;
  }

  if (text.includes("pix") || text.includes("chave") || text.includes("pagar")) {
    if (desk?.shop?.pixKey) {
      return `Nossa chave Pix é ${desk.shop.pixKey} no ${desk.shop.pixBanco || "banco"} em nome de ${desk.shop.pixFavorecido || "nossa loja"}. Assim que fizer só mandar o comprovante aqui!`;
    }
    return `Aceitamos Pix sim! Me avisa o que você vai querer que eu já te passo o total e a chave.`;
  }

  if (Array.isArray(desk?.products)) {
    for (const prod of desk.products) {
      const pName = (prod.name || "").toLowerCase();
      const words = pName.split(" ");
      if (words.some((w: string) => w.length > 3 && text.includes(w))) {
        const price = formatBrl(prod.priceCents);
        return `${prod.name} sai por ${price} a ${prod.unit}. ${prod.available ? "Temos disponível sim!" : "No momento está em falta."} Quer que separe para você?`;
      }
    }
  }

  if (text.includes("quanto") || text.includes("preco") || text.includes("preço") || text.includes("valor")) {
    return `Trabalhamos com impressões, cópias, encadernações e artigos de papelaria. Qual item você precisa saber o valor?`;
  }

  return `Opa, tudo bem? ${attendant}O que você precisa hoje aqui na ${desk?.shop?.name || "loja"}?`;
}

export default app;
export { server, app };

if (!process.env.VERCEL) {
  setupVite().then(() => {
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Balcão v2.4.0 full-stack server running on http://0.0.0.0:${PORT}`);
    });
  });
}

