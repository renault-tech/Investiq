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
import { buildHolderOptions, matchesHolder } from "@/lib/holders";

interface AccountChipProps {
  account: Account;
  active: boolean;
  onToggle: () => void;
  onEdit: () => void;
  mask: (value: string) => string;
}

/** Pílula "Nome R$ saldo", compartilhada entre o card de Contas e a tira
 * embutida no cabeçalho — a mesma informação, só o container muda. */
function AccountChip({ account, active, onToggle, onEdit, mask }: AccountChipProps) {
  const balance = Number(account.balance);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className="group flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full border transition-colors cursor-pointer"
      style={{
        borderColor: active ? "var(--accent)" : "var(--border)",
        background: active ? "var(--glow)" : "var(--surface-2)",
      }}
      title={active ? "Clique para ver o consolidado" : `Ver só ${account.name}`}
    >
      <span className="text-xs font-medium text-[var(--text-primary)] truncate max-w-[96px]">
        {account.name}
      </span>
      <span
        className={`font-mono text-[11px] whitespace-nowrap ${
          balance < 0 ? "text-[var(--danger)]" : "text-[var(--text-secondary)]"
        }`}
      >
        {mask(formatBRLExact(balance))}
      </span>
      {!account.include_in_total && (
        <span title="Fora do total">
          <Wallet size={10} className="text-[var(--text-muted)]" />
        </span>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        aria-label={`Editar ${account.name}`}
        // Revelar só no group-hover deixava o botão invisível no toque (sem
        // :hover, o dedo não tem como "passar por cima" antes de tocar) —
        // visível sempre até md, esconde e revela por hover só no desktop.
        className="opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-opacity"
      >
        <Pencil size={11} />
      </button>
    </div>
  );
}

interface Props {
  /** Titular selecionado ("" = todos) — controlado pelo pai, que também
   * aplica o filtro nas demais consultas da página. */
  holder: string;
  onHolderChange: (holder: string) => void;
  /** Sem o cartão próprio (borda/sombra/padding) — para quando o pai já
   * embrulha isto num DashboardCard da grade ajustável (Finanças). Sozinho
   * em Transações, mantém o cartão de sempre. */
  bare?: boolean;
  /** Tira única (sem título, sem "Total", sem estado vazio ilustrado) para
   * caber no espaço ocioso do cabeçalho da página, ao lado do seletor de
   * mês — em vez de reservar um card inteiro (a maior parte dele vazia) só
   * pras contas. Ignora `bare`. */
  inline?: boolean;
}

export function AccountsBar({ holder, onHolderChange, bare = false, inline = false }: Props) {
  const { data: accounts = [], isLoading, isError, refetch } = useAccounts();
  const mask = useMask();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Account | undefined>(undefined);
  const activeAccountId = useFinanceScopeStore((s) => s.activeAccountId);
  const setActiveAccountId = useFinanceScopeStore((s) => s.setActiveAccountId);

  const holderOptions = useMemo(() => buildHolderOptions(accounts), [accounts]);

  const visible = accounts.filter((a) => matchesHolder(a.holder, holder));
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

  const accountModal = showModal && (
    <AccountModal
      editing={editing}
      onClose={() => {
        setShowModal(false);
        setEditing(undefined);
      }}
    />
  );

  if (inline) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        {holderOptions.length > 1 && (
          <select
            value={holder}
            onChange={(e) => onHolderChange(e.target.value)}
            aria-label="Filtrar por titular"
            className="px-2 py-1 text-xs border border-[var(--border)] rounded-lg bg-[var(--surface-2)] text-[var(--text-secondary)] flex-shrink-0"
          >
            {holderOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )}
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-7 w-24 rounded-full" />)
        ) : isError ? (
          <button onClick={() => refetch()} className="text-xs text-[var(--danger)] hover:underline">
            Erro ao carregar contas — tentar de novo
          </button>
        ) : (
          visible.map((account) => (
            <AccountChip
              key={account.id}
              account={account}
              active={account.id === activeAccountId}
              onToggle={() => setActiveAccountId(account.id === activeAccountId ? null : account.id)}
              onEdit={() => { setEditing(account); setShowModal(true); }}
              mask={mask}
            />
          ))
        )}
        <button
          onClick={openNew}
          aria-label="Adicionar conta"
          title="Adicionar conta"
          className="w-7 h-7 flex items-center justify-center rounded-full border border-dashed border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)] transition-colors flex-shrink-0"
        >
          <Plus size={14} />
        </button>
        {accountModal}
      </div>
    );
  }

  const Wrapper = bare ? "div" : "section";

  return (
    <Wrapper
      className={
        bare
          ? ""
          : "bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)] animate-rise-up"
      }
      style={bare ? undefined : { animationDelay: ".22s" }}
    >
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
          {holderOptions.length > 1 && (
            <select
              value={holder}
              onChange={(e) => onHolderChange(e.target.value)}
              aria-label="Filtrar por titular"
              className="px-2 py-1 text-xs border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text-secondary)]"
            >
              {holderOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
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
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-full" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title={
            holder
              ? `Nenhuma conta de ${holderOptions.find((o) => o.value === holder)?.label ?? holder}.`
              : "Nenhuma conta cadastrada."
          }
          description="Crie uma conta por banco (e use o titular para separar as contas de outra pessoa)."
          action={<Button onClick={openNew}>Criar conta</Button>}
        />
      ) : (
        // Chips compactos numa linha só (quebrando quando não couber) em vez
        // de uma grade 2x4 de cartões de ~80px de altura cada — a mesma
        // informação (nome, saldo, editar) cabe numa tira bem mais fina, e o
        // card de Contas para de "engolir" a tela sozinho.
        <ul className="flex flex-wrap gap-1.5">
          {visible.map((account) => (
            <li key={account.id}>
              <AccountChip
                account={account}
                active={account.id === activeAccountId}
                onToggle={() => setActiveAccountId(account.id === activeAccountId ? null : account.id)}
                onEdit={() => { setEditing(account); setShowModal(true); }}
                mask={mask}
              />
            </li>
          ))}
        </ul>
      )}

      {accountModal}
    </Wrapper>
  );
}
