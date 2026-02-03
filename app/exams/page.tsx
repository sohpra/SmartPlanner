"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { ExamModal } from "../components/exams/ExamModal";
import { useExams } from "@/hooks/use-exams";
import { Trash2, Plus, AlertCircle, Target } from "lucide-react";

export default function ExamsPage() {
  const [open, setOpen] = useState(false);
  const { upcoming, loading, refresh } = useExams();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const visibleExams = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return upcoming
      .filter((e) => !hiddenIds.has(e.id))
      .filter((e) => (e.date ?? "").slice(0, 10) >= todayStr);
  }, [upcoming, hiddenIds]);

  async function deleteExam(id: string) {
    if (!confirm("Remove this exam from your roadmap?")) return;
    setHiddenIds((prev) => new Set(prev).add(id));
    const { error } = await supabase.from("exams").delete().eq("id", id);
    if (error) {
      alert(error.message);
      setHiddenIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-10 space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-100 pb-8">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mb-1">Overview</p>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter italic">Exams & Assessments</h1>
        </div>

        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-600 transition-all shadow-xl shadow-slate-200"
        >
          <Plus className="w-4 h-4" />
          Add New Exam
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center py-20 gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Loading Briefings...</p>
        </div>
      ) : visibleExams.length === 0 ? (
        <div className="rounded-[2rem] border-2 border-dashed border-gray-100 p-20 text-center">
          <Target className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No active threats detected.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {visibleExams.map((exam) => {
            const daysLeft = Math.ceil((new Date(exam.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            
            return (
              <div key={exam.id} className="group relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all">
                <div className="flex flex-col gap-1 mb-4 md:mb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-blue-50 text-blue-600">{exam.exam_type}</span>
                    {daysLeft <= 7 && (
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-red-100 text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Critical
                      </span>
                    )}
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">{exam.subject}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {new Date(exam.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>

                <div className="flex flex-col md:items-end gap-4">
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">Countdown</p>
                      <p className={`text-xl font-black italic ${daysLeft <= 7 ? 'text-red-600' : 'text-slate-900'}`}>
                        IN {daysLeft} DAYS
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">Preparedness</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-black italic text-blue-600">{exam.preparedness}%</span>
                      </div>
                    </div>
                  </div>
                  
                  <button onClick={() => deleteExam(exam.id)} className="flex items-center gap-2 text-[9px] font-black uppercase text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3 h-3" /> Remove Briefing
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ExamModal open={open} onClose={() => setOpen(false)} onAdded={async () => { setHiddenIds(new Set()); await refresh(); }} />
    </div>
  );
}