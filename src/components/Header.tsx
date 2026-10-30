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

      {/* Account & Cloud Sync Status */}
      <div className="mt-2.5 pt-2 border-t border-line/60 flex items-center justify-between text-[11px] text-muted">
        <div className="flex items-center gap-1.5 truncate">
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          <span className="truncate font-medium text-ink">comercial.play.2018@gmail.com</span>
        </div>
        <span className="flex items-center gap-1 text-pine font-medium shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-pine animate-pulse" />
          Configurações Salvas na Nuvem
        </span>
      </div>
    </header>
  );
}
