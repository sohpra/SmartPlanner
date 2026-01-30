"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { useSubjects } from "@/hooks/use-subjects";

type ExamType = "internal" | "board" | "competitive";

type Props = {
  open: boolean;
  onClose: () => void;
  onAdded?: () => void;
};

export function ExamModal({ open, onClose, onAdded }: Props) {
  const [examType, setExamType] = useState<ExamType>("internal");
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState("");
  const [preparedness, setPreparedness] = useState(50);

  // Internal
  const [topics, setTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState("");

  // Board
  const [examBoard, setExamBoard] = useState("");

  // Competitive
  const [examName, setExamName] = useState("");

  // Subjects
  const { subjects, loading } = useSubjects();

  // 🔑 RESET FORM STATE ON OPEN (prevents stale dates & values)
  useEffect(() => {
    if (open) {
      setExamType("internal");
      setSubject("");
      setDate("");
      setPreparedness(50);

      setTopics([]);
      setTopicInput("");

      setExamBoard("");
      setExamName("");
    }
  }, [open]);

  if (!open) return null;

  function addTopic() {
    if (!topicInput.trim()) return;
    setTopics([...topics, topicInput.trim()]);
    setTopicInput("");
  }

  function removeTopic(topic: string) {
    setTopics(topics.filter((t) => t !== topic));
  }

  async function handleSubmit() {
    if (!subject || !date) {
      alert("Subject and date are required");
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      alert("Not authenticated");
      return;
    }

    const base = {
      user_id: user.id,
      subject,
      exam_type:
        examType === "internal"
          ? "Internal"
          : examType === "board"
          ? "Board"
          : "Competitive",
      date, // ✅ date-only, no timezone bugs
      preparedness,
    };

    const payload =
      examType === "internal"
        ? { ...base, topics }
        : examType === "board"
        ? { ...base, exam_board: examBoard }
        : { ...base, competitive_exam_name: examName };

    const { error } = await supabase.from("exams").insert(payload);

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    onAdded?.();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-lg bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add new exam</h2>
          <button onClick={onClose}>✕</button>
        </div>

        {/* Exam type */}
        <label className="block mb-3">
          <span className="text-sm font-medium">Exam type</span>
          <select
            className="mt-1 w-full rounded border p-2"
            value={examType}
            onChange={(e) => setExamType(e.target.value as ExamType)}
          >
            <option value="internal">Internal</option>
            <option value="board">Board</option>
            <option value="competitive">Competitive</option>
          </select>
        </label>

        {/* Subject */}
        <label className="block mb-3">
          <span className="text-sm font-medium">Subject</span>
          <select
            className="mt-1 w-full rounded border p-2"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={loading}
          >
            <option value="">
              {loading ? "Loading subjects…" : "Select subject"}
            </option>

            {subjects.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        {/* Internal */}
        {examType === "internal" && (
          <div className="mb-3">
            <span className="text-sm font-medium">Topics (optional)</span>
            <div className="mt-1 flex gap-2">
              <input
                className="flex-1 rounded border p-2"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                placeholder="Add topic"
              />
              <button
                type="button"
                onClick={addTopic}
                className="rounded bg-blue-600 px-3 text-white"
              >
                +
              </button>
            </div>

            {topics.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {topics.map((t) => (
                  <span
                    key={t}
                    className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm"
                  >
                    {t}
                    <button onClick={() => removeTopic(t)}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Board */}
        {examType === "board" && (
          <label className="block mb-3">
            <span className="text-sm font-medium">Exam board</span>
            <input
              className="mt-1 w-full rounded border p-2"
              value={examBoard}
              onChange={(e) => setExamBoard(e.target.value)}
              placeholder="e.g. AQA, OCR"
            />
          </label>
        )}

        {/* Competitive */}
        {examType === "competitive" && (
          <label className="block mb-3">
            <span className="text-sm font-medium">Exam name</span>
            <input
              className="mt-1 w-full rounded border p-2"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              placeholder="e.g. Math Olympiad"
            />
          </label>
        )}

        {/* Date */}
        <label className="block mb-3">
          <span className="text-sm font-medium">Date</span>
          <input
            type="date"
            className="mt-1 w-full rounded border p-2"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        {/* Preparedness */}
        <label className="block mb-6">
          <span className="text-sm font-medium">
            Preparedness: {preparedness}%
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={preparedness}
            onChange={(e) => setPreparedness(Number(e.target.value))}
            className="mt-1 w-full"
          />
        </label>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="rounded border px-4 py-2">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!subject || !date}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            Create exam
          </button>
        </div>
      </div>
    </div>
  );
}
