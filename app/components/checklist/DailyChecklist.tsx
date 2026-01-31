"use client";

import { useWeeklyTasks } from "@/hooks/use-weekly-tasks";
import { useDeadlineTasks } from "@/hooks/use-deadline-tasks";
import { useProjects } from "@/hooks/use-projects";
import { useDailyCompletions } from "@/hooks/use-daily-completions";

/* ================================
   Types
================================ */

export type RevisionSlot = {
  examId: string;
  subject: string;
  slotMinutes: number;
  label: string;
};

type Props = {
  date: Date;
  revisionSlots?: RevisionSlot[];
};

/* ================================
   Component
================================ */

export function DailyChecklist({ date, revisionSlots = [] }: Props) {
  const dayIndex = date.getDay();
  const { completed, toggle } = useDailyCompletions(date);

  const { tasks: weeklyTasks, isLoading: weeklyLoading } = useWeeklyTasks();
  const { tasks: deadlineTasks, isLoading: deadlineLoading } =
    useDeadlineTasks();
  const { projects, isLoading: projectsLoading } = useProjects();

  if (weeklyLoading || deadlineLoading || projectsLoading) {
    return <div className="p-4">Loading checklist…</div>;
  }

  const todaysWeeklyTasks = weeklyTasks.filter(
    (t) => t.day_of_week === dayIndex
  );

  function isDone(key: string) {
    return completed.has(key);
  }

  return (
    <div className="space-y-8">
      <h2 className="text-lg font-semibold">Today’s checklist</h2>

      {/* ===================== */}
      {/* WEEKLY TASKS */}
      {/* ===================== */}
      <section>
        <h3 className="mb-2 text-sm font-medium text-gray-500">
          Weekly tasks
        </h3>

        {todaysWeeklyTasks.length === 0 ? (
          <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-500">
            No recurring tasks today.
          </div>
        ) : (
          <div className="space-y-2">
            {todaysWeeklyTasks.map((task) => {
              const key = `weekly_task:${task.id}`;

              return (
                <div
                  key={key}
                  className={`flex items-center justify-between rounded-lg border bg-white p-3
                    ${isDone(key) ? "opacity-60" : ""}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isDone(key)}
                      onChange={() => toggle("weekly_task", task.id)}
                    />

                    <span
                      className={`text-sm ${
                        isDone(key) ? "line-through" : ""
                      }`}
                    >
                      <strong>{task.name}</strong> ·{" "}
                      {task.duration_minutes} mins
                    </span>
                  </div>

                  <span className="text-xs text-gray-400">
                    Recurring
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ===================== */}
      {/* HOMEWORK & ASSIGNMENTS */}
      {/* ===================== */}
      <section>
        <h3 className="mb-2 text-sm font-medium text-gray-500">
          Homework & assignments
        </h3>

        {deadlineTasks.length === 0 ? (
          <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-500">
            No homework scheduled.
          </div>
        ) : (
          <div className="space-y-2">
            {deadlineTasks.map((task) => {
              const key = `deadline_task:${task.id}`;

              return (
                <div
                  key={key}
                  className={`flex items-center justify-between rounded-lg border bg-white p-3
                    ${isDone(key) ? "opacity-60" : ""}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isDone(key)}
                      onChange={() =>
                        toggle("deadline_task", task.id)
                      }
                    />

                    <span
                      className={`text-sm ${
                        isDone(key) ? "line-through" : ""
                      }`}
                    >
                      <strong>{task.name}</strong> ·{" "}
                      {task.estimated_minutes} mins
                    </span>
                  </div>

                  <span className="text-xs text-gray-400">
                    Due {task.due_date}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ===================== */}
      {/* PROJECTS */}
      {/* ===================== */}
      <section>
        <h3 className="mb-2 text-sm font-medium text-gray-500">
          Projects
        </h3>

        {projects.filter((p) => p.status === "active").length ===
        0 ? (
          <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-500">
            No active projects.
          </div>
        ) : (
          <div className="space-y-2">
            {projects
              .filter((p) => p.status === "active")
              .slice(0, 2)
              .map((project) => {
                const key = `project:${project.id}`;

                return (
                  <div
                    key={key}
                    className={`flex items-center justify-between rounded-lg border bg-white p-3
                      ${isDone(key) ? "opacity-60" : ""}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isDone(key)}
                        onChange={() =>
                          toggle("project", project.id)
                        }
                      />

                      <span
                        className={`text-sm ${
                          isDone(key) ? "line-through" : ""
                        }`}
                      >
                        <strong>{project.name}</strong> · project work
                      </span>
                    </div>

                    <span className="text-xs text-gray-400">
                      Project
                    </span>
                  </div>
                );
              })}
          </div>
        )}
      </section>

      {/* ===================== */}
      {/* REVISION */}
      {/* ===================== */}
      <section>
        <h3 className="mb-2 text-sm font-medium text-gray-500">
          Revision
        </h3>

        {revisionSlots.length === 0 ? (
          <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-500">
            No revision planned for today.
          </div>
        ) : (
          <div className="space-y-2">
            {revisionSlots.map((slot, idx) => (
              <div
                key={`${slot.examId}-${idx}`}
                className="flex items-center justify-between rounded-lg border bg-white p-3 opacity-60"
              >
                <div className="flex items-center gap-3">
                  <input type="checkbox" disabled />
                  <span className="text-sm">
                    <strong>{slot.label}</strong> ·{" "}
                    {slot.slotMinutes} mins
                  </span>
                </div>

                <span className="text-xs text-gray-400">
                  Revision
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
