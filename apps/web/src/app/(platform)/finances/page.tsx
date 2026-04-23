import { Metadata } from "next";
import { FinancesClient } from "@/components/finances/FinancesClient";

export const metadata: Metadata = {
  title: "Finanças | InvestIQ",
};

export default function FinancesPage() {
  return (
    <div className="h-full bg-[var(--background)]">
      <FinancesClient />
    </div>
  );
}
