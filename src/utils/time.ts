import type { ShopException, WeekHours } from "@/types/balcao";

export type Clock = {
  weekday: number;
  date: string;
  minutes: number;
  label: string;
};

export type OpenState = {
  open: boolean;
  reason: string;
};

const WEEKDAYS_PT = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

function parts(date: Date, timeZone: string) {
  try {
    const list = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || "America/Sao_Paulo",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const get = (type: string) => list.find((p) => p.type === type)?.value ?? "";
    return get;
  } catch {
    const list = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const get = (type: string) => list.find((p) => p.type === type)?.value ?? "";
    return get;
  }
}

export function clockIn(timeZone: string, now = new Date()): Clock {
  const get = parts(now, timeZone);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  let hour = Number(get("hour"));
  if (hour === 24 || Number.isNaN(hour)) hour = 0;
  let minute = Number(get("minute"));
  if (Number.isNaN(minute)) minute = 0;
  const weekday = map[get("weekday")] ?? now.getDay();
  const date = `${get("year") || now.getFullYear()}-${get("month") || String(now.getMonth() + 1).padStart(2, "0")}-${get("day") || String(now.getDate()).padStart(2, "0")}`;
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return {
    weekday,
    date,
    minutes: hour * 60 + minute,
    label: `${WEEKDAYS_PT[weekday]}, ${get("day")}/${get("month")} às ${hh}:${mm}`,
  };
}

export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function fmt(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function openState(
  clock: Clock,
  hours: WeekHours[],
  exceptions: ShopException[]
): { open: boolean; reason: string } {
  const ex = exceptions.find((e) => e.onDate === clock.date);
  const today = hours.find((h) => h.weekday === clock.weekday);
  if (ex?.kind === "fechado") {
    return { open: false, reason: ex.note ? `Não abre hoje (${ex.note}).` : "Não abre hoje." };
  }
  if (!today || today.closed) {
    return { open: false, reason: "Fechado neste dia da semana." };
  }
  let opens = hmToMinutes(today.opens);
  let closes = hmToMinutes(today.closes);
  if (ex?.kind === "abre_tarde" && ex.atTime) opens = hmToMinutes(ex.atTime);
  if (ex?.kind === "fecha_cedo" && ex.atTime) closes = hmToMinutes(ex.atTime);
  const span = `${fmt(opens)} às ${fmt(closes)}`;
  const note = ex?.note ? ` (${ex.note})` : "";
  if (clock.minutes >= opens && clock.minutes < closes) {
    return { open: true, reason: `Aberto agora (hoje das ${span})${note}.` };
  }
  if (clock.minutes < opens) {
    return { open: false, reason: `Ainda fechado. Abre hoje às ${fmt(opens)}${note}.` };
  }
  return { open: false, reason: `Já fechou. Hoje funcionou até às ${fmt(closes)}${note}.` };
}

export function formatStamp(iso: string, timeZone: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const get = parts(d, timeZone);
    let hour = Number(get("hour"));
    if (hour === 24 || Number.isNaN(hour)) hour = 0;
    return `${get("day")}/${get("month")} ${String(hour).padStart(2, "0")}:${String(get("minute")).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

export function promoIsLive(
  promo: { active: boolean; startsAt: string | null; endsAt: string | null },
  now = new Date()
): boolean {
  if (!promo.active) return false;
  if (promo.startsAt && new Date(promo.startsAt).getTime() > now.getTime()) return false;
  if (promo.endsAt && new Date(promo.endsAt).getTime() < now.getTime()) return false;
  return true;
}

export function todayPair(timeZone: string): { today: string; yesterday: string } {
  const clock = clockIn(timeZone);
  return { today: clock.date, yesterday: shiftDate(clock.date, -1) };
}
