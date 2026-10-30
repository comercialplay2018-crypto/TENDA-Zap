import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-pine focus:ring-1 focus:ring-pine/20 placeholder:text-muted/60";

export const btnPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-pine px-4 text-sm font-medium text-pine-ink transition hover:bg-pine/90 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-xs";

export const btnGhost =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink transition hover:bg-sand active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";

export const btnClay =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-clay px-4 text-sm font-medium text-clay-ink transition hover:bg-clay/90 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-xs";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium text-ink">{label}</span>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

export function Card({
  children,
  title,
  hint,
  badge,
  action,
}: {
  children: ReactNode;
  title?: string;
  hint?: string;
  badge?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 shadow-xs transition">
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="flex items-center gap-2">
              {title && <h2 className="font-display text-xl text-ink font-semibold tracking-tight">{title}</h2>}
              {badge}
            </div>
            {hint && <p className="mt-0.5 text-xs text-muted leading-relaxed">{hint}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

export function Note({ children, variant = "warn" }: { children: ReactNode; variant?: "warn" | "success" | "info" }) {
  const styles = {
    warn: "border-warn/30 bg-warn-bg text-warn",
    success: "border-pine/30 bg-moss text-pine",
    info: "border-line bg-sand text-ink",
  };
  return (
    <div className={`rounded-xl border px-3 py-2 text-xs leading-relaxed font-medium ${styles[variant]}`}>
      {children}
    </div>
  );
}
