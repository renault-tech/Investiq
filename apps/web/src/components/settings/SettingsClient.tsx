"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { Check, KeyRound, Moon, Sun, ZoomIn, ZoomOut } from "lucide-react";
import { useSettings, usePatchSettings, useUpdateApiKeys } from "@/hooks/useSettings";
import { ApiKeysUpdate } from "@/lib/settings-api";
import { useShallow } from "zustand/react/shallow";
import { useUserStore } from "@/store/useUserStore";
import { useUIStore } from "@/store/useUIStore";
import { ACCENT_PALETTE } from "@/lib/accentPalette";
import { SessionsSection } from "./SessionsSection";

const LLM_OPTIONS = [
  { value: "claude", label: "Claude (Anthropic)", keyField: "claude_api_key" as const, hasField: "has_claude_api_key" as const },
  { value: "openai", label: "OpenAI", keyField: "openai_api_key" as const, hasField: "has_openai_api_key" as const },
  { value: "gemini", label: "Gemini (Google)", keyField: "gemini_api_key" as const, hasField: "has_gemini_api_key" as const },
];

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5">
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
      {description && <p className="text-xs text-[var(--text-muted)] mt-0.5 mb-4">{description}</p>}
      {!description && <div className="mb-4" />}
      {children}
    </section>
  );
}

function ApiKeyInput({
  label,
  configured,
  onSave,
  saving,
}: {
  label: string;
  configured: boolean;
  onSave: (value: string) => void;
  saving: boolean;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] mb-1">
          {label}
          {configured && (
            <span className="flex items-center gap-0.5 text-[var(--accent)]">
              <Check size={12} /> configurada
            </span>
          )}
        </label>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={configured ? "•••••••• (substituir)" : "Cole a chave aqui"}
          autoComplete="off"
          className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text-primary)] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--navy)]"
        />
      </div>
      <button
        onClick={() => { if (value.trim()) { onSave(value.trim()); setValue(""); } }}
        disabled={saving || !value.trim()}
        className="px-3 py-2 text-sm bg-[var(--navy)] text-white rounded-lg hover:opacity-90 disabled:opacity-40"
      >
        Salvar
      </button>
    </div>
  );
}

