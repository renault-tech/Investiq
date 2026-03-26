"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, BarChart2, LineChart, Settings } from "lucide-react";

const NAV_ITEMS = [
  { href: "/investments", label: "Dashboard", icon: TrendingUp },
  { href: "/finances", label: "Finanças", icon: BarChart2 },
  { href: "/analysis", label: "Análise", icon: LineChart },
  { href: "/settings", label: "Ajustes", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--surface)] border-t border-[var(--border)] pb-safe flex justify-around items-center h-16 px-2 z-50">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
              active ? "text-[var(--navy)] dark:text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
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
