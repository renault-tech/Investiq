import { apiClient } from "./api-client";
import { coerceNumbers } from "./coerce";

export interface WatchlistItem {
  id: string;
  ticker: string;
  name: string;
  asset_type: string;
  price: number | null;
  change_pct: number | null;
  currency: string;
  created_at: string;
}

const WATCHLIST_ITEM_NUMERIC = ["price", "change_pct"] as const;

export async function listWatchlist(): Promise<WatchlistItem[]> {
  const res = await apiClient.get<WatchlistItem[]>("/watchlist");
  return res.data.map((item) => coerceNumbers(item, WATCHLIST_ITEM_NUMERIC));
}

export async function addToWatchlist(ticker: string): Promise<WatchlistItem> {
  const res = await apiClient.post<WatchlistItem>("/watchlist", { ticker });
  return coerceNumbers(res.data, WATCHLIST_ITEM_NUMERIC);
}

export async function removeFromWatchlist(id: string): Promise<void> {
  await apiClient.delete(`/watchlist/${id}`);
}
