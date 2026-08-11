"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, PlayCircle, Search } from "lucide-react";
import { HELP_ARTICLES, TUTORIALS } from "@/lib/tutorials";
import { useTour } from "@/components/tour/TourProvider";

function Accordion({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-[var(--border)] rounded-[var(--radius-card-sm)] bg-[var(--surface)] overflow-hidden">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-start gap-3 text-left p-4 hover:bg-[var(--surface-2)] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-semibold text-[var(--text-primary)]">{title}</div>
          <div className="text-[12px] text-[var(--text-secondary)] mt-0.5">{summary}</div>
        </div>
        <ChevronDown
          size={16}
          className="text-[var(--text-muted)] flex-shrink-0 mt-0.5 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t border-[var(--border)]">{children}</div>}
    </div>
  );
}

export function HelpClient() {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(HELP_ARTICLES[0]?.id ?? null);
  const { startTour } = useTour();

  const needle = query.trim().toLowerCase();
  const matches = (haystack: string[]) =>
    !needle || haystack.some((text) => text.toLowerCase().includes(needle));

  const articles = HELP_ARTICLES.filter((a) =>
    matches([a.title, a.summary, ...a.steps, a.note ?? ""])
  );
  const screens = TUTORIALS.filter((t) =>
    matches([t.label, t.summary, ...t.steps.flatMap((s) => [s.title, s.body])])
  );

  return (
    <div className="p-6 max-w-3xl mx-auto w-full space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-[var(--text-primary)]">
          <BookOpen size={20} /> Central de ajuda
        </h1>
        <p className="text-[12.5px] text-[var(--text-secondary)] mt-1">
          Passo a passo das configurações e do que cada tela faz.
        </p>
      </div>

      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar na ajuda (ex.: gemini, carteira, vencimento)"
          aria-label="Buscar na ajuda"
          className="w-full pl-9 pr-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--surface-2)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      </div>

      <section className="space-y-2">
        <h2 className="text-[11px] tracking-[.1em] uppercase text-[var(--text-muted)]">
          Tutoriais
        </h2>
        {articles.length === 0 && (
          <p className="text-[12.5px] text-[var(--text-muted)]">Nada encontrado para “{query}”.</p>
        )}
        {articles.map((article) => (
          <Accordion
            key={article.id}
            title={article.title}
            summary={article.summary}
            open={openId === article.id}
            onToggle={() => setOpenId(openId === article.id ? null : article.id)}
          >
            <ol className="mt-3 space-y-2">
              {article.steps.map((step, i) => (
                <li key={i} className="flex gap-2.5 text-[12.5px] text-[var(--text-secondary)]">
                  <span
                    className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10.5px] font-semibold"
                    style={{ background: "var(--glow)", color: "var(--accent)" }}
                  >
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
            {article.note && (
              <p className="mt-3 text-[11.5px] text-[var(--text-muted)] leading-relaxed border-l-2 border-[var(--border)] pl-3">
                {article.note}
              </p>
            )}
          </Accordion>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-[11px] tracking-[.1em] uppercase text-[var(--text-muted)]">
          As telas do app
        </h2>
        {screens.map((screen) => (
          <div
            key={screen.route}
            className="border border-[var(--border)] rounded-[var(--radius-card-sm)] bg-[var(--surface)] p-4"
          >
            <div className="text-[13.5px] font-semibold text-[var(--text-primary)]">
              {screen.label}
            </div>
            <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">{screen.summary}</p>
            <ul className="mt-2.5 space-y-1.5">
              {screen.steps.map((step) => (
                <li key={step.title} className="text-[12px] text-[var(--text-secondary)]">
                  <span className="font-medium text-[var(--text-primary)]">{step.title}</span>
                  {" — "}
                  {step.body}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <button
        onClick={() => startTour()}
        className="flex items-center gap-2 px-4 h-[38px] rounded-xl text-[12.5px] font-semibold"
        style={{ background: "var(--accent)", color: "#04120D" }}
      >
        <PlayCircle size={15} /> Refazer o tour guiado
      </button>
    </div>
  );
}
