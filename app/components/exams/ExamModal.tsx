"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { useSubjects } from "@/hooks/use-subjects";
import { syncRevisionSlots } from "@/lib/planner/revisionPersistence";
import { X, Sparkles, PencilLine, Loader2 } from "lucide-react";

export function ExamModal({ open, onClose, onAdded }: any) {
  // 1. HOOKS (Must be at the top level, before any returns)
  const [examType, setExamType] = useState("internal");
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState("");
  const [preparedness, setPreparedness] = useState(50);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Specific Detail Fields
  const [examBoard, setExamBoard] = useState("");
  const [examName, setExamName] = useState("");
  const [topicInput, setTopicInput] = useState(""); 

  const { subjects } = useSubjects();

  useEffect(() => {
    if (open) {
      setExamType("internal"); 
      setSubject(""); 
      setDate(""); 
      setPreparedness(50); 
      setExamBoard(""); 
      setExamName("");
      setTopicInput("");
      setIsSyncing(false);
    }
  }, [open]);

  // 2. LOGIC
  async function handleSubmit() {
    if (!subject || !date) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("User session not found. Please log in again.");
      return;
    }

    setIsSyncing(true);

    // Format for DB Check Constraints
    const formattedType = examType.charAt(0).toUpperCase() + examType.slice(1);

    const payload: any = {
      user_id: user.id,
      subject,
      exam_type: formattedType,
      date: new Date(date).toISOString(),
      preparedness,
      topics: examType === "internal" ? topicInput : null,
      exam_board: examType === "board" ? examBoard : null,
      competitive_exam_name: examType === "competitive" ? examName : null,
      color: "#3b82f6",
    };

    try {
      // Step 1: Insert the Exam
      const { data: newExam, error: examError } = await supabase
        .from("exams")
        .insert([payload])
        .select()
        .single();

      if (examError) throw examError;

      // Step 2: Global Orchestration
      // This recalculates the entire interleaved schedule around this new exam
      if (newExam) {
        const syncResult = await syncRevisionSlots();
        if (!syncResult.success) {
          console.warn("Revision sync encountered an issue:", syncResult.error);
        }
      }

      // Step 3: Refresh UI and Exit
      onAdded?.(); 
      onClose();
      
    } catch (error: any) {
      console.error("Submission Error:", error);
      alert(`Failed to save briefing: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  }

  // 3. RENDER (Early return after hooks)
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-xl bg-white rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom md:zoom-in-95 duration-300 max-h-[95vh] overflow-y-auto">
        <div className="p-6 md:p-8 space-y-6">
          
          {/* Header */}
          <div className="flex items-center justify-between sticky top-0 bg-white py-2 z-10">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 md:p-2.5 rounded-xl rotate-3">
                <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </div>
              <h2 className="text-xl md:text-2xl font-black italic tracking-tighter text-slate-900">New Briefing</h2>
            </div>
            <button 
              onClick={onClose} 
              disabled={isSyncing}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-30"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[9px] md:text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Category</label>
              <select 
                disabled={isSyncing}
                className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-600 disabled:opacity-50" 
                value={examType} 
                onChange={(e) => setExamType(e.target.value)}
              >
                <option value="internal">Internal</option>
                <option value="board">Board Exam</option>
                <option value="competitive">Competitive</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] md:text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Subject</label>
              <select 
                disabled={isSyncing}
                className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-600 disabled:opacity-50" 
                value={subject} 
                onChange={(e) => setSubject(e.target.value)}
              >
                <option value="">Select...</option>
                {subjects.map((s) => (<option key={s.id} value={s.name}>{s.name}</option>))}
              </select>
            </div>
          </div>

          {/* Dynamic Detail Field */}
          <div className="space-y-1.5 animate-in slide-in-from-left duration-300">
            <label className="text-[9px] md:text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
              {examType === "internal" ? "Key Topics" : examType === "board" ? "Exam Board" : "Exam Name"}
            </label>
            <div className="relative">
              <input 
                disabled={isSyncing}
                type="text"
                placeholder={examType === "competitive" ? "e.g. Maths Olympiad" : "Enter details..."}
                className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3.5 pl-11 text-sm font-bold focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
                value={examType === "internal" ? topicInput : examType === "board" ? examBoard : examName}
                onChange={(e) => {
                  if (examType === "internal") setTopicInput(e.target.value);
                  else if (examType === "board") setExamBoard(e.target.value);
                  else setExamName(e.target.value);
                }}
              />
              <PencilLine className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] md:text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Target Date</label>
            <input 
              disabled={isSyncing}
              type="date" 
              className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-600 disabled:opacity-50" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
            />
          </div>

          {/* Readiness Slider */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-[9px] md:text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Readiness</label>
              <span className="text-xl font-black text-blue-600 italic">{preparedness}%</span>
            </div>
            <input 
              disabled={isSyncing}
              type="range" 
              min={0} max={100} 
              value={preparedness} 
              onChange={(e) => setPreparedness(Number(e.target.value))} 
              className="w-full h-2 bg-gray-100 rounded-full appearance-none cursor-pointer accent-blue-600 disabled:opacity-50" 
            />
          </div>

          <div className="flex flex-col md:flex-row gap-3 pt-2">
            <button 
              onClick={handleSubmit} 
              disabled={!subject || !date || isSyncing} 
              className="w-full bg-slate-900 text-white rounded-2xl py-4 text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-blue-600 disabled:opacity-30 transition-all flex items-center justify-center gap-2"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analysing Schedule...
                </>
              ) : (
                "Confirm Briefing"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}