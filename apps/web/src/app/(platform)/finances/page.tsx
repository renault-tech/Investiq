import { FinanceSummaryCards } from "./FinanceSummaryCards"
import { TransactionsTable }   from "./TransactionsTable"
import { CategoryDonutChart }  from "./CategoryDonutChart"
import { MonthlyBarChart }     from "./MonthlyBarChart"

export default function FinancesPage() {
  return (
    <div className="h-full overflow-auto p-4 flex flex-col gap-4">
      <FinanceSummaryCards />
      <div className="flex gap-4 flex-1 min-h-0">
        <div className="flex-1 min-w-0">
          <TransactionsTable />
        </div>
        <div className="w-72 shrink-0 flex flex-col gap-4">
          <CategoryDonutChart />
          <MonthlyBarChart />
        </div>
      </div>
    </div>
  )
}
