"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { LayoutReplit } from "../../components/Layout.replit";

export default function NewExamPage() {
  const router = useRouter();

  const [subject, setSubject] = useState("");
  const [examType, setExamType] = useState("Internal");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);

    const {
        data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
        setError("Not authenticated");
        setSaving(false);
        return;
        }

    const { error } = await supabase.from("exams").insert({
        user_id: user.id,
        subject,
        exam_type: examType,
        date,
        });

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    router.push("/planner");
  };

  return (
    <LayoutReplit>
      <div className="max-w-xl">
        <h1 className="text-xl font-semibold mb-6">
          Create exam
        </h1>

        <div className="space-y-4">

          <div>
            <label className="block text-sm font-medium mb-1">
              Subject
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="Maths"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Exam type
            </label>
            <select
              value={examType}
              onChange={(e) => setExamType(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            >
              <option value="Internal">Internal</option>
              <option value="Board">Board</option>
              <option value="Competitive">Competitive</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Date
            </label>
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="pt-4">
            <button
              onClick={handleSubmit}
              disabled={saving || !subject || !date}
              className="rounded-lg bg-blue-600 text-white px-4 py-2 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Create exam"}
            </button>
          </div>
        </div>
      </div>
    </LayoutReplit>
  );
}
