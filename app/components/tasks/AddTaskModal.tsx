"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { syncRevisionSlots } from "@/lib/planner/revisionPersistence";
import { X, Clock, Loader2, Sparkles, Calendar, Lock } from "lucide-react";

type TabType = "homework" | "project" | "weekly";

export function AddTaskModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<TabType>("homework");
  const [title, setTitle] = useState("");
  const [load, setLoad] = useState("30");
  const [day, setDay] = useState("1");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [subjectId, setSubjectId] = useState("");
  
  // 🎯 STABILITY FIX: isFixed no longer resets the date
  const [isFixed, setIsFixed] = useState(false);
  
  const [activityType, setActivityType] = useState("Regular Study Slot");
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSubjects() {
      const { data } = await supabase.from("subjects").select("id, name").order("name");
      if (data) setSubjects(data);
    }
    if (open) {
      fetchSubjects();
      setSyncStatus(null);
      setTitle("");
      setLoad("30");
      setIsFixed(false);
      setDueDate(new Date().toISOString().split('T')[0]);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!title) return alert("Please enter an objective name");
    setIsSubmitting(true);
    setSyncStatus("Saving objective...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      let insertError;

      if (activeTab === "homework") {
        // 🎯 THE FIX: FinalDate is singular. If fixed, it anchors the task.
        const finalDate = dueDate;

        const { error } = await supabase.from("deadline_tasks").insert([{
          name: title,
          estimated_minutes: parseInt(load),
          due_date: finalDate,
          scheduled_date: isFixed ? finalDate : null,
          is_fixed: isFixed,
          subject_id: subjectId || null,
          user_id: user.id,
          status: 'active'
        }]);
        insertError = error;
      } else if (activeTab === "weekly") {
        const { error } = await supabase.from("recurring_tasks").insert([{
          name: title,
          duration_minutes: parseInt(load),
          day_of_week: parseInt(day),
          task_type: activityType || "Regular Study Slot",
          user_id: user.id,
          color: activityType === "music" ? "#8b5cf6" : "#10b981"
        }]);
        insertError = error;
      } else if (activeTab === "project") {
        const { error } = await supabase.from("projects").insert([{
          name: title,
          user_id: user.id,
          estimated_minutes: parseInt(load) || 60,
          due_date: dueDate,
          status: 'active'
        }]);
        insertError = error;
      }

      if (insertError) throw insertError;

      setSyncStatus("Re-balancing roadmap...");
      await syncRevisionSlots();
      
      onClose();
      window.location.reload(); 
    } catch (err: any) {
      console.error("Task Error:", err);
      alert("Database Error: " + err.message);
    } finally {
      setIsSubmitting(false);
      setSyncStatus(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-md p-0 md:p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-xl rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom md:zoom-in-95 duration-300 max-h-[95vh] overflow-y-auto">
        
        {/* Header */}
        <div className="p-6 md:p-8 pb-4 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2.5 rounded-xl text-white rotate-3 shadow-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="text-xl md:text-2xl font-black italic tracking-tighter text-slate-900">New Objective</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-6 md:px-8 mb-6">
          <div className="flex p-1.5 bg-slate-50 rounded-2xl border border-slate-100">
            {(["homework", "project", "weekly"] as TabType[]).map((tab) => (
              <button
                key={tab}
                disabled={isSubmitting}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                  activeTab === tab ? "bg-slate-900 text-white shadow-xl" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 md:px-8 pb-10 space-y-5">
          <div className="space-y-4">
            {activeTab === "homework" && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Subject</label>
                <select 
                  value={subjectId} 
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                >
                  <option value="">Select Subject...</option>
                  {subjects.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Description</label>
              <input
                placeholder="e.g. English Essay"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-slate-300 text-slate-900"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  {activeTab === "weekly" ? "Assigned Day" : isFixed ? "Event Date" : "Deadline (Due Date)"}
                </label>
                {activeTab === "weekly" ? (
                  <select value={day} onChange={(e) => setDay(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none text-slate-900">
                    <option value="1">Monday</option><option value="2">Tuesday</option><option value="3">Wednesday</option>
                    <option value="4">Thursday</option><option value="5">Friday</option><option value="6">Saturday</option><option value="0">Sunday</option>
                  </select>
                ) : (
                  <input 
                    type="date" 
                    value={dueDate} 
                    onChange={(e) => setDueDate(e.target.value)} 
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none text-slate-900" 
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 text-right block pr-1">Duration (Min)</label>
                <div className="relative">
                  <input type="number" value={load} onChange={(e) => setLoad(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none text-slate-900" />
                  <Clock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* 🎯 FIXED TOGGLE UI - Streamlined */}
            {activeTab === "homework" && (
              <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${isFixed ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isFixed ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                    {isFixed ? <Lock className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${isFixed ? 'text-blue-600' : 'text-slate-500'}`}>
                      {isFixed ? 'Fixed Session' : 'Floating Objective'}
                    </p>
                    <p className="text-[9px] text-slate-400 font-bold italic">
                      {isFixed ? 'Locked to specific date' : 'Engine finds the best gap'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFixed(!isFixed)}
                  className={`w-12 h-7 rounded-full transition-colors relative ${isFixed ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${isFixed ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            )}
          </div>

          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-slate-900 hover:bg-blue-600 text-white font-black uppercase tracking-widest py-5 rounded-2xl md:rounded-[1.5rem] shadow-xl transition-all active:scale-[0.98] disabled:opacity-50 mt-4 flex items-center justify-center gap-3 group"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                <span className="text-xs">{syncStatus}</span>
              </>
            ) : (
              <>
                <span>Add Objective</span>
                <Sparkles className="w-4 h-4 text-blue-400 group-hover:rotate-12 transition-transform" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}