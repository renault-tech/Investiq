import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listGoals, createGoal, deleteGoal, contributeToGoal, CreateGoalInput } from "@/lib/goals-api";

export function useGoals() {
  return useQuery({ queryKey: ["finance", "goals"], queryFn: listGoals, staleTime: 30_000 });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGoalInput) => createGoal(input),
    onSuccess: () => {
      toast.success("Meta criada.");
      queryClient.invalidateQueries({ queryKey: ["finance", "goals"] });
    },
    onError: () => toast.error("Falha ao criar meta."),
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (goalId: string) => deleteGoal(goalId),
    onSuccess: () => {
      toast.success("Meta removida.");
      queryClient.invalidateQueries({ queryKey: ["finance", "goals"] });
    },
    onError: () => toast.error("Falha ao remover meta."),
  });
}

export function useContributeToGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ goalId, amount, note }: { goalId: string; amount: number; note?: string }) =>
      contributeToGoal(goalId, amount, note),
    onSuccess: (goal) => {
      toast.success(goal.is_complete ? `Meta "${goal.name}" concluída!` : "Aporte registrado.");
      queryClient.invalidateQueries({ queryKey: ["finance", "goals"] });
    },
    onError: () => toast.error("Falha ao registrar aporte."),
  });
}
