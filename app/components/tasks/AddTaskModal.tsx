"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { X, BookOpen, Clock } from "lucide-react";

type TabType = "homework" | "project" | "weekly";

export function AddTaskModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<TabType>("homework");
  const [title, setTitle] = useState("");
  const [load, setLoad] = useState("30");
  const [day, setDay] = useState("1");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [subjectId, setSubjectId] = useState("");
  
  // Defaulting to "Regular Study Slot" makes it effectively optional for the user
  const [activityType, setActivityType] = useState("Regular Study Slot");
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchSubjects() {
      const { data } = await supabase.from("subjects").select("id, name").order("name");
      if (data) setSubjects(data);
    }
    if (open) fetchSubjects();
  }, [open]);

  const handleSubmit = async () => {
    if (!title) return alert("Please enter an objective name");
    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      let error;

      if (activeTab === "homework") {
        ({ error } = await supabase.from("deadline_tasks").insert([{
          name: title,
          estimated_minutes: parseInt(load),
          due_date: dueDate,
          subject_id: subjectId || null,
          user_id: user.id,
          status: 'active'
        }]));
      } else if (activeTab === "weekly") {
        ({ error } = await supabase.from("recurring_tasks").insert([{
          name: title,
          duration_minutes: parseInt(load),
          day_of_week: parseInt(day),
          task_type: activityType || "Regular Study Slot", // Ensures a value hits the DB
          user_id: user.id
        }]));
      } else if (activeTab === "project") {
        ({ error } = await supabase.from("projects").insert([{
          name: title,
          user_id: user.id,
          estimated_minutes: parseInt(load) || 60,
          due_date: new Date().toISOString().split('T')[0],
          status: 'active'
        }]));
      }

      if (error) throw error;
      onClose();
      window.location.reload();
    } catch (err: any) {
      alert("Database Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-slate-900">
      <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-8 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 p-2 rounded-xl text-white">
              <BookOpen className="w-5 h-5" />
            </div>
              <h2 className="text-2xl font-black italic tracking-tighter">Add New Task</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-8 mb-6">
          <div className="flex p-1 bg-slate-50 rounded-2xl border border-slate-100">
            {(["homework", "project", "weekly"] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                  activeTab === tab ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="px-8 pb-10 space-y-5">
          {/* Conditional Fields: Homework Subject */}
          {activeTab === "homework" && (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Subject (Optional)</label>
              <select 
                value={subjectId} 
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold focus:border-blue-500 outline-none transition-all appearance-none"
              >
                <option value="">Select Subject...</option>
                {subjects.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
            </div>
          )}

          {/* Conditional Fields: Weekly Activity Type */}
          {activeTab === "weekly" && (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Type (Optional)</label>
              <select 
                value={activityType} 
                onChange={(e) => setActivityType(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold focus:border-blue-500 outline-none transition-all appearance-none"
              >
                <option value="Regular Study Slot">Regular Study Slot</option>
                <option value="club">Club</option>
                <option value="music">Music</option>
              </select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Objective Name</label>
            <input
              placeholder="Enter title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {activeTab === "weekly" ? (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Day</label>
                <select value={day} onChange={(e) => setDay(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold focus:border-blue-500 outline-none appearance-none">
                  <option value="1">Monday</option><option value="2">Tuesday</option><option value="3">Wednesday</option>
                  <option value="4">Thursday</option><option value="5">Friday</option><option value="6">Saturday</option><option value="0">Sunday</option>
                </select>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Due Date</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold focus:border-blue-500 outline-none" />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 text-right block mr-1">Load (Mins)</label>
              <div className="relative">
                <input type="number" value={load} onChange={(e) => setLoad(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-center focus:border-blue-500 outline-none" />
                <Clock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              </div>
            </div>
          </div>

          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest py-5 rounded-[1.5rem] shadow-xl shadow-blue-100 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isSubmitting ? "Syncing..." : "Add Objective"}
          </button>
        </div>
      </div>
    </div>
  );
}