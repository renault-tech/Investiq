"use client";

import { ForecastSection } from "./ForecastSection";

export function PlanningClient() {
  return (
    <div className="p-6 max-w-6xl mx-auto w-full space-y-4">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">Planejamento</h1>
      <ForecastSection />
    </div>
  );
}
