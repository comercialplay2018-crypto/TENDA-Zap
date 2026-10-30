import { useState } from "react";
import {
  Printer,
  X,
  Download,
  FileText,
  ShoppingBag,
  CheckCircle,
  Clock,
  Play,
  RotateCcw,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import type { PrintJob, ShopJob } from "@/types/balcao";
import { Card, btnGhost, btnPrimary, btnClay } from "./Ui";

interface OficinaModalProps {
  isOpen: boolean;
  onClose: () => void;
  printJobs: PrintJob[];
  shopJobs: ShopJob[];
  onAddPrintJob: (job: Omit<PrintJob, "id" | "createdAt">) => void;
  onUpdatePrintStatus: (id: number, status: PrintJob["status"]) => void;
}

export function OficinaModal({
  isOpen,
  onClose,
  printJobs,
  shopJobs,
  onAddPrintJob,
  onUpdatePrintStatus,
}: OficinaModalProps) {
  const [activeTab, setActiveTab] = useState<"fila" | "curriculo" | "pdv">("fila");
  const [printSuccessNotice, setPrintSuccessNotice] = useState("");

  if (!isOpen) return null;

  function handleTestPrint() {
    onAddPrintJob({
      contactId: null,
      title: "Página de Teste - Balcão Impressora",
      kind: "teste",
      mime: "text/plain",
      payload: "TESTE BALCÃO",
      status: "impresso",
      copies: 1,
    });
    setPrintSuccessNotice("Folha de teste enviada para a fila de impressão!");
    setTimeout(() => setPrintSuccessNotice(""), 3000);
  }

  function handlePrintJob(job: PrintJob) {
    window.print();
    onUpdatePrintStatus(job.id, "impresso");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-3xl border border-line bg-surface shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4 bg-sand/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pine text-pine-ink shadow-xs">
              <Printer size={18} />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-ink">Balcão da Loja & Impressora</h2>
              <p className="text-xs text-muted">Fila automática de documentos, currículos e PDV</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-muted hover:bg-line/60 hover:text-ink transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {/* Windows background agent banner */}
          <div className="rounded-2xl border border-line bg-sand/80 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-pine">
                  Programa da Impressora no Computador
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink">
                  Para impressoras térmicas ou Epson/HP locais imprimirem sozinhas assim que o cliente mandar no WhatsApp, baixe o inicializador para Windows:
                </p>
              </div>
              <a
                href="/impressora/Iniciar-Balcao.bat"
                download
                className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-3 py-2 text-xs font-semibold text-surface transition hover:bg-ink/80 shrink-0"
              >
                <Download size={14} />
                <span>Baixar .BAT</span>
              </a>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestPrint}
                className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-sand transition"
              >
                Imprimir página de teste
              </button>
              {printSuccessNotice && (
                <span className="text-xs text-pine font-medium flex items-center gap-1">
                  <CheckCircle size={14} /> {printSuccessNotice}
                </span>
              )}
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-1.5 border-b border-line pb-2">
            {[
              { id: "fila" as const, label: `Fila de Impressão (${printJobs.length})` },
              { id: "curriculo" as const, label: "Gerador de Currículo" },
              { id: "pdv" as const, label: "Lançamentos de PDV" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === t.id
                    ? "bg-pine text-pine-ink shadow-2xs"
                    : "text-muted hover:text-ink hover:bg-sand"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* 1. Print Queue Tab */}
          {activeTab === "fila" && (
            <div className="flex flex-col gap-2.5">
              {printJobs.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted">
                  Nenhum arquivo na fila de impressão no momento.
                </div>
              ) : (
                printJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-clay/10 text-clay">
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{job.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                          <span>{job.copies || 1} cópia(s)</span>
                          <span>·</span>
                          <span
                            className={
                              job.status === "impresso"
                                ? "text-pine font-medium"
                                : job.status === "aguardando"
                                ? "text-warn font-medium"
                                : "text-clay font-medium"
                            }
                          >
                            {job.status === "impresso"
                              ? "Já impresso"
                              : job.status === "aguardando"
                              ? "Aguardando aprovação"
                              : "Falhou"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePrintJob(job)}
                      className={btnGhost}
                      title="Enviar para a impressora do navegador"
                    >
                      <Printer size={14} className="text-pine" />
                      <span>Imprimir</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 2. Currículo Tab */}
          {activeTab === "curriculo" && (
            <div className="flex flex-col gap-3">
              <div className="rounded-2xl border border-pine/30 bg-moss/50 p-4 text-xs leading-relaxed text-ink">
                <div className="flex items-center gap-1.5 font-semibold text-pine mb-1">
                  <Sparkles size={14} />
                  <span>Montagem Automática de Currículo</span>
                </div>
                Quando um cliente diz no WhatsApp que quer um currículo, a IA pergunta os dados principais (nome, telefone, escolaridade, histórico profissional) e gera o PDF profissional pronto para impressão!
              </div>

              <div className="rounded-2xl border border-line bg-surface p-4 text-xs flex flex-col gap-2">
                <h4 className="font-semibold text-ink text-sm">Exemplo de Currículo Gerado</h4>
                <div className="rounded-xl border border-line bg-sand/40 p-3 leading-relaxed">
                  <p className="font-bold text-sm text-ink">MARIANA DOS SANTOS</p>
                  <p className="text-muted">São Paulo - SP · (11) 99123-4567 · mariana.santos@email.com</p>
                  <div className="my-2 border-t border-line/60" />
                  <p className="font-semibold text-ink">OBJETIVO</p>
                  <p className="text-muted">Atuação na área administrativa, recepção ou atendimento ao cliente.</p>
                  <div className="my-2 border-t border-line/60" />
                  <p className="font-semibold text-ink">ESCOLARIDADE</p>
                  <p className="text-muted">Ensino Médio Completo (Colégio Estadual São Paulo, 2024)</p>
                  <div className="my-2 border-t border-line/60" />
                  <p className="font-semibold text-ink">EXPERIÊNCIA</p>
                  <p className="text-ink font-medium">Assistente de Loja - Magazine Central (2024 - 2025)</p>
                  <p className="text-muted">Atendimento aos clientes, organização do estoque e fechamento de caixa.</p>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className={`${btnPrimary} mt-2 w-full`}
                >
                  <Printer size={15} />
                  <span>Imprimir este Currículo (Formato A4)</span>
                </button>
              </div>
            </div>
          )}

          {/* 3. PDV Tab */}
          {activeTab === "pdv" && (
            <div className="flex flex-col gap-3">
              <div className="rounded-2xl border border-line bg-sand/60 p-4 text-xs leading-relaxed text-ink">
                <p className="font-semibold text-ink text-sm mb-1">Vendas e Comprovantes de Caixa</p>
                Os pedidos confirmados via WhatsApp com comprovante de Pix liberado podem ser lançados diretamente no cupom térmico da loja.
              </div>

              <div className="rounded-2xl border border-line bg-surface p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <span className="font-semibold text-xs text-ink">Venda #1042 - Carlos Mecânica</span>
                  <span className="font-display font-bold text-sm text-pine">R$ 25,00</span>
                </div>
                <p className="text-xs text-muted">10x Impressão Colorida A4 (R$ 2,50/un)</p>
                <div className="flex items-center justify-between text-[11px] text-muted pt-1">
                  <span>Pago via Pix (Confirmado)</span>
                  <span>Hoje às 14:15</span>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className={`${btnGhost} mt-2 text-xs`}
                >
                  <Printer size={14} className="text-pine" />
                  <span>Imprimir Cupom Térmico (80mm)</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-line px-5 py-3 bg-sand/40 flex justify-end">
          <button type="button" onClick={onClose} className={btnGhost}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
