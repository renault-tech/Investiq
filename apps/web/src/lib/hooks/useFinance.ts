import { useQuery } from "@tanstack/react-query"
import { MOCK_FINANCE_DASHBOARD, MOCK_TRANSACTIONS } from "@/lib/mock-data"
import type { FinancialTransaction } from "@/types"

interface TransactionFilters { month?: string; category?: string }

export const useFinanceDashboard = () =>
  useQuery({ queryKey: ["finance", "dashboard"], queryFn: () => Promise.resolve(MOCK_FINANCE_DASHBOARD) })

export const useTransactions = (filters?: TransactionFilters) =>
  useQuery({
    queryKey: ["finance", "transactions", filters],
    queryFn: () => {
      let data: FinancialTransaction[] = MOCK_TRANSACTIONS
      if (filters?.category) data = data.filter(t => t.category_name === filters.category)
      if (filters?.month)    data = data.filter(t => t.date.startsWith(filters.month!))
      return Promise.resolve(data)
    },
  })
