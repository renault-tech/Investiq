"use client";

import { AnalysisMessage } from "@/lib/analysis-api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AnalysisChatMessageProps {
  message: AnalysisMessage;
}

export function AnalysisChatMessage({ message }: AnalysisChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex w-full mb-4 ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`px-3 py-2 text-sm leading-relaxed text-wrap break-words ${
          isUser
            ? "bg-[var(--navy)] text-white rounded-lg rounded-br-sm ml-auto max-w-xs"
            : "bg-slate-100 dark:bg-slate-800 text-[var(--text-primary)] rounded-lg rounded-bl-sm mr-auto max-w-sm [&>p]:mb-2 last:[&>p]:mb-0 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4"
        }`}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
      </div>
    </div>
  );
}
