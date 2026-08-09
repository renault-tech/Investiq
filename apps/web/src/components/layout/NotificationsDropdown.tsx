"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Check, TrendingUp, Wallet, Info } from "lucide-react";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/hooks/useNotifications";
import { Notification } from "@/lib/notifications-api";

const ICONS: Record<Notification["type"], typeof Bell> = {
  price_alert: TrendingUp,
  budget_exceeded: Wallet,
  system: Info,
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data, isError } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const unreadCount = data?.unread_count ?? 0;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label={`Notificações${unreadCount > 0 ? ` (${unreadCount} não lidas)` : ""}`}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--danger)] rounded-full border border-[var(--surface)]" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg z-50 max-h-96 flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-[var(--border)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Notificações</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="flex items-center gap-1 text-xs text-[var(--navy)] dark:text-[var(--accent)] hover:underline"
              >
                <Check size={12} /> Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {isError ? (
              <p className="p-6 text-center text-sm text-[var(--text-muted)]">
                Não foi possível carregar as notificações.
              </p>
            ) : !data || data.items.length === 0 ? (
              <p className="p-6 text-center text-sm text-[var(--text-muted)]">
                Nenhuma notificação por aqui.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {data.items.map((notif) => {
                  const Icon = ICONS[notif.type];
                  const unread = !notif.read_at;
                  return (
                    <li key={notif.id}>
                      <button
                        onClick={() => unread && markRead.mutate(notif.id)}
                        className={`w-full text-left flex gap-2.5 p-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 ${
                          unread ? "bg-slate-50/60 dark:bg-slate-900/30" : ""
                        }`}
                      >
                        <Icon size={15} className="mt-0.5 shrink-0 text-[var(--text-muted)]" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                            {notif.title}
                          </p>
                          {notif.body && (
                            <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">{notif.body}</p>
                          )}
                          <p className="text-[10px] text-[var(--text-muted)] mt-1">{timeAgo(notif.created_at)}</p>
                        </div>
                        {unread && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0 mt-1.5" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
