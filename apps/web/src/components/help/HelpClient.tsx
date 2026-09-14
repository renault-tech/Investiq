"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, CreditCard, LineChart, PlayCircle, Receipt, Search, ShieldCheck } from "lucide-react";
import { HELP_ARTICLES, TUTORIALS } from "@/lib/tutorials";
import { useTour } from "@/components/tour/TourProvider";

// Categorias reais — cada uma referencia rotas de TUTORIALS e ids de
// HELP_ARTICLES que já existem; a contagem vem de filtrar essas listas, não
// de um número fixo (evita divergir do conteúdo real conforme ele cresce).
const CATEGORIES = [
  { key: "investimentos", title: "Investimentos", Icon: LineChart, fg: "var(--accent)", bg: "color-mix(in srgb, var(--accent) 16%, transparent)", routes: ["/investments", "/investments/[ticker]", "/trader"], articleIds: [] as string[] },
  { key: "financas", title: "Finanças", Icon: Receipt, fg: "var(--accent-2)", bg: "color-mix(in srgb, var(--accent-2) 16%, transparent)", routes: ["/finances", "/finances/planejamento", "/finances/analise", "/finances/importar", "/transactions"], articleIds: ["contas-a-pagar"] },
  { key: "cartoes", title: "Cartões", Icon: CreditCard, fg: "#2563EB", bg: "color-mix(in srgb, #2563EB 16%, transparent)", routes: ["/finances/cards"], articleIds: [] as string[] },
  { key: "config", title: "Configurações & IA", Icon: ShieldCheck, fg: "var(--warning)", bg: "color-mix(in srgb, var(--warning) 16%, transparent)", routes: ["/settings"], articleIds: ["gemini", "brapi"] },
];

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
    <div
      className="rounded-[var(--radius-card-sm)] overflow-hidden"
      style={{ border: "1px solid var(--border)", background: "linear-gradient(180deg,var(--t4),var(--t1))" }}
    >
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
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(HELP_ARTICLES[0]?.id ?? null);
  const { startTour } = useTour();

  const needle = query.trim().toLowerCase();
  const matches = (haystack: string[]) =>
    !needle || haystack.some((text) => text.toLowerCase().includes(needle));

  const category = CATEGORIES.find((c) => c.key === activeCategory) ?? null;

  const articles = HELP_ARTICLES.filter(
    (a) => (!category || category.articleIds.includes(a.id)) && matches([a.title, a.summary, ...a.steps, a.note ?? ""])
  );
  const screens = TUTORIALS.filter(
    (t) => (!category || category.routes.includes(t.route)) && matches([t.label, t.summary, ...t.steps.flatMap((s) => [s.title, s.body])])
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

      <div className="grid grid-cols-2 gap-3">
        {CATEGORIES.map((cat) => {
          const count = TUTORIALS.filter((t) => cat.routes.includes(t.route)).length + HELP_ARTICLES.filter((a) => cat.articleIds.includes(a.id)).length;
          const active = activeCategory === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(active ? null : cat.key)}
              aria-pressed={active}
              className="text-left rounded-[14px] p-4 flex items-center gap-3"
              style={{ border: `1px solid ${active ? "var(--border-strong)" : "var(--border)"}`, background: "linear-gradient(180deg,var(--t4),var(--t1))" }}
            >
              <div className="w-9 h-9 rounded-[11px] flex items-center justify-center flex-shrink-0" style={{ background: cat.bg, color: cat.fg }}>
                <cat.Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-medium text-[var(--text-primary)]">{cat.title}</div>
                <div className="text-[10.5px] text-[var(--text-muted)]">{count} artigo{count === 1 ? "" : "s"}</div>
              </div>
            </button>
          );
        })}
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
            className="rounded-[var(--radius-card-sm)] p-4"
            style={{ border: "1px solid var(--border)", background: "linear-gradient(180deg,var(--t4),var(--t1))" }}
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
        style={{ background: "var(--accent)", color: "var(--on-accent)" }}
      >
        <PlayCircle size={15} /> Refazer o tour guiado
      </button>
    </div>
  );
}
