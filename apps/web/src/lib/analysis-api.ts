import { apiClient } from "./api-client";

export type AnalysisListItem = {
  id: string;
  created_at: string;
  provider: string | null;
  model: string | null;
  summary_snippet: string;
};

export type AnalysisMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type AnalysisDetail = {
  id: string;
  portfolio_id: string;
  raw_text: string;
  sections: Record<string, string>;
  provider: string | null;
  model: string | null;
  created_at: string;
  messages: AnalysisMessage[];
};

export type SaveAnalysisInput = {
  portfolio_id: string;
  raw_text: string;
  sections: Record<string, string>;
  provider?: string;
  model?: string;
};

export const listAnalyses = async (portfolioId: string): Promise<AnalysisListItem[]> => {
  const { data } = await apiClient.get(`/portfolios/${portfolioId}/analyses`);
  return data;
};

export const getRecentContext = async (portfolioId: string): Promise<{ raw_texts: string[] }> => {
  const { data } = await apiClient.get(`/portfolios/${portfolioId}/analyses/recent-context`);
  return data;
};

export const getAnalysis = async (id: string): Promise<AnalysisDetail> => {
  const { data } = await apiClient.get(`/analyses/${id}`);
  return data;
};

export const saveAnalysis = async (input: SaveAnalysisInput): Promise<{ id: string }> => {
  const { data } = await apiClient.post(`/analyses`, input);
  return data;
};
