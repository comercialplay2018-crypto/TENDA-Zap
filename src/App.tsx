import { useState, useEffect } from "react";
import { BalcaoStorage } from "@/services/storage";
import { generateBalcaoReply, parsePixReceiptWithGemini, transcribeAudioViaServer } from "@/services/ai";
import { todayPair } from "@/utils/time";
import type {
  Desk,
  ThreadSummary,
  ChatMessage,
  ReceiptRow,
  PrintJob,
  ShopJob,
  WaLinkStatus,
} from "@/types/balcao";

import { Header } from "@/components/Header";
import { Navigation, type TabType } from "@/components/Navigation";
import { ConversasTab } from "@/components/ConversasTab";
import { ProvaTab } from "@/components/ProvaTab";
import { LojaTab } from "@/components/LojaTab";
import { PixTab } from "@/components/PixTab";
import { LigarTab } from "@/components/LigarTab";
import { OficinaModal } from "@/components/OficinaModal";

export default function App() {
  const [desk, setDesk] = useState<Desk>(() => BalcaoStorage.getDesk());
  const [threads, setThreads] = useState<ThreadSummary[]>(() => BalcaoStorage.getThreads());
  const [receipts, setReceipts] = useState<ReceiptRow[]>(() => BalcaoStorage.getReceipts());
  const [provaMessages, setProvaMessages] = useState<ChatMessage[]>(() => BalcaoStorage.getProvaMessages());
  const [printJobs, setPrintJobs] = useState<PrintJob[]>(() => BalcaoStorage.getPrintJobs());
  const [shopJobs, setShopJobs] = useState<ShopJob[]>(() => BalcaoStorage.getShopJobs());
  const [waLink, setWaLink] = useState<WaLinkStatus>(() => BalcaoStorage.getWaLink());

  // Navigation and active conversation state
  const [currentTab, setCurrentTab] = useState<TabType>("conversas");
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);

  // Messages dictionary per contact
  const [messagesMap, setMessagesMap] = useState<Record<number, ChatMessage[]>>({});

  // Modal states
  const [isOficinaOpen, setIsOficinaOpen] = useState(false);

  // Sync state changes to localStorage
  useEffect(() => {
    BalcaoStorage.saveDesk(desk);
  }, [desk]);

  useEffect(() => {
    BalcaoStorage.saveThreads(threads);
  }, [threads]);

  useEffect(() => {
    BalcaoStorage.saveReceipts(receipts);
  }, [receipts]);

  useEffect(() => {
    BalcaoStorage.saveProvaMessages(provaMessages);
  }, [provaMessages]);

  useEffect(() => {
    BalcaoStorage.savePrintJobs(printJobs);
  }, [printJobs]);

  useEffect(() => {
    BalcaoStorage.saveShopJobs(shopJobs);
  }, [shopJobs]);

  useEffect(() => {
    BalcaoStorage.saveWaLink(waLink);
  }, [waLink]);

  // Load saved desk configuration from server on mount
  useEffect(() => {
    fetch("/api/desk")
      .then((r) => r.json())
      .then((serverDesk) => {
        if (serverDesk && serverDesk.shop?.name) {
          setDesk(serverDesk);
          BalcaoStorage.saveDesk(serverDesk);
        }
      })
      .catch(() => {});
  }, []);

  // Sync desk changes to server backend
  useEffect(() => {
    fetch("/api/desk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ desk }),
    }).catch(() => {});
  }, [desk]);

  // Periodic Polling of Real WhatsApp Threads and Receipts from the Server
  useEffect(() => {
    let active = true;

    async function syncRealData() {
      try {
        const [thRes, recRes] = await Promise.all([
          fetch("/api/whatsapp/threads"),
          fetch("/api/whatsapp/receipts"),
        ]);

        if (thRes.ok && active) {
          const serverThreads = await thRes.json();
          if (Array.isArray(serverThreads)) {
            setThreads(serverThreads);
          }
        }

        if (recRes.ok && active) {
          const serverReceipts = await recRes.json();
          if (Array.isArray(serverReceipts)) {
            setReceipts(serverReceipts);
          }
        }
      } catch {
        // network or server restarting
      }
    }

    syncRealData();
    const interval = window.setInterval(syncRealData, 2000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  // Poll messages for active conversation in real time
  useEffect(() => {
    if (!activeThreadId) return;
    const currentId = activeThreadId;

    let active = true;

    async function fetchActiveMessages() {
      try {
        const res = await fetch(`/api/whatsapp/messages/${currentId}`);
        if (res.ok && active) {
          const msgs = await res.json();
          if (Array.isArray(msgs)) {
            setMessagesMap((prev) => ({ ...prev, [currentId]: msgs }));
          }
        }
      } catch {
        // network error
      }
    }

    fetchActiveMessages();
    const interval = window.setInterval(fetchActiveMessages, 1500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [activeThreadId]);

  // Toggle global bot enable/pause
  function handleToggleBot() {
    setDesk((prev) => {
      const next = {
        ...prev,
        shop: {
          ...prev.shop,
          botEnabled: !prev.shop.botEnabled,
        },
      };
      fetch("/api/whatsapp/sync-desk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ desk: next }),
      }).catch(() => {});
      return next;
    });
  }

  // Clear local mock data
  function handleResetData() {
    if (window.confirm("Deseja limpar as conversas e restaurar as configurações padrão da loja?")) {
      BalcaoStorage.resetToDefaults();
      setDesk(BalcaoStorage.getDesk());
      setThreads([]);
      setReceipts([]);
      setMessagesMap({});
      setActiveThreadId(null);
    }
  }

  // Send real manual message directly to customer via WhatsApp
  async function handleSendManualMessage(contactId: number, text: string) {
    if (!text.trim()) return;

    // Optimistic message update
    const optMsg: ChatMessage = {
      id: Date.now(),
      contactId,
      direction: "out",
      kind: "text",
      body: text.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessagesMap((prev) => ({
      ...prev,
      [contactId]: [...(prev[contactId] || []), optMsg],
    }));

    try {
      const res = await fetch("/api/whatsapp/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, text: text.trim() }),
      });

      if (res.ok) {
        // Fetch real updated messages from server
        const mRes = await fetch(`/api/whatsapp/messages/${contactId}`);
        if (mRes.ok) {
          const msgs = await mRes.json();
          setMessagesMap((prev) => ({ ...prev, [contactId]: msgs }));
        }
      }
    } catch (e) {
      console.error("Erro ao enviar mensagem manual:", e);
    }
  }

  // Toggle bot pause for a specific contact ("Eu assumo" / "Devolver ao atendente")
  async function handleToggleBotPause(contactId: number, paused: boolean) {
    setThreads((prev) =>
      prev.map((t) => (t.id === contactId ? { ...t, botPaused: paused } : t))
    );

    try {
      await fetch("/api/whatsapp/toggle-pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, paused }),
      });

      const mRes = await fetch(`/api/whatsapp/messages/${contactId}`);
      if (mRes.ok) {
        const msgs = await mRes.json();
        setMessagesMap((prev) => ({ ...prev, [contactId]: msgs }));
      }
    } catch (e) {
      console.error("Erro ao alternar pausa do bot:", e);
    }
  }

  // Handle messages in the Sandbox / Prova tab
  async function handleSendProvaMessage(payload: {
    text: string;
    attachment?: { kind: "audio" | "image" | "pdf"; base64: string; mime: string; filename: string };
  }) {
    const userMsg: ChatMessage = {
      id: Date.now(),
      direction: "in",
      kind: payload.attachment?.kind || "text",
      body: payload.text || (payload.attachment ? `[Arquivo: ${payload.attachment.filename}]` : ""),
      mediaUrl: payload.attachment ? `data:${payload.attachment.mime};base64,${payload.attachment.base64}` : undefined,
      filename: payload.attachment?.filename,
      createdAt: new Date().toISOString(),
    };

    let updatedProva = [...provaMessages, userMsg];
    setProvaMessages(updatedProva);

    let pixResult = null;
    let transcription = undefined;

    const { today, yesterday } = todayPair(desk.shop.timezone);

    if (payload.attachment?.kind === "image" || payload.attachment?.kind === "pdf") {
      pixResult = await parsePixReceiptWithGemini({
        bytesBase64: payload.attachment.base64,
        mime: payload.attachment.mime,
        textExtracted: payload.text,
        expectedFavorecido: desk.shop.pixFavorecido,
        today,
        yesterday,
      });

      if (pixResult.isReceipt) {
        const newReceipt: ReceiptRow = {
          id: Date.now(),
          contactId: null,
          contactName: "Cliente na Prova",
          waId: "5511999990000",
          payerName: pixResult.payerName || "Cliente",
          favorecido: pixResult.favorecido,
          banco: pixResult.banco,
          amountCents: pixResult.amountCents,
          paidAtText: pixResult.paidAtText || "Agora",
          paidDate: pixResult.paidDate || today,
          e2eId: pixResult.e2eId || "E" + Date.now().toString(16),
          confidence: pixResult.confidence,
          nameMatches: pixResult.decision.nameMatches,
          decision: pixResult.decision.decision,
          status: pixResult.decision.status,
          note: "Enviado na aba Prova",
          mediaDataUrl: userMsg.mediaUrl || null,
          createdAt: new Date().toISOString(),
        };
        setReceipts((prev) => [newReceipt, ...prev]);
      }
    } else if (payload.attachment?.kind === "audio") {
      transcription = await transcribeAudioViaServer(
        payload.attachment.base64,
        payload.attachment.mime || "audio/wav"
      );
    }

    const history = updatedProva.map((m) => ({
      direction: m.direction,
      body: m.body,
      kind: m.kind,
    }));

    const reply = await generateBalcaoReply({
      desk,
      history,
      customerText: payload.text,
      pix: pixResult,
      transcription,
    });

    const aiMsg: ChatMessage = {
      id: Date.now() + 1,
      direction: "out",
      kind: "text",
      body: reply,
      createdAt: new Date().toISOString(),
    };

    updatedProva = [...updatedProva, aiMsg];
    setProvaMessages(updatedProva);
  }

  function handleClearProva() {
    const welcomeMsg: ChatMessage = {
      id: Date.now(),
      direction: "out",
      kind: "text",
      body: `Oi! Sou a ${desk.shop.attendantName || "atendente"} do Balcão. Pode mandar mensagem de texto, áudio ou comprovante que eu respondo na hora.`,
      createdAt: new Date().toISOString(),
    };
    setProvaMessages([welcomeMsg]);
  }

  // Update receipt status (Conferi no banco / Não caiu)
  async function handleUpdateReceiptStatus(id: number, status: ReceiptRow["status"]) {
    setReceipts((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );

    try {
      await fetch("/api/whatsapp/update-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
    } catch {
      // ignore
    }
  }

  function handleOpenConversationFromReceipt(contactId: number) {
    setActiveThreadId(contactId);
    setCurrentTab("conversas");
  }

  const pendingPixCount = receipts.filter((r) => r.status === "liberado").length;
  const unreadMessagesCount = threads.reduce((acc, t) => acc + (t.unreadCount || 0), 0);

  return (
    <div className="min-h-screen bg-bg text-ink selection:bg-pine/20">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 pb-24 pt-5 gap-4">
        {/* Header */}
        <Header
          desk={desk}
          onToggleBot={handleToggleBot}
          onOpenOficina={() => setIsOficinaOpen(true)}
          onResetData={handleResetData}
        />

        {/* Tab views */}
        <main className="flex-1">
          {currentTab === "conversas" && (
            <ConversasTab
              desk={desk}
              threads={threads}
              messages={messagesMap}
              openId={activeThreadId}
              onOpen={setActiveThreadId}
              onSendMessage={handleSendManualMessage}
              onToggleBotPause={handleToggleBotPause}
              onOpenOficina={() => setIsOficinaOpen(true)}
            />
          )}

          {currentTab === "prova" && (
            <ProvaTab
              desk={desk}
              messages={provaMessages}
              onSendUserMessage={handleSendProvaMessage}
              onClearProva={handleClearProva}
            />
          )}

          {currentTab === "loja" && (
            <LojaTab
              desk={desk}
              onUpdateDesk={(updater) => setDesk(updater)}
            />
          )}

          {currentTab === "pix" && (
            <PixTab
              desk={desk}
              receipts={receipts}
              onUpdateReceiptStatus={handleUpdateReceiptStatus}
              onOpenConversation={handleOpenConversationFromReceipt}
              onSavePixConfig={(cfg) =>
                setDesk((prev) => ({
                  ...prev,
                  shop: {
                    ...prev.shop,
                    pixKey: cfg.pixKey,
                    pixFavorecido: cfg.pixFavorecido,
                    pixBanco: cfg.pixBanco,
                  },
                }))
              }
            />
          )}

          {currentTab === "ligar" && (
            <LigarTab
              desk={desk}
              linkStatus={waLink}
              onUpdateLinkStatus={setWaLink}
              onSaveCloudConnection={(conn) =>
                setDesk((prev) => ({
                  ...prev,
                  connection: conn,
                }))
              }
            />
          )}
        </main>
      </div>

      {/* Bottom Navigation */}
      <Navigation
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
        }}
        pendingPixCount={pendingPixCount}
        unreadMessagesCount={unreadMessagesCount}
      />

      {/* Oficina / Printing Modal */}
      <OficinaModal
        isOpen={isOficinaOpen}
        onClose={() => setIsOficinaOpen(false)}
        printJobs={printJobs}
        shopJobs={shopJobs}
        onAddPrintJob={(job) => {
          const newJ: PrintJob = {
            ...job,
            id: Date.now(),
            createdAt: new Date().toISOString(),
          };
          setPrintJobs((prev) => [newJ, ...prev]);
        }}
        onUpdatePrintStatus={(id, status) => {
          setPrintJobs((prev) =>
            prev.map((j) => (j.id === id ? { ...j, status } : j))
          );
        }}
      />
    </div>
  );
}
