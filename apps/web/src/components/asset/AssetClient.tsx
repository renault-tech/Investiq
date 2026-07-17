"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  useAssetHistory,
  useAssetIndicators,
  useAssetFundamentals,
} from "@/hooks/useAssetData";
import { HistoryPeriod } from "@/lib/market-api";
import { streamAnalysis } from "@/lib/sse";
import { AssetHeader } from "./AssetHeader";
import { CandlestickChart } from "./CandlestickChart";
import { IndicatorToggle, IndicatorState, DEFAULT_INDICATOR_STATE } from "./IndicatorToggle";
import { FundamentalsGrid } from "./FundamentalsGrid";
import { AssetAiPanel } from "./AssetAiPanel";

const PERIODS: { value: HistoryPeriod; label: string }[] = [
  { value: "1mo", label: "1m" },
  { value: "3mo", label: "3m" },
  { value: "6mo", label: "6m" },
  { value: "1y", label: "1a" },
  { value: "5y", label: "5a" },
  { value: "max", label: "máx" },
];

interface AssetClientProps {
  ticker: string;
}

export function AssetClient({ ticker }: AssetClientProps) {
  const [period, setPeriod] = useState<HistoryPeriod>("1y");
  const [indicatorState, setIndicatorState] = useState<IndicatorState>(DEFAULT_INDICATOR_STATE);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiStreaming, setAiStreaming] = useState(false);

  const needIndicators = Object.values(indicatorState).some(Boolean);
  const { data: history, isLoading: historyLoading, isError: historyError } =
    useAssetHistory(ticker, period);
  const { data: indicators } = useAssetIndicators(ticker, period, needIndicators);
  const { data: fundamentals, isLoading: fundamentalsLoading } = useAssetFundamentals(ticker);

  const handleAnalyze = async () => {
    if (aiStreaming) return;
    setAiStreaming(true);
    setAiText("");

    const lastBars = history?.bars.slice(-30) ?? [];
    const lastRsi = indicators?.rsi.filter((p) => p.rsi !== null).slice(-1)[0]?.rsi;
    const context = {
      ticker,
      fundamentos: fundamentals ?? "indisponível",
      rsi_atual: lastRsi ?? "indisponível",
      ultimos_fechamentos: lastBars.map((b) => ({ data: b.date.slice(0, 10), fechamento: b.close })),
    };

    try {
      const { text } = await streamAnalysis(
        {
          messages: [
            {
              role: "user",
              content: `Analise o ativo ${ticker} com base nos dados abaixo (fundamentos, RSI e últimos fechamentos). Estruture em: visão geral, análise técnica, análise fundamentalista e riscos. Seja objetivo e responda em português.\n\n${JSON.stringify(context)}`,
            },
          ],
          system: "Você é um analista financeiro institucional especializado no mercado brasileiro. Baseie-se apenas nos dados fornecidos e deixe claro quando um dado estiver indisponível. Não invente números.",
        },
        (fullText) => setAiText(fullText),
      );
      setAiText(text);
    } catch {
      toast.error("Falha ao gerar análise do ativo. Verifique sua chave de IA em Configurações.");
      setAiText(null);
    } finally {
      setAiStreaming(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
      <Link
        href="/investments"
        className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        <ArrowLeft size={16} /> Investimentos
      </Link>

      <AssetHeader
        ticker={ticker}
        bars={history?.bars ?? []}
        fundamentals={fundamentals}
        onAnalyze={handleAnalyze}
        analyzing={aiStreaming}
      />

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex rounded-md border border-[var(--border)] overflow-hidden">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-2.5 py-1 text-xs transition-colors ${
                  period === p.value
                    ? "bg-[var(--navy)] text-white"
                    : "text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <IndicatorToggle state={indicatorState} onChange={setIndicatorState} />
        </div>

        {historyLoading ? (
          <div className="h-[360px] rounded-md bg-slate-100 dark:bg-slate-800 animate-pulse" />
        ) : historyError || !history || history.bars.length === 0 ? (
          <div className="h-[360px] flex flex-col items-center justify-center text-[var(--text-muted)] gap-2">
            <p className="font-medium">Nenhum dado encontrado para {ticker}.</p>
            <p className="text-sm">Verifique se o ticker está correto ou tente outro período.</p>
          </div>
        ) : (
          <CandlestickChart
            bars={history.bars}
            indicators={needIndicators ? indicators : undefined}
            state={indicatorState}
          />
        )}
      </div>

      <FundamentalsGrid fundamentals={fundamentals} isLoading={fundamentalsLoading} />

      <AssetAiPanel text={aiText} streaming={aiStreaming} />
    </div>
  );
}
