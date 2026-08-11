"use client";

import { useState } from "react";
import { FinanceCategory, FinanceTransaction } from "@/lib/finance-api";
import { useCreateTransaction, useUpdateTransaction } from "@/hooks/useFinance";
import { useAccounts } from "@/hooks/useAccounts";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { formatBRLExact } from "@/components/charts/chartTheme";

const RECURRENCE_OPTIONS = [
  { value: "", label: "Não se repete" },
  { value: "FREQ=WEEKLY", label: "Semanal" },
  { value: "FREQ=MONTHLY", label: "Mensal" },
  { value: "FREQ=YEARLY", label: "Anual" },
];

type TxnType = "expense" | "income" | "transfer";

const TYPE_BUTTONS: [TxnType, string][] = [
  ["expense", "Despesa"],
  ["income", "Receita"],
  ["transfer", "Transferência"],
];

interface TransactionModalProps {
  categories: FinanceCategory[];
  editing?: FinanceTransaction;
  onClose: () => void;
}

export function TransactionModal({ categories, editing, onClose }: TransactionModalProps) {
  const [type, setType] = useState<TxnType>(
    (editing?.transaction_type as TxnType) ?? "expense"
  );
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [categoryId, setCategoryId] = useState(editing?.category_id ?? "");
  const [accountId, setAccountId] = useState(editing?.bank_account_id ?? "");
  const [toAccountId, setToAccountId] = useState(editing?.to_bank_account_id ?? "");
  const [date, setDate] = useState(
    editing ? editing.transaction_date.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  // Vazio = vence na data de lançamento (pago no ato). Só populamos se o
  // vencimento gravado já for diferente — editar um lançamento "normal" não
  // deve fazer os dois campos aparecerem preenchidos com a mesma data.
  const [dueDate, setDueDate] = useState(
    editing && editing.due_date.slice(0, 10) !== editing.transaction_date.slice(0, 10)
      ? editing.due_date.slice(0, 10)
      : ""
  );
  const [recurrence, setRecurrence] = useState(editing?.recurrence_rule ?? "");
  const [installments, setInstallments] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const { data: accounts = [] } = useAccounts();
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const pending = createMutation.isPending || updateMutation.isPending;

  const isTransfer = type === "transfer";
  const filteredCategories = categories.filter((c) => c.category_type === type && c.is_active);

  // Parcelar só faz sentido criando uma despesa nova — editar uma parcela já
  // existente mexe naquela linha, não na série.
  const canSplit = !editing && type === "expense";
  const parcelCount = Math.max(1, Number(installments) || 1);
  const parsedAmount = Number(amount.replace(",", ".").replace(/\s/g, ""));
  const showParcelPreview = canSplit && parcelCount > 1 && parsedAmount > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedAmount || parsedAmount <= 0) {
      setError("Informe um valor válido maior que zero.");
      return;
    }
    if (isTransfer) {
      if (!accountId || !toAccountId) {
        setError("Transferência precisa de uma conta de origem e uma de destino.");
        return;
      }
      if (accountId === toAccountId) {
        setError("A conta de destino precisa ser diferente da de origem.");
        return;
      }
    }
    setError(null);

    const payload = {
      transaction_type: type,
      amount: parsedAmount,
      description: description || undefined,
      category_id: isTransfer ? undefined : categoryId || undefined,
      bank_account_id: accountId || undefined,
      to_bank_account_id: isTransfer ? toAccountId : undefined,
      transaction_date: `${date}T12:00:00Z`,
      due_date: dueDate ? `${dueDate}T12:00:00Z` : undefined,
      recurrence_rule: canSplit && parcelCount > 1 ? undefined : recurrence || undefined,
      installments: canSplit ? parcelCount : undefined,
    };

    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, input: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onClose();
    } catch {
      // O toast do hook já reporta; mantém o modal aberto para corrigir.
    }
  };

  return (
    <Modal title={editing ? "Editar transação" : "Nova transação"} onClose={onClose} maxWidth="xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
          {TYPE_BUTTONS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setType(value);
                setCategoryId("");
              }}
              className={`flex-1 py-2 text-sm transition-colors ${
                type === value
                  ? value === "expense"
                    ? "bg-[var(--danger)] text-white"
                    : value === "income"
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--navy)] text-white"
                  : "text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <Input
          label="Valor (R$)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0,00"
          className="font-mono"
          autoFocus
        />

        <Input
          label="Descrição"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={255}
        />

        {isTransfer ? (
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="De (conta)"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">Selecione…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.holder ? ` · ${a.holder}` : ""}
                </option>
              ))}
            </Select>
            <Select
              label="Para (conta)"
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
            >
              <option value="">Selecione…</option>
              {accounts
                .filter((a) => a.id !== accountId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.holder ? ` · ${a.holder}` : ""}
                  </option>
                ))}
            </Select>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Categoria"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Sem categoria</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select label="Conta" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Sem conta</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.holder ? ` · ${a.holder}` : ""}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Data"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          {canSplit ? (
            <Input
              label="Parcelas"
              type="number"
              min={1}
              max={120}
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
            />
          ) : (
            <Select
              label="Recorrência"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
            >
              {RECURRENCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          )}
        </div>

        <Input
          label="Vencimento (se diferente da data de lançamento)"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <p className="text-xs text-[var(--text-muted)] -mt-2.5">
          Deixe em branco para "pago no ato". Preenchendo com uma data futura, o lançamento
          fica pendente até você clicar em "Pagar" na tabela — ou até o vencimento chegar,
          quando você recebe uma notificação.
        </p>

        {canSplit && parcelCount === 1 && (
          <Select
            label="Recorrência"
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value)}
          >
            {RECURRENCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        )}

        {showParcelPreview && (
          <p className="text-xs text-[var(--text-muted)]">
            {parcelCount}× de{" "}
            <span className="font-mono text-[var(--text-secondary)]">
              {formatBRLExact(Math.floor((parsedAmount / parcelCount) * 100) / 100)}
            </span>{" "}
            — os lançamentos futuros já entram na projeção e não mexem no saldo de hoje.
          </p>
        )}

        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={pending}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
