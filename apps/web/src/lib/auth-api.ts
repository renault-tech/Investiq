import { apiClient } from "./api-client";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_verified: boolean;
  plan: string;
}

export async function updateProfile(fullName: string): Promise<UserProfile> {
  const res = await apiClient.patch<UserProfile>("/auth/me", { full_name: fullName });
  return res.data;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.post("/auth/change-password", { current_password: currentPassword, new_password: newPassword });
}
