import { useQuery } from "@tanstack/react-query"
import { MOCK_ASSETS, getMockOHLCV, MOCK_INDICATORS, MOCK_FIXED_INCOME } from "@/lib/mock-data"

export const useAssets = (query: string) =>
  useQuery({
    queryKey: ["analysis", "assets", query],
    queryFn: () => {
      const q = query.toLowerCase()
      return Promise.resolve(
        q.length < 1 ? [] : MOCK_ASSETS.filter(a =>
          a.ticker.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
        )
      )
    },
  })

export const useOHLCV = (ticker: string, _range: string) =>
  useQuery({
    queryKey: ["analysis", "ohlcv", ticker],
    queryFn: () => Promise.resolve(getMockOHLCV(ticker)),
    enabled: !!ticker,
  })

export const useIndicators = (_ticker: string) =>
  useQuery({ queryKey: ["analysis", "indicators"], queryFn: () => Promise.resolve(MOCK_INDICATORS) })

export const useFixedIncome = () =>
  useQuery({ queryKey: ["analysis", "fixedIncome"], queryFn: () => Promise.resolve(MOCK_FIXED_INCOME) })
