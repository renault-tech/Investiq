import { apiClient } from "./api-client";

export interface Goal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  pct_complete: number;
  target_date: string | null;
  color: string | null;
  icon: string | null;
  is_archived: boolean;
  is_complete: boolean;
  created_at: string;
}

export interface CreateGoalInput {
  name: string;
  target_amount: number;
  target_date?: string;
  color?: string;
}

export async function listGoals(): Promise<Goal[]> {
  const res = await apiClient.get<Goal[]>("/finance/goals");
  return res.data;
}

export async function createGoal(input: CreateGoalInput): Promise<Goal> {
  const res = await apiClient.post<Goal>("/finance/goals", input);
  return res.data;
}

export async function deleteGoal(goalId: string): Promise<void> {
  await apiClient.delete(`/finance/goals/${goalId}`);
}

export async function contributeToGoal(
  goalId: string,
  amount: number,
  note?: string
): Promise<Goal> {
  const res = await apiClient.post<Goal>(`/finance/goals/${goalId}/contributions`, { amount, note });
  return res.data;
}
