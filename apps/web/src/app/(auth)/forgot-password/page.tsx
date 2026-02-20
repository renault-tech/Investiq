"use client";

import { useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";

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
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-white">InvestIQ</h1>
        </div>
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-8">
          <h2 className="text-base font-medium text-white mb-2">Recuperar senha</h2>
          {sent ? (
            <div className="text-center py-4">
              <p className="text-sm text-neutral-300 mb-1">Email enviado!</p>
              <p className="text-xs text-neutral-500 mb-6">
                Se o email existir, voce recebera um link de recuperacao.
              </p>
              <Link href="/login" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                Voltar ao login
              </Link>
            </div>
          ) : (
            <>
              <p className="text-xs text-neutral-500 mb-5">
                Informe seu email para receber o link de redefinicao.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="seu@email.com"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {loading ? "Enviando..." : "Enviar link"}
                </button>
              </form>
              <div className="mt-5 text-center">
                <Link href="/login" className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
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
