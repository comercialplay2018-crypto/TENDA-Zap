import type {
  Desk,
  ChatMessage,
  ThreadSummary,
  ReceiptRow,
  PrintJob,
  WaLinkStatus,
  ShopJob,
} from "@/types/balcao";

const STORAGE_KEY_DESK = "balcao_desk_v1";
const STORAGE_KEY_THREADS = "balcao_threads_v1";
const STORAGE_KEY_MESSAGES = "balcao_messages_v1";
const STORAGE_KEY_RECEIPTS = "balcao_receipts_v1";
const STORAGE_KEY_PROVA = "balcao_prova_messages_v1";
const STORAGE_KEY_PRINTS = "balcao_prints_v1";
const STORAGE_KEY_JOBS = "balcao_jobs_v1";
const STORAGE_KEY_WALINK = "balcao_walink_v1";

const DEFAULT_DESK: Desk = {
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
  hours: [
    { weekday: 0, closed: true, opens: "00:00", closes: "00:00" },
    { weekday: 1, closed: false, opens: "08:00", closes: "18:30" },
    { weekday: 2, closed: false, opens: "08:00", closes: "18:30" },
    { weekday: 3, closed: false, opens: "08:00", closes: "18:30" },
    { weekday: 4, closed: false, opens: "08:00", closes: "18:30" },
    { weekday: 5, closed: false, opens: "08:00", closes: "18:30" },
    { weekday: 6, closed: false, opens: "08:30", closes: "13:00" },
  ],
  exceptions: [
    {
      id: 1,
      onDate: "2026-11-02",
      kind: "fechado",
      atTime: null,
      note: "Feriado de Finados",
    },
  ],
  products: [
    {
      id: 1,
      name: "Impressão P&B A4 (frente)",
      priceCents: 75,
      unit: "folha",
      details: "Papel sulfite 75g",
      available: true,
    },
    {
      id: 2,
      name: "Impressão Colorida A4",
      priceCents: 250,
      unit: "folha",
      details: "Alta definição jato de tinta",
      available: true,
    },
    {
      id: 3,
      name: "Plastificação A4",
      priceCents: 600,
      unit: "un",
      details: "Polaseal térmico resistente",
      available: true,
    },
    {
      id: 4,
      name: "Encadernação Espiral até 50 folhas",
      priceCents: 800,
      unit: "un",
      details: "Capa cristal e contracapa preta",
      available: true,
    },
    {
      id: 5,
      name: "Montagem de Currículo Profissional",
      priceCents: 1500,
      unit: "un",
      details: "Formatado em PDF com 3 cópias impressas",
      available: true,
    },
    {
      id: 6,
      name: "Água Mineral 500ml",
      priceCents: 350,
      unit: "un",
      details: "Gelada ou natural",
      available: true,
    },
    {
      id: 7,
      name: "Refrigerante Lata 350ml",
      priceCents: 500,
      unit: "un",
      details: "Coca-Cola, Guaraná",
      available: true,
    },
  ],
  promos: [
    {
      id: 1,
      title: "Combo Estudante",
      details: "Encadernação + 20 impressões P&B por apenas R$ 18,00",
      startsAt: null,
      endsAt: null,
      active: true,
    },
  ],
  notices: [
    {
      id: 1,
      body: "Aceitamos Pix, cartão de crédito, débito e dinheiro.",
      active: true,
    },
  ],
  connection: {
    phoneNumberId: "109283746592817",
    displayPhone: "+55 (11) 98765-4321",
    verifyToken: "balcao_token_8899",
    tokenSet: true,
    tokenTail: "7f8a",
    secretSet: true,
  },
};

const DEFAULT_THREADS: ThreadSummary[] = [];

const DEFAULT_MESSAGES: Record<number, ChatMessage[]> = {};

const DEFAULT_RECEIPTS: ReceiptRow[] = [];

