import { apiClient } from "./api-client";

export interface UserSettings {
  theme: string;
  accent_color: string;
  font_size_scale: string;
  base_currency: string;
  preferred_provider: "yahoo" | "brapi";
  preferred_llm: "claude" | "openai" | "gemini";
  llm_model: string | null;
  notify_price_alerts: boolean;
  notify_email: boolean;
  has_claude_api_key: boolean;
  has_openai_api_key: boolean;
  has_gemini_api_key: boolean;
  has_alpha_vantage_key: boolean;
  has_brapi_key: boolean;
  has_polygon_key: boolean;
}

export interface SettingsPatch {
  theme?: "dark" | "light";
  base_currency?: string;
  preferred_provider?: "yahoo" | "brapi";
  preferred_llm?: "claude" | "openai" | "gemini";
  llm_model?: string;
  notify_price_alerts?: boolean;
  notify_email?: boolean;
}

export interface ApiKeysUpdate {
  claude_api_key?: string;
  openai_api_key?: string;
  gemini_api_key?: string;
  brapi_key?: string;
}

export async function getSettings(): Promise<UserSettings> {
  const res = await apiClient.get<UserSettings>("/settings");
  return res.data;
}

export async function patchSettings(input: SettingsPatch): Promise<UserSettings> {
  const res = await apiClient.patch<UserSettings>("/settings", input);
  return res.data;
}

export async function updateApiKeys(input: ApiKeysUpdate): Promise<UserSettings> {
  const res = await apiClient.put<UserSettings>("/settings/api-keys", input);
  return res.data;
}
