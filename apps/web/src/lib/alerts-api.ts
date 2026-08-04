import { apiClient } from "./api-client";

export interface PriceAlert {
  id: string;
  ticker: string;
  alert_type: "price_above" | "price_below";
  threshold: number;
  is_active: boolean;
  triggered_at: string | null;
  created_at: string;
}

export async function listAlerts(): Promise<PriceAlert[]> {
  const res = await apiClient.get<PriceAlert[]>("/alerts");
  return res.data;
}

export async function createAlert(input: {
  ticker: string;
  alert_type: "price_above" | "price_below";
  threshold: number;
}): Promise<PriceAlert> {
  const res = await apiClient.post<PriceAlert>("/alerts", input);
  return res.data;
}

export async function updateAlert(
  id: string,
  input: Partial<{ is_active: boolean; threshold: number }>
): Promise<PriceAlert> {
  const res = await apiClient.patch<PriceAlert>(`/alerts/${id}`, input);
  return res.data;
}

export async function deleteAlert(id: string): Promise<void> {
  await apiClient.delete(`/alerts/${id}`);
}
