"use client";

import { useMemo } from "react";

import { useExams } from "@/hooks/use-exams";
import { useWeeklyTasks } from "@/hooks/use-weekly-tasks";
import { useDeadlineTasks } from "@/hooks/use-deadline-tasks";

import {
  planRevisionSlots,
  addDays,
  toDateOnly,
  daysBetween,
} from "@/lib/planner/revisionEngine";

/* ---------- helpers ---------- */

function buildBaseCapacity(start: string, days: number) {
  const out: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    const dow = new Date(d + "T00:00:00").getDay();
    out[d] = dow === 0 || dow === 6 ? 240 : 150;
  }
  return out;
}

/* ---------- component ---------- */

export default function DebugRevisionPage() {
  const today = toDateOnly(new Date().toISOString());
  const numDays = 7;

  const exams = useExams();
  const weekly = useWeeklyTasks();
  const deadlines = useDeadlineTasks();

  const windowDates = useMemo(
    () => Array.from({ length: numDays }, (_, i) => addDays(today, i)),
    [today]
  );

  const baseCapacity = useMemo(
    () => buildBaseCapacity(today, numDays),
    [today]
  );

  /* ============================================================
     WEEKLY TASKS
     ============================================================ */

  const weeklyByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of windowDates) map[d] = 0;

    for (const task of weekly.tasks) {
      for (const d of windowDates) {
        const dow = new Date(d + "T00:00:00").getDay();
        if (dow === task.day_of_week) {
          map[d] += task.duration_minutes;
        }
      }
    }
    return map;
  }, [weekly.tasks, windowDates]);

  /* ============================================================
     DEADLINE TASKS — EARLIEST SAFE PLACEMENT (PER-TASK TRACKING)
     ============================================================ */

  const deadlineAllocations = useMemo(() => {
    const remainingCap: Record<string, number> = {};
    const perDay: Record<
      string,
      { taskId: string; name: string; minutes: number }[]
    > = {};

    for (const d of windowDates) {
      remainingCap[d] = baseCapacity[d] - weeklyByDate[d];
      perDay[d] = [];
    }

    const ordered = [...deadlines.tasks].sort(
      (a, b) => daysBetween(today, a.due_date) - daysBetween(today, b.due_date)
    );

    for (const task of ordered) {
      let remaining = task.estimated_minutes;

      for (const d of windowDates) {
        if (d >= task.due_date) break;
        if (remainingCap[d] <= 0) continue;

        const used = Math.min(remainingCap[d], remaining);

        perDay[d].push({
          taskId: task.id,
          name: task.name,
          minutes: used,
        });

        remainingCap[d] -= used;
        remaining -= used;

        if (remaining <= 0) break;
      }
    }

    return perDay;
  }, [deadlines.tasks, windowDates, baseCapacity, weeklyByDate, today]);

  const deadlineByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of windowDates) {
      map[d] = deadlineAllocations[d].reduce((s, x) => s + x.minutes, 0);
    }
    return map;
  }, [deadlineAllocations, windowDates]);

  /* ============================================================
     REVISION CAPACITY (REAL)
     ============================================================ */

  const revisionCapacity = useMemo(() => {
    const cap: Record<string, number> = {};
    for (const d of windowDates) {
      cap[d] = Math.max(
        0,
        baseCapacity[d] - weeklyByDate[d] - deadlineByDate[d]
      );
    }
    return cap;
  }, [baseCapacity, weeklyByDate, deadlineByDate, windowDates]);

  const revisionPlan = useMemo(() => {
    return planRevisionSlots(exams.upcoming, {
      startDate: today,
      numDays,
      capacityByDate: revisionCapacity,
      includeExamDay: false,
    });
  }, [exams.upcoming, today, numDays, revisionCapacity]);

  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-semibold">🔍 Planner Debug</h1>

      {revisionPlan.days.map((day) => {
        const base = baseCapacity[day.date] ?? 0;
        const weeklyMins = weeklyByDate[day.date] ?? 0;
        const deadlineMins = deadlineByDate[day.date] ?? 0;
        const revisionMins = day.usedMinutes;

        const totalUsed = weeklyMins + deadlineMins + revisionMins;
        const overload = Math.max(0, totalUsed - base);

        return (
          <div
            key={day.date}
            className={`rounded-lg border p-4 space-y-3 ${
              overload > 0 ? "bg-red-50 border-red-300" : "bg-white"
            }`}
          >
            <div className="flex justify-between">
              <h2 className="font-medium">{day.date}</h2>
              <div className="text-sm text-gray-600">
                Total used {totalUsed} / {base} mins
                {overload > 0 && (
                  <span className="ml-2 text-red-600 font-medium">
                    (+{overload} overload)
                  </span>
                )}
              </div>
            </div>

            <ul className="text-sm space-y-1">
              <li>🟦 Base: {base}</li>
              <li>📌 Weekly: {weeklyMins}</li>
              <li>📅 Deadlines: {deadlineMins}</li>
              <li>⏱ Revision: {revisionMins}</li>
            </ul>

            <div className="pt-2 space-y-1 text-sm">
              {weeklyMins > 0 && <div className="font-medium">Weekly</div>}
              {deadlineAllocations[day.date].length > 0 && (
                <>
                  <div className="font-medium">Deadline</div>
                  {deadlineAllocations[day.date].map((d, i) => (
                    <div key={i}>
                      • {d.name}: {d.minutes} mins
                    </div>
                  ))}
                </>
              )}
              {day.slots.length > 0 && (
                <>
                  <div className="font-medium">Revision</div>
                  {day.slots.map((s, i) => (
                    <div key={i}>
                      • {s.subject} — {s.label} ({s.slotMinutes} mins)
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
