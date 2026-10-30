const STOP = new Set(["de", "da", "do", "dos", "das", "e", "ltda", "me", "sa", "eireli"]);

export function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(s: string): string[] {
  return norm(s)
    .split(" ")
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

export function namesMatch(expected: string, found: string): boolean | null {
  const a = tokens(expected);
  const b = tokens(found);
  if (a.length === 0 || b.length === 0) return null;
  const firstOk = b.some((x) => x === a[0] || x.startsWith(a[0]) || a[0].startsWith(x));
  if (!firstOk) return false;
  const hit = a.filter((t) => b.some((x) => x === t || x.startsWith(t) || t.startsWith(x)));
  return hit.length === a.length || hit.length >= Math.min(a.length, 2);
}

export type ReceiptDecision = {
  status: "liberado" | "duvida" | "recusado";
  nameMatches: boolean | null;
  decision: string;
};

export function decideReceipt(input: {
  isReceipt: boolean;
  amountCents: number | null;
  favorecido: string;
  expectedFavorecido: string;
  paidDate: string;
  today: string;
  yesterday: string;
  confidence: string;
  banco: string;
}): ReceiptDecision {
  if (!input.isReceipt) {
    return { status: "recusado", nameMatches: null, decision: "A imagem não parece ser um comprovante de Pix válido." };
  }
  const nameMatches = namesMatch(input.expectedFavorecido, input.favorecido);
  const bits: string[] = [];
  if (!input.expectedFavorecido.trim()) {
    bits.push("cadastre o nome do favorecido na aba Loja / Ligar");
  } else if (nameMatches === false) {
    bits.push(`favorecido lido ("${input.favorecido}") diverge do cadastrado ("${input.expectedFavorecido}")`);
  } else if (nameMatches === null) {
    bits.push("não foi possível identificar o favorecido");
  }

  if (input.amountCents == null || input.amountCents <= 0) {
    bits.push("valor não identificado no comprovante");
  }

  if (!input.paidDate) {
    bits.push("data do pagamento não encontrada");
  } else if (input.paidDate !== input.today && input.paidDate !== input.yesterday) {
    bits.push(`data (${input.paidDate}) não é de hoje nem de ontem`);
  }

  if (input.confidence === "baixa") {
    bits.push("leitura com baixa nitidez");
  }

  if (input.banco) {
    bits.push(`banco de destino: ${input.banco}`);
  }

  const issues = bits.filter((b) => !b.startsWith("banco de destino"));
  if (issues.length > 0) {
    const hardReject = nameMatches === false;
    return {
      status: hardReject ? "recusado" : "duvida",
      nameMatches,
      decision: issues.join(". ") + ".",
    };
  }

  return {
    status: "liberado",
    nameMatches: true,
    decision: `Liberado para conferência no banco. Favorecido e valor conferem. ${bits.filter(b => b.startsWith('banco')).join('. ')}.`.replace("..", "."),
  };
}

export function parseBrlToCents(raw: string): number | null {
  const t = (raw || "").trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (!t) return null;
  const normalized = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return null;
  return Math.round(n * 100);
}
