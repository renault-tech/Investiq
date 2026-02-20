"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  TrendingUp,
  BarChart2,
  LineChart,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useUIStore } from "@/store/useUIStore";
import { useUserStore } from "@/store/useUserStore";

const NAV_ITEMS = [
  { href: "/investments", label: "Investimentos", icon: TrendingUp },
  { href: "/finances", label: "Finan\u00e7as", icon: BarChart2 },
  { href: "/analysis", label: "An\u00e1lise", icon: LineChart },
  { href: "/settings", label: "Configura\u00e7\u00f5es", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const user = useUserStore((s) => s.user);

  return (
    <aside
      className={`flex-shrink-0 bg-neutral-900 border-r border-neutral-800 flex flex-col transition-all duration-200 ${
        sidebarCollapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-neutral-800 flex-shrink-0">
        {!sidebarCollapsed && (
          <span className="text-base font-semibold tracking-tight text-white">
            InvestIQ
          </span>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors ml-auto"
          aria-label="Toggle sidebar"
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={sidebarCollapsed ? label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-800"
              }`}
            >
              <Icon size={16} className="flex-shrink-0" />
              {!sidebarCollapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      {user && !sidebarCollapsed && (
        <div className="p-3 border-t border-neutral-800 flex-shrink-0">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-neutral-800">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-medium text-white flex-shrink-0">
              {(user.full_name ?? user.email).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">
                {user.full_name ?? user.email}
              </p>
              <p className="text-xs text-neutral-500 capitalize">{user.plan}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
