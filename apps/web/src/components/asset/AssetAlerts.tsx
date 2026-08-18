"use client";

import { useState } from "react";
import { Bell, Plus, Trash2 } from "lucide-react";
import { useAlerts, useCreateAlert, useDeleteAlert, useUpdateAlert } from "@/hooks/useAlerts";
import { formatBRL } from "@/components/charts/chartTheme";
import { parseBRNumber } from "@/lib/number-format";

interface AssetAlertsProps {
  ticker: string;
}

export function AssetAlerts({ ticker }: AssetAlertsProps) {
  const { data: allAlerts = [] } = useAlerts();
  const createMutation = useCreateAlert();
  const deleteMutation = useDeleteAlert();
  const updateMutation = useUpdateAlert();

  const [showForm, setShowForm] = useState(false);
  const [alertType, setAlertType] = useState<"price_above" | "price_below">("price_above");
  const [threshold, setThreshold] = useState("");

  const alerts = allAlerts.filter((a) => a.ticker === ticker);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseBRNumber(threshold);
    if (!value || value <= 0) return;
    await createMutation.mutateAsync({ ticker, alert_type: alertType, threshold: value });
    setThreshold("");
    setShowForm(false);
  };

  return (
    <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-5 shadow-[var(--shadow)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
          <Bell size={15} /> Alertas de preço
        </h3>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
        >
          <Plus size={13} /> Novo alerta
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="flex items-end gap-2 mb-3 pb-3 border-b border-[var(--border)]">
          <div>
            <label className="block text-[10px] text-[var(--text-muted)] mb-1">Condição</label>
            <select
              value={alertType}
              onChange={(e) => setAlertType(e.target.value as typeof alertType)}
              className="px-2 py-1.5 text-xs border border-[var(--border)] rounded-[9px] bg-[var(--surface-2)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            >
              <option value="price_above">Subir acima de</option>
              <option value="price_below">Cair abaixo de</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-[var(--text-muted)] mb-1">Preço (R$)</label>
            <input
              type="text"
              inputMode="decimal"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="0,00"
              className="w-24 px-2 py-1.5 text-xs border border-[var(--border)] rounded-[9px] bg-[var(--surface-2)] text-[var(--text-primary)] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-3 py-1.5 text-xs rounded-[9px] hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--accent)", color: "#04120D" }}
          >
            Criar
          </button>
        </form>
      )}

      {alerts.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">Nenhum alerta ativo para {ticker}.</p>
      ) : (
        <ul className="space-y-1.5">
          {alerts.map((alert) => (
            <li key={alert.id} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={alert.is_active}
                onChange={(e) => updateMutation.mutate({ id: alert.id, input: { is_active: e.target.checked } })}
                aria-label={alert.is_active ? "Desativar alerta" : "Ativar alerta"}
                className="accent-[var(--accent)]"
              />
              <span className="text-[var(--text-secondary)]">
                {alert.alert_type === "price_above" ? "Acima de" : "Abaixo de"}{" "}
                <span className="font-mono text-[var(--text-primary)]">{formatBRL(Number(alert.threshold))}</span>
              </span>
              {alert.triggered_at && (
                <span className="text-[10px] text-[var(--warning)]">disparado</span>
              )}
              <button
                onClick={() => deleteMutation.mutate(alert.id)}
                className="ml-auto p-1 text-[var(--text-muted)] hover:text-[var(--danger)]"
                aria-label="Remover alerta"
              >
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
