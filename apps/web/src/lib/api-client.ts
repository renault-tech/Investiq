import axios from "axios";
// "localhost", not "127.0.0.1": the refresh_token cookie is SameSite=Lax,
// and 127.0.0.1/localhost count as different sites for that policy even on
// the same machine — a request from a page served on localhost:3000 to an
// API on 127.0.0.1:8000 silently drops the cookie, breaking session
// persistence across page reloads. Matches infrastructure/docker-compose.yml,
// which already sets NEXT_PUBLIC_API_URL to the localhost form; this is
// only the fallback for when that env var isn't set.
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

// Refresh tokens rotate server-side (each use revokes it and issues a new
// one), so if two requests 401 at the same time — e.g. a page that fires
// several queries on mount with no access token yet in memory — and each
// independently calls /auth/refresh, the second call presents a
// refresh_token cookie the first call already revoked and gets rejected,
// wrongly logging the user out. Sharing one in-flight refresh call (all
// concurrent 401s await the same promise) fixes that.
let refreshPromise: Promise<string> | null = null;

// Compartilhar a promessa só cobre os 401 que chegam *durante* a renovação.
// Os que chegam logo depois dela terminar abriam uma segunda renovação
// apresentando o refresh_token que a primeira acabou de revogar — 401, e o
// usuário caía no login sem motivo. Dentro desta janela o retry reusa o
// token recém-obtido em vez de renovar de novo.
const REFRESH_GRACE_MS = 10_000;
let lastRefreshAt = 0;

function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(API_BASE + "/auth/refresh", {}, { withCredentials: true })
      .then((res) => {
        const newToken = res.data.access_token;
        setAccessToken(newToken);
        lastRefreshAt = Date.now();
        return newToken;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post("/auth/logout");
  } catch {
    // Best-effort: even if the server call fails, still clear local state
    // below so the user isn't stuck "logged in" on a dead session.
  } finally {
    clearAccessToken();
  }
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes("/auth/login") &&
      !original.url?.includes("/auth/register")
    ) {
      original._retry = true;
      try {
        const fresh = accessToken && Date.now() - lastRefreshAt < REFRESH_GRACE_MS;
        const newToken = fresh ? accessToken : await refreshAccessToken();
        original.headers.Authorization = "Bearer " + newToken;
        return apiClient(original);
      } catch {
        clearAccessToken();
        // Já estar numa tela de autenticação significa que o refresh falhou
        // durante o próprio login/registro — redirecionar dali recarregaria
        // a página e apagaria o erro que o formulário está exibindo.
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);
