export function useRevision() {
  return {
    tasks: [
      { id: "a", subject: "Maths" },
      { id: "b", subject: "Biology" },
    ],
  };
}



/*
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type RevisionSlotInput } from "@shared/routes";

// GET /api/revision-slots
export function useRevisionSlots(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: [api.revision.list.path, startDate, endDate],
    queryFn: async () => {
      // Build query params
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      
      const url = `${api.revision.list.path}?${params.toString()}`;
      const res = await fetch(url, { credentials: "include" });
      
      if (!res.ok) throw new Error("Failed to fetch revision slots");
      return api.revision.list.responses[200].parse(await res.json());
    },
  });
}

// POST /api/revision-slots
export function useCreateRevisionSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: RevisionSlotInput) => {
      const res = await fetch(api.revision.create.path, {
        method: api.revision.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create revision slot");
      return api.revision.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.revision.list.path] });
    },
  });
}

// PUT /api/revision-slots/:id
export function useUpdateRevisionSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<RevisionSlotInput>) => {
      const url = buildUrl(api.revision.update.path, { id });
      const res = await fetch(url, {
        method: api.revision.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update revision slot");
      return api.revision.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.revision.list.path] });
    },
  });
}

// DELETE /api/revision-slots/:id
export function useDeleteRevisionSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.revision.delete.path, { id });
      const res = await fetch(url, {
        method: api.revision.delete.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete revision slot");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.revision.list.path] });
    },
  });
}

// POST /api/revision-slots/generate
export function useGenerateTimetable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      startDate: string;
      endDate: string;
      intensity: 'low' | 'medium' | 'high';
      excludedDays: number[];
      preferredRestDay?: number;
    }) => {
      const res = await fetch(api.revision.generate.path, {
        method: api.revision.generate.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to generate timetable");
      }
      return api.revision.generate.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.revision.list.path] });
    },
  });
}
*/