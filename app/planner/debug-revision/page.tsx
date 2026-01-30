"use client";

import { useExams } from "@/hooks/use-exams";
import { planRevisionSlots } from "@/lib/planner/revisionEngine";

function toDateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

function buildCapacityMap(start: Date, days = 7) {
  const map: Record<string, number> = {};

  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const day = d.getDay();
    const isWeekend = day === 0 || day === 6;
    map[toDateOnly(d)] = isWeekend ? 240 : 150;
  }

  return map;
}

export default function DebugRevisionPage() {
  const exams = useExams();

  const today = new Date();
  const todayStr = toDateOnly(today);

  if (exams.loading) {
    return <div className="p-6">Loading exams…</div>;
  }

  const revisionPlan = planRevisionSlots(exams.upcoming, {
    startDate: todayStr,
    numDays: 7,
    capacityByDate: buildCapacityMap(today, 7),
    includeExamDay: false,
  });

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-semibold">
        🔍 Revision Engine Debug
      </h1>

      <div className="text-sm text-gray-600">
        Start date: <strong>{todayStr}</strong>
      </div>

      {/* ===================== */}
      {/* DAILY PLANS */}
      {/* ===================== */}
      <div className="space-y-6">
        {revisionPlan.days.map((day) => (
          <div
            key={day.date}
            className="rounded-lg border bg-white p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-medium">
                {day.date}
              </h2>
              <div className="text-sm text-gray-500">
                Used {day.usedMinutes} / {day.capacityMinutes} mins
              </div>
            </div>

            {day.slots.length === 0 ? (
              <div className="text-sm text-gray-400">
                No revision slots
              </div>
            ) : (
              <ul className="space-y-1 text-sm">
                {day.slots.map((slot, idx) => (
                  <li key={idx}>
                    • <strong>{slot.subject}</strong> —{" "}
                    {slot.label} ({slot.slotMinutes} mins)
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* ===================== */}
      {/* UNMET DEMAND */}
      {/* ===================== */}
      <div className="rounded-lg border bg-red-50 p-4">
        <h2 className="font-medium mb-2">Unmet revision demand</h2>

        {revisionPlan.unmet.length === 0 ? (
          <div className="text-sm text-gray-600">
            ✅ All revision demand scheduled
          </div>
        ) : (
          <ul className="text-sm space-y-1">
            {revisionPlan.unmet.map((u) => (
              <li key={u.examId}>
                • <strong>{u.subject}</strong> —{" "}
                {u.remainingMinutes} mins remaining
                (exam {u.examDate})
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ===================== */}
      {/* ENGINE NOTES */}
      {/* ===================== */}
      <div className="rounded-lg border bg-gray-50 p-4">
        <h2 className="font-medium mb-2">Engine notes</h2>
        <ul className="text-sm space-y-1">
          {revisionPlan.notes.map((n, i) => (
            <li key={i}>• {n}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
