"use client";

import { useMemo } from "react";
import { CheckCircle2, CircleDashed } from "lucide-react";
import type { FinanceTransaction } from "@/lib/finance-api";
import { formatBRLExact } from "@/components/charts/chartTheme";
import { useMask } from "@/hooks/useMask";
import { formatPercent } from "@/lib/number-format";

/** Previsto × executado do mês.
 *
 * O mês já traz as duas coisas misturadas na mesma lista: o que já saiu da
 * conta e o que ainda vai sair (conta a pagar em aberto, parcela futura,
 * ocorrência de recorrência projetada). Somar tudo junto — o que o resumo do
 * mês faz — responde "quanto vai ser", mas não "quanto já foi", e é a
 * diferença entre as duas que diz se o mês está indo como planejado.
 *
 * A régua usa `is_paid`: pago é executado, pendente é previsto. É o mesmo
 * critério do selo na tabela de lançamentos, então os dois números sempre
 * batem com o que está logo abaixo na tela.
 */

interface Bucket {
  executado: number;
  previsto: number;
}

function emptyBucket(): Bucket {
  return { executado: 0, previsto: 0 };
}

function TrackBar({
  bucket,
  color,
  scale,
}: {
  bucket: Bucket;
  color: string;
  scale: number;
}) {
  const total = bucket.executado + bucket.previsto;
  const executadoPct = scale > 0 ? (bucket.executado / scale) * 100 : 0;
  const previstoPct = scale > 0 ? (bucket.previsto / scale) * 100 : 0;
  return (
    <div
      className="h-2.5 w-full rounded-full bg-[var(--surface-3)] overflow-hidden flex"
      role="img"
      aria-label={`Executado ${formatBRLExact(bucket.executado)} de ${formatBRLExact(total)} previsto`}
    >
      <div style={{ width: `${executadoPct}%`, background: color }} className="h-full" />
      {/* O previsto entra hachurado: mesma cor, meio apagado — é dinheiro
          comprometido, mas que ainda não aconteceu. */}
      <div
        style={{
          width: `${previstoPct}%`,
          backgroundImage: `repeating-linear-gradient(135deg, ${color} 0 4px, transparent 4px 8px)`,
          opacity: 0.55,
        }}
        className="h-full"
      />
    </div>
  );
}

function Row({
  label,
  bucket,
  color,
  scale,
  mask,
}: {
  label: string;
  bucket: Bucket;
  color: string;
  scale: number;
  mask: (text: string) => string;
}) {
  const total = bucket.executado + bucket.previsto;
  const pct = total > 0 ? (bucket.executado / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="text-[12px] text-[var(--text-secondary)]">{label}</span>
        <span className="text-[12px] tabular-nums text-[var(--text-primary)]">
          <b className="font-semibold">{mask(formatBRLExact(bucket.executado))}</b>
          <span className="text-[var(--text-muted)]"> de {mask(formatBRLExact(total))}</span>
        </span>
      </div>
      <TrackBar bucket={bucket} color={color} scale={scale} />
      <div className="flex items-center justify-between mt-1 text-[10.5px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1">
          <CheckCircle2 size={10} /> {formatPercent(pct, 0)} executado
        </span>
        {bucket.previsto > 0 && (
          <span className="flex items-center gap-1">
            <CircleDashed size={10} /> falta {mask(formatBRLExact(bucket.previsto))}
          </span>
        )}
      </div>
    </div>
  );
}

export function PlannedVsActual({
  transactions,
  isLoading,
}: {
  transactions: FinanceTransaction[];
  isLoading?: boolean;
}) {
  const mask = useMask();

  const { income, expense, byCategory, scale } = useMemo(() => {
    const income = emptyBucket();
    const expense = emptyBucket();
    const byCategory = new Map<string, Bucket & { color: string | null }>();

    for (const txn of transactions) {
      // Transferência anda entre contas do próprio usuário: não é receita
      // nem despesa, entraria duas vezes no comparativo.
      if (txn.transaction_type === "transfer") continue;
      const amount = Number(txn.amount);
      if (!Number.isFinite(amount)) continue;
      const target = txn.transaction_type === "income" ? income : expense;
      const key = txn.is_paid ? "executado" : "previsto";
      target[key] += amount;

      if (txn.transaction_type === "expense") {
        const name = txn.category_name ?? "Sem categoria";
        const bucket = byCategory.get(name) ?? { ...emptyBucket(), color: txn.category_color };
        bucket[key] += amount;
        byCategory.set(name, bucket);
      }
    }

    const scale = Math.max(
      income.executado + income.previsto,
      expense.executado + expense.previsto,
      1
    );
    const sorted = Array.from(byCategory.entries())
      .map(([name, bucket]) => ({ name, ...bucket, total: bucket.executado + bucket.previsto }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return { income, expense, byCategory: sorted, scale };
  }, [transactions]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-11 rounded-lg bg-[var(--surface-2)] animate-pulse" />
        ))}
      </div>
    );
  }

  const nothingPlanned = income.previsto === 0 && expense.previsto === 0;

  return (
    <div className="space-y-4">
      <Row label="Receitas" bucket={income} color="var(--accent)" scale={scale} mask={mask} />
      <Row label="Despesas" bucket={expense} color="var(--danger)" scale={scale} mask={mask} />

      {byCategory.length > 0 && (
        <div className="border-t border-[var(--border)] pt-3.5 space-y-2.5">
          <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-[.06em]">
            Maiores despesas do mês
          </div>
          {byCategory.map((cat) => {
            const total = cat.executado + cat.previsto;
            return (
              <div key={cat.name} className="flex items-center gap-2.5">
                <span
                  className="w-2 h-2 rounded-[3px] flex-shrink-0"
                  style={{ background: cat.color ?? "var(--text-muted)" }}
                />
                <span className="text-[11.5px] text-[var(--text-secondary)] flex-1 truncate">
                  {cat.name}
                </span>
                <div className="w-[92px] flex-shrink-0">
                  <TrackBar
                    bucket={cat}
                    color={cat.color ?? "var(--text-muted)"}
                    scale={Math.max(...byCategory.map((c) => c.executado + c.previsto), 1)}
                  />
                </div>
                <span className="text-[11px] tabular-nums text-[var(--text-primary)] w-[86px] text-right">
                  {mask(formatBRLExact(total))}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10.5px] text-[var(--text-muted)] leading-snug">
        {nothingPlanned
          ? "Tudo neste mês já foi pago — nada em aberto. Lançamentos com vencimento futuro aparecem aqui como previsto."
          : "Barra cheia é o que já foi pago; a parte hachurada ainda está em aberto no mês."}
      </p>
    </div>
  );
}
