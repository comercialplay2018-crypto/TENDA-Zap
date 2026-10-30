import { MessageCircle, Mic, Store, Receipt, Cable } from "lucide-react";

export type TabType = "conversas" | "prova" | "loja" | "pix" | "ligar";

interface NavigationProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  pendingPixCount: number;
  unreadMessagesCount: number;
}

export function Navigation({
  currentTab,
  onTabChange,
  pendingPixCount,
  unreadMessagesCount,
}: NavigationProps) {
  const tabs = [
    {
      id: "conversas" as TabType,
      label: "Conversas",
      icon: MessageCircle,
      badge: unreadMessagesCount > 0 ? unreadMessagesCount : null,
      badgeColor: "bg-pine text-white",
    },
    {
      id: "prova" as TabType,
      label: "Prova",
      icon: Mic,
      badge: null,
      badgeColor: "",
    },
    {
      id: "loja" as TabType,
      label: "Loja",
      icon: Store,
      badge: null,
      badgeColor: "",
    },
    {
      id: "pix" as TabType,
      label: "Pix",
      icon: Receipt,
      badge: pendingPixCount > 0 ? pendingPixCount : null,
      badgeColor: "bg-clay text-white",
    },
    {
      id: "ligar" as TabType,
      label: "Ligar",
      icon: Cable,
      badge: null,
      badgeColor: "",
    },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md">
      <div className="mx-auto grid max-w-xl grid-cols-5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 transition active:scale-95 ${
                isActive ? "text-pine font-semibold" : "text-muted hover:text-ink"
              }`}
            >
              <span className="relative">
                <Icon size={21} strokeWidth={isActive ? 2.2 : 1.75} />
                {tab.badge !== null && (
                  <span
                    className={`absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none ${tab.badgeColor}`}
                  >
                    {tab.badge}
                  </span>
                )}
              </span>
              <span className="text-[11px] tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
