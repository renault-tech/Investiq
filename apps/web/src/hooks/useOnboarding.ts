import { useQuery } from "@tanstack/react-query";
import { getOnboardingStatus, OnboardingStatus } from "@/lib/onboarding-api";

export function useOnboardingStatus() {
  return useQuery<OnboardingStatus>({
    queryKey: ["onboarding-status"],
    queryFn: getOnboardingStatus,
    staleTime: 30_000,
  });
}
