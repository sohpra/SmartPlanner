"use client";

import { useWeeklyTasks } from "@/hooks/use-weekly-tasks";
import { useProjects } from "@/hooks/use-projects";

type Props = {
  date: Date;
};

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function DailyChecklist({ date }: Props) {
  const todayIndex = date.getDay();
  const todayLabel = DAYS[todayIndex];

  const { tasks: weeklyTasks, isLoading: weeklyLoading } = useWeeklyTasks();
  const { projects, isLoading: projectsLoading } = useProjects();

  // Weekly tasks for this date
  const todaysWeeklyTasks = weeklyTasks.filter(
    (t) => t.day_of_week === todayIndex
  );

  if (weeklyLoading || projectsLoading) {
    return <div className="p-8">Loading checklist…</div>;
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Today</h1>
        <p className="text-sm text-gray-500">{todayLabel}</p>
      </div>

      {/* Checklist */}
      <div className="space-y-6">
        {/* Weekly tasks */}
        <section>
          <h2 className="mb-2 text-sm font-medium text-gray-500">
            Weekly tasks
          </h2>

          {todaysWeeklyTasks.length === 0 ? (
            <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-500">
              No recurring tasks today.
            </div>
          ) : (
            <div className="space-y-3">
              {todaysWeeklyTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-lg border bg-white p-4"
                >
                  <div className="flex items-center gap-3">
                    <input type="checkbox" disabled />
                    <div>
                      <div className="font-medium">{task.name}</div>
                      <div className="text-sm text-gray-500">
                        {task.duration_minutes} mins
                      </div>
                    </div>
                  </div>

                  <span className="text-xs text-gray-400">Recurring</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Projects (placeholder) */}
        <section>
          <h2 className="mb-2 text-sm font-medium text-gray-500">Projects</h2>

          {projects.length === 0 ? (
            <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-500">
              No active projects.
            </div>
          ) : (
            <div className="space-y-3">
              {projects
                .filter((p) => p.status === "active")
                .slice(0, 2)
                .map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between rounded-lg border bg-white p-4 opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <input type="checkbox" disabled />
                      <div>
                        <div className="font-medium">{project.name}</div>
                        <div className="text-sm text-gray-500">
                          Project work (allocation pending)
                        </div>
                      </div>
                    </div>

                    <span className="text-xs text-gray-400">Project</span>
                  </div>
                ))}
            </div>
          )}
        </section>

        {/* Revision (placeholder) */}
        <section>
          <h2 className="mb-2 text-sm font-medium text-gray-500">Revision</h2>

          <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-500">
            Revision plan not generated yet.
          </div>
        </section>
      </div>
    </div>
  );
}
