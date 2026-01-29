"use client";

import { useWeeklyTasks } from "@/hooks/use-weekly-tasks";
import { useExams } from "@/hooks/use-exams";

const DAYS = [
  "Sunday","Monday","Tuesday","Wednesday",
  "Thursday","Friday","Saturday",
];

export function TomorrowChecklist() {
  const { tasks, isLoading } = useWeeklyTasks();
  const exams = useExams();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const dayIndex = tomorrow.getDay();
  const dayLabel = DAYS[dayIndex];

  const weekly = tasks.filter(t => t.day_of_week === dayIndex);

  const examsTomorrow = exams.upcoming.filter(e => {
    const d = new Date(e.date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === tomorrow.getTime();
  });

  if (isLoading) {
    return <div className="p-4">Loading tomorrow…</div>;
  }

  return (
    <div className="rounded-xl border bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="mb-3 text-sm font-semibold">Tomorrow</h3>
        <span className="text-sm text-gray-500">{dayLabel}</span>
      </div>

      {weekly.map(task => (
        <div
          key={task.id}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          {task.name} · {task.duration_minutes}m
        </div>
      ))}

      {examsTomorrow.map(exam => (
        <div
          key={exam.id}
          className="rounded-lg border bg-yellow-50 px-3 py-2 text-sm"
        >
          {exam.subject} exam
        </div>
      ))}

      {weekly.length === 0 && examsTomorrow.length === 0 && (
        <div className="text-sm text-gray-500">
          Nothing scheduled yet.
        </div>
      )}
    </div>
  );
}
