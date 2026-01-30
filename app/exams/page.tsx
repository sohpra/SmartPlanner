"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { ExamModal } from "../components/exams/ExamModal";
import { useExams } from "@/hooks/use-exams";

export default function ExamsPage() {
  const [open, setOpen] = useState(false);

  const { upcoming, loading, refresh } = useExams();

  // Track optimistic deletions without fighting the hook/state sync
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const visibleExams = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    return upcoming
      .filter((e) => !hiddenIds.has(e.id))
      .filter((e) => {
        // Compare as date-only string to avoid timezone bugs
        const examDay = (e.date ?? "").slice(0, 10);
        return examDay >= todayStr;
      });
  }, [upcoming, hiddenIds]);

  async function deleteExam(id: string) {
    if (!confirm("Delete this exam?")) return;

    // 🔥 optimistic UI update
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    const { error } = await supabase.from("exams").delete().eq("id", id);

    if (error) {
      alert(error.message);
      // rollback optimistic hide
      setHiddenIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }

    // keep hiddenIds as-is; hook refresh not required but safe
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Exams</h1>
          <p className="text-sm text-gray-500">Manage upcoming assessments</p>
        </div>

        <button
          onClick={() => setOpen(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Add exam
        </button>
      </div>

      {loading && <div className="text-sm text-gray-500">Loading exams…</div>}

      {!loading && visibleExams.length === 0 && (
        <div className="rounded-lg border bg-gray-50 p-6 text-sm text-gray-500">
          No upcoming exams.
        </div>
      )}

      {!loading && visibleExams.length > 0 && (
        <div className="space-y-3">
          {visibleExams.map((exam) => (
            <div
              key={exam.id}
              className="flex items-center justify-between rounded-lg border bg-white p-4"
            >
              <div>
                <div className="font-medium">{exam.subject}</div>
                <div className="text-sm text-gray-500">
                  {exam.exam_type} ·{" "}
                  {new Date(exam.date).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>

              <button
                onClick={() => deleteExam(exam.id)}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <ExamModal
        open={open}
        onClose={() => setOpen(false)}
        onAdded={async () => {
          // Clear any optimistic hides (optional safety) and refetch
          setHiddenIds(new Set());
          await refresh();
        }}
      />
    </div>
  );
}
