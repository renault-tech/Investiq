"use client";

import { useEffect, useMemo, useState } from "react";
import { Landmark, Layers, Pencil, Plus, Wallet } from "lucide-react";
import { useAccounts } from "@/hooks/useAccounts";
import { useMask } from "@/hooks/useMask";
import { useFinanceScopeStore } from "@/store/useFinanceScopeStore";
import { formatBRLExact } from "@/components/charts/chartTheme";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { AccountModal } from "./AccountModal";
import { ACCOUNT_TYPE_LABELS, type Account } from "@/lib/accounts-api";

interface Props {
  /** Titular selecionado ("" = todos) — controlado pelo pai, que também
   * aplica o filtro nas demais consultas da página. */
  holder: string;
  onHolderChange: (holder: string) => void;
}

export function AccountsBar({ holder, onHolderChange }: Props) {
  const { data: accounts = [], isLoading, isError, refetch } = useAccounts();
  const mask = useMask();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Account | undefined>(undefined);
  const activeAccountId = useFinanceScopeStore((s) => s.activeAccountId);
  const setActiveAccountId = useFinanceScopeStore((s) => s.setActiveAccountId);

  const holders = useMemo(
    () => Array.from(new Set(accounts.map((a) => a.holder).filter((h): h is string => !!h))).sort(),
    [accounts]
  );

  const visible = holder ? accounts.filter((a) => a.holder === holder) : accounts;
  const total = visible
    .filter((a) => a.include_in_total)
    .reduce((sum, a) => sum + Number(a.balance), 0);

  // Titular trocado (ou conta apagada) escondeu a carteira ativa — voltar
  // ao consolidado em vez de deixar o filtro "preso" numa conta invisível.
  useEffect(() => {
    if (activeAccountId && !accounts.some((a) => a.id === activeAccountId)) {
      setActiveAccountId(null);
    }
  }, [accounts, activeAccountId, setActiveAccountId]);

  const openNew = () => {
    setEditing(undefined);
    setShowModal(true);
  };

  return (
    <section className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)] animate-rise-up" style={{ animationDelay: ".22s" }}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Contas</h2>
          {activeAccountId && (
            <button
              onClick={() => setActiveAccountId(null)}
              className="flex items-center gap-1.5 px-2 py-1 text-[11px] rounded-lg border transition-colors"
              style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--glow)" }}
            >
              <Layers size={12} /> Ver consolidado
            </button>
          )}
          {holders.length > 0 && (
            <select
              value={holder}
              onChange={(e) => onHolderChange(e.target.value)}
              aria-label="Filtrar por titular"
              className="px-2 py-1 text-xs border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text-secondary)]"
            >
              <option value="">Todos os titulares</option>
              {holders.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-3">
          {visible.length > 0 && (
            <span className="text-xs text-[var(--text-muted)]">
              Total{" "}
              <span className="font-mono font-medium text-[var(--text-primary)]">
                {mask(formatBRLExact(total))}
              </span>
            </span>
          )}
          <Button size="sm" variant="secondary" onClick={openNew}>
            <Plus size={14} /> Conta
          </Button>
        </div>
      </div>

      {isError && !isLoading ? (
        <ErrorState title="Não foi possível carregar as contas." onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title={holder ? `Nenhuma conta de ${holder}.` : "Nenhuma conta cadastrada."}
          description="Crie uma conta por banco (e use o titular para separar as contas de outra pessoa)."
          action={<Button onClick={openNew}>Criar conta</Button>}
        />
      ) : (
        <ul className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {visible.map((account) => {
            const balance = Number(account.balance);
            const active = account.id === activeAccountId;
            return (
              <li
                key={account.id}
                role="button"
                tabIndex={0}
                aria-pressed={active}
                onClick={() => setActiveAccountId(active ? null : account.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveAccountId(active ? null : account.id);
                  }
                }}
                className="group relative border rounded-2xl p-4 transition-colors cursor-pointer"
                style={{
                  borderColor: active ? "var(--accent)" : "var(--border)",
                  background: active ? "var(--glow)" : "var(--surface-2)",
                }}
                title={active ? "Clique para ver o consolidado" : `Ver só ${account.name}`}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                      {account.name}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] truncate">
                      {ACCOUNT_TYPE_LABELS[account.account_type]}
                      {account.holder ? ` · ${account.holder}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(account);
                      setShowModal(true);
                    }}
                    aria-label={`Editar ${account.name}`}
                    className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-opacity"
                  >
                    <Pencil size={13} />
                  </button>
                </div>
                <p
                  className={`mt-2 font-mono text-sm ${
                    balance < 0 ? "text-[var(--danger)]" : "text-[var(--text-primary)]"
                  }`}
                >
                  {mask(formatBRLExact(balance))}
                </p>
                {!account.include_in_total && (
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5 flex items-center gap-1">
                    <Wallet size={10} /> fora do total
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {showModal && (
        <AccountModal
          editing={editing}
          onClose={() => {
            setShowModal(false);
            setEditing(undefined);
          }}
        />
      )}
    </section>
  );
}
