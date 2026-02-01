"use client";

type Props = {
  tasksCompleted: number;
  totalTasks: number;
  minutesCompleted: number;
  minutesPlanned: number;
  upcomingExams: number;
  nextExamLabel?: string;
};

function formatMinutes(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function DashboardMetrics({
  tasksCompleted,
  totalTasks,
  minutesCompleted,
  minutesPlanned,
  upcomingExams,
  nextExamLabel,
}: Props) {
  return (
    <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Tasks completed */}
      <div className="rounded-xl border bg-white p-5">
        <div className="text-sm text-gray-500 mb-1">
          Tasks completed
        </div>
        <div className="text-2xl font-semibold">
          {tasksCompleted} / {totalTasks}
        </div>
      </div>

      {/* Study time */}
      <div className="rounded-xl border bg-white p-5">
        <div className="text-sm text-gray-500 mb-1">
          Study time today
        </div>
        <div className="text-2xl font-semibold">
          {formatMinutes(minutesCompleted)} /{" "}
          {formatMinutes(minutesPlanned)}
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Completed / Planned
        </div>
      </div>

      {/* Upcoming exams */}
      <div className="rounded-xl border bg-white p-5">
        <div className="text-sm text-gray-500 mb-1">
          Upcoming exams
        </div>
        <div className="text-2xl font-semibold">
          {upcomingExams}
        </div>
        {nextExamLabel && (
          <div className="text-xs text-gray-400 mt-1">
            Next: {nextExamLabel}
          </div>
        )}
      </div>
    </div>
  );
}
