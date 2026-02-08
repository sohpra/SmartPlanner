"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { ExamModal } from "../components/exams/ExamModal";
import { useExams } from "@/hooks/use-exams";
import { Trash2, Plus, AlertCircle, Target, Clock } from "lucide-react";

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
  if (!confirm("Remove this exam and all scheduled revision?")) return;
  
  // Optimistic UI update
  setHiddenIds((prev) => new Set(prev).add(id));

  // 🎯 Delete the exam. 
  // If your DB has "ON DELETE CASCADE", the slots die automatically.
  // If not, delete slots manually first:
  await supabase.from("revision_slots").delete().eq("exam_id", id);
  
  const { error } = await supabase.from("exams").delete().eq("id", id);
  
  if (error) {
    alert(error.message);
    // Rollback hidden UI on error...
  } else {
    refresh();
  }
}

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-10 space-y-6 md:space-y-10 pb-24 animate-in fade-in duration-500">
      
      {/* 📋 Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-100 pb-6 md:pb-8">
        <div>
          <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mb-1">Inventory</p>
          <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter italic leading-none">Exam Register</h1>
        </div>

        <button
          onClick={() => setOpen(true)}
          className="flex items-center justify-center gap-2 rounded-xl md:rounded-2xl bg-slate-900 px-5 py-3 md:px-6 md:py-3 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-600 transition-all shadow-xl active:scale-95 w-full md:w-auto"
        >
          <Plus className="w-4 h-4" />
          Add Exam
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center py-20 gap-3">
          <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 italic">Syncing Briefings...</p>
        </div>
      ) : visibleExams.length === 0 ? (
        <div className="rounded-[2rem] md:rounded-[2.5rem] border-2 border-dashed border-gray-100 p-12 md:p-20 text-center">
          <Target className="w-10 h-10 text-gray-200 mx-auto mb-4" />
          <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">No active threats detected.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {visibleExams.map((exam) => {
            const daysLeft = Math.ceil((new Date(exam.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            
            return (
              <div key={exam.id} className="group relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between rounded-[1.5rem] md:rounded-[2rem] border-2 border-slate-100 bg-white p-5 md:p-7 shadow-sm hover:border-blue-500/20 transition-all">
                
                <div className="flex flex-col gap-1 mb-4 md:mb-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[7px] md:text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
                      {exam.exam_type}
                    </span>
                    {daysLeft <= 7 && (
                      <span className="text-[7px] md:text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-red-100 text-red-600 flex items-center gap-1 italic">
                        <AlertCircle className="w-2.5 h-2.5" /> Urgent
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                  <h3 className="text-xl md:text-2xl font-black italic tracking-tight text-slate-900 leading-tight">
                    {exam.subject}
                  </h3>
                  
                  {(exam.topics || exam.exam_board || exam.competitive_exam_name) && (
                    <p className="text-[11px] md:text-xs font-bold text-blue-600/80 italic tracking-tight flex items-center gap-1.5">
                      <span className="opacity-50">//</span>
                      {exam.exam_type === "Internal" && exam.topics}
                      {exam.exam_type === "Board" && exam.exam_board}
                      {exam.exam_type === "Competitive" && exam.competitive_exam_name}
                    </p>
                  )}
                </div>

                  <div className="flex items-center gap-2 mt-1.5 text-slate-400 opacity-70">
                    <Clock className="w-3 h-3" />
                    <p className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest">
                      {new Date(exam.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                </div>

                <div className="flex flex-row md:flex-col items-center justify-between md:justify-center gap-4 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-8">
                  <div className="flex items-center gap-6 md:gap-8">
                    <div className="text-left md:text-right">
                      <p className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest">Countdown</p>
                      <p className={`text-base md:text-lg font-black italic tracking-tight ${daysLeft <= 7 ? 'text-red-600' : 'text-slate-900'}`}>
                        {daysLeft}d
                      </p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest">Status</p>
                      <p className="text-base md:text-lg font-black italic tracking-tight text-blue-600">
                        {exam.preparedness}%
                      </p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => deleteExam(exam.id)} 
                    className="p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ExamModal 
        open={open} 
        onClose={() => setOpen(false)} 
        onAdded={async () => { setHiddenIds(new Set()); await refresh(); }} 
      />
    </div>
  );
}