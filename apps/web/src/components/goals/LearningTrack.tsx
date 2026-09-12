"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Check } from "lucide-react";

const MODULES = [
  { id: "reserva", title: "Reserva de emergência", blurb: "Quanto guardar e onde deixar antes de investir o resto." },
  { id: "renda-fixa", title: "Renda fixa na prática", blurb: "CDB, Tesouro Direto e LCI/LCA — o que muda entre eles." },
  { id: "renda-variavel", title: "Renda variável sem susto", blurb: "Ações, FIIs e ETFs: risco, liquidez e horizonte de tempo." },
  { id: "diversificacao", title: "Diversificação de verdade", blurb: "Por que 'colocar tudo num lugar só' custa caro no longo prazo." },
  { id: "juros-compostos", title: "Juros compostos", blurb: "O motivo de começar cedo valer mais que aportar mais tarde." },
  { id: "ir", title: "Imposto de renda em investimentos", blurb: "Isenções, alíquotas e o que precisa ser declarado." },
] as const;

const STORAGE_KEY = "investiq_learning_track_v1";

function loadProgress(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

/** Conteúdo educativo estático — sem endpoint no backend, progresso salvo só
 * no navegador (localStorage). Não é personalizado por perfil nem por
 * carteira: é a mesma trilha para todo mundo, o que já entrega valor sem
 * fabricar uma recomendação individualizada que a plataforma não tem base
 * de dados para calcular. */
export function LearningTrack() {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDone(loadProgress());
    setHydrated(true);
  }, []);

  const toggle = (id: string) => {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // localStorage indisponível (modo privado etc.) — progresso só não persiste entre sessões.
      }
      return next;
    });
  };

  const pct = hydrated ? Math.round((done.size / MODULES.length) * 100) : 0;

  return (
    <section className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)] animate-rise-up">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <GraduationCap size={16} className="text-[var(--accent)]" />
          <div className="text-sm font-semibold text-[var(--text-primary)]">Trilha rápida</div>
        </div>
        <span className="text-[11px] text-[var(--text-secondary)] tabular-nums">{done.size}/{MODULES.length}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden mb-4">
        <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: "var(--accent)" }} />
      </div>

      <ul className="flex flex-col gap-1.5">
        {MODULES.map((m) => {
          const isDone = done.has(m.id);
          return (
            <li key={m.id}>
              <button
                onClick={() => toggle(m.id)}
                className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-[10px] text-left transition-colors hover:bg-[var(--surface-2)]"
              >
                <span
                  className="w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: isDone ? "var(--accent)" : "var(--surface-2)", border: isDone ? "none" : "1px solid var(--border)" }}
                >
                  {isDone && <Check size={12} color="var(--on-accent)" />}
                </span>
                <span className="min-w-0">
                  <span className={`block text-[12.5px] font-medium ${isDone ? "text-[var(--text-muted)] line-through" : "text-[var(--text-primary)]"}`}>
                    {m.title}
                  </span>
                  <span className="block text-[11px] text-[var(--text-muted)] mt-0.5">{m.blurb}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
