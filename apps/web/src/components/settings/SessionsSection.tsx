"use client";

import { Laptop, LogOut } from "lucide-react";
import { useSessions, useRevokeSession, useRevokeOtherSessions } from "@/hooks/useSessions";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function SessionsSection() {
  const { data: sessions = [], isLoading } = useSessions();
  const revokeMutation = useRevokeSession();
  const revokeOthersMutation = useRevokeOtherSessions();

  const hasOtherSessions = sessions.some((s) => !s.is_current);

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="h-20 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
      ) : (
        <ul className="space-y-2">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5 border border-[var(--border)] rounded-lg"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Laptop size={16} className="text-[var(--text-muted)] shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-[var(--text-primary)] font-medium flex items-center gap-1.5">
                    {session.device_info ?? "Dispositivo desconhecido"}
                    {session.is_current && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)]/15 text-[var(--accent)] font-normal">
                        Este dispositivo
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {session.ip_address ?? "IP desconhecido"} · desde {formatDateTime(session.created_at)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => revokeMutation.mutate(session.id)}
                disabled={revokeMutation.isPending}
                className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--danger)] shrink-0 disabled:opacity-40"
              >
                <LogOut size={13} /> Sair
              </button>
            </li>
          ))}
        </ul>
      )}

      {hasOtherSessions && (
        <button
          onClick={() => revokeOthersMutation.mutate()}
          disabled={revokeOthersMutation.isPending}
          className="text-xs text-[var(--navy)] dark:text-[var(--accent)] hover:underline disabled:opacity-40"
        >
          Sair de todos os outros dispositivos
        </button>
      )}
    </div>
  );
}
