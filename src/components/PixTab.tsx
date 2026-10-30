import { useState } from "react";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ShieldCheck,
  Building,
  Key,
  User,
  ExternalLink,
  Receipt,
  Sparkles,
} from "lucide-react";
import { brl, type Desk, type ReceiptRow } from "@/types/balcao";
import { Card, Field, btnGhost, btnPrimary, btnClay, inputClass } from "./Ui";

interface PixTabProps {
  desk: Desk;
  receipts: ReceiptRow[];
  onUpdateReceiptStatus: (id: number, status: ReceiptRow["status"]) => void;
  onOpenConversation: (contactId: number) => void;
  onSavePixConfig: (config: { pixKey: string; pixFavorecido: string; pixBanco: string }) => void;
}

export function PixTab({
  desk,
  receipts,
  onUpdateReceiptStatus,
  onOpenConversation,
  onSavePixConfig,
}: PixTabProps) {
  const [filter, setFilter] = useState<"todos" | "liberado" | "duvida" | "conferido">("todos");

  // Shop Pix Form state
  const [pixKey, setPixKey] = useState(desk.shop.pixKey);
  const [pixFavorecido, setPixFavorecido] = useState(desk.shop.pixFavorecido);
  const [pixBanco, setPixBanco] = useState(desk.shop.pixBanco);
  const [configSaved, setConfigSaved] = useState(false);

  const liberadosCount = receipts.filter((r) => r.status === "liberado").length;
  const duvidasCount = receipts.filter((r) => r.status === "duvida" || r.status === "recusado").length;
  const conferidosCount = receipts.filter((r) => r.status === "conferido").length;

  const filteredReceipts = receipts.filter((r) => {
    if (filter === "liberado") return r.status === "liberado";
    if (filter === "duvida") return r.status === "duvida" || r.status === "recusado";
    if (filter === "conferido") return r.status === "conferido";
    return true;
  });

  function handleSaveConfig() {
    onSavePixConfig({ pixKey, pixFavorecido, pixBanco });
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2500);
  }

  const STATUS_META: Record<
    ReceiptRow["status"],
    { label: string; bg: string; text: string; icon: typeof CheckCircle }
  > = {
    liberado: {
      label: "Liberado pela IA (Falta conferir no banco)",
      bg: "bg-moss border-pine/30",
      text: "text-pine font-semibold",
      icon: ShieldCheck,
    },
    duvida: {
      label: "Segurou — Conferir com atenção",
      bg: "bg-warn-bg border-warn/30",
      text: "text-warn font-semibold",
      icon: AlertTriangle,
    },
    recusado: {
      label: "Recusado pela IA",
      bg: "bg-clay/10 border-clay/30",
      text: "text-clay font-semibold",
      icon: XCircle,
    },
    conferido: {
      label: "Conferido no banco com sucesso",
      bg: "bg-sand border-line",
      text: "text-muted font-medium",
      icon: CheckCircle,
    },
    nao_caiu: {
      label: "Não caiu no banco",
      bg: "bg-clay/10 border-clay/30",
      text: "text-clay font-semibold",
      icon: XCircle,
    },
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Overview Banner */}
      <section className="rounded-2xl border border-line bg-surface p-4 shadow-xs">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-pine/10 text-pine">
                <Receipt size={14} />
              </span>
              <h2 className="font-display text-xl font-bold text-ink">Fila do Banco (Pix)</h2>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              O atendente lê data, hora, favorecido, banco e valor dos comprovantes enviados pelos clientes. O que ele libera, você confirma no seu app do banco. Ele nunca promete que o dinheiro já caiu na conta.
            </p>
          </div>
        </div>

        {/* Metric pills */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-line bg-sand/70 p-2.5 text-center">
            <span className="text-[11px] font-medium text-muted block">A Conferir</span>
            <span className="font-display text-xl font-bold text-pine">{liberadosCount}</span>
          </div>
          <div className="rounded-xl border border-line bg-sand/70 p-2.5 text-center">
            <span className="text-[11px] font-medium text-muted block">Dúvidas</span>
            <span className="font-display text-xl font-bold text-warn">{duvidasCount}</span>
          </div>
          <div className="rounded-xl border border-line bg-sand/70 p-2.5 text-center">
            <span className="text-[11px] font-medium text-muted block">Confirmados</span>
            <span className="font-display text-xl font-bold text-ink">{conferidosCount}</span>
          </div>
        </div>
      </section>

      {/* Filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {[
          { id: "todos" as const, label: `Todos (${receipts.length})` },
          { id: "liberado" as const, label: `Liberados (${liberadosCount})` },
          { id: "duvida" as const, label: `Dúvidas (${duvidasCount})` },
          { id: "conferido" as const, label: `Conferidos (${conferidosCount})` },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`min-h-9 rounded-full px-3 text-xs font-semibold transition ${
              filter === f.id
                ? "bg-ink text-surface shadow-2xs"
                : "border border-line bg-surface text-muted hover:text-ink hover:bg-sand"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Receipts list */}
      {filteredReceipts.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center text-muted">
          <Receipt size={32} className="mx-auto text-muted/40 mb-2" />
          <p className="font-display text-lg text-ink">Nenhum comprovante nesta categoria</p>
          <p className="mt-1 text-xs">
            Envie um comprovante na aba Prova ou simule clientes enviando no WhatsApp.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredReceipts.map((row) => {
            const meta = STATUS_META[row.status] || STATUS_META.duvida;
            const Icon = meta.icon;

            return (
              <article
                key={row.id}
                className="rounded-2xl border border-line bg-surface p-4 shadow-xs transition hover:border-pine/40"
              >
                {/* Status pill */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${meta.bg} ${meta.text}`}
                  >
                    <Icon size={13} />
                    <span>{meta.label}</span>
                  </span>
                  <span className="text-xs text-muted font-medium">{row.paidAtText || row.paidDate}</span>
                </div>

                {/* Amount display */}
                <div className="mt-2.5 flex items-baseline justify-between">
                  <h3 className="font-display text-3xl font-extrabold tracking-tight text-ink tabular-nums">
                    {row.amountCents != null ? brl(row.amountCents) : "Valor não lido"}
                  </h3>
                  <span className="text-xs font-semibold text-pine">
                    {row.contactName || row.waId}
                  </span>
                </div>

                {/* Details dl */}
                <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl border border-line/60 bg-sand/40 p-3 text-xs leading-relaxed">
                  <div>
                    <span className="text-muted">Favorecido:</span>{" "}
                    <span className="font-medium text-ink">{row.favorecido || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted">Banco:</span>{" "}
                    <span className="font-medium text-ink">{row.banco || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted">Pagador:</span>{" "}
                    <span className="font-medium text-ink">{row.payerName || "—"}</span>
                  </div>
                  <div className="truncate">
                    <span className="text-muted">Autenticação:</span>{" "}
                    <span className="font-mono text-[11px] text-ink">{row.e2eId || "—"}</span>
                  </div>
                </dl>

                {/* AI Decision notes */}
                <div className="mt-2.5 rounded-lg border border-line/70 bg-surface px-3 py-2 text-xs leading-relaxed text-muted">
                  <p>
                    <strong className="text-ink font-semibold">Parecer da IA:</strong> {row.decision}
                  </p>
                </div>

                {/* Optional Media screenshot */}
                {row.mediaDataUrl && (
                  <div className="mt-3 overflow-hidden rounded-xl border border-line">
                    <img
                      src={row.mediaDataUrl}
                      alt="Comprovante enviado"
                      className="max-h-52 w-full object-contain bg-black/5 p-2"
                    />
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-3.5 flex flex-wrap items-center gap-2 pt-1 border-t border-line/60">
                  {row.status === "liberado" && (
                    <button
                      type="button"
                      className={btnPrimary}
                      onClick={() => onUpdateReceiptStatus(row.id, "conferido")}
                    >
                      <CheckCircle size={15} />
                      <span>Conferi no banco</span>
                    </button>
                  )}

                  {row.status !== "conferido" && row.status !== "nao_caiu" && (
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() => onUpdateReceiptStatus(row.id, "nao_caiu")}
                    >
                      <XCircle size={15} className="text-clay" />
                      <span>Não caiu</span>
                    </button>
                  )}

                  {row.contactId && (
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() => onOpenConversation(row.contactId!)}
                    >
                      <span>Abrir conversa</span>
                      <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Store Pix configuration card */}
      <Card
        title="Dados de Pix da Loja"
        hint="Esses dados são usados pelo atendente para informar a chave ao cliente e conferir o nome do favorecido nos comprovantes recebidos."
      >
        <Field label="Chave Pix da loja">
          <input
            type="text"
            className={inputClass}
            placeholder="Telefone, CNPJ, CPF, E-mail ou chave aleatória"
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
          />
        </Field>

        <Field
          label="Nome completo do Favorecido (crucial)"
          hint="Exatamente como impresso no comprovante"
        >
          <input
            type="text"
            className={inputClass}
            placeholder="Ex: CARLA REGINA SILVA BALCAO"
            value={pixFavorecido}
            onChange={(e) => setPixFavorecido(e.target.value)}
          />
        </Field>

        <Field label="Banco de destino">
          <input
            type="text"
            className={inputClass}
            placeholder="Ex: Nubank, Itaú, Banco do Brasil, Inter"
            value={pixBanco}
            onChange={(e) => setPixBanco(e.target.value)}
          />
        </Field>

        <div className="flex items-center gap-3 pt-1">
          <button type="button" className={btnPrimary} onClick={handleSaveConfig}>
            Salvar dados de Pix
          </button>
          {configSaved && (
            <span className="text-xs font-semibold text-pine flex items-center gap-1">
              <CheckCircle size={15} /> Salvo com sucesso!
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}