const DEFAULT_PROVA: ChatMessage[] = [
  {
    id: 1,
    direction: "out",
    kind: "text",
    body: "Oi! Sou a Carla aqui do Balcão. Pode mandar mensagem de texto, gravar áudio ou mandar comprovante que eu respondo na hora.",
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_PRINTS: PrintJob[] = [];

const DEFAULT_JOBS: ShopJob[] = [];

const DEFAULT_WALINK: WaLinkStatus = {
  status: "open",
  qrDataUrl: null,
  phone: "5511987654321",
  note: "Conectado como aparelho de WhatsApp comercial.",
};

export class BalcaoStorage {
  static getDesk(): Desk {
    try {
      const data = localStorage.getItem(STORAGE_KEY_DESK);
      if (data) return JSON.parse(data);
    } catch {
      // fallback
    }
    this.saveDesk(DEFAULT_DESK);
    return DEFAULT_DESK;
  }

  static saveDesk(desk: Desk): void {
    try {
      localStorage.setItem(STORAGE_KEY_DESK, JSON.stringify(desk));
    } catch {
      // storage quota or SSR
    }
  }

  static getThreads(): ThreadSummary[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_THREADS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          const mockNames = ["mariana santos", "carlos mecânica", "dra. juliana", "roberto silva"];
          return parsed.filter((t) => !mockNames.some((m) => t.name.toLowerCase().includes(m)));
        }
      }
    } catch {
      // fallback
    }
    this.saveThreads(DEFAULT_THREADS);
    return DEFAULT_THREADS;
  }

  static saveThreads(threads: ThreadSummary[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_THREADS, JSON.stringify(threads));
    } catch {}
  }

  static getMessages(contactId: number): ChatMessage[] {
    try {
      const data = localStorage.getItem(`${STORAGE_KEY_MESSAGES}_${contactId}`);
      if (data) return JSON.parse(data);
    } catch {}
    const init = DEFAULT_MESSAGES[contactId] || [];
    this.saveMessages(contactId, init);
    return init;
  }

  static saveMessages(contactId: number, messages: ChatMessage[]): void {
    try {
      localStorage.setItem(`${STORAGE_KEY_MESSAGES}_${contactId}`, JSON.stringify(messages));
    } catch {}
  }

  static getReceipts(): ReceiptRow[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_RECEIPTS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          const mockNames = ["carlos alberto mendes", "lucas ferreira lima", "patrícia souza", "juliana almeida rocha"];
          return parsed.filter((r) => !mockNames.some((m) => (r.payerName || "").toLowerCase().includes(m)));
        }
      }
    } catch {}
    this.saveReceipts(DEFAULT_RECEIPTS);
    return DEFAULT_RECEIPTS;
  }

  static saveReceipts(receipts: ReceiptRow[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_RECEIPTS, JSON.stringify(receipts));
    } catch {}
  }

  static getProvaMessages(): ChatMessage[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_PROVA);
      if (data) return JSON.parse(data);
    } catch {}
    this.saveProvaMessages(DEFAULT_PROVA);
    return DEFAULT_PROVA;
  }

  static saveProvaMessages(messages: ChatMessage[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_PROVA, JSON.stringify(messages));
    } catch {}
  }

  static getPrintJobs(): PrintJob[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_PRINTS);
      if (data) return JSON.parse(data);
    } catch {}
    this.savePrintJobs(DEFAULT_PRINTS);
    return DEFAULT_PRINTS;
  }

  static savePrintJobs(jobs: PrintJob[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_PRINTS, JSON.stringify(jobs));
    } catch {}
  }

  static getShopJobs(): ShopJob[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_JOBS);
      if (data) return JSON.parse(data);
    } catch {}
    this.saveShopJobs(DEFAULT_JOBS);
    return DEFAULT_JOBS;
  }

  static saveShopJobs(jobs: ShopJob[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_JOBS, JSON.stringify(jobs));
    } catch {}
  }

  static getWaLink(): WaLinkStatus {
    try {
      const data = localStorage.getItem(STORAGE_KEY_WALINK);
      if (data) return JSON.parse(data);
    } catch {}
    this.saveWaLink(DEFAULT_WALINK);
    return DEFAULT_WALINK;
  }

  static saveWaLink(status: WaLinkStatus): void {
    try {
      localStorage.setItem(STORAGE_KEY_WALINK, JSON.stringify(status));
    } catch {}
  }

  static resetToDefaults(): void {
    localStorage.removeItem(STORAGE_KEY_DESK);
    localStorage.removeItem(STORAGE_KEY_THREADS);
    localStorage.removeItem(STORAGE_KEY_RECEIPTS);
    localStorage.removeItem(STORAGE_KEY_PROVA);
    localStorage.removeItem(STORAGE_KEY_PRINTS);
    localStorage.removeItem(STORAGE_KEY_JOBS);
    localStorage.removeItem(STORAGE_KEY_WALINK);
    // clear all contact messages
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_MESSAGES)) {
        localStorage.removeItem(key);
      }
    }
  }
}
