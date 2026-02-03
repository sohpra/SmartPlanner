"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { useSubjects } from "@/hooks/use-subjects";
import { X, Sparkles, Target, Layers } from "lucide-react";

export function ExamModal({ open, onClose, onAdded }: any) {
  const [examType, setExamType] = useState("internal");
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState("");
  const [preparedness, setPreparedness] = useState(50);
  const [topics, setTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState("");
  const [examBoard, setExamBoard] = useState("");
  const [examName, setExamName] = useState("");

  const { subjects, loading } = useSubjects();

  useEffect(() => {
    if (open) {
      setExamType("internal"); setSubject(""); setDate(""); setPreparedness(50);
      setTopics([]); setTopicInput(""); setExamBoard(""); setExamName("");
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit() {
    if (!subject || !date) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const base = {
      user_id: user.id,
      subject,
      exam_type: examType.charAt(0).toUpperCase() + examType.slice(1),
      date,
      preparedness,
    };

    const payload = examType === "internal" ? { ...base, topics } : examType === "board" ? { ...base, exam_board: examBoard } : { ...base, competitive_exam_name: examName };
    const { error } = await supabase.from("exams").insert(payload);
    if (!error) { onAdded?.(); onClose(); }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-8 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2.5 rounded-2xl rotate-3"><Sparkles className="w-5 h-5 text-white" /></div>
              <h2 className="text-2xl font-black italic tracking-tighter">Add New Exam</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Type</label>
              <select className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-600 transition-all" value={examType} onChange={(e) => setExamType(e.target.value)}>
                <option value="internal">Internal</option>
                <option value="board">Board</option>
                <option value="competitive">Competitive</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Subject</label>
              <select className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-600" value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="">Select</option>
                {subjects.map((s) => (<option key={s.id} value={s.name}>{s.name}</option>))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Deadline Date</label>
            <input type="date" className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-600" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Current Preparedness</label>
              <span className="text-xl font-black text-blue-600 italic">{preparedness}%</span>
            </div>
            <input type="range" min={0} max={100} value={preparedness} onChange={(e) => setPreparedness(Number(e.target.value))} className="w-full h-2 bg-gray-100 rounded-full appearance-none cursor-pointer accent-blue-600" />
          </div>

          <div className="flex gap-3 pt-4">
            <button onClick={onClose} className="flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-slate-900 transition-colors">Abort</button>
            <button onClick={handleSubmit} disabled={!subject || !date} className="flex-[2] bg-slate-900 text-white rounded-2xl py-4 text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-200 hover:bg-blue-600 disabled:opacity-30 transition-all">Confirm Briefing</button>
          </div>
        </div>
      </div>
    </div>
  );
}