"use client";

import ReactMarkdown from "react-markdown";
import { Sparkles } from "lucide-react";

interface AssetAiPanelProps {
  text: string | null;
  streaming: boolean;
}

export function AssetAiPanel({ text, streaming }: AssetAiPanelProps) {
  if (text === null && !streaming) return null;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-[var(--accent)]" />
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Análise inteligente</h3>
        {streaming && (
          <span className="text-xs text-[var(--text-muted)] animate-pulse">gerando…</span>
        )}
      </div>
      {text ? (
        <div className="prose prose-sm dark:prose-invert max-w-none text-[var(--text-secondary)] [&_h2]:text-[var(--text-primary)] [&_h3]:text-[var(--text-primary)] [&_strong]:text-[var(--text-primary)]">
          <ReactMarkdown>{text}</ReactMarkdown>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="h-3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse w-3/4" />
          <div className="h-3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse w-full" />
          <div className="h-3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse w-2/3" />
        </div>
      )}
    </div>
  );
}
