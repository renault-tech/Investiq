"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";

interface InvoiceUploadZoneProps {
  onUpload: (file: File, referenceMonth: string) => void;
  uploading: boolean;
}

function currentMonthFirstDay(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export function InvoiceUploadZone({ onUpload, uploading }: InvoiceUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [month, setMonth] = useState(() => currentMonthFirstDay().slice(0, 7));

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file || uploading) return;
    onUpload(file, `${month}-01`);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        dragOver ? "border-[var(--accent)] bg-emerald-50 dark:bg-emerald-950/20" : "border-[var(--border)]"
      }`}
    >
      {uploading ? (
        <div className="flex flex-col items-center gap-2 text-[var(--text-secondary)]">
          <Loader2 size={22} className="animate-spin text-[var(--accent)]" />
          <p className="text-sm font-medium">IA extraindo os lançamentos da fatura…</p>
          <p className="text-xs text-[var(--text-muted)]">Isso pode levar até um minuto.</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <FileUp size={22} className="text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-secondary)]">
            Arraste a fatura (PDF ou CSV) ou{" "}
            <button
              onClick={() => inputRef.current?.click()}
              className="text-[var(--navy)] dark:text-[var(--accent)] font-medium hover:underline"
            >
              selecione o arquivo
            </button>
          </p>
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            Mês de referência:
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="px-2 py-1 border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--text-primary)]"
            />
          </label>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.csv,.txt,application/pdf,text/csv"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}
    </div>
  );
}
