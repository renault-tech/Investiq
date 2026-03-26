"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AnalysisSectionProps {
  title: string;
  content: string;
}

export function AnalysisSection({ title, content }: AnalysisSectionProps) {
  if (!content) return null;
  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-[var(--navy)] dark:text-[var(--accent)] uppercase tracking-wide mb-2">
        {title}
      </h4>
      <div className="text-[var(--text-primary)] text-sm leading-relaxed [&>p]:mb-3 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&_li]:mb-1 [&>h3]:text-base [&>h3]:font-semibold [&>h3]:mb-2 [&>h3]:mt-4 [&>h4]:text-sm [&>h4]:font-semibold [&>h4]:mb-2 [&>h4]:mt-3 [&_strong]:font-semibold text-wrap break-words">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
      <div className="border-b border-[var(--border)] mt-6" />
    </div>
  );
}
