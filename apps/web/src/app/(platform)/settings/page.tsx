import { Metadata } from "next";
import { SettingsClient } from "@/components/settings/SettingsClient";

export const metadata: Metadata = {
  title: "Configurações | InvestIQ",
};

export default function SettingsPage() {
  return (
    <div className="h-full overflow-y-auto bg-[var(--background)]">
      <SettingsClient />
    </div>
  );
}
