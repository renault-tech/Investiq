"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BarChart2, LineChart, ArrowLeftRight, CreditCard } from "lucide-react";

const NAV_ITEMS = [
  { href: "/overview", label: "Visão geral", icon: LayoutDashboard },
  { href: "/finances", label: "Finanças", icon: BarChart2 },
  { href: "/investments", label: "Invest.", icon: LineChart },
  { href: "/finances/cards", label: "Cartões", icon: CreditCard },
  { href: "/transactions", label: "Transações", icon: ArrowLeftRight },
];

export function BottomNav() {
  const pathname = usePathname();
  const activeHref = NAV_ITEMS
    .filter((item) => pathname.startsWith(item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--surface)] border-t border-[var(--border)] pb-safe flex justify-around items-center h-16 px-2 z-50">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === activeHref;
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
              active ? "text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Icon size={20} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
