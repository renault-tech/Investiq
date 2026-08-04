import { apiClient } from "./api-client";

export interface OnboardingStatus {
  has_portfolio: boolean;
  has_position: boolean;
  has_transaction: boolean;
  has_finance_transaction: boolean;
  has_goal: boolean;
}

export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  const res = await apiClient.get<OnboardingStatus>("/onboarding/status");
  return res.data;
}
