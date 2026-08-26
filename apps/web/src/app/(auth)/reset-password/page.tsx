"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      await apiClient.post("/auth/reset-password", { token, new_password: password });
      setDone(true);
    } catch (err: unknown) {
      const data = (err as any)?.response?.data;
      let message = "Não foi possível redefinir a senha. O link pode ter expirado.";
      if (typeof data?.detail === "string") message = data.detail;
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-[var(--text-secondary)] mb-1">Link inválido.</p>
        <p className="text-xs text-[var(--text-muted)] mb-6">
          Peça um novo link de redefinição de senha.
        </p>
        <Link href="/forgot-password" className="text-xs text-[var(--navy)] dark:text-[var(--accent)] hover:underline transition-colors">
          Esqueci minha senha
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-[var(--text-secondary)] mb-1">Senha redefinida!</p>
        <p className="text-xs text-[var(--text-muted)] mb-6">
          Já pode entrar com a nova senha.
        </p>
        <Button className="w-full" onClick={() => router.push("/login")}>
          Ir para o login
        </Button>
      </div>
    );
  }

  return (
    <>
      <p className="text-xs text-[var(--text-muted)] mb-5">
        Escolha uma nova senha para sua conta.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordInput
          label="Nova senha"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          placeholder="••••••••"
        />
        <PasswordInput
          label="Confirmar nova senha"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          placeholder="••••••••"
        />
        {error && (
          <p className="text-[var(--danger)] text-xs bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <Button type="submit" loading={loading} className="w-full">
          {loading ? "Redefinindo..." : "Redefinir senha"}
        </Button>
      </form>
      <div className="mt-5 text-center">
        <Link href="/login" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          Voltar ao login
        </Link>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-[var(--navy)] dark:text-white">
            Invest<span className="text-[var(--accent)]">IQ</span>
          </h1>
        </div>
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-8 shadow-sm dark:shadow-none">
          <h2 className="text-base font-medium text-[var(--text-primary)] mb-2">Redefinir senha</h2>
          <Suspense fallback={<p className="text-xs text-[var(--text-muted)]">Carregando...</p>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
