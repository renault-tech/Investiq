"use client";

import { useEffect, useRef } from "react";
import { Bell, TrendingUp, TrendingDown, Info, X } from "lucide-react";

export interface Notification {
  id: string;
  type: "price_up" | "price_down" | "info";
  title: string;
  body: string;
  time: string;
  read: boolean;
}

// Static demo notifications — will be replaced by a real API when alerts backend is ready
const DEMO_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    type: "price_up",
    title: "PETR4 subiu 3,2%",
    body: "Petrobras atingiu R$ 38,90 na última cotação.",
    time: "há 12 min",
    read: false,
  },
  {
    id: "2",
    type: "price_down",
    title: "VALE3 caiu 2,1%",
    body: "Vale registrou queda para R$ 62,45.",
    time: "há 1 h",
    read: false,
  },
  {
    id: "3",
    type: "info",
    title: "Análise concluída",
    body: "A análise do seu portfólio principal foi gerada.",
    time: "há 3 h",
    read: true,
  },
];

const ICON_MAP = {
  price_up: { Icon: TrendingUp, bg: "bg-emerald-50 dark:bg-emerald-950/30", color: "text-emerald-500" },
  price_down: { Icon: TrendingDown, bg: "bg-red-50 dark:bg-red-950/30", color: "text-red-500" },
  info: { Icon: Info, bg: "bg-blue-50 dark:bg-blue-950/30", color: "text-blue-500" },
};

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  if (!open) return null;

  const unread = DEMO_NOTIFICATIONS.filter((n) => !n.read).length;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-80 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-[var(--text-muted)]" />
          <span className="text-[12px] font-semibold text-[var(--text-primary)]">Notificações</span>
          {unread > 0 && (
            <span className="bg-[var(--navy)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {unread}
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Items */}
      <div className="max-h-96 overflow-y-auto divide-y divide-[var(--border)]">
        {DEMO_NOTIFICATIONS.map((n) => {
          const { Icon, bg, color } = ICON_MAP[n.type];
          return (
            <div
              key={n.id}
              className={`flex gap-3 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                !n.read ? "bg-[var(--background)]" : ""
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${bg}`}>
                <Icon size={14} className={color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-[12px] font-medium leading-tight ${!n.read ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
                    {n.title}
                  </p>
                  {!n.read && (
                    <span className="w-1.5 h-1.5 bg-[var(--navy)] rounded-full flex-shrink-0 mt-1" />
                  )}
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">{n.body}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">{n.time}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-[var(--border)] text-center">
        <button className="text-[11px] text-[var(--navy)] dark:text-[var(--accent)] hover:opacity-70 transition-opacity">
          Marcar todas como lidas
        </button>
      </div>
    </div>
  );
}
