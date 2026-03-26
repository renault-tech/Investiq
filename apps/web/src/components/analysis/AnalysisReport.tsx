"use client";

import { AnalysisSection } from "./AnalysisSection";

interface AnalysisReportProps {
  sections: Record<string, string>;
  createdAt?: string;
  provider?: string | null;
  model?: string | null;
}

const SECTION_TITLES: Record<string, string> = {
  summary: "Resumo Executivo",
  context: "Contexto da Análise",
  composition: "Composição",
  risks: "Riscos",
  opportunities: "Oportunidades",
  recommendations: "Recomendações",
};

export function AnalysisReport({ sections, createdAt, provider, model }: AnalysisReportProps) {
  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('pt-BR', { 
        day: 'numeric', month: 'short', year: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
      }).format(date);
    } catch {
      return dateString;
    }
  };

  const dateStr = createdAt ? formatDateTime(createdAt) : "";

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Análise de Portfólio</h2>
        {(createdAt || provider) && (
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {createdAt ? `Gerado em ${dateStr}` : ""}
            {provider ? ` · ${provider}` : ""}
            {model ? ` (${model})` : ""}
          </p>
        )}
      </div>

      <div className="mt-8">
        {Object.entries(SECTION_TITLES).map(([key, title]) => {
          const content = sections[key];
          if (!content) return null;
          return <AnalysisSection key={key} title={title} content={content} />;
        })}
      </div>
    </div>
  );
}
