import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type RecurringTaskInput } from "@shared/routes";

export function useRecurringTasks() {
  return useQuery({
    queryKey: [api.recurringTasks.list.path],
    queryFn: async () => {
      const res = await fetch(api.recurringTasks.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch recurring tasks");
      return api.recurringTasks.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateRecurringTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: RecurringTaskInput) => {
      const res = await fetch(api.recurringTasks.create.path, {
        method: api.recurringTasks.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create recurring task");
      return api.recurringTasks.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.recurringTasks.list.path] });
    },
  });
}

export function useUpdateRecurringTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<RecurringTaskInput>) => {
      const url = buildUrl(api.recurringTasks.update.path, { id });
      const res = await fetch(url, {
        method: api.recurringTasks.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update recurring task");
      return api.recurringTasks.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.recurringTasks.list.path] });
    },
  });
}

export function useDeleteRecurringTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.recurringTasks.delete.path, { id });
      const res = await fetch(url, {
        method: api.recurringTasks.delete.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete recurring task");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.recurringTasks.list.path] });
    },
  });
}
