import { Metadata } from "next";
import { AnalysisClient } from "@/components/analysis/AnalysisClient";

export const metadata: Metadata = {
  title: "Análise com IA | InvestIQ",
  description: "Análise profunda de portfólios utilizando Inteligência Artificial.",
};

export default function AnalysisPage() {
  return (
    <div className="h-full w-full bg-[var(--background)]">
      <AnalysisClient />
    </div>
  );
}
