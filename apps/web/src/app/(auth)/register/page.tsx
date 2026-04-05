"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient, setAccessToken } from "@/lib/api-client";
import { useUserStore } from "@/store/useUserStore";

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
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-white">InvestIQ</h1>
          <p className="text-sm text-neutral-500 mt-1">Crie sua conta</p>
        </div>
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-8">
          <h2 className="text-base font-medium text-white mb-6">Nova conta</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5">Nome (opcional)</label>
              <input
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Seu nome"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5">Email</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="seu@email.com"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5">Senha</label>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Minimo 8 caracteres"
              />
            </div>
            {error && (
              <p className="text-red-400 text-xs bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? "Criando conta..." : "Criar conta"}
            </button>
          </form>
          <div className="mt-5 text-center text-xs text-neutral-500">
            <Link href="/login" className="hover:text-neutral-300 transition-colors">
              Ja tenho conta &mdash; Entrar
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
