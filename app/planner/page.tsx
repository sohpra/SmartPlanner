"use client";

import { LayoutReplit } from "../components/Layout.replit";
import { StatCard } from "../components/StatCard";
import { useExams } from "@/hooks/use-exams";
import { useRevision } from "@/hooks/use-revision";

export default function PlannerPage() {
  const exams = useExams();
  const revision = useRevision();

  return (
    <LayoutReplit>
      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Upcoming exams" value={exams.upcoming.length} icon="📝" />
        <StatCard title="Subjects" value={exams.subjectCount} icon="📚" />
        <StatCard title="Revision tasks" value={revision.tasks.length} icon="⏱️" />
      </div>

      {/* Main dashboard sections */}
      <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Upcoming exams */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Upcoming exams</h2>

          <div className="space-y-3">
            {exams.upcoming.map((exam) => (
              <div
                key={exam.id}
                className="flex items-center justify-between rounded-lg border bg-white p-4"
              >
                <div>
                  <div className="font-medium">{exam.subject}</div>
                  <div className="text-sm text-gray-500">
                    {exam.examType} · {exam.date}
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  📅
                </div>
              </div>
            ))}

            {exams.upcoming.length === 0 && (
              <div className="text-sm text-gray-500 italic">
                No upcoming exams
              </div>
            )}
          </div>
        </section>

        {/* Revision tasks */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Revision plan</h2>

          <div className="space-y-3">
            {revision.tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between rounded-lg border bg-white p-4"
              >
                <div>
                  <div className="font-medium">{task.subject}</div>
                  <div className="text-sm text-gray-500">
                    {task.duration} mins · {task.scheduledFor}
                  </div>
                </div>
                <div className="text-sm">
                  ⏱️
                </div>
              </div>
            ))}

            {revision.tasks.length === 0 && (
              <div className="text-sm text-gray-500 italic">
                No revision tasks scheduled
              </div>
            )}
          </div>
        </section>

      </div>
    </LayoutReplit>
  );
}
