"use client";

import { StatCard } from "../components/StatCard";
import { DailyChecklist } from "../components/checklist/DailyChecklist";
import { useExams } from "@/hooks/use-exams";
import { useRevision } from "@/hooks/use-revision";

function formatDayLabel(dateString: string) {
  const today = new Date();
  const target = new Date(dateString);

  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diffDays =
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";

  return target.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export default function PlannerPage() {
  const exams = useExams();
  const revision = useRevision();

  return (
    <>
      {/* ===================== */}
      {/* STAT CARDS */}
      {/* ===================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Upcoming exams"
          value={exams.upcoming.length}
          icon="📝"
        />
        <StatCard
          title="Subjects"
          value={exams.subjectCount}
          icon="📚"
        />
        <StatCard
          title="Revision tasks"
          value={revision.tasks.length}
          icon="⏱️"
        />
      </div>

      <p className="mt-4 text-sm text-gray-500">
        Overview based on your current planner data
      </p>

      <div className="mt-10 space-y-12">

        {/* ===================== */}
        {/* TODAY'S CHECKLIST */}
        {/* ===================== */}
        <section>
          <DailyChecklist date={new Date()} />
        </section>

        {/* ===================== */}
        {/* UPCOMING EXAMS */}
        {/* ===================== */}
        <section>
          <h2 className="text-lg font-semibold mb-1">
            Upcoming exams
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Exams scheduled in the next few weeks
          </p>

          <div className="space-y-3">
            {exams.upcoming.map((exam) => (
              <div
                key={exam.id}
                className="flex items-center justify-between rounded-lg border bg-white p-4"
              >
                <div>
                  <div className="font-medium">
                    {exam.subject}
                  </div>
                  <div className="text-sm text-gray-500">
                    {exam.exam_type} ·{" "}
                    {new Date(exam.date).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>
                <div className="text-sm">📅</div>
              </div>
            ))}

            {exams.upcoming.length === 0 && (
              <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-500">
                🎉 No upcoming exams — you’re all caught up!
              </div>
            )}
          </div>
        </section>

        {/* ===================== */}
        {/* REVISION PLAN */}
        {/* ===================== */}
        <section>
          <h2 className="text-lg font-semibold mb-1">
            Revision plan
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            What you should revise today and next
          </p>

          <div className="space-y-3">
            {revision.tasks.map((task) => {
              const dayLabel = formatDayLabel(task.date);
              const isToday = dayLabel === "Today";

              return (
                <div
                  key={task.id}
                  className={`flex items-center justify-between rounded-lg border p-4
                    ${isToday ? "bg-blue-50 border-blue-200" : "bg-white"}
                  `}
                >
                  <div>
                    <div className="font-medium">{task.subject}</div>
                    <div className="text-sm text-gray-500">
                      {task.duration_minutes} mins · {dayLabel}
                    </div>
                  </div>

                  {isToday ? (
                    <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded-full">
                      Today
                    </span>
                  ) : (
                    <span className="text-sm">⏱️</span>
                  )}
                </div>
              );
            })}

            {revision.tasks.length === 0 && (
              <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-500">
                📭 No revision tasks scheduled yet
              </div>
            )}
          </div>
        </section>

      </div>
    </>
  );
}
