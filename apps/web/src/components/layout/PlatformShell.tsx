"use client";

import { useUIStore } from "@/store/useUIStore";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";

interface PlatformShellProps {
  children: React.ReactNode;
}

export function PlatformShell({ children }: PlatformShellProps) {
  const fontScale = useUIStore((s) => s.fontScale);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)] text-[var(--text-primary)]">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main
          className="flex-1 overflow-hidden md:mb-0 mb-16"
          style={{ zoom: fontScale }}
        >
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
