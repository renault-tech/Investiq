"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, TrendingUp, Upload, Wallet } from "lucide-react";

const TABS = [
  { href: "/finances", label: "Visão geral", icon: Wallet },
  { href: "/finances/planejamento", label: "Planejamento", icon: TrendingUp },
  { href: "/finances/analise", label: "Análise financeira", icon: BarChart3 },
  { href: "/finances/importar", label: "Importar", icon: Upload },
] as const;

/** Navegação entre as sub-rotas de Finanças. Nome "Análise financeira" (e não
 * só "Análise") para não colidir com o item "Análise" da sidebar, que é a
 * análise de portfólio por IA — feature completamente diferente. */
export function FinanceTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-[var(--border)]" aria-label="Navegação de Finanças">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = href === "/finances" ? pathname === "/finances" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm border-b-2 -mb-px shrink-0 transition-colors ${
              active
                ? "border-[var(--navy)] text-[var(--navy)] dark:text-white dark:border-white font-medium"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
            }`}
          >
            <Icon size={15} /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
