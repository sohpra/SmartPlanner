"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

/* ---------- Types ---------- */

export type Project = {
  id: string;
  user_id: string;

  name: string;
  subject: string | null;

  due_date: string;

  estimated_minutes: number;
  completed_minutes: number;

  status: "active" | "completed" | "paused";

  created_at: string;
};

type CreateProjectInput = {
  name: string;
  subject?: string | null;
  due_date: string;            // yyyy-mm-dd
  estimated_minutes: number;
};

/* ---------- Hook ---------- */

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = async () => {
    setIsLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("due_date", { ascending: true });

    if (error) {
      setError(error.message);
      setProjects([]);
    } else {
      setProjects(data as Project[]);
    }

    setIsLoading(false);
  };

  const createProject = async (input: CreateProjectInput) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase.from("projects").insert({
      user_id: user.id,
      name: input.name,
      subject: input.subject ?? null,
      due_date: input.due_date,
      estimated_minutes: input.estimated_minutes,
      status: "active",
    });

    if (error) throw error;

    await fetchProjects();
  };

  const deleteProject = async (id: string) => {
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", id);

    if (error) throw error;

    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  return {
    projects,
    isLoading,
    error,
    createProject,
    deleteProject,
    refetch: fetchProjects,
  };
}
