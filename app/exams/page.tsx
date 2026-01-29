"use client";

import { useState } from "react";
import { ExamModal } from "../components/exams/ExamModal";
import { useExams } from "@/hooks/use-exams";

export default function ExamsPage() {
  const [open, setOpen] = useState(false);
  const exams = useExams();

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Exams</h1>
        <button
          onClick={() => setOpen(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add exam
        </button>
      </div>

      {/* Exams list */}
      <div className="space-y-3">
        {exams.upcoming.map((exam) => (
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

            <div className="text-sm text-gray-400">📘</div>
          </div>
        ))}

        {exams.upcoming.length === 0 && (
          <div className="rounded-lg border bg-gray-50 p-6 text-sm text-gray-500">
            No exams added yet.
          </div>
        )}
      </div>

      {/* Modal */}
      <ExamModal
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
