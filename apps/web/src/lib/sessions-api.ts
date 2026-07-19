import { apiClient } from "./api-client";

export interface Session {
  id: string;
  device_info: string | null;
  ip_address: string | null;
  created_at: string;
  expires_at: string;
  is_current: boolean;
}

export async function listSessions(): Promise<Session[]> {
  const res = await apiClient.get<Session[]>("/auth/sessions");
  return res.data;
}

export async function revokeSession(sessionId: string): Promise<void> {
  await apiClient.delete(`/auth/sessions/${sessionId}`);
}

export async function revokeOtherSessions(): Promise<{ revoked_count: number }> {
  const res = await apiClient.post<{ revoked_count: number }>("/auth/sessions/revoke-others");
  return res.data;
}
