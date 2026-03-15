import { useQuery } from "@tanstack/react-query"
import { MOCK_PORTFOLIO_SUMMARY, MOCK_POSITIONS, MOCK_REBALANCE } from "@/lib/mock-data"

export const usePortfolioSummary = () =>
  useQuery({ queryKey: ["portfolio", "summary"], queryFn: () => Promise.resolve(MOCK_PORTFOLIO_SUMMARY) })

export const usePositions = () =>
  useQuery({ queryKey: ["portfolio", "positions"], queryFn: () => Promise.resolve(MOCK_POSITIONS) })

export const useRebalance = () =>
  useQuery({ queryKey: ["portfolio", "rebalance"], queryFn: () => Promise.resolve(MOCK_REBALANCE) })
