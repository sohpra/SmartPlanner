"use client";

import { useDailyCompletions } from "@/hooks/use-daily-completions";

/* ================================
   Types
================================ */

export type RevisionSlot = {
  examId: string; // uuid
  subject: string;
  slotMinutes: number;
  label: string;
};

type Props = {
  date: Date;

  weeklyItems: { id: string; name: string; minutes: number }[];
  homeworkItems: { id: string; name: string; dueDate: string; minutes: number }[];
  revisionSlots: RevisionSlot[];
  projectItems: { projectId: string; name: string; minutes: number }[];
};

/* ================================
   Helpers
================================ */

function formatDueDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const dow = d.toLocaleDateString("en-GB", { weekday: "short" });
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${dow} ${day}/${month}`;
}

export function DailyChecklist({
  date,
  weeklyItems,
  homeworkItems,
  revisionSlots,
  projectItems,
}: Props) {
  const { completed, toggle } = useDailyCompletions(date);

  const isDone = (key: string) => completed.has(key);

  const completionCount = (keys: string[]) => {
    if (keys.length === 0) return "0 / 0";
    const done = keys.filter((k) => completed.has(k)).length;
    return `${done} / ${keys.length}`;
  };

  // Trackable keys (UUID-based)
  const weeklyKeys = weeklyItems.map((t) => `weekly_task:${t.id}`);
  const projectKeys = projectItems.map((p) => `project:${p.projectId}`);
  const revisionExamKeys = Array.from(new Set(revisionSlots.map((s) => `revision:${s.examId}`)));

  // Homework is not trackable with current DB CHECK constraint unless you extend it.
  // We'll show checkboxes disabled for homework for now to avoid "it ticks then disappears".
  const homeworkKeys: string[] = []; // intentionally excluded from completion

  return (
    <div className="space-y-10">
      <h2 className="text-lg font-semibold">Today’s checklist</h2>

      {/* ===================== */}
      {/* HOMEWORK & ASSIGNMENTS */}
      {/* ===================== */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-500">Homework & assignments</h3>

          {homeworkItems.length > 0 && (
            <span className="text-xs text-gray-400">{completionCount(homeworkKeys)}</span>
          )}
        </div>

        {homeworkItems.length === 0 ? (
          <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-500">
            No homework scheduled.
          </div>
        ) : (
          <div className="space-y-2">
            {homeworkItems.map((task, idx) => {
              const key = `deadline_task:${task.id}:${idx}`;

              return (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg border bg-white p-3"
                >
                  <div className="flex items-center gap-3">
                    <input type="checkbox" disabled />
                    <span className="text-sm">
                      <strong>{task.name}</strong> · {task.minutes} mins
                    </span>
                  </div>

                  <span className="text-xs text-gray-400">Due {formatDueDate(task.dueDate)}</span>
                </div>
              );
            })}
          </div>
        )}

        {homeworkItems.length > 0 && (
          <div className="mt-2 text-xs text-gray-400">
            Homework completion tracking can be enabled once <code>daily_completions</code> allows
            <code> deadline_task</code>.
          </div>
        )}
      </section>

      {/* ===================== */}
      {/* WEEKLY TASKS */}
      {/* ===================== */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-500">Weekly tasks</h3>
          {weeklyItems.length > 0 && (
            <span className="text-xs text-gray-400">{completionCount(weeklyKeys)}</span>
          )}
        </div>

        {weeklyItems.length === 0 ? (
          <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-500">
            No recurring tasks today.
          </div>
        ) : (
          <div className="space-y-2">
            {weeklyItems.map((task) => {
              const key = `weekly_task:${task.id}`;

              return (
                <div
                  key={key}
                  className={`flex items-center justify-between rounded-lg border bg-white p-3 ${
                    isDone(key) ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isDone(key)}
                      onChange={() => toggle("weekly_task", task.id)}
                    />

                    <span className={`text-sm ${isDone(key) ? "line-through" : ""}`}>
                      <strong>{task.name}</strong> · {task.minutes} mins
                    </span>
                  </div>

                  <span className="text-xs text-gray-400">Recurring</span>
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
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-500">Revision</h3>
          {revisionExamKeys.length > 0 && (
            <span className="text-xs text-gray-400">{completionCount(revisionExamKeys)}</span>
          )}
        </div>

        {revisionSlots.length === 0 ? (
          <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-500">
            No revision planned for today.
          </div>
        ) : (
          <div className="space-y-2">
            {revisionSlots.map((slot, idx) => {
              // We track completion per examId (uuid) because daily_completions.source_id must be uuid.
              const key = `revision:${slot.examId}`;
              const checked = isDone(key);

              return (
                <div
                  key={`${slot.examId}-${idx}`}
                  className={`flex items-center justify-between rounded-lg border bg-white p-3 ${
                    checked ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle("revision", slot.examId)}
                    />
                    <span className={`text-sm ${checked ? "line-through" : ""}`}>
                      <strong>{slot.label}</strong> · {slot.slotMinutes} mins
                    </span>
                  </div>

                  <span className="text-xs text-gray-400">Revision</span>
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
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-500">Projects</h3>
          {projectItems.length > 0 && (
            <span className="text-xs text-gray-400">{completionCount(projectKeys)}</span>
          )}
        </div>

        {projectItems.length === 0 ? (
          <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-500">
            No project work planned for today.
          </div>
        ) : (
          <div className="space-y-2">
            {projectItems.map((project) => {
              const key = `project:${project.projectId}`;

              return (
                <div
                  key={key}
                  className={`flex items-center justify-between rounded-lg border bg-white p-3 ${
                    isDone(key) ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isDone(key)}
                      onChange={() => toggle("project", project.projectId)}
                    />
                    <span className={`text-sm ${isDone(key) ? "line-through" : ""}`}>
                      <strong>{project.name}</strong> · {project.minutes} mins
                    </span>
                  </div>

                  <span className="text-xs text-gray-400">Project</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
