"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient, setAccessToken } from "@/lib/api-client";
import { useUserStore } from "@/store/useUserStore";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setUser = useUserStore((s) => s.setUser);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres");
      return;
    }
    setLoading(true);
    try {
      await apiClient.post("/auth/register", {
        email,
        password,
        full_name: fullName || null,
      });
      // Auto-login after register
      const loginRes = await apiClient.post("/auth/login", { email, password });
      setAccessToken(loginRes.data.access_token);
      const meRes = await apiClient.get("/auth/me");
      setUser(meRes.data);
      router.push("/investments");
    } catch (err: unknown) {
      console.error(err);
      let message = "Erro ao criar conta";
      const data = (err as any)?.response?.data;
      if (data?.detail) {
        if (typeof data.detail === "string") message = data.detail;
        else if (Array.isArray(data.detail)) message = data.detail[0]?.msg || JSON.stringify(data.detail);
        else if (data.detail.message) message = data.detail.message;
      } else if ((err as any)?.message) {
        message = (err as any).message;
      }
      setError(message);
    } finally {
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
          <p className="text-sm text-[var(--text-muted)] mt-1">Crie sua conta</p>
        </div>
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-8 shadow-sm dark:shadow-none">
          <h2 className="text-base font-medium text-[var(--text-primary)] mb-6">Nova conta</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nome (opcional)"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Seu nome"
            />
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
            />
            <Input
              label="Senha"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Mínimo 8 caracteres"
            />
            {error && (
              <p className="text-[var(--danger)] text-xs bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <Button type="submit" loading={loading} className="w-full">
              {loading ? "Criando conta..." : "Criar conta"}
            </Button>
          </form>
          <div className="mt-5 text-center text-xs text-[var(--text-muted)]">
            <Link href="/login" className="hover:text-[var(--text-primary)] transition-colors">
              Já tenho conta — Entrar
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
