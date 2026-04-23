import { apiClient } from "@/lib/api-client";

export interface UserSettings {
  theme: string;
  accent_color: string;
  font_size_scale: string;
  base_currency: string;
  preferred_provider: string;
  preferred_llm: string;
  llm_model: string | null;
  notify_price_alerts: boolean;
  notify_email: boolean;
  has_claude_api_key: boolean;
  has_openai_api_key: boolean;
  has_gemini_api_key: boolean;
  has_alpha_vantage_key: boolean;
  has_brapi_key: boolean;
  has_polygon_key: boolean;
  updated_at: string | null;
}

export interface SettingsPatch {
  theme?: string;
  accent_color?: string;
  font_size_scale?: string;
  base_currency?: string;
  preferred_provider?: string;
  preferred_llm?: string;
  llm_model?: string | null;
  notify_price_alerts?: boolean;
  notify_email?: boolean;
}

export interface ApiKeysPatch {
  claude_api_key?: string | null;
  openai_api_key?: string | null;
  gemini_api_key?: string | null;
  alpha_vantage_key?: string | null;
  brapi_key?: string | null;
  polygon_key?: string | null;
}

export async function getSettings(): Promise<UserSettings> {
  const res = await apiClient.get("/settings");
  return res.data;
}

export async function patchSettings(patch: SettingsPatch): Promise<UserSettings> {
  const res = await apiClient.patch("/settings", patch);
  return res.data;
}

export async function updateApiKeys(keys: ApiKeysPatch): Promise<UserSettings> {
  const res = await apiClient.put("/settings/api-keys", keys);
  return res.data;
}
