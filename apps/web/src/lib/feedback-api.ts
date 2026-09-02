import { apiClient } from "@/lib/api-client";

export type FeedbackCategory = "bug" | "idea" | "other";

export interface Feedback {
  id: string;
  category: FeedbackCategory;
  message: string;
  page_path: string | null;
  created_at: string;
}

export interface FeedbackInput {
  category: FeedbackCategory;
  message: string;
  page_path?: string;
}

export async function sendFeedback(input: FeedbackInput): Promise<Feedback> {
  const res = await apiClient.post<Feedback>("/feedback", input);
  return res.data;
}

export async function listFeedback(): Promise<Feedback[]> {
  const res = await apiClient.get<Feedback[]>("/feedback");
  return res.data;
}
