//import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
//import { api, buildUrl, type ExamInput } from "@shared/routes";

export function useExams() {
  const upcoming = [
    {
      id: "1",
      subject: "Maths",
      date: "2026-03-12",
      examType: "GCSE",
    },
    {
      id: "2",
      subject: "Biology",
      date: "2026-03-20",
      examType: "GCSE",
    },
  ];

  return {
    upcoming,
    subjectCount: 2,
  };
}



// GET /api/exams
/*
export function useExams() {
  return useQuery({
    queryKey: [api.exams.list.path],
    queryFn: async () => {
      const res = await fetch(api.exams.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch exams");
      return api.exams.list.responses[200].parse(await res.json());
    },
  });
}

// POST /api/exams
export function useCreateExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ExamInput) => {
      // Coerce date string to Date object if needed by backend, though schema expects string/Date
      // Assuming frontend form sends string, backend validates
      const res = await fetch(api.exams.create.path, {
        method: api.exams.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create exam");
      }
      return api.exams.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.exams.list.path] });
    },
  });
}

// PUT /api/exams/:id
export function useUpdateExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<ExamInput>) => {
      const url = buildUrl(api.exams.update.path, { id });
      const res = await fetch(url, {
        method: api.exams.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update exam");
      return api.exams.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.exams.list.path] });
    },
  });
}

// DELETE /api/exams/:id
export function useDeleteExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.exams.delete.path, { id });
      const res = await fetch(url, {
        method: api.exams.delete.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete exam");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.exams.list.path] });
    },
  });
}
*/