"use client";

import { useWeeklyTasks } from "@/hooks/use-weekly-tasks";
import { useDeadlineTasks } from "@/hooks/use-deadline-tasks";
import { useExams } from "@/hooks/use-exams";
import { useProjects } from "@/hooks/use-projects";

import { toDateOnly } from "@/lib/planner/revisionEngine";
import { buildWeekPlan } from "@/lib/planner/buildWeekPlan";

export default function DebugRevisionPage() {
  const weekly = useWeeklyTasks();
  const deadlines = useDeadlineTasks();
  const exams = useExams();
  const projects = useProjects();

  const today = toDateOnly(new Date().toISOString());

  const weekPlan = buildWeekPlan({
    today,
    weeklyTasks: weekly.tasks,
    deadlines: deadlines.tasks,
    exams: exams.upcoming,
    projects: projects.projects,
  });

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-semibold">🔍 Planner Debug</h1>

      {weekPlan.days.map((day) => (
        <div key={day.date} className="rounded-lg border p-4 space-y-3">
          <div className="flex justify-between">
            <h2 className="font-medium">{day.date}</h2>
            <div className="text-sm text-gray-600">
              Total used {day.totalUsed} / {day.baseCapacity} mins
            </div>
          </div>

          <ul className="text-sm space-y-1">
            <li>📌 Weekly: {day.weekly.minutes}</li>
            <li>📅 Homework & Assignments: {day.homework.minutes}</li>
            <li>⏱ Revision: {day.revision.minutes}</li>
            <li>🧩 Projects: {day.projects.minutes}</li>
          </ul>

          {day.weekly.items.length > 0 && (
            <>
              <div className="font-medium">Weekly</div>
              {day.weekly.items.map((t, i) => (
                <div key={i}>• {t.name}: {t.minutes} mins</div>
              ))}
            </>
          )}

          {day.homework.items.length > 0 && (
            <>
              <div className="font-medium">Homework & Assignments</div>
              {day.homework.items.map((h, i) => (
                <div key={i}>
                  • {h.name} (due {h.dueDate}): {h.minutes} mins
                </div>
              ))}
            </>
          )}

          {day.revision.slots.length > 0 && (
            <>
              <div className="font-medium">Revision</div>
              {day.revision.slots.map((s, i) => (
                <div key={i}>
                  • {s.subject} — {s.label} ({s.slotMinutes} mins)
                </div>
              ))}
            </>
          )}

          {day.projects.items.length > 0 && (
            <>
              <div className="font-medium">Projects</div>
              {day.projects.items.map((p, i) => (
                <div key={i}>
                  • {p.name}: {p.minutes} mins
                </div>
              ))}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
