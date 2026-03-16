import axios from "axios";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
export const apiClient = axios.create({ baseURL: API_BASE, withCredentials: true });
let accessToken: string | null = null;
export function setAccessToken(token: string) { accessToken = token; }
export function clearAccessToken() { accessToken = null; }
export function getAccessToken() { return accessToken; }
apiClient.interceptors.request.use((config) => {
  if (accessToken) { config.headers.Authorization = "Bearer " + accessToken; }
  return config;
});
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const res = await axios.post(API_BASE + "/auth/refresh", {}, { withCredentials: true });
        const newToken = res.data.access_token;
        setAccessToken(newToken);
        original.headers.Authorization = "Bearer " + newToken;
        return apiClient(original);
      } catch { clearAccessToken(); if (typeof window !== "undefined") { window.location.href = "/login"; } }
    }
    return Promise.reject(error);
  }
);
