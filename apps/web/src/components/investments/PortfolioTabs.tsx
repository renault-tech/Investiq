"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { deletePortfolio, updatePortfolio, type Portfolio } from "@/lib/portfolio-api";

interface Props {
  portfolios: Portfolio[];
  activeId: string | null;
  onChange: (id: string) => void;
}

interface ConfirmState {
  id: string;
  name: string;
}

export function PortfolioTabs({ portfolios, activeId, onChange }: Props) {
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState<ConfirmState | null>(null);

  const deleteMut = useMutation({
    mutationFn: deletePortfolio,
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      toast.success("Portfólio apagado.");
      setConfirmDelete(null);
      if (activeId === deletedId && portfolios.length > 1) {
        const next = portfolios.find(p => p.id !== deletedId);
        if (next) onChange(next.id);
      }
    },
  });

  const editMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updatePortfolio(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      toast.success("Portfólio renomeado.");
    },
  });

  const handleEdit = (e: React.MouseEvent, id: string, oldName: string) => {
    e.stopPropagation();
    const newName = window.prompt("Novo nome do portfólio:", oldName);
    if (newName && newName.trim() !== "" && newName !== oldName) {
      editMut.mutate({ id, name: newName.trim() });
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    setConfirmDelete({ id, name });
  };

  if (portfolios.length === 0) return null;

  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {portfolios.map((portfolio) => (
          <button
            key={portfolio.id}
            onClick={() => onChange(portfolio.id)}
            className={`group relative flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full shrink-0 transition-all ${
              portfolio.id === activeId
                ? "bg-[var(--navy)] text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-[var(--text-secondary)] hover:bg-neutral-700 hover:text-neutral-200"
            }`}
          >
            <span>{portfolio.name}</span>

            <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
              <span
                className="p-0.5 rounded-full hover:bg-white/20 transition-colors"
                onClick={(e) => handleEdit(e, portfolio.id, portfolio.name)}
                title="Renomear"
              >
                <Pencil size={11} />
              </span>
              <span
                className="p-0.5 rounded-full hover:bg-red-500/70 transition-colors"
                onClick={(e) => handleDeleteClick(e, portfolio.id, portfolio.name)}
                title="Excluir"
              >
                <Trash2 size={11} />
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Modal de confirmação de exclusão */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl w-[360px] p-6 animate-in fade-in slide-in-from-bottom-3 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4 mb-5">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">
                  Excluir portfólio
                </h3>
                <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                  Tem certeza que deseja excluir{" "}
                  <span className="font-semibold text-[var(--text-primary)]">
                    "{confirmDelete.name}"
                  </span>
                  ? Todas as posições e transações serão apagadas permanentemente.
                </p>
              </div>
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-shrink-0 p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-[12px] text-[var(--text-primary)] bg-[var(--background)] border border-[var(--border)] rounded-lg hover:bg-[var(--border)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteMut.mutate(confirmDelete.id)}
                disabled={deleteMut.isPending}
                className="px-4 py-2 text-[12px] text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteMut.isPending ? "Excluindo..." : "Sim, excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
