"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Plus, Trash2 } from "lucide-react";
import { useAlerts, useCreateAlert, useDeleteAlert, useUpdateAlert } from "@/hooks/useAlerts";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export function AlertsManager() {
  const { data: alerts = [], isLoading } = useAlerts();
  const createMutation = useCreateAlert();
  const deleteMutation = useDeleteAlert();
  const updateMutation = useUpdateAlert();

  const [showForm, setShowForm] = useState(false);
  const [ticker, setTicker] = useState("");
  const [alertType, setAlertType] = useState<"price_above" | "price_below">("price_above");
  const [threshold, setThreshold] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(threshold.replace(",", "."));
    const t = ticker.trim().toUpperCase();
    if (!t || !value || value <= 0) return;
    await createMutation.mutateAsync({ ticker: t, alert_type: alertType, threshold: value });
    setTicker("");
    setThreshold("");
    setShowForm(false);
  };

  return (
    <div>
      <div className="flex items-center justify-end mb-3">
        <Button size="sm" variant="secondary" onClick={() => setShowForm((v) => !v)}>
          <Plus size={14} /> Novo alerta
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="flex items-end gap-2 mb-4 pb-4 border-b border-[var(--border)] flex-wrap">
          <div>
            <label className="block text-[10px] text-[var(--text-muted)] mb-1">Ticker</label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="PETR4"
              className="w-24 px-2.5 py-1.5 text-xs border border-[var(--border)] rounded-[9px] bg-[var(--surface-2)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[var(--text-muted)] mb-1">Condição</label>
            <select
              value={alertType}
              onChange={(e) => setAlertType(e.target.value as typeof alertType)}
              className="px-2.5 py-1.5 text-xs border border-[var(--border)] rounded-[9px] bg-[var(--surface-2)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            >
              <option value="price_above">Subir acima de</option>
              <option value="price_below">Cair abaixo de</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-[var(--text-muted)] mb-1">Preço</label>
            <input
              type="text"
              inputMode="decimal"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="0,00"
              className="w-24 px-2.5 py-1.5 text-xs border border-[var(--border)] rounded-[9px] bg-[var(--surface-2)] text-[var(--text-primary)] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>
          <Button type="submit" size="sm" loading={createMutation.isPending}>Criar</Button>
        </form>
      )}

      {!isLoading && alerts.length === 0 ? (
        <EmptyState icon={Bell} title="Nenhum alerta criado." description="Crie um alerta de preço para qualquer ticker, mesmo sem tê-lo na carteira." />
      ) : (
        <ul className="space-y-1.5">
          {alerts.map((alert) => (
            <li key={alert.id} className="flex items-center gap-2.5 px-3 py-2 rounded-[11px] hover:bg-[var(--surface-2)] transition-colors text-[12.5px]">
              <input
                type="checkbox"
                checked={alert.is_active}
                onChange={(e) => updateMutation.mutate({ id: alert.id, input: { is_active: e.target.checked } })}
                aria-label={alert.is_active ? "Desativar alerta" : "Ativar alerta"}
                className="accent-[var(--accent)]"
              />
              <Link href={`/investments/${encodeURIComponent(alert.ticker)}`} className="font-semibold text-[var(--text-primary)] hover:underline">
                {alert.ticker}
              </Link>
              <span className="text-[var(--text-secondary)]">
                {alert.alert_type === "price_above" ? "acima de" : "abaixo de"}{" "}
                <span className="font-mono text-[var(--text-primary)]">
                  {Number(alert.threshold).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </span>
              {alert.triggered_at && <span className="text-[10.5px]" style={{ color: "var(--warning)" }}>disparado</span>}
              <button
                onClick={() => deleteMutation.mutate(alert.id)}
                className="ml-auto text-[var(--text-muted)] hover:text-[var(--danger)]"
                aria-label={`Remover alerta de ${alert.ticker}`}
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
