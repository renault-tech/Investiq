"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PortfolioSelector } from "./PortfolioSelector";
import { AnalysisSidebar } from "./AnalysisSidebar";
import { AnalysisReport } from "./AnalysisReport";
import { AnalysisChat } from "./AnalysisChat";
import { AnalysisEmptyState } from "./AnalysisEmptyState";
import { AnalysisStreamingSkeleton } from "./AnalysisStreamingSkeleton";
import { useAnalysis as useAnalysisHook } from "@/hooks/useAnalysis";
import { useSettings } from "@/hooks/useSettings";
import { getRecentContext, saveAnalysis } from "@/lib/analysis-api";
import { getPortfolioSummary } from "@/lib/portfolio-api";
import { getAccessToken } from "@/lib/api-client";

const PROVIDER_LABELS: Record<string, string> = {
  claude: "Claude (Anthropic)",
  openai: "OpenAI",
  gemini: "Gemini (Google)",
};

const SECTION_HEADERS: Record<string, string> = {
  "## Contexto da Análise": "context",
  "## Resumo Executivo": "summary",
  "## Composição": "composition",
  "## Riscos": "risks",
  "## Oportunidades": "opportunities",
  "## Recomendações": "recommendations",
};

function parseSections(rawText: string): Record<string, string> {
  const sections: Record<string, string> = {};
  let currentKey: string | null = null;
  let currentContent: string[] = [];

  const lines = rawText.split("\\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (SECTION_HEADERS[trimmed]) {
      if (currentKey) {
        sections[currentKey] = currentContent.join("\\n").trim();
      }
      currentKey = SECTION_HEADERS[trimmed];
      currentContent = [];
    } else if (currentKey) {
      currentContent.push(line);
    }
  }

  if (currentKey) {
    sections[currentKey] = currentContent.join("\\n").trim();
  }

  return sections;
}

export function AnalysisClient() {
  const [activePortfolioId, setActivePortfolioId] = useState<string | null>(null);
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [streamedSections, setStreamedSections] = useState<Record<string, string>>({});
  const [missingKey, setMissingKey] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { data: analysisDetail, isLoading: isLoadingAnalysis } = useAnalysisHook(activeAnalysisId);
  const { data: settings } = useSettings();

  // Derive which key is needed for the configured provider
  const provider = settings?.preferred_llm ?? "claude";
  const hasRequiredKey =
    provider === "openai" ? settings?.has_openai_api_key :
    provider === "gemini" ? settings?.has_gemini_api_key :
    settings?.has_claude_api_key;

  const handleAnalyze = async () => {
    if (!activePortfolioId) return;

    // Preventive check before hitting the API
    if (settings && !hasRequiredKey) {
      setMissingKey(PROVIDER_LABELS[provider] ?? provider);
      return;
    }

    setMissingKey(null);
    setStreaming(true);
    setStreamedSections({});
    setActiveAnalysisId(null);
    let rawText = "";

    try {
      const recentCtx = await getRecentContext(activePortfolioId).catch(() => ({ raw_texts: [] }));
      const portfolioSum = await getPortfolioSummary(activePortfolioId).catch(() => null);

      if (!portfolioSum || portfolioSum.positions.length === 0) {
        toast.error("O portfólio não possui posições para análise.");
        setStreaming(false);
        return;
      }

      const payload = {
        messages: [{
          role: "user",
          content: `Analise as posições do meu portfólio (IDs e ativos): ${JSON.stringify(portfolioSum.positions)}`
        }],
        portfolio_id: activePortfolioId,
        previous_analyses: recentCtx.raw_texts
      };

      const token = getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/ai/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        // 422 = no API key configured on backend
        if (res.status === 422) {
          const body = await res.json().catch(() => ({}));
          const msg: string = body?.detail?.message ?? "";
          const matched = Object.entries(PROVIDER_LABELS).find(([, label]) =>
            msg.toLowerCase().includes(label.toLowerCase().split(" ")[0])
          );
          setMissingKey(matched ? matched[1] : PROVIDER_LABELS[provider] ?? provider);
          return;
        }
        throw new Error("Failed to start analysis stream");
      }

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              rawText += data;
              setStreamedSections(parseSections(rawText));
            } catch { /* partial JSON — ignore */ }
          }
        }
      }

      const finalSections = parseSections(rawText);
      const saved = await saveAnalysis({
        portfolio_id: activePortfolioId,
        raw_text: rawText,
        sections: finalSections,
        provider: provider,
        model: settings?.llm_model ?? "unknown"
      });

      queryClient.invalidateQueries({ queryKey: ["analyses", activePortfolioId] });
      setActiveAnalysisId(saved.id);

    } catch {
      toast.error("Falha ao gerar análise. Tente novamente.");
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="flex h-full bg-[var(--background)]">
      {/* Sidebar History (Desktop) */}
      <AnalysisSidebar 
        portfolioId={activePortfolioId}
        activeAnalysisId={activeAnalysisId}
        onSelect={setActiveAnalysisId}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                Análise de Portfólio
              </h1>
              <p className="text-[var(--text-muted)] text-sm mt-1">
                Insights inteligentes e gestão de risco avançada com IA
              </p>
            </div>
            
            <div className="md:w-64">
              <PortfolioSelector 
                activeId={activePortfolioId} 
                onChange={(id) => {
                  setActivePortfolioId(id);
                  setActiveAnalysisId(null);
                }} 
              />
            </div>
          </div>

          {/* Content Area */}
          {!activePortfolioId ? (
            <AnalysisEmptyState disabled={true} />
          ) : missingKey ? (
            <AnalysisEmptyState noApiKey missingProvider={missingKey} />
          ) : streaming ? (
            <div className="space-y-6">
              <AnalysisStreamingSkeleton />
              {Object.keys(streamedSections).length > 0 && (
                <div className="opacity-70 pointer-events-none">
                  <AnalysisReport sections={streamedSections} />
                </div>
              )}
            </div>
          ) : activeAnalysisId ? (
            <div className="space-y-6">
              {isLoadingAnalysis ? (
                <AnalysisStreamingSkeleton />
              ) : analysisDetail ? (
                <>
                  <AnalysisReport 
                    sections={analysisDetail.sections}
                    createdAt={analysisDetail.created_at}
                    provider={analysisDetail.provider}
                    model={analysisDetail.model}
                  />
                  <AnalysisChat 
                    analysisId={activeAnalysisId}
                    messages={analysisDetail.messages}
                  />
                </>
              ) : (
                <AnalysisEmptyState onAnalyze={handleAnalyze} />
              )}
            </div>
          ) : (
            <AnalysisEmptyState onAnalyze={handleAnalyze} disabled={streaming} />
          )}
        </div>
      </div>
    </div>
  );
}
