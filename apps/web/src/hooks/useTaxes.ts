import { useQuery } from "@tanstack/react-query";
import { getTaxApuration, getDarfList, getInformeRendimentos } from "@/lib/taxes-api";

export function useTaxApuration(year: number) {
  return useQuery({
    queryKey: ["taxes", "apuracao", year],
    queryFn: () => getTaxApuration(year),
    staleTime: 60_000,
  });
}

export function useDarfList(year: number) {
  return useQuery({
    queryKey: ["taxes", "darf", year],
    queryFn: () => getDarfList(year),
    staleTime: 60_000,
  });
}

export function useInformeRendimentos(year: number) {
  return useQuery({
    queryKey: ["taxes", "informe", year],
    queryFn: () => getInformeRendimentos(year),
    staleTime: 60_000,
  });
}
