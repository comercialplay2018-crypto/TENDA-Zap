import { useState } from "react";
import {
  ArrowLeft,
  Bot,
  Send,
  UserCheck,
  Search,
  Printer,
  Phone,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import type { ChatMessage, Desk, ThreadSummary } from "@/types/balcao";
import { formatStamp } from "@/utils/time";
import { Bubbles } from "./Bubbles";
import { inputClass } from "./Ui";

interface ConversasTabProps {
  desk: Desk;
  threads: ThreadSummary[];
  messages: Record<number, ChatMessage[]>;
  openId: number | null;
  onOpen: (id: number | null) => void;
  onSendMessage: (contactId: number, text: string) => Promise<void>;
  onToggleBotPause: (contactId: number, paused: boolean) => void;
  onOpenOficina: () => void;
}

export function ConversasTab({
  desk,
  threads,
  messages,
  openId,
  onOpen,
  onSendMessage,
  onToggleBotPause,
  onOpenOficina,
}: ConversasTabProps) {
  const [replyText, setReplyText] = useState("");
  const [filter, setFilter] = useState<"todas" | "ativas" | "assumidas">("todas");
  const [search, setSearch] = useState("");
  const [isSending, setIsSending] = useState(false);

  const currentThread = threads.find((t) => t.id === openId);
  const currentMessages = openId ? messages[openId] || [] : [];

  const filteredThreads = threads.filter((t) => {
    if (filter === "ativas" && t.botPaused) return false;
    if (filter === "assumidas" && !t.botPaused) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.waId.includes(q) ||
        t.preview.toLowerCase().includes(q)
      );
    }
    return true;
  });

  async function handleSend() {
    if (!replyText.trim() || !openId || isSending) return;
    setIsSending(true);
    try {
      await onSendMessage(openId, replyText);
      setReplyText("");
    } finally {
      setIsSending(false);
    }
  }

  // Inside an active conversation with a real customer
  if (openId && currentThread) {
    return (
      <div className="flex flex-col gap-3">
        {/* Top bar with back and bot controls */}
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-surface p-3 shadow-xs">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-sand px-3 py-2 text-xs font-semibold text-ink hover:bg-line/70 transition"
            onClick={() => onOpen(null)}
          >
            <ArrowLeft size={16} />
            <span>Voltar</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenOficina}
              className="inline-flex items-center gap-1 rounded-xl border border-line bg-sand px-2.5 py-2 text-xs font-medium text-ink hover:bg-line/70 transition"
              title="Balcão da loja e impressão"
            >
              <Printer size={14} className="text-pine" />
              <span className="hidden sm:inline">Impressão</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleBotPause(currentThread.id, !currentThread.botPaused)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition active:scale-95 ${
                currentThread.botPaused
                  ? "bg-clay text-clay-ink hover:bg-clay/90 shadow-2xs"
                  : "border border-line bg-surface text-ink hover:bg-sand"
              }`}
            >
              {currentThread.botPaused ? (
                <>
                  <UserCheck size={14} />
                  <span>Você assumiu</span>
                </>
              ) : (
                <>
                  <Bot size={14} className="text-pine" />
                  <span>IA Atendendo</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Real Contact Info Header */}
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-2xs">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pine/10 text-pine font-semibold text-base">
            {currentThread.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-lg font-bold text-ink">
              {currentThread.name}
            </h2>
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="flex items-center gap-1">
                <Phone size={11} /> {currentThread.waId}
              </span>
              <span>·</span>
              <span className={currentThread.botPaused ? "text-clay font-medium" : "text-pine font-medium"}>
                {currentThread.botPaused ? "Humano assumiu" : "IA responde automaticamente mensagens e áudios"}
              </span>
            </div>
          </div>
        </div>

        {/* Real Chat message bubbles */}
        <div className="rounded-2xl border border-line bg-[#efeae2]/50 p-4 shadow-inner min-h-[350px]">
          <Bubbles messages={currentMessages} timeZone={desk.shop.timezone} />
        </div>

        {/* Manual reply box directly into customer's WhatsApp */}
        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3 shadow-xs">
          <label className="text-xs font-medium text-muted">
            Enviar mensagem direta para o WhatsApp deste cliente:
          </label>
          <div className="flex gap-2">
            <textarea
              className={inputClass}
              rows={2}
              value={replyText}
              disabled={isSending}
              placeholder="Digite aqui para enviar diretamente pelo seu WhatsApp..."
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
            />
            <button
              type="button"
              disabled={!replyText.trim() || isSending}
              onClick={() => void handleSend()}
              className="flex h-auto w-12 shrink-0 items-center justify-center rounded-xl bg-pine text-pine-ink transition hover:bg-pine/90 disabled:opacity-50"
              title="Enviar no WhatsApp"
            >
              <Send size={18} />
            </button>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted">
            <span>Pressione Enter para enviar</span>
            <span>
              {currentThread.botPaused
                ? "Atendente IA pausado para este cliente"
                : "IA ativa (clique em 'IA Atendendo' acima para assumir)"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Conversation list view
  return (
    <div className="flex flex-col gap-3">
      {/* Search Bar */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-3.5 text-muted" />
        <input
          type="text"
          className={`${inputClass} pl-9`}
          placeholder="Buscar clientes por nome, número de telefone ou mensagem..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {[
          { id: "todas" as const, label: `Todas (${threads.length})` },
          { id: "ativas" as const, label: `IA Atendendo (${threads.filter((t) => !t.botPaused).length})` },
          { id: "assumidas" as const, label: `Você Assumiu (${threads.filter((t) => t.botPaused).length})` },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`min-h-9 rounded-full px-3.5 text-xs font-semibold transition ${
              filter === f.id
                ? "bg-ink text-surface shadow-2xs"
                : "border border-line bg-surface text-muted hover:text-ink hover:bg-sand"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Real Threads list */}
      {filteredThreads.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-10 text-center text-muted">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-pine/10 text-pine">
            <MessageSquare size={24} />
          </div>
          <p className="font-display text-lg font-bold text-ink">
            {threads.length === 0 ? "Aguardando clientes no WhatsApp" : "Nenhuma conversa com este filtro"}
          </p>
          <p className="mt-1.5 max-w-md mx-auto text-xs leading-relaxed">
            {threads.length === 0
              ? "Assim que qualquer cliente enviar uma mensagem ou áudio para o seu WhatsApp conectado, a conversa aparecerá aqui em tempo real e o atendente automático responderá de imediato."
              : "Nenhuma conversa corresponde ao termo pesquisado."}
          </p>
          {threads.length === 0 && (
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-pine/30 bg-moss/50 px-3.5 py-1 text-xs font-medium text-pine">
              <Sparkles size={12} />
              <span>O atendente inteligente transcreve e responde áudios automaticamente</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredThreads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => onOpen(thread.id)}
              className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 text-left transition hover:border-pine/50 hover:bg-sand/40 active:scale-[0.99] shadow-2xs"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pine/10 text-pine font-bold text-sm">
                {thread.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm text-ink truncate">{thread.name}</span>
                  <span className="text-[11px] text-muted/80 shrink-0">
                    {formatStamp(thread.updatedAt, desk.shop.timezone)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted leading-relaxed">
                  {thread.preview || "Nenhuma mensagem recente"}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  {thread.botPaused ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-clay/20 px-1.5 py-0.5 text-[10px] font-semibold text-clay">
                      <UserCheck size={10} /> Você assumiu
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-moss px-1.5 py-0.5 text-[10px] font-semibold text-pine">
                      <Bot size={10} /> IA Atendendo
                    </span>
                  )}
                  {(thread.unreadCount ?? 0) > 0 && (
                    <span className="rounded-full bg-pine px-1.5 py-0.2 text-[10px] font-bold text-pine-ink">
                      {thread.unreadCount} nova{(thread.unreadCount ?? 0) > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
