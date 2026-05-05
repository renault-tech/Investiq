"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Check, Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useUIStore } from "@/store/useUIStore";
import { useSettings, usePatchSettings, useUpdateApiKeys } from "@/hooks/useSettings";
import type { SettingsPatch, ApiKeysPatch } from "@/lib/settings-api";

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
      <div className="mb-4">
        <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</h2>
        {description && <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-[var(--text-secondary)] mb-1">{children}</p>;
}

function Select({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2.5 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--navy)] cursor-pointer"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ─── API Key field ────────────────────────────────────────────────────────────

function ApiKeyField({ label, hasKey, onSave, onClear }: {
  label: string;
  hasKey: boolean;
  onSave: (value: string) => Promise<void>;
  onClear: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!value.trim()) return;
    setLoading(true);
    try {
      await onSave(value.trim());
      setValue("");
      setEditing(false);
      toast.success(`${label} salva.`);
    } catch {
      toast.error(`Erro ao salvar ${label}.`);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    setLoading(true);
    try {
      await onClear();
      toast.success(`${label} removida.`);
    } catch {
      toast.error(`Erro ao remover ${label}.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[var(--border)] last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[11px] text-[var(--text-primary)] w-36 shrink-0">{label}</span>
        {hasKey && !editing && (
          <span className="flex items-center gap-1 text-[10px] text-[var(--accent)]">
            <Check size={11} /> Configurada
          </span>
        )}
        {!hasKey && !editing && (
          <span className="text-[10px] text-[var(--text-muted)]">Não configurada</span>
        )}
        {editing && (
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <div className="relative flex-1">
              <input
                type={show ? "text" : "password"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder="sk-..."
                autoFocus
                className="w-full px-2.5 py-1 pr-8 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--navy)] font-mono"
              />
              <button
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                {show ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
            </div>
            <button
              onClick={handleSave}
              disabled={!value.trim() || loading}
              className="px-2.5 py-1 text-[11px] bg-[var(--navy)] text-white rounded-lg hover:opacity-80 disabled:opacity-40 transition-opacity"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : "Salvar"}
            </button>
            <button
              onClick={() => { setEditing(false); setValue(""); }}
              className="px-2.5 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
      {!editing && (
        <div className="flex gap-2 shrink-0 ml-4">
          <button
            onClick={() => setEditing(true)}
            className="text-[11px] text-[var(--navy)] dark:text-[var(--accent)] hover:opacity-70 transition-opacity"
          >
            {hasKey ? "Alterar" : "Adicionar"}
          </button>
          {hasKey && (
            <button
              onClick={handleClear}
              disabled={loading}
              className="text-[11px] text-red-500 hover:opacity-70 transition-opacity disabled:opacity-40"
            >
              Remover
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between cursor-pointer py-2">
      <span className="text-[12px] text-[var(--text-primary)]">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors ${checked ? "bg-[var(--navy)]" : "bg-slate-300 dark:bg-slate-600"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
      </button>
    </label>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SettingsClient() {
  const { data: settings, isLoading } = useSettings();
  const patch = usePatchSettings();
  const updateKeys = useUpdateApiKeys();
  const { setTheme } = useTheme();
  const setFontScale = useUIStore((s) => s.setFontScale);

  const save = (data: SettingsPatch) => {
    if (data.theme) setTheme(data.theme);
    if (data.font_size_scale) setFontScale(Number(data.font_size_scale), false);
    patch.mutate(data, {
      onError: () => toast.error("Erro ao salvar configurações."),
      onSuccess: () => toast.success("Configurações salvas."),
    });
  };

  const saveKey = async (field: keyof ApiKeysPatch, value: string) => {
    await updateKeys.mutateAsync({ [field]: value });
  };

  const clearKey = async (field: keyof ApiKeysPatch) => {
    await updateKeys.mutateAsync({ [field]: "" });
  };

  if (isLoading || !settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">Configurações</h1>

      {/* Aparência */}
      <Section title="Aparência" description="Tema e preferências visuais.">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Tema</Label>
            <Select
              value={settings.theme}
              onChange={(v) => save({ theme: v })}
              options={[
                { value: "light", label: "Claro" },
                { value: "dark", label: "Escuro" },
              ]}
            />
          </div>
          <div>
            <Label>Moeda base</Label>
            <Select
              value={settings.base_currency}
              onChange={(v) => save({ base_currency: v })}
              options={[
                { value: "BRL", label: "BRL — Real" },
                { value: "USD", label: "USD — Dólar" },
                { value: "EUR", label: "EUR — Euro" },
              ]}
            />
          </div>
        </div>
      </Section>

      {/* Provedor de IA */}
      <Section title="Inteligência Artificial" description="Provedor e modelo usado na página de Análise.">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Provedor LLM</Label>
            <Select
              value={settings.preferred_llm}
              onChange={(v) => save({ preferred_llm: v })}
              options={[
                { value: "claude", label: "Claude (Anthropic)" },
                { value: "openai", label: "OpenAI" },
                { value: "gemini", label: "Gemini (Google)" },
              ]}
            />
          </div>
          <div>
            <Label>Modelo</Label>
            <input
              type="text"
              defaultValue={settings.llm_model ?? ""}
              onBlur={(e) => {
                const v = e.target.value.trim() || null;
                if (v !== settings.llm_model) save({ llm_model: v });
              }}
              placeholder={
                settings.preferred_llm === "claude"
                  ? "claude-sonnet-4-6"
                  : settings.preferred_llm === "openai"
                  ? "gpt-4o"
                  : "gemini-2.0-flash"
              }
              className="w-full px-2.5 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--navy)] font-mono"
            />
          </div>
        </div>
      </Section>

      {/* Dados de mercado */}
      <Section title="Dados de Mercado" description="Fonte de cotações para cálculo do portfólio.">
        <div className="max-w-xs">
          <Label>Provedor</Label>
          <Select
            value={settings.preferred_provider}
            onChange={(v) => save({ preferred_provider: v })}
            options={[
              { value: "yahoo", label: "Yahoo Finance (gratuito)" },
              { value: "brapi", label: "Brapi (API key necessária)" },
            ]}
          />
        </div>
      </Section>

      {/* Chaves de API */}
      <Section
        title="Chaves de API"
        description="As chaves são criptografadas antes de serem salvas. Nunca são expostas nas respostas."
      >
        <ApiKeyField
          label="Claude (Anthropic)"
          hasKey={settings.has_claude_api_key}
          onSave={(v) => saveKey("claude_api_key", v)}
          onClear={() => clearKey("claude_api_key")}
        />
        <ApiKeyField
          label="OpenAI"
          hasKey={settings.has_openai_api_key}
          onSave={(v) => saveKey("openai_api_key", v)}
          onClear={() => clearKey("openai_api_key")}
        />
        <ApiKeyField
          label="Gemini (Google)"
          hasKey={settings.has_gemini_api_key}
          onSave={(v) => saveKey("gemini_api_key", v)}
          onClear={() => clearKey("gemini_api_key")}
        />
        <ApiKeyField
          label="Brapi"
          hasKey={settings.has_brapi_key}
          onSave={(v) => saveKey("brapi_key", v)}
          onClear={() => clearKey("brapi_key")}
        />
        <ApiKeyField
          label="Alpha Vantage"
          hasKey={settings.has_alpha_vantage_key}
          onSave={(v) => saveKey("alpha_vantage_key", v)}
          onClear={() => clearKey("alpha_vantage_key")}
        />
        <ApiKeyField
          label="Polygon.io"
          hasKey={settings.has_polygon_key}
          onSave={(v) => saveKey("polygon_key", v)}
          onClear={() => clearKey("polygon_key")}
        />
      </Section>

      {/* Notificações */}
      <Section title="Notificações">
        <Toggle
          label="Alertas de preço"
          checked={settings.notify_price_alerts}
          onChange={(v) => save({ notify_price_alerts: v })}
        />
        <Toggle
          label="Notificações por e-mail"
          checked={settings.notify_email}
          onChange={(v) => save({ notify_email: v })}
        />
      </Section>

      {settings.updated_at && (
        <p className="text-[10px] text-[var(--text-muted)] text-right">
          Atualizado em{" "}
          {new Date(settings.updated_at).toLocaleString("pt-BR", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          })}
        </p>
      )}
    </div>
  );
}
