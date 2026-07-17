import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BarChart3, Brain, CreditCard, LineChart, ShieldCheck, Wallet } from "lucide-react";

const FEATURES = [
  {
    icon: Wallet,
    title: "Carteira consolidada",
    description:
      "Ações B3, FIIs, ETFs, ativos globais e renda fixa num só lugar — preço médio, P&L e sugestões de rebalanceamento em tempo real.",
  },
  {
    icon: LineChart,
    title: "Análise técnica e fundamentalista",
    description:
      "Candlestick profissional com RSI, MACD, Bollinger e médias móveis, além de P/L, P/VP, ROE e dividend yield por ativo.",
  },
  {
    icon: Brain,
    title: "IA com a sua chave",
    description:
      "Análises inteligentes de carteira e de ativos com Claude, OpenAI ou Gemini — usando a sua própria chave, criptografada.",
  },
  {
    icon: CreditCard,
    title: "Faturas lidas por IA",
    description:
      "Envie o PDF da fatura do cartão: a IA extrai e categoriza os lançamentos, você revisa e confirma.",
  },
  {
    icon: BarChart3,
    title: "Controle de gastos",
    description:
      "Receitas, despesas e recorrências com categorias, filtros e gráficos mensais que mostram para onde vai o seu dinheiro.",
  },
  {
    icon: ShieldCheck,
    title: "Dados sob seu controle",
    description:
      "Fontes de dados gratuitas (Yahoo, Brapi, Banco Central), isolamento por usuário no banco e chaves guardadas com criptografia.",
  },
];

export default async function Home() {
  const cookieStore = await cookies();
  if (cookieStore.get("refresh_token")) {
    redirect("/investments");
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)]">
      {/* Hero */}
      <header className="bg-[#0A192F] text-white">
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
          <span className="text-lg font-bold tracking-tight">
            Invest<span className="text-emerald-400">IQ</span>
          </span>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-slate-300 hover:text-white transition-colors">
              Entrar
            </Link>
            <Link
              href="/register"
              className="text-sm px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#0A192F] font-semibold rounded-lg transition-colors"
            >
              Criar conta
            </Link>
          </div>
        </nav>
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-20 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight max-w-3xl mx-auto leading-tight">
            Seus investimentos e seus gastos, com análise{" "}
            <span className="text-emerald-400">inteligente</span>.
          </h1>
          <p className="mt-5 text-lg text-slate-300 max-w-2xl mx-auto">
            Consolide carteiras da B3 e do exterior, acompanhe gráficos profissionais,
            controle despesas e deixe a IA ler suas faturas de cartão — tudo em português,
            feito para o investidor brasileiro.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href="/register"
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-[#0A192F] font-semibold rounded-lg transition-colors"
            >
              Começar agora — é grátis
            </Link>
            <Link
              href="/login"
              className="px-6 py-3 border border-slate-600 hover:border-slate-400 text-slate-200 rounded-lg transition-colors"
            >
              Já tenho conta
            </Link>
          </div>
        </div>
      </header>

      {/* Features */}
      <main className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-10">
          Uma plataforma completa de gestão patrimonial
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5 shadow-sm dark:shadow-none"
            >
              <Icon className="text-[var(--accent)] mb-3" size={22} />
              <h3 className="font-semibold text-[var(--text-primary)]">{title}</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </main>

      {/* CTA + footer */}
      <footer className="border-t border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-6 py-10 text-center">
          <Link
            href="/register"
            className="inline-block px-6 py-3 bg-[#0A192F] hover:opacity-90 text-white font-semibold rounded-lg transition-opacity"
          >
            Criar minha conta
          </Link>
          <p className="mt-6 text-xs text-[var(--text-muted)]">
            InvestIQ — plataforma pessoal de investimentos e finanças. Cotações via fontes públicas
            gratuitas; este site não é recomendação de investimento.
          </p>
        </div>
      </footer>
    </div>
  );
}
