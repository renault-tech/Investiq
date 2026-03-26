"use client";

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { AnalysisMessage } from "@/lib/analysis-api";
import { AnalysisChatMessage } from "./AnalysisChatMessage";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getAccessToken } from "@/lib/api-client";

interface AnalysisChatProps {
  analysisId: string;
  messages: AnalysisMessage[];
}

export function AnalysisChat({ analysisId, messages }: AnalysisChatProps) {
  const [inputValue, setInputValue] = useState("");
  const [optimisticMessages, setOptimisticMessages] = useState<AnalysisMessage[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, optimisticMessages, streamingMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isStreaming) return;

    const userContent = inputValue.trim();
    setInputValue("");
    setIsStreaming(true);

    const tempUserMsg: AnalysisMessage = {
      id: "temp-" + Date.now(),
      role: "user",
      content: userContent,
      created_at: new Date().toISOString()
    };
    
    setOptimisticMessages(prev => [...prev, tempUserMsg]);
    setStreamingMessage("");

    try {
      const token = getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/analyses/${analysisId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ content: userContent })
      });

      if (!res.ok || !res.body) {
        throw new Error("Failed to send message");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

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
              // Assuming API sends just text chunks or JSON {text: "..."}
              // The backend SSE endpoint might send bare text or JSON. We accumulate it.
              // Wait, previous implementation of /ai/analyze sends bare text chunks usually.
              // We'll append the data directly (it might need unescaping if JSON).
              assistantText += data;
              setStreamingMessage(assistantText);
            } catch (e) {}
          }
        }
      }

      // Stream Finished
      queryClient.invalidateQueries({ queryKey: ["analysis", analysisId] });
      setOptimisticMessages([]);
      setStreamingMessage(null);
    } catch (error) {
      toast.error("Falha ao enviar mensagem. Tente novamente.");
      setOptimisticMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
      setStreamingMessage(null);
    } finally {
      setIsStreaming(false);
    }
  };

  const allMessages = [...messages, ...optimisticMessages];

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl flex flex-col mt-6 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-[var(--border)] bg-slate-50 dark:bg-slate-900/50">
        <h3 className="font-semibold text-sm text-[var(--text-primary)]">Chat sobre a Análise</h3>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 p-4 max-h-80 overflow-y-auto"
      >
        {allMessages.length === 0 && !streamingMessage && (
          <p className="text-center text-[var(--text-muted)] text-sm py-8">
            Faça perguntas sobre a análise acima.
          </p>
        )}
        
        {allMessages.map(msg => (
          <AnalysisChatMessage key={msg.id} message={msg} />
        ))}
        
        {streamingMessage !== null && (
          <AnalysisChatMessage 
            message={{
              id: "streaming",
              role: "assistant",
              content: streamingMessage,
              created_at: new Date().toISOString()
            }} 
          />
        )}
      </div>

      <div className="p-4 border-t border-[var(--border)]">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isStreaming}
            placeholder="Digite sua dúvida..."
            className="w-full pl-4 pr-12 py-2.5 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--navy)] disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isStreaming}
            className="absolute right-2 p-1.5 text-[var(--navy)] dark:text-[var(--accent)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
