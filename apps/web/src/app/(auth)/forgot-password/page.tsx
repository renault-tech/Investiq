"use client";

import { useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post("/auth/forgot-password", { email });
    } finally {
      setSent(true);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-[var(--navy)] dark:text-white">
            Invest<span className="text-[var(--accent)]">IQ</span>
          </h1>
        </div>
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-8 shadow-sm dark:shadow-none">
          <h2 className="text-base font-medium text-[var(--text-primary)] mb-2">Recuperar senha</h2>
          {sent ? (
            <div className="text-center py-4">
              <p className="text-sm text-[var(--text-secondary)] mb-1">Email enviado!</p>
              <p className="text-xs text-[var(--text-muted)] mb-6">
                Se o email existir, você receberá um link de recuperação.
              </p>
              <Link href="/login" className="text-xs text-[var(--navy)] dark:text-[var(--accent)] hover:underline transition-colors">
                Voltar ao login
              </Link>
            </div>
          ) : (
            <>
              <p className="text-xs text-[var(--text-muted)] mb-5">
                Informe seu email para receber o link de redefinição.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                />
                <Button type="submit" loading={loading} className="w-full">
                  {loading ? "Enviando..." : "Enviar link"}
                </Button>
              </form>
              <div className="mt-5 text-center">
                <Link href="/login" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                  Voltar ao login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
