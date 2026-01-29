"use client";

import { useState } from "react";
import { ExamModal } from "../components/exams/ExamModal";

export default function ExamsPage() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Exams</h1>
        <button
          onClick={() => setOpen(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-white"
        >
          Add exam
        </button>
      </div>

      <div className="rounded-lg border p-6 text-gray-500">
        No exams listed yet.
      </div>

      <ExamModal
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
