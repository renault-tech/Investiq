"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, Upload, FileText } from "lucide-react";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useFinance";
import {
  useUploadStatement,
  useImportBatch,
  useConfirmImportBatch,
  useCategorizeImportBatchWithAI,
  useDiscardImportBatch,
} from "@/hooks/useImport";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { ImportReviewTable } from "./ImportReviewTable";

export function ImportClient() {
  const [accountId, setAccountId] = useState("");
  const [batchId, setBatchId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: batch, isLoading: batchLoading } = useImportBatch(batchId);
  const uploadMutation = useUploadStatement();
  const confirmMutation = useConfirmImportBatch();
  const categorizeMutation = useCategorizeImportBatchWithAI();
  const discardMutation = useDiscardImportBatch();

  const handleFile = async (file: File) => {
    try {
      const result = await uploadMutation.mutateAsync({ file, bankAccountId: accountId || undefined });
      setBatchId(result.id);
    } catch {
      // O toast do hook já reporta o erro.
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleConfirm = async () => {
    if (!batchId) return;
    await confirmMutation.mutateAsync(batchId);
    setBatchId(null);
  };

  const handleDiscard = async () => {
    if (!batchId) return;
    await discardMutation.mutateAsync(batchId);
    setBatchId(null);
  };

  const selectedCount = batch?.rows.filter((r) => r.is_selected).length ?? 0;
  const unclassifiedCount = batch?.rows.filter((r) => !r.category_id).length ?? 0;

  return (
    <div className="p-6 max-w-4xl mx-auto w-full space-y-4">
      <Link
        href="/finances"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        <ArrowLeft size={15} /> Finanças
      </Link>
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">Importar extrato</h1>
      <p className="text-sm text-[var(--text-secondary)]">
        Envie um arquivo OFX ou CSV do seu banco. Lançamentos parecidos com os que já existem vêm
        marcados como possível duplicata e desmarcados por padrão — você decide o que entra.
      </p>

      {!batch && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 space-y-4">
          <Select label="Conta de destino" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Sem conta específica</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.holder ? ` · ${a.holder}` : ""}
              </option>
            ))}
          </Select>

          <div
            className="border-2 border-dashed border-[var(--border)] rounded-lg p-10 text-center cursor-pointer hover:border-[var(--border-strong)] transition-colors"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
          >
            <Upload className="mx-auto mb-2 text-[var(--text-muted)]" size={28} />
            <p className="text-sm text-[var(--text-secondary)]">
              Arraste um arquivo .ofx ou .csv aqui, ou clique para escolher
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".ofx,.csv,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>

          {uploadMutation.isPending && (
            <p className="text-sm text-[var(--text-muted)] text-center">Lendo o arquivo…</p>
          )}
        </div>
      )}

      {batchLoading && <p className="text-sm text-[var(--text-muted)]">Carregando…</p>}

      {batch && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <FileText size={16} />
            <span className="font-medium text-[var(--text-primary)]">{batch.file_name}</span>
            <span className="text-[var(--text-muted)]">
              · {batch.rows.length} lançamentos · {selectedCount} selecionados
            </span>
          </div>

          {batch.rows.length === 0 ? (
            <EmptyState icon={FileText} title="Nenhum lançamento encontrado no arquivo." />
          ) : (
            <ImportReviewTable batch={batch} categories={categories} />
          )}

          <div className="flex justify-end gap-2">
            {unclassifiedCount > 0 && (
              <Button
                variant="secondary"
                onClick={() => batchId && categorizeMutation.mutate(batchId)}
                loading={categorizeMutation.isPending}
              >
                <Sparkles size={15} /> Sugerir com IA ({unclassifiedCount})
              </Button>
            )}
            <Button variant="secondary" onClick={handleDiscard} loading={discardMutation.isPending}>
              Descartar
            </Button>
            <Button
              onClick={handleConfirm}
              loading={confirmMutation.isPending}
              disabled={selectedCount === 0}
            >
              Importar {selectedCount > 0 ? `(${selectedCount})` : ""}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
