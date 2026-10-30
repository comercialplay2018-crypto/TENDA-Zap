import { Bot, Power, Printer, RefreshCw, Sparkles, Store } from "lucide-react";
import type { Desk } from "@/types/balcao";
import { clockIn, openState } from "@/utils/time";

export function Header({
  desk,
  onToggleBot,
  onOpenOficina,
  onResetData,
}: {
  desk: Desk;
  onToggleBot: () => void;
  onOpenOficina: () => void;
  onResetData: () => void;
}) {
  const clock = clockIn(desk.shop.timezone);
  const state = openState(clock, desk.hours, desk.exceptions);

  return (
    <header className="rounded-2xl border border-line bg-surface p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <span className="flex h-2 w-2 rounded-full bg-pine animate-pulse" />
            <p className="text-xs font-semibold uppercase tracking-wider text-pine">
              {desk.shop.name || "Sua Loja"}
            </p>
          </div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
              Balcão
            </h1>
            <span
              className="inline-flex items-center gap-1 rounded-full border border-pine/30 bg-moss/80 px-2 py-0.5 text-[11px] font-bold text-pine shadow-2xs select-none"
              title="Versão do sistema Balcão: v2.4.0 (Última atualização)"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-pine animate-pulse" />
              v2.4.0
            </span>
          </div>
          <p
            className={`mt-1 inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${
              state.open ? "bg-moss text-pine" : "bg-clay/10 text-clay"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${state.open ? "bg-pine" : "bg-clay"}`} />
            {state.reason}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          {/* Bot State Button */}
          <button
            type="button"
            onClick={onToggleBot}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition active:scale-95 shadow-2xs ${
              desk.shop.botEnabled
                ? "bg-pine text-pine-ink hover:bg-pine/90"
                : "bg-line text-muted hover:bg-line/80"
            }`}
            title={desk.shop.botEnabled ? "Clique para pausar atendimento automático" : "Clique para ativar atendimento automático"}
          >
            {desk.shop.botEnabled ? (
              <>
                <Bot size={14} className="animate-bounce" />
                <span>IA Atendendo</span>
              </>
            ) : (
              <>
                <Power size={14} />
                <span>IA Pausada</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onOpenOficina}
              className="inline-flex items-center gap-1 rounded-lg border border-line bg-sand px-2 py-1 text-xs text-ink hover:bg-line/60 transition"
              title="Balcão da Loja / Impressão"
            >
              <Printer size={13} className="text-pine" />
              <span>Impressora</span>
            </button>
            <button
              type="button"
              onClick={onResetData}
              className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface p-1 text-xs text-muted hover:text-ink transition"
              title="Limpar e reiniciar atendimento"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
