"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listFeedback, sendFeedback, type Feedback, type FeedbackInput } from "@/lib/feedback-api";

export function useFeedbackHistory(enabled: boolean) {
  return useQuery<Feedback[]>({
    queryKey: ["feedback"],
    queryFn: listFeedback,
    enabled,
    staleTime: 60_000,
  });
}

export function useSendFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FeedbackInput) => sendFeedback(input),
    onSuccess: () => {
      toast.success("Feedback enviado. Obrigado!");
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
    },
    onError: () => toast.error("Não foi possível enviar o feedback."),
  });
}
