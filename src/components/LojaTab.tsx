import { useState } from "react";
import {
  Clock,
  MessageSquare,
  Package,
  Plus,
  Trash2,
  Edit2,
  Check,
  AlertCircle,
  Zap,
  Info,
  Calendar,
  Sparkles,
} from "lucide-react";
import {
  WEEKDAY_LABELS,
  TIMEZONES,
  brl,
  type Desk,
  type Product,
  type ProductInput,
  type Shop,
  type WeekHours,
  type ShopException,
  type Promo,
  type Notice,
  parsePriceToCents,
} from "@/types/balcao";
import { promoIsLive } from "@/utils/time";
import { Card, Field, Note, btnGhost, btnPrimary, btnClay, inputClass } from "./Ui";

type LojaSlice = "fala" | "produtos" | "horario" | "avisos";

interface LojaTabProps {
  desk: Desk;
  onUpdateDesk: (updater: (prev: Desk) => Desk) => void;
}

export function LojaTab({ desk, onUpdateDesk }: LojaTabProps) {
  const [slice, setSlice] = useState<LojaSlice>("fala");

  const slices = [
    { id: "fala" as const, label: "Fala", icon: MessageSquare },
    { id: "produtos" as const, label: `Produtos (${desk.products.length})`, icon: Package },
    { id: "horario" as const, label: "Horário", icon: Clock },
    { id: "avisos" as const, label: `Avisos & Promos (${desk.promos.length + desk.notices.length})`, icon: Zap },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Subtabs switcher */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {slices.map((item) => {
          const Icon = item.icon;
          const isActive = slice === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSlice(item.id)}
              className={`inline-flex min-h-10 items-center gap-1.5 shrink-0 rounded-full px-4 text-xs font-semibold transition active:scale-95 ${
                isActive
                  ? "bg-ink text-surface shadow-2xs"
                  : "border border-line bg-surface text-muted hover:text-ink hover:bg-sand"
              }`}
            >
              <Icon size={14} className={isActive ? "text-pine-ink" : "text-muted"} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {slice === "fala" && <FalaSection shop={desk.shop} onUpdate={(shop) => onUpdateDesk((d) => ({ ...d, shop }))} />}
      {slice === "produtos" && (
        <ProdutosSection
          products={desk.products}
          onUpdate={(products) => onUpdateDesk((d) => ({ ...d, products }))}
        />
      )}
      {slice === "horario" && (
        <HorarioSection
          hours={desk.hours}
          exceptions={desk.exceptions}
          onUpdate={(hours, exceptions) => onUpdateDesk((d) => ({ ...d, hours, exceptions }))}
        />
      )}
      {slice === "avisos" && (
        <AvisosSection
          promos={desk.promos}
          notices={desk.notices}
          onUpdate={(promos, notices) => onUpdateDesk((d) => ({ ...d, promos, notices }))}
        />
      )}
    </div>
  );
}

// 1. FALA SECTION
function FalaSection({ shop, onUpdate }: { shop: Shop; onUpdate: (shop: Shop) => void }) {
  const [form, setForm] = useState(shop);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    onUpdate(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <Card
      title="Como a loja fala"
      hint="O atendente usa essa identidade em todas as conversas no WhatsApp. Sem isso ele não sabe seu catálogo, tom e horário."
    >
      <Field label="Nome da loja">
        <input
          className={inputClass}
          value={form.name}
          placeholder="Ex: Papelaria & Gráfica Express"
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </Field>

      <Field label="Nome de quem atende" hint="Opcional">
        <input
          className={inputClass}
          value={form.attendantName}
          placeholder="Ex: Carla (ou deixe em branco)"
          onChange={(e) => setForm({ ...form, attendantName: e.target.value })}
        />
      </Field>

      <Field label="O que vocês fazem e vendem" hint="Principais produtos, serviços e regras">
        <textarea
          className={inputClass}
          rows={3}
          value={form.about}
          placeholder="Ex: Fazemos impressões rápidas, cópias coloridas, encadernações e vendemos artigos de papelaria e conveniência."
          onChange={(e) => setForm({ ...form, about: e.target.value })}
        />
      </Field>

      <Field label="Jeito de falar / Tom de voz" hint="Instrução direta para a IA">
        <textarea
          className={inputClass}
          rows={3}
          value={form.voice}
          placeholder="Ex: Fale solto e educado como gente de verdade no balcão. Sem enrolar e sem papo de robô."
          onChange={(e) => setForm({ ...form, voice: e.target.value })}
        />
      </Field>

      <Field label="Fuso horário da loja">
        <select
          className={inputClass}
          value={form.timezone}
          onChange={(e) => setForm({ ...form, timezone: e.target.value })}
        >
          {TIMEZONES.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex items-center gap-3 pt-1">
        <button type="button" className={btnPrimary} onClick={handleSave}>
          Salvar identidade da fala
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-xs font-semibold text-pine">
            <Check size={16} /> Salvo com sucesso!
          </span>
        )}
      </div>
    </Card>
  );
}

// 2. PRODUTOS SECTION
function ProdutosSection({
  products,
  onUpdate,
}: {
  products: Product[];
  onUpdate: (products: Product[]) => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [unit, setUnit] = useState("un");
  const [details, setDetails] = useState("");
  const [available, setAvailable] = useState(true);
  const [err, setErr] = useState("");

  function startEdit(product: Product) {
    setEditingId(product.id);
    setName(product.name);
    setPriceStr((product.priceCents / 100).toFixed(2).replace(".", ","));
    setUnit(product.unit);
    setDetails(product.details);
    setAvailable(product.available);
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setPriceStr("");
    setUnit("un");
    setDetails("");
    setAvailable(true);
    setErr("");
  }

  function handleSaveProduct() {
    if (!name.trim()) {
      setErr("Nome do produto é obrigatório.");
      return;
    }
    const cents = parsePriceToCents(priceStr);
    if (cents == null) {
      setErr("Preço inválido (ex: 10,00 ou 2,50).");
      return;
    }

    if (editingId) {
      onUpdate(
        products.map((p) =>
          p.id === editingId
            ? { ...p, name: name.trim(), priceCents: cents, unit: unit.trim() || "un", details: details.trim(), available }
            : p
        )
      );
    } else {
      const newProduct: Product = {
        id: Date.now(),
        name: name.trim(),
        priceCents: cents,
        unit: unit.trim() || "un",
        details: details.trim(),
        available,
      };
      onUpdate([...products, newProduct]);
    }
    resetForm();
  }

  function handleDelete(id: number) {
    onUpdate(products.filter((p) => p.id !== id));
  }

  function toggleAvailable(id: number) {
    onUpdate(products.map((p) => (p.id === id ? { ...p, available: !p.available } : p)));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Product Form Card */}
      <Card
        title={editingId ? "Editar Produto" : "Adicionar Produto ou Serviço"}
        hint="O atendente só informa e calcula os produtos cadastrados aqui."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Nome do produto">
            <input
              type="text"
              className={inputClass}
              placeholder="Ex: Cópia Colorida A4"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Preço (R$)">
              <input
                type="text"
                className={inputClass}
                placeholder="Ex: 2,50"
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
              />
            </Field>
            <Field label="Unidade">
              <input
                type="text"
                className={inputClass}
                placeholder="folha, un, kg"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </Field>
          </div>
        </div>

        <Field label="Detalhes adicionais" hint="Opcional">
          <input
            type="text"
            className={inputClass}
            placeholder="Ex: Papel sulfite 75g, alta resolução"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
        </Field>

        <label className="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer">
          <input
            type="checkbox"
            checked={available}
            onChange={(e) => setAvailable(e.target.checked)}
            className="rounded border-line text-pine focus:ring-pine"
          />
          <span>Item disponível para venda imediata (desmarque se estiver em falta)</span>
        </label>

        {err && <p className="text-xs text-warn">{err}</p>}

        <div className="flex items-center gap-2 pt-1">
          <button type="button" className={btnPrimary} onClick={handleSaveProduct}>
            {editingId ? "Salvar alterações" : "Adicionar produto"}
          </button>
          {editingId && (
            <button type="button" className={btnGhost} onClick={resetForm}>
              Cancelar
            </button>
          )}
        </div>
      </Card>

      {/* Product list */}
      <Card title={`Catálogo Atual (${products.length} itens)`}>
        {products.length === 0 ? (
          <p className="text-xs text-muted text-center py-4">Nenhum produto cadastrado ainda.</p>
        ) : (
          <div className="flex flex-col divide-y divide-line/60">
            {products.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-ink truncate">{p.name}</p>
                    <span
                      onClick={() => toggleAvailable(p.id)}
                      className={`cursor-pointer rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
                        p.available
                          ? "bg-moss text-pine hover:bg-moss/80"
                          : "bg-clay/10 text-clay hover:bg-clay/20"
                      }`}
                    >
                      {p.available ? "Disponível" : "Em falta"}
                    </span>
                  </div>
                  <p className="font-display font-medium text-sm text-pine mt-0.5">
                    {brl(p.priceCents)} <span className="text-xs text-muted font-sans">/ {p.unit}</span>
                  </p>
                  {p.details && <p className="text-xs text-muted truncate mt-0.5">{p.details}</p>}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEdit(p)}
                    className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-sand transition"
                    title="Editar produto"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id)}
                    className="p-1.5 rounded-lg text-muted hover:text-clay hover:bg-clay/10 transition"
                    title="Excluir produto"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// 3. HORARIO SECTION
function HorarioSection({
  hours,
  exceptions,
  onUpdate,
}: {
  hours: WeekHours[];
  exceptions: ShopException[];
  onUpdate: (hours: WeekHours[], exceptions: ShopException[]) => void;
}) {
  const [newExDate, setNewExDate] = useState("");
  const [newExKind, setNewExKind] = useState<ShopException["kind"]>("fechado");
  const [newExTime, setNewExTime] = useState("");
  const [newExNote, setNewExNote] = useState("");

  function updateDay(weekday: number, updates: Partial<WeekHours>) {
    onUpdate(
      hours.map((h) => (h.weekday === weekday ? { ...h, ...updates } : h)),
      exceptions
    );
  }

  function addException() {
    if (!newExDate) return;
    const ex: ShopException = {
      id: Date.now(),
      onDate: newExDate,
      kind: newExKind,
      atTime: newExKind !== "fechado" ? newExTime || null : null,
      note: newExNote.trim(),
    };
    onUpdate(hours, [...exceptions, ex]);
    setNewExDate("");
    setNewExNote("");
  }

  function removeException(id: number) {
    onUpdate(
      hours,
      exceptions.filter((e) => e.id !== id)
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Weekly Schedule */}
      <Card
        title="Horário Semanal de Atendimento"
        hint="O atendente confere o relógio em tempo real antes de responder se a loja está aberta ou fechada."
      >
        <div className="flex flex-col divide-y divide-line/60">
          {WEEKDAY_LABELS.map((label, idx) => {
            const h = hours.find((item) => item.weekday === idx) || {
              weekday: idx,
              closed: false,
              opens: "08:00",
              closes: "18:00",
            };
            return (
              <div key={idx} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span className="w-28 font-medium text-xs text-ink">{label}</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={h.closed}
                      onChange={(e) => updateDay(idx, { closed: e.target.checked })}
                      className="rounded border-line text-clay focus:ring-clay"
                    />
                    <span>Fechado</span>
                  </label>
                  {!h.closed && (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="time"
                        value={h.opens}
                        onChange={(e) => updateDay(idx, { opens: e.target.value })}
                        className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink"
                      />
                      <span className="text-xs text-muted">às</span>
                      <input
                        type="time"
                        value={h.closes}
                        onChange={(e) => updateDay(idx, { closes: e.target.value })}
                        className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Exceptions & Holidays */}
      <Card
        title="Feriados e Exceções"
        hint="Dias em que a loja não abrirá ou abrirá em horário especial (ex: Carnaval, reformas, balanço)."
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            type="date"
            className={inputClass}
            value={newExDate}
            onChange={(e) => setNewExDate(e.target.value)}
          />
          <select
            className={inputClass}
            value={newExKind}
            onChange={(e) => setNewExKind(e.target.value as ShopException["kind"])}
          >
            <option value="fechado">Não abre (dia todo)</option>
            <option value="abre_tarde">Abre mais tarde às</option>
            <option value="fecha_cedo">Fecha mais cedo às</option>
          </select>
          {newExKind !== "fechado" && (
            <input
              type="time"
              className={inputClass}
              value={newExTime}
              onChange={(e) => setNewExTime(e.target.value)}
            />
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            className={inputClass}
            placeholder="Motivo (ex: Feriado municipal, Reforma)"
            value={newExNote}
            onChange={(e) => setNewExNote(e.target.value)}
          />
          <button
            type="button"
            className={`${btnPrimary} shrink-0`}
            disabled={!newExDate}
            onClick={addException}
          >
            Adicionar
          </button>
        </div>

        {exceptions.length > 0 && (
          <div className="flex flex-col gap-2 pt-2">
            {exceptions.map((ex) => (
              <div
                key={ex.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-line bg-sand/60 px-3 py-2 text-xs"
              >
                <div>
                  <span className="font-semibold text-ink">{ex.onDate}</span>:{" "}
                  <span className="text-clay font-medium">
                    {ex.kind === "fechado"
                      ? "Fechado"
                      : ex.kind === "abre_tarde"
                      ? `Abre às ${ex.atTime}`
                      : `Fecha às ${ex.atTime}`}
                  </span>
                  {ex.note && <span className="text-muted"> ({ex.note})</span>}
                </div>
                <button
                  type="button"
                  onClick={() => removeException(ex.id)}
                  className="text-muted hover:text-clay transition p-1"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// 4. AVISOS & PROMOÇÕES SECTION
function AvisosSection({
  promos,
  notices,
  onUpdate,
}: {
  promos: Promo[];
  notices: Notice[];
  onUpdate: (promos: Promo[], notices: Notice[]) => void;
}) {
  const [promoTitle, setPromoTitle] = useState("");
  const [promoDetails, setPromoDetails] = useState("");
  const [noticeBody, setNoticeBody] = useState("");

  function addPromo() {
    if (!promoTitle.trim()) return;
    const newP: Promo = {
      id: Date.now(),
      title: promoTitle.trim(),
      details: promoDetails.trim(),
      startsAt: null,
      endsAt: null,
      active: true,
    };
    onUpdate([...promos, newP], notices);
    setPromoTitle("");
    setPromoDetails("");
  }

  function addNotice() {
    if (!noticeBody.trim()) return;
    const newN: Notice = {
      id: Date.now(),
      body: noticeBody.trim(),
      active: true,
    };
    onUpdate(promos, [...notices, newN]);
    setNoticeBody("");
  }

  function removePromo(id: number) {
    onUpdate(
      promos.filter((p) => p.id !== id),
      notices
    );
  }

  function removeNotice(id: number) {
    onUpdate(
      promos,
      notices.filter((n) => n.id !== id)
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Lightning Promos */}
      <Card
        title="Promoções Relâmpago"
        hint="A IA só cita essas promoções quando o cliente perguntar de preços, promoções ou do item específico."
      >
        <div className="flex flex-col gap-2">
          <input
            type="text"
            className={inputClass}
            placeholder="Título da promoção (ex: Combo Estudante)"
            value={promoTitle}
            onChange={(e) => setPromoTitle(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              type="text"
              className={inputClass}
              placeholder="Detalhes (ex: Encadernação + 20 impressões por R$ 18,00)"
              value={promoDetails}
              onChange={(e) => setPromoDetails(e.target.value)}
            />
            <button
              type="button"
              className={`${btnPrimary} shrink-0`}
              disabled={!promoTitle.trim()}
              onClick={addPromo}
            >
              Criar Promoção
            </button>
          </div>
        </div>

        {promos.length > 0 && (
          <div className="flex flex-col gap-2 pt-2">
            {promos.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-pine/30 bg-moss/60 p-3"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <Zap size={13} className="text-pine fill-pine" />
                    <span className="font-semibold text-xs text-pine">{p.title}</span>
                  </div>
                  <p className="text-xs text-ink mt-0.5">{p.details}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removePromo(p.id)}
                  className="text-muted hover:text-clay transition p-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Notices */}
      <Card
        title="Avisos Importantes da Loja"
        hint="Informações operacionais que a IA precisa saber (formas de pagamento, prazos de entrega, etc.)."
      >
        <div className="flex gap-2">
          <input
            type="text"
            className={inputClass}
            placeholder="Ex: Aceitamos cartões de crédito, débito, Pix e dinheiro."
            value={noticeBody}
            onChange={(e) => setNoticeBody(e.target.value)}
          />
          <button
            type="button"
            className={`${btnPrimary} shrink-0`}
            disabled={!noticeBody.trim()}
            onClick={addNotice}
          >
            Adicionar Aviso
          </button>
        </div>

        {notices.length > 0 && (
          <div className="flex flex-col gap-2 pt-2">
            {notices.map((n) => (
              <div
                key={n.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-sand/60 px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-1.5">
                  <Info size={13} className="text-muted" />
                  <span className="text-ink">{n.body}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeNotice(n.id)}
                  className="text-muted hover:text-clay transition p-1"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
