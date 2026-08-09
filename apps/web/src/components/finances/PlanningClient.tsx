"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ForecastSection } from "./ForecastSection";

export function PlanningClient() {
  return (
    <div className="p-6 max-w-6xl mx-auto w-full space-y-4">
      <Link
        href="/finances"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        <ArrowLeft size={15} /> Finanças
      </Link>
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">Planejamento</h1>
      <ForecastSection />
    </div>
  );
}
