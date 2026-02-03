"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useSubjects } from "@/hooks/use-subjects";
import { X, Zap, Target, Clock } from "lucide-react";

export function AddTaskModal({ open, onClose }: any) {
  const { subjects, loading: subjectsLoading } = useSubjects();
  const [taskType, setTaskType] = useState<"weekly" | "deadline" | "project">("weekly");
  const [name, setName] = useState("");
  const [subjectText, setSubjectText] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [dueDate, setDueDate] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState(300);

  useEffect(() => { if (open) setName(""); }, [open]);
  if (!open) return null;

  async function handleSubmit() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload: any = { user_id: user.id, name };
    let table = "";

    if (taskType === "weekly") {
      table = "recurring_tasks";
      Object.assign(payload, { subject: subjectText, day_of_week: dayOfWeek, duration_minutes: durationMinutes, task_type: "homework" });
    } else if (taskType === "deadline") {
      table = "deadline_tasks";
      Object.assign(payload, { due_date: dueDate, estimated_minutes: durationMinutes });
    } else {
      table = "projects";
      Object.assign(payload, { due_date: dueDate, estimated_minutes: estimatedMinutes, status: "active", subject: subjectText });
    }

    const { error } = await supabase.from(table).insert(payload);
    if (!error) { onClose(); window.location.reload(); }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-8 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-slate-900 p-2.5 rounded-2xl rotate-3 text-white"><Zap className="w-5 h-5 fill-current" /></div>
              <h2 className="text-2xl font-black italic tracking-tighter">Initialize Task</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-2">
              {(["weekly", "deadline", "project"] as const).map((t) => (
                <button key={t} onClick={() => setTaskType(t)} className={`py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest border-2 transition-all ${taskType === t ? 'border-slate-900 bg-slate-900 text-white' : 'border-gray-50 bg-gray-50 text-gray-400'}`}>
                  {t}
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Objective Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter task title..." className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 text-sm font-bold placeholder:text-gray-300 focus:ring-2 focus:ring-blue-600" />
            </div>

            <div className="grid grid-cols-2 gap-4">
               {taskType === "weekly" ? (
                 <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Day</label>
                   <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))} className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold">
                     <option value={1}>Monday</option><option value={2}>Tuesday</option><option value={3}>Wednesday</option>
                     <option value={4}>Thursday</option><option value={5}>Friday</option><option value={6}>Saturday</option><option value={0}>Sunday</option>
                   </select>
                 </div>
               ) : (
                 <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Deadline Date</label>
                   <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold" />
                 </div>
               )}

               <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Estimated Load</label>
                 <div className="relative">
                   <input type="number" value={taskType === "project" ? estimatedMinutes : durationMinutes} onChange={(e) => taskType === "project" ? setEstimatedMinutes(Number(e.target.value)) : setDurationMinutes(Number(e.target.value))} className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold" />
                   <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400">MINS</span>
                 </div>
               </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button onClick={onClose} className="flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-slate-900 transition-colors">Cancel</button>
            <button onClick={handleSubmit} disabled={!name} className="flex-[2] bg-blue-600 text-white rounded-2xl py-4 text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-200 hover:bg-slate-900 disabled:opacity-30 transition-all">Add Objective</button>
          </div>
        </div>
      </div>
    </div>
  );
}