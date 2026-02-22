"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { syncRevisionSlots } from "@/lib/planner/revisionPersistence"; 
import { ExamModal } from "../components/exams/ExamModal";
import { useExams } from "@/hooks/use-exams";
import { useRevision } from "@/hooks/use-revision";
import { 
  Trash2, Plus, AlertCircle, Target, Clock, 
  Loader2, Rocket, CheckCircle2, Trophy 
} from "lucide-react";
import confetti from 'canvas-confetti';

export default function ExamsPage() {
  const [open, setOpen] = useState(false);
  const { upcoming, loading, refresh } = useExams();
  const { slots, refresh: refreshRevision } = useRevision();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const visibleExams = useMemo(() => {
    return upcoming
      .filter((e) => !hiddenIds.has(e.id))
      .filter((e) => (e.date ?? "").slice(0, 10) >= todayStr);
  }, [upcoming, hiddenIds, todayStr]);

  // 🎯 CORE LOGIC: Complete a session directly from this page
  async function completeRevisionSlot(examId: string, subjectName: string) {
    // 1. Find the earliest uncompleted slot (today's or future)
    const nextSlot = slots
      .filter(s => s.exam_id === examId && !s.is_completed)
      .sort((a, b) => a.date.localeCompare(b.date))[0];

    if (!nextSlot) {
      alert("All scheduled sessions for this exam are already complete!");
      return;
    }

    if (!confirm(`Mark 1 session of ${subjectName} as done today?`)) return;

    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 2. Mark the slot as completed and move its date to today so
      // buildWeekPlan treats it as a today item.
      await supabase
        .from("revision_slots")
        .update({ 
          is_completed: true, 
          date: todayStr,
        })
        .eq("id", nextSlot.id);

      // 3. Log to Daily Completions so the Dashboard Workload bar fills up
      await supabase.from("daily_completions").insert([{
        user_id: user.id,
        source_id: nextSlot.id,
        source_type: 'revision',
        date: todayStr
      }]);

      // 4. Trigger Orchestrator to reshuffle remaining time
      await syncRevisionSlots();

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#3b82f6', '#10b981']
      });

      // 5. Refresh everything
      await refreshRevision();
      await refresh();
      
    } catch (err: any) {
      console.error("Revision Completion Error:", err);
      alert("Failed to sync completion: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  async function deleteExam(id: string) {
    if (!confirm("Remove this exam? Roadmap will be reshuffled.")) return;
    setIsProcessing(true);
    setHiddenIds((prev) => new Set(prev).add(id));

    try {
      await supabase.from("revision_slots").delete().eq("exam_id", id);
      const { error } = await supabase.from("exams").delete().eq("id", id);
      if (error) throw error;
      await syncRevisionSlots();
      await Promise.all([refresh(), refreshRevision()]);
    } catch (err: any) {
      alert("Error: " + err.message);
      setHiddenIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className={`max-w-5xl mx-auto p-4 md:p-10 space-y-6 md:space-y-10 pb-24 animate-in fade-in duration-500 ${isProcessing ? "opacity-70 pointer-events-none" : ""}`}>
      
      {/* 📋 Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-100 pb-8">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mb-1">Inventory</p>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter italic leading-none">Exam Register</h1>
        </div>
        <div className="flex items-center gap-3">
          {isProcessing && (
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-4 py-2 rounded-xl">
              <Loader2 className="w-3 h-3 animate-spin" />
              Syncing...
            </div>
          )}
          <button onClick={() => setOpen(true)} className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-600 transition-all shadow-xl active:scale-95">
            <Plus className="w-4 h-4" /> Add Exam
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center py-20 gap-3">
          <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 italic text-center">Syncing Operational Briefings...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {visibleExams.map((exam) => {
            const daysLeft = Math.ceil(
              (new Date(exam.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
            );

            // 1. Get all slots for this specific exam
            const examSlots = slots.filter((s) => s.exam_id === exam.id);

            // 2. Numerator: Total sessions actually completed (Original + Bonus)
            const completedCount = examSlots.filter((s) => s.is_completed).length;

            // 3. Denominator (The Shield): Only count original planned slots.
            const displayTotal = examSlots.filter((s) => {
              const isBonus = 
                s.description?.includes("[Bonus]") || 
                s.displayName?.includes("[Bonus]");
              return !isBonus;
            }).length;

            // 4. Check if there are any real future sessions left to do
            const hasFutureSlots = examSlots.some((s) => !s.is_completed);
            return (
              <div
                key={exam.id}
                className="group relative overflow-hidden rounded-[2rem] border-2 border-slate-100 bg-white p-6 md:p-8 shadow-sm hover:border-blue-500/20 transition-all"
              >
                <div className="flex flex-col lg:flex-row gap-8">
                  {/* Left: Metadata */}
                  <div className="flex-1 space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded bg-blue-50 text-blue-600 border border-blue-100">
                          {exam.exam_type}
                        </span>
                        {daysLeft <= 7 && (
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded bg-red-100 text-red-600 flex items-center gap-1 italic animate-pulse">
                            <AlertCircle className="w-3 h-3" /> Urgent
                          </span>
                        )}
                      </div>
                      <h3 className="text-3xl font-black italic tracking-tight text-slate-900 leading-tight">
                        {exam.subject}
                      </h3>

                      {/* Exam detail — board / competitive name / topics */}
                      {exam.exam_type === "Board" && exam.exam_board && (
                        <p className="text-sm font-bold text-slate-500 mt-1">{exam.exam_board}</p>
                      )}
                      {exam.exam_type === "Competitive" && exam.competitive_exam_name && (
                        <p className="text-sm font-bold text-slate-500 mt-1">{exam.competitive_exam_name}</p>
                      )}
                      {exam.exam_type === "Internal" && exam.topics && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {String(exam.topics).split(",").map((t: string) => t.trim()).filter(Boolean).map((topic: string) => (
                            <span key={topic} className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                              {topic}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-6">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Clock className="w-4 h-4" />
                        <p className="text-[10px] font-bold uppercase tracking-widest">
                          {new Date(exam.date).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>
                      {/*<div className="flex items-center gap-2 text-blue-600">
                        <Target className="w-4 h-4" />
                        <p className="text-[10px] font-bold uppercase tracking-widest">
                          Preparedness: {exam.preparedness}%
                        </p>
                      </div>*/}
                    </div>
                  </div>

                  {/* Middle: Live Session Action */}
                  <div className="flex-1 bg-slate-50 rounded-[1.8rem] p-5 border border-slate-100 flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-3 px-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 italic">
                        Session Progress
                      </p>
                      {/* 🎯 FIXED DENOMINATOR: Using displayTotal instead of examSlots.length */}
                      <p className="text-[10px] font-black text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-100">
                        {completedCount} / {displayTotal}
                      </p>
                    </div>

                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden mb-5">
                      <div
                        className={`h-full transition-all duration-1000 ${
                          completedCount >= displayTotal ? "bg-emerald-500" : "bg-blue-600"
                        }`}
                        style={{
                          width: `${Math.min(100, (completedCount / (displayTotal || 1)) * 100)}%`,
                        }}
                      />
                    </div>

                    <button
                      onClick={() =>
                        completeRevisionSlot(exam.id, exam.subject ?? "Unknown Subject")
                      }
                      disabled={!hasFutureSlots}
                      className={`group flex items-center justify-between w-full p-3 rounded-2xl transition-all border-2 ${
                        hasFutureSlots
                          ? "bg-white border-slate-100 hover:border-emerald-500 hover:bg-emerald-50 active:scale-95"
                          : "bg-slate-100 border-transparent opacity-50 cursor-not-allowed"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-1.5 rounded-lg transition-colors ${
                            hasFutureSlots
                              ? "bg-emerald-100 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white"
                              : "bg-slate-200 text-slate-400"
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                          {hasFutureSlots ? "Extra Session Complete" : "Exam Prepared"}
                        </span>
                      </div>
                      <Rocket
                        className={`w-3.5 h-3.5 ${
                          hasFutureSlots
                            ? "text-slate-200 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all"
                            : "text-transparent"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Right: Meta & Delete */}
                  <div className="flex flex-row lg:flex-col items-center justify-between lg:justify-center lg:pl-8 lg:border-l lg:border-slate-100 gap-6">
                    <div className="text-right">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                        T-Minus
                      </p>
                      <p
                        className={`text-4xl font-black italic tracking-tighter leading-none ${
                          daysLeft <= 7 ? "text-red-600" : "text-slate-900"
                        }`}
                      >
                        {daysLeft}d
                      </p>
                    </div>
                    <button
                      onClick={() => deleteExam(exam.id)}
                      className="p-3 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ExamModal 
        open={open} 
        onClose={() => setOpen(false)} 
        onAdded={async () => { 
          setIsProcessing(true);
          try {
            const result = await syncRevisionSlots();
            if (!result.success) console.warn("Sync issue:", result.error);
          } catch (err) {
            console.error("Sync failed:", err);
          }
          // Refresh both exams list AND revision slots so UI is up to date
          await Promise.all([refresh(), refreshRevision()]);
          setIsProcessing(false);
        }} 
      />
    </div>
  );
}