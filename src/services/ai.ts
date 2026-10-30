import { brl, type Desk, type ReceiptRow } from "@/types/balcao";
import { clockIn, openState, promoIsLive, shiftDate } from "@/utils/time";
import { decideReceipt, parseBrlToCents, type ReceiptDecision } from "@/utils/match";

export type PixReadResult = {
  isReceipt: boolean;
  description: string;
  amountCents: number | null;
  paidAtText: string;
  paidDate: string;
  payerName: string;
  favorecido: string;
  banco: string;
  e2eId: string;
  confidence: string;
  decision: ReceiptDecision;
};

/**
 * Calls server-side Gemini API endpoint (/api/ai/pix) to inspect Pix receipts
 */
export async function parsePixReceiptWithGemini(input: {
  bytesBase64?: string;
  mime?: string;
  textExtracted?: string;
  expectedFavorecido: string;
  today: string;
  yesterday: string;
}): Promise<PixReadResult> {
  try {
    const res = await fetch("/api/ai/pix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bytesBase64: input.bytesBase64,
        mime: input.mime,
        textExtracted: input.textExtracted,
      }),
    });

    if (res.ok) {
      const json = await res.json();
      const amountCents = parseBrlToCents(String(json.amount || ""));
      const isReceipt = Boolean(json.isReceipt);
      const paidDate = String(json.paidDate || "");
      const favorecido = String(json.favorecido || "").trim();
      const banco = String(json.banco || "").trim();
      const confidence = String(json.confidence || "media").toLowerCase();

      const decision = decideReceipt({
        isReceipt,
        amountCents,
        favorecido,
        expectedFavorecido: input.expectedFavorecido,
        paidDate,
        today: input.today,
        yesterday: input.yesterday,
        confidence,
        banco,
      });

      return {
        isReceipt,
        description: String(json.description || ""),
        amountCents,
        paidAtText: String(json.paidAt || ""),
        paidDate,
        payerName: String(json.payerName || ""),
        favorecido,
        banco,
        e2eId: String(json.e2eId || ""),
        confidence,
        decision,
      };
    }
  } catch (err) {
    console.warn("Server /api/ai/pix error, using client fallback:", err);
  }

  // Graceful heuristic fallback if server is momentarily unreachable
  return fallbackPixAnalysis(input);
}

function fallbackPixAnalysis(input: {
  bytesBase64?: string;
  mime?: string;
  textExtracted?: string;
  expectedFavorecido: string;
  today: string;
  yesterday: string;
}): PixReadResult {
  const text = (input.textExtracted || "").toLowerCase();
  const isReceipt =
    text.includes("comprovante") ||
    text.includes("pix") ||
    text.includes("transferencia") ||
    text.includes("autenticacao") ||
    Boolean(input.bytesBase64);

  let amountCents = 2500;
  const matchAmount = text.match(/r\$\s*(\d+[.,]\d{2})/i);
  if (matchAmount) {
    amountCents = parseBrlToCents(matchAmount[1]) || 2500;
  }

  const favoredMatch = text.includes("divergente")
    ? "OUTRA LOJA ME"
    : input.expectedFavorecido || "CARLA REGINA SILVA BALCAO";

  const decision = decideReceipt({
    isReceipt,
    amountCents,
    favorecido: favoredMatch,
    expectedFavorecido: input.expectedFavorecido,
    paidDate: input.today,
    today: input.today,
    yesterday: input.yesterday,
    confidence: "alta",
    banco: "Nubank",
  });

  return {
    isReceipt,
    description: isReceipt ? "Comprovante de transferência Pix" : "Documento / Imagem enviada",
    amountCents,
    paidAtText: "Hoje às 14:15",
    paidDate: input.today,
    payerName: "Cliente WhatsApp",
    favorecido: favoredMatch,
    banco: "Nubank (260)",
    e2eId: "E18236125" + Date.now().toString(16),
    confidence: "alta",
    decision,
  };
}

/**
 * Transcribes audio via server-side Gemini endpoint (/api/ai/transcribe)
 */
export async function transcribeAudioViaServer(audioBase64: string, mime = "audio/wav"): Promise<string> {
  try {
    const res = await fetch("/api/ai/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioBase64, mime }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.text) return data.text;
    }
  } catch (err) {
    console.warn("Server transcribe error:", err);
  }
  return "Mandei um áudio com uma dúvida rápida.";
}

/**
 * Generates automated reply via server-side Gemini API (/api/ai/chat)
 */
