import { PortfolioSummaryCards } from "./PortfolioSummaryCards"
import { PositionsTable }        from "./PositionsTable"
import { AllocationChart }       from "./AllocationChart"
import { RebalancePanel }        from "./RebalancePanel"

export default function InvestmentsPage() {
  return (
    <div className="h-full overflow-auto p-4 flex flex-col gap-4">
      <PortfolioSummaryCards />
      <div className="flex gap-4 flex-1 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <PositionsTable />
        </div>
        <div className="w-72 shrink-0 flex flex-col gap-4">
          <AllocationChart />
          <RebalancePanel />
        </div>
      </div>
    </div>
  )
}