export function SettingsClient() {
  const { data: settings, isLoading } = useSettings();
  const patchMutation = usePatchSettings();
  const keysMutation = useUpdateApiKeys();
  const { theme, setTheme } = useTheme();
  const user = useUserStore((s) => s.user);
  const { fontScale, setFontScale, accentColorId, setAccentColor } = useUIStore(
    useShallow((s) => ({
      fontScale: s.fontScale,
      setFontScale: s.setFontScale,
      accentColorId: s.accentColorId,
      setAccentColor: s.setAccentColor,
    }))
  );

  if (isLoading || !settings) {
    return (
      <div className="p-6 max-w-3xl mx-auto w-full space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
        ))}
      </div>
    );
  }

  const saveKey = (field: keyof ApiKeysUpdate) => (value: string) =>
    keysMutation.mutate({ [field]: value });

  return (
    <div className="p-6 max-w-3xl mx-auto w-full space-y-4">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">Configurações</h1>

      <Section title="Perfil">
        <div className="space-y-1 text-sm">
          <p className="text-[var(--text-primary)] font-medium">{user?.full_name ?? "—"}</p>
          <p className="text-[var(--text-secondary)]">{user?.email ?? ""}</p>
        </div>
      </Section>

      <Section title="Aparência">
        <div className="flex items-center gap-2">
          {([["light", "Claro", Sun], ["dark", "Escuro", Moon]] as const).map(([value, label, Icon]) => (
            <button
              key={value}
              onClick={() => {
                setTheme(value);
                patchMutation.mutate({ theme: value });
              }}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg border transition-colors ${
                theme === value
                  ? "bg-[var(--navy)] text-white border-[var(--navy)]"
                  : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[var(--border)]">
          <span className="text-xs text-[var(--text-secondary)]">Tamanho da fonte</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFontScale(fontScale - 0.05)}
              aria-label="Diminuir fonte"
              className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-xs text-[var(--text-muted)] w-10 text-center tabular-nums">
              {Math.round(fontScale * 100)}%
            </span>
            <button
              onClick={() => setFontScale(fontScale + 0.05)}
              aria-label="Aumentar fonte"
              className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ZoomIn size={14} />
            </button>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-[var(--border)]">
          <span className="text-xs text-[var(--text-secondary)]">Cor de destaque</span>
          <div className="flex items-center gap-2.5 mt-2">
            {ACCENT_PALETTE.map((option) => {
              const active = accentColorId === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => setAccentColor(option.id)}
                  aria-label={option.label}
                  aria-pressed={active}
                  title={option.label}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-transform"
                  style={{
                    background: option.dark,
                    outline: active ? "2px solid var(--text-primary)" : "2px solid transparent",
                    outlineOffset: "2px",
                    transform: active ? "scale(1.1)" : "scale(1)",
                  }}
                >
                  {active && <Check size={13} className="text-white" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      <Section
        title="Dados de mercado"
        description="Fonte das cotações e histórico. A Brapi (B3) exige um token gratuito de brapi.dev."
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {([["yahoo", "Yahoo Finance"], ["brapi", "Brapi (B3)"]] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => patchMutation.mutate({ preferred_provider: value })}
                className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                  settings.preferred_provider === value
                    ? "bg-[var(--navy)] text-white border-[var(--navy)]"
                    : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <ApiKeyInput
            label="Token Brapi (gratuito)"
            configured={settings.has_brapi_key}
            onSave={saveKey("brapi_key")}
            saving={keysMutation.isPending}
          />
        </div>
      </Section>

      <Section
        title="Inteligência artificial"
        description="A análise de carteiras, de ativos e a leitura de faturas usam a SUA chave — ela é criptografada e nunca exibida de volta."
      >
        <div className="space-y-4">
          <div>
            <p className="text-xs text-[var(--text-secondary)] mb-1.5">Provedor preferido</p>
            <div className="flex flex-wrap items-center gap-2">
              {LLM_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => patchMutation.mutate({ preferred_llm: opt.value as "claude" | "openai" | "gemini" })}
                  className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                    settings.preferred_llm === opt.value
                      ? "bg-[var(--navy)] text-white border-[var(--navy)]"
                      : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {opt.label}
                  {settings[opt.hasField] && <Check size={13} className="inline ml-1.5 text-[var(--accent)]" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="llm-model" className="block text-xs text-[var(--text-secondary)] mb-1">
              Modelo (opcional — vazio usa o padrão do provedor)
            </label>
            <input
              id="llm-model"
              type="text"
              defaultValue={settings.llm_model ?? ""}
              onBlur={(e) => {
                const value = e.target.value.trim();
                if (value !== (settings.llm_model ?? "")) {
                  patchMutation.mutate({ llm_model: value });
                }
              }}
              placeholder="ex.: claude-sonnet-4-6"
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text-primary)] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--navy)]"
            />
          </div>

          <div className="space-y-3 pt-1">
            <p className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <KeyRound size={13} /> Chaves de API (write-only)
            </p>
            {LLM_OPTIONS.map((opt) => (
              <ApiKeyInput
                key={opt.value}
                label={opt.label}
                configured={settings[opt.hasField]}
                onSave={saveKey(opt.keyField)}
                saving={keysMutation.isPending}
              />
            ))}
          </div>
        </div>
      </Section>

      <Section title="Sessões" description="Dispositivos com uma sessão ativa na sua conta.">
        <SessionsSection />
      </Section>

      <Section title="Notificações">
        <div className="space-y-2">
          {([
            ["notify_price_alerts", "Alertas de preço"],
            ["notify_email", "Resumos por e-mail"],
          ] as const).map(([field, label]) => (
            <label key={field} className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={settings[field]}
                onChange={(e) => patchMutation.mutate({ [field]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
      </Section>
    </div>
  );
}