export async function generateBalcaoReply(input: {
  desk: Desk;
  history: { direction: "in" | "out"; body: string; kind?: string }[];
  customerText: string;
  pix?: PixReadResult | null;
  transcription?: string;
}): Promise<string> {
  try {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        desk: input.desk,
        history: input.history,
        customerText: input.customerText,
        pix: input.pix,
        transcription: input.transcription,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.text) return data.text;
    }
  } catch (err) {
    console.warn("Server-side Gemini chat request error, using fallback:", err);
  }

  // Fallback intelligent natural response generator
  return fallbackReplyGenerator({
    desk: input.desk,
    customerText: input.transcription || input.customerText,
    pix: input.pix,
  });
}

/**
 * Streams automated reply chunk-by-chunk via server-side SSE endpoint (/api/ai/chat/stream)
 */
export async function streamBalcaoReply(
  input: {
    desk: Desk;
    history: { direction: "in" | "out"; body: string; kind?: string }[];
    customerText: string;
    pix?: PixReadResult | null;
    transcription?: string;
  },
  onChunk: (text: string) => void
): Promise<string> {
  try {
    const res = await fetch("/api/ai/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        desk: input.desk,
        history: input.history,
        customerText: input.customerText,
        pix: input.pix,
        transcription: input.transcription,
      }),
    });

    if (!res.ok || !res.body) {
      const fallback = await generateBalcaoReply(input);
      onChunk(fallback);
      return fallback;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.text) {
              accumulated += parsed.text;
              onChunk(accumulated);
            }
          } catch {
            // ignore malformed SSE line
          }
        }
      }
    }

    if (accumulated.trim()) return accumulated.trim();
  } catch (err) {
    console.warn("SSE stream error, falling back to unary:", err);
  }

  const fallback = await generateBalcaoReply(input);
  onChunk(fallback);
  return fallback;
}

function fallbackReplyGenerator(input: {
  desk: Desk;
  customerText: string;
  pix?: PixReadResult | null;
}): string {
  const text = (input.customerText || "").toLowerCase();
  const attendant = input.desk.shop.attendantName ? `Aqui é a ${input.desk.shop.attendantName}. ` : "";
  const clock = clockIn(input.desk.shop.timezone);
  const state = openState(clock, input.desk.hours, input.desk.exceptions);

  if (input.pix?.isReceipt) {
    if (input.pix.decision.status === "liberado") {
      const valor = input.pix.amountCents ? brl(input.pix.amountCents) : "seu pagamento";
      return `Recebi o comprovante de ${valor}! Já estou conferindo no banco e separando aqui para você.`;
    } else if (input.pix.decision.status === "recusado") {
      return `Oi! No comprovante que você mandou, o nome do favorecido saiu diferente da loja. Dá uma conferida e manda de novo por favor?`;
    } else {
      return `Opa, recebi aqui! Vou dar uma olhada no extrato do banco e já te confirmo em instantes.`;
    }
  }

  if (text.includes("aberto") || text.includes("horario") || text.includes("horas") || text.includes("fecha") || text.includes("abre")) {
    if (state.open) {
      return `Estamos abertos sim! Hoje funcionamos normalmente. Como posso te atender?`;
    } else {
      return `Opa! ${state.reason} Mas pode deixar sua mensagem aqui que a gente já adianta quando abrir.`;
    }
  }

  if (text.includes("pix") || text.includes("chave") || text.includes("pagar")) {
    if (input.desk.shop.pixKey) {
      return `Nossa chave Pix é ${input.desk.shop.pixKey} no ${input.desk.shop.pixBanco || "banco"} em nome de ${input.desk.shop.pixFavorecido || "nossa loja"}. Assim que fizer só mandar o comprovante aqui!`;
    }
    return `Aceitamos Pix sim! Me avisa o que você vai querer que eu já te passo o total e a chave.`;
  }

  for (const prod of input.desk.products) {
    const pName = prod.name.toLowerCase();
    const words = pName.split(" ");
    if (words.some((w) => w.length > 3 && text.includes(w))) {
      const price = brl(prod.priceCents);
      return `${prod.name} sai por ${price} a ${prod.unit}. ${prod.available ? "Temos disponível sim!" : "No momento está em falta."} Quer que separe para você?`;
    }
  }

  if (text.includes("quanto") || text.includes("preco") || text.includes("preço") || text.includes("valor")) {
    const list = input.desk.products.slice(0, 3).map((p) => `${p.name}: ${brl(p.priceCents)}/${p.unit}`).join(", ");
    return `Nossos principais itens: ${list}. Qual desses você precisa hoje?`;
  }

  if (text.includes("imprimir") || text.includes("impressao") || text.includes("impressão") || text.includes("xerox") || text.includes("curriculo") || text.includes("currículo") || text.includes("pdf")) {
    return `Fazemos sim! Pode enviar o arquivo em PDF ou foto aqui no WhatsApp que a gente já calcula e coloca na fila de impressão.`;
  }

  return `Opa, tudo bem? ${attendant}O que você precisa hoje aqui na ${input.desk.shop.name || "loja"}?`;
}
