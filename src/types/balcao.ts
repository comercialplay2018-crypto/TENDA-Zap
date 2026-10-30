export type WeekHours = {
  weekday: number;
  closed: boolean;
  opens: string;
  closes: string;
};

export type ShopException = {
  id: number;
  onDate: string;
  kind: "fechado" | "abre_tarde" | "fecha_cedo";
  atTime: string | null;
  note: string;
};

export type Product = {
  id: number;
  name: string;
  priceCents: number;
  unit: string;
  details: string;
  available: boolean;
};

export type Promo = {
  id: number;
  title: string;
  details: string;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
};

export type Notice = {
  id: number;
  body: string;
  active: boolean;
};

export type Shop = {
  name: string;
  attendantName: string;
  about: string;
  voice: string;
  pixKey: string;
  pixFavorecido: string;
  pixBanco: string;
  timezone: string;
  botEnabled: boolean;
};

export type ConnectionPublic = {
  phoneNumberId: string;
  displayPhone: string;
  verifyToken: string;
  tokenSet: boolean;
  tokenTail: string;
  secretSet: boolean;
};

export type WaLinkStatus = {
  status: "off" | "qr" | "connecting" | "open";
  qrDataUrl: string | null;
  phone: string;
  note: string;
};

export type PrintJob = {
  id: number;
  contactId: number | null;
  title: string;
  kind: string;
  mime: string;
  payload: string;
  status: "aguardando" | "imprimindo" | "impresso" | "falhou";
  copies?: number;
  createdAt: string;
};

export type ShopJob = {
  id: number;
  contactId: number | null;
  kind: "curriculo" | "venda";
  title: string;
  detail: string;
  status: string;
  hasFile: boolean;
  createdAt: string;
};

export type Desk = {
  shop: Shop;
  hours: WeekHours[];
  exceptions: ShopException[];
  products: Product[];
  promos: Promo[];
  notices: Notice[];
  connection: ConnectionPublic;
};

export type ThreadSummary = {
  id: number;
  waId: string;
  name: string;
  botPaused: boolean;
  preview: string;
  updatedAt: string;
  unreadCount?: number;
  avatar?: string;
};

export type ChatMessage = {
  id: number;
  contactId?: number;
  direction: "in" | "out";
  kind: "text" | "audio" | "image" | "pdf" | "nota";
  body: string;
  mediaUrl?: string;
  mediaMime?: string;
  filename?: string;
  audioDuration?: number;
  createdAt: string;
};

export type ReceiptRow = {
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
};

export type ProductInput = {
  id: number;
  name: string;
  price: string;
  unit: string;
  details: string;
  available: boolean;
};

export type PromoInput = {
  title: string;
  details: string;
  startsLocal: string;
  endsLocal: string;
  active: boolean;
};

export type ExceptionInput = {
  onDate: string;
  kind: "fechado" | "abre_tarde" | "fecha_cedo";
  atTime: string;
  note: string;
};

export type ConnInput = {
  phoneNumberId: string;
  displayPhone: string;
  accessToken: string;
  appSecret: string;
  clearSecret: boolean;
};

export type ProvaAttachment = {
  kind: "audio" | "image" | "pdf";
  base64: string;
  mime: string;
  filename: string;
};

export type ProvaInput = {
  text: string;
  attachment?: ProvaAttachment;
};

export const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export const TIMEZONES = [
  { id: "America/Sao_Paulo", label: "Brasília, São Paulo, Rio, Sul (GMT-3)" },
  { id: "America/Belem", label: "Belém, Macapá, Pará (GMT-3)" },
  { id: "America/Fortaleza", label: "Fortaleza, Salvador, Nordeste (GMT-3)" },
  { id: "America/Recife", label: "Recife (GMT-3)" },
  { id: "America/Manaus", label: "Manaus, Amazonas (GMT-4)" },
  { id: "America/Cuiaba", label: "Cuiabá, Campo Grande (GMT-4)" },
  { id: "America/Rio_Branco", label: "Rio Branco, Acre (GMT-5)" },
];

export function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function parsePriceToCents(input: string): number | null {
  const t = input.trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (!t) return null;
  const normalized = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return null;
  return Math.round(n * 100);
}
