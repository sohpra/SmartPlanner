"use client";

import { useWeeklyTasks } from "@/hooks/use-weekly-tasks";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function TomorrowChecklist() {
  const { tasks, isLoading } = useWeeklyTasks();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dayIndex = tomorrow.getDay();
  const dayLabel = DAYS[dayIndex];

  const tomorrowsTasks = tasks.filter(
    (t) => t.day_of_week === dayIndex
  );

  if (isLoading) {
    return <div className="p-6">Loading tomorrow…</div>;
  }

  return (
    <div className="rounded-xl border bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Tomorrow
        </h2>
        <span className="text-sm text-gray-500">
          {dayLabel}
        </span>
      </div>

      {tomorrowsTasks.length === 0 ? (
        <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-500">
          Nothing scheduled yet.
        </div>
      ) : (
        <div className="space-y-3">
          {tomorrowsTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between rounded-lg border bg-gray-50 p-4"
            >
              <div>
                <div className="font-medium">{task.name}</div>
                <div className="text-sm text-gray-500">
                  {task.duration_minutes} mins
                </div>
              </div>

              <span className="text-xs text-gray-400">
                Recurring
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
