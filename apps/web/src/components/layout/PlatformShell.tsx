"use client";

import { useEffect } from "react";
import { useUIStore } from "@/store/useUIStore";
import { useSettings } from "@/hooks/useSettings";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";

interface PlatformShellProps {
  children: React.ReactNode;
}

export function PlatformShell({ children }: PlatformShellProps) {
  const fontScale = useUIStore((s) => s.fontScale);
  const setFontScale = useUIStore((s) => s.setFontScale);
  const { data: settings } = useSettings();

  // Apply persisted font scale from user settings on load
  useEffect(() => {
    if (settings?.font_size_scale) {
      const saved = Number(settings.font_size_scale);
      if (!isNaN(saved) && saved !== fontScale) {
        setFontScale(saved, false); // false = don't re-persist
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.font_size_scale]);

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
