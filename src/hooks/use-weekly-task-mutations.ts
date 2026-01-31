"use client";

import { supabase } from "@/lib/supabase/client";

export type CreateWeeklyTaskInput = {
  name: string;
  day_of_week: number;
  duration_minutes: number;
  task_type?: string;
  subject?: string | null;
};

export function useWeeklyTaskMutations() {
  async function createTask(input: CreateWeeklyTaskInput) {
    const { error } = await supabase
      .from("recurring_tasks")
      .insert({
        ...input,
        task_type: input.task_type ?? "homework",
      });

    if (error) throw error;
  }

  async function deleteTask(id: string) {
    const { error } = await supabase
      .from("recurring_tasks")
      .delete()
      .eq("id", id);

    if (error) throw error;
  }

  return {
    createTask,
    deleteTask,
  };
}
