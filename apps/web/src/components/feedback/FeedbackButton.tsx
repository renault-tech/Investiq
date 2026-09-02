"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Bug, Lightbulb, MessageSquare, MessageSquarePlus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useFeedbackHistory, useSendFeedback } from "@/hooks/useFeedback";
import type { FeedbackCategory } from "@/lib/feedback-api";

const CATEGORIES: { value: FeedbackCategory; label: string; icon: typeof Bug }[] = [
  { value: "bug", label: "Algo errado", icon: Bug },
  { value: "idea", label: "Ideia", icon: Lightbulb },
  { value: "other", label: "Outro", icon: MessageSquare },
];

/** Canal de feedback dentro do produto, atrás de um ícone no topo.
 *
 * Discreto de propósito: não é uma função que se usa todo dia, mas precisa
 * estar do lado de onde o problema aparece — um relato como "esse número
 * está errado" perde quase todo o valor se a pessoa tiver que sair do app
 * pra escrever. Por isso a tela atual vai junto, automaticamente.
 */
export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const pathname = usePathname();
  const send = useSendFeedback();
  const { data: history = [] } = useFeedbackHistory(open);

  const close = () => {
    setOpen(false);
    setMessage("");
    setCategory("bug");
  };

  const submit = async () => {
    if (message.trim().length < 3) return;
    await send.mutateAsync({
      category,
      message: message.trim(),
      page_path: pathname ?? undefined,
    });
    close();
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Enviar feedback"
        aria-label="Enviar feedback"
        className="w-9 h-9 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center flex-shrink-0 transition-colors"
      >
        <MessageSquarePlus size={16} />
      </button>

      {open && (
        <Modal
          title="Enviar feedback"
          onClose={close}
          maxWidth="lg"
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={close}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={submit}
                disabled={message.trim().length < 3 || send.isPending}
                loading={send.isPending}
              >
                Enviar
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="flex gap-2">
              {CATEGORIES.map((c) => {
                const Icon = c.icon;
                const active = category === c.value;
                return (
                  <button
                    key={c.value}
                    onClick={() => setCategory(c.value)}
                    aria-pressed={active}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-[12px] font-medium transition-colors"
                    style={{
                      borderColor: active ? "var(--accent)" : "var(--border)",
                      background: active ? "var(--glow)" : "transparent",
                      color: active ? "var(--accent)" : "var(--text-secondary)",
                    }}
                  >
                    <Icon size={13} /> {c.label}
                  </button>
                );
              })}
            </div>

            <div>
              <label htmlFor="feedback-message" className="block text-[11px] text-[var(--text-muted)] mb-1.5">
                O que aconteceu?
              </label>
              <textarea
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={4000}
                autoFocus
                placeholder="Descreva o que você viu e o que esperava ver."
                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[12.5px] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)] resize-none"
              />
              <p className="text-[10.5px] text-[var(--text-muted)] mt-1.5">
                A tela atual ({pathname || "—"}) vai junto, para localizar o problema.
              </p>
            </div>

            {history.length > 0 && (
              <div className="border-t border-[var(--border)] pt-3.5">
                <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-[.06em] mb-2">
                  Enviados por você
                </div>
                <ul className="space-y-2 max-h-[150px] overflow-y-auto">
                  {history.slice(0, 5).map((item) => (
                    <li key={item.id} className="text-[11.5px] text-[var(--text-secondary)]">
                      <span className="text-[var(--text-muted)]">
                        {new Date(item.created_at).toLocaleDateString("pt-BR")} ·{" "}
                      </span>
                      {item.message.length > 90 ? `${item.message.slice(0, 90)}…` : item.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
