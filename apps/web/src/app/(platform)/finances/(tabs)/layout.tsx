import { FinanceTabs } from "@/components/finances/FinanceTabs";

export default function FinancesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="px-6 pt-4 max-w-6xl mx-auto w-full">
        <FinanceTabs />
      </div>
      {children}
    </div>
  );
}
