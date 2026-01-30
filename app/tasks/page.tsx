"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { AddTaskModal } from "../components/tasks/AddTaskModal";
import { useWeeklyTasks } from "@/hooks/use-weekly-tasks";
import { useProjects } from "@/hooks/use-projects";
import { useDeadlineTasks } from "@/hooks/use-deadline-tasks";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function TasksPage() {
  const [openAddTask, setOpenAddTask] = useState(false);

  // Source hooks
  const { tasks: weeklyFromHook, isLoading: weeklyLoading } =
    useWeeklyTasks();
  const { tasks: deadlineFromHook, isLoading: deadlineLoading } =
    useDeadlineTasks();
  const { projects: projectsFromHook, isLoading: projectsLoading } =
    useProjects();

  // Local state (authoritative for UI)
  const [weeklyTasks, setWeeklyTasks] = useState(weeklyFromHook);
  const [deadlineTasks, setDeadlineTasks] = useState(deadlineFromHook);
  const [projects, setProjects] = useState(projectsFromHook);

  // Sync when hooks load
  useEffect(() => {
    setWeeklyTasks(weeklyFromHook);
  }, [weeklyFromHook]);

  useEffect(() => {
    setDeadlineTasks(deadlineFromHook);
  }, [deadlineFromHook]);

  useEffect(() => {
    setProjects(projectsFromHook);
  }, [projectsFromHook]);

  const loading = weeklyLoading || deadlineLoading || projectsLoading;

  async function deleteRow(
    table: "recurring_tasks" | "deadline_tasks" | "projects",
    id: string
  ) {
    if (!confirm("Delete this task?")) return;

    // 🔥 Optimistic UI update
    if (table === "recurring_tasks") {
      setWeeklyTasks((t) => t.filter((x) => x.id !== id));
    }
    if (table === "deadline_tasks") {
      setDeadlineTasks((t) => t.filter((x) => x.id !== id));
    }
    if (table === "projects") {
      setProjects((t) => t.filter((x) => x.id !== id));
    }

    const { error } = await supabase.from(table).delete().eq("id", id);

    if (error) {
      alert(error.message);
      // Optional rollback (rare)
    }
  }

  return (
    <div className="p-8 space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="text-sm text-gray-500">
            Manage homework, recurring tasks and projects
          </p>
        </div>

        <button
          onClick={() => setOpenAddTask(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Add task
        </button>
      </div>

      {loading && (
        <div className="text-sm text-gray-500">Loading tasks…</div>
      )}

      {/* HOMEWORK */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-gray-700">
          Homework & assignments
        </h2>

        {deadlineTasks.length === 0 ? (
          <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-500">
            No homework or assignments yet.
          </div>
        ) : (
          <div className="space-y-2">
            {deadlineTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between rounded-lg border bg-white p-3"
              >
                <div>
                  <div className="font-medium">{task.name}</div>
                  <div className="text-xs text-gray-500">
                    {task.estimated_minutes} mins · Due{" "}
                    {new Date(task.due_date).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                </div>

                <button
                  onClick={() =>
                    deleteRow("deadline_tasks", task.id)
                  }
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* WEEKLY */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-gray-700">
          Weekly recurring
        </h2>

        {weeklyTasks.length === 0 ? (
          <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-500">
            No recurring tasks yet.
          </div>
        ) : (
          <div className="space-y-2">
            {weeklyTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between rounded-lg border bg-white p-3"
              >
                <div>
                  <div className="font-medium">{task.name}</div>
                  <div className="text-xs text-gray-500">
                    {task.duration_minutes} mins ·{" "}
                    {DAYS[task.day_of_week]}
                  </div>
                </div>

                <button
                  onClick={() =>
                    deleteRow("recurring_tasks", task.id)
                  }
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* PROJECTS */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-gray-700">
          Projects
        </h2>

        {projects.length === 0 ? (
          <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-500">
            No projects yet.
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between rounded-lg border bg-white p-3"
              >
                <div>
                  <div className="font-medium">{project.name}</div>
                  <div className="text-xs text-gray-500">
                    Ongoing project
                  </div>
                </div>

                <button
                  onClick={() =>
                    deleteRow("projects", project.id)
                  }
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <AddTaskModal
        open={openAddTask}
        onClose={() => setOpenAddTask(false)}
      />
    </div>
  );
}
