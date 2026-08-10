"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { useCreateAccount, useUpdateAccount } from "@/hooks/useAccounts";
import { ACCOUNT_TYPE_LABELS, type Account, type AccountType } from "@/lib/accounts-api";

interface Props {
  editing?: Account;
  onClose: () => void;
}

const TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[];

export function AccountModal({ editing, onClose }: Props) {
  const [name, setName] = useState(editing?.name ?? "");
  const [accountType, setAccountType] = useState<AccountType>(editing?.account_type ?? "checking");
  const [institution, setInstitution] = useState(editing?.institution ?? "");
  const [holder, setHolder] = useState(editing?.holder ?? "");
  const [openingBalance, setOpeningBalance] = useState(
    editing ? String(editing.opening_balance) : "0"
  );
  const [includeInTotal, setIncludeInTotal] = useState(editing?.include_in_total ?? true);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateAccount();
  const updateMutation = useUpdateAccount();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Dê um nome para a conta.");
      return;
    }
    const balance = Number(openingBalance.replace(",", "."));
    if (Number.isNaN(balance)) {
      setError("Saldo inicial inválido.");
      return;
    }

    const payload = {
      name: name.trim(),
      account_type: accountType,
      institution: institution.trim() || undefined,
      holder: holder.trim() || undefined,
      opening_balance: balance,
      include_in_total: includeInTotal,
    };

    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, input: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onClose();
    } catch {
      // O toast do hook já informa; manter o modal aberto para corrigir.
    }
  };

  return (
    <Modal title={editing ? "Editar conta" : "Nova conta"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          label="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nubank, Itaú, Carteira…"
          maxLength={100}
          autoFocus
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Tipo"
            value={accountType}
            onChange={(e) => setAccountType(e.target.value as AccountType)}
          >
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {ACCOUNT_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
          <Input
            label="Instituição"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            placeholder="Opcional"
            maxLength={100}
          />
        </div>

        <Input
          label="Titular"
          value={holder}
          onChange={(e) => setHolder(e.target.value)}
          placeholder="Eu, Minha mãe…"
          maxLength={80}
        />
        <p className="text-xs text-[var(--text-muted)] -mt-1">
          Use o titular para separar contas que você administra para outra pessoa. Um filtro no
          topo das Finanças mostra tudo junto ou só as contas de um titular.
        </p>

        <Input
          label="Saldo inicial (R$)"
          value={openingBalance}
          onChange={(e) => setOpeningBalance(e.target.value)}
          inputMode="decimal"
          disabled={false}
        />
        <p className="text-xs text-[var(--text-muted)] -mt-1">
          Quanto a conta tinha antes do primeiro lançamento registrado aqui. O saldo atual é
          calculado a partir dele mais as transações.
        </p>

        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={includeInTotal}
            onChange={(e) => setIncludeInTotal(e.target.checked)}
            className="rounded border-[var(--border)]"
          />
          Somar no total consolidado
        </label>

        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSaving}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
