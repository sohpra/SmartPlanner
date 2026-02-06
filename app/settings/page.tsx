"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { 
  Zap, Clock, Calendar, Plus, Trash2, Save, Loader2, ChevronLeft, Layers, LogOut 
} from "lucide-react";
import { usePlannerCapacity } from "@/hooks/use-planner-capacity";
import Link from "next/link";

const DAYS_DISPLAY = [
  { label: "Monday",    index: 1 },
  { label: "Tuesday",   index: 2 },
  { label: "Wednesday", index: 3 },
  { label: "Thursday",  index: 4 },
  { label: "Friday",    index: 5 },
  { label: "Saturday",  index: 6 },
  { label: "Sunday",    index: 0 },
];

export default function SettingsPage() {
  const { capacityData, loading, refresh } = usePlannerCapacity();
  const [weeklyBudgets, setWeeklyBudgets] = useState<Record<number, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isRange, setIsRange] = useState(false);
  const [newException, setNewException] = useState({ 
    startDate: "", 
    endDate: "", 
    mins: 150, 
    label: "" 
  });

  useEffect(() => {
    if (capacityData) setWeeklyBudgets(capacityData.weeklyPattern);
  }, [capacityData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const saveWeeklyPattern = async () => {
    setIsSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 🎯 Map our data. NOTICE: No 'id' field here! 
    // The DB uses user_id and day_of_week to match.
    const updates = DAYS_DISPLAY.map((day) => ({
      user_id: user.id,
      day_of_week: day.index,
      base_minutes: weeklyBudgets[day.index] ?? 150
    }));

    const { error } = await supabase
      .from('planner_settings')
      .upsert(updates); // DB now knows how to handle the "conflict"

    if (error) {
      console.error("Save Error:", error);
    } else {
      await refresh();
      alert("Baseline Synced!");
    }
    setIsSaving(false);
  };

  const addException = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !newException.startDate) return;

    const datesToInsert = [];
    if (isRange && newException.endDate) {
      let current = new Date(newException.startDate);
      const end = new Date(newException.endDate);
      while (current <= end) {
        datesToInsert.push({
          user_id: user.id,
          date: current.toISOString().split('T')[0],
          override_minutes: newException.mins,
          label: newException.label
        });
        current.setDate(current.getDate() + 1);
      }
    } else {
      datesToInsert.push({
        user_id: user.id,
        date: newException.startDate,
        override_minutes: newException.mins,
        label: newException.label
      });
    }

    await supabase.from('planner_overrides').upsert(datesToInsert);
    setNewException({ startDate: "", endDate: "", mins: 150, label: "" });
    await refresh();
  };

  const deleteException = async (date: string) => {
    await supabase.from('planner_overrides').delete().eq('date', date);
    await refresh();
  };

  if (loading) return <div className="p-10 text-center font-black uppercase tracking-widest text-gray-400 italic">Syncing Operations...</div>;

  return (
    <main className="p-4 md:p-10 space-y-12 max-w-[1100px] mx-auto pb-24 animate-in fade-in duration-500">
      
      {/* 📋 Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-blue-600 fill-current" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Capacity Calibration</span>
          </div>
          <h2 className="text-3xl font-black text-slate-900 italic tracking-tighter flex items-center gap-3">
            System Settings
          </h2>
        </div>
        
      </header>

      {/* 🚀 PRIMARY SECTION: Live Overrides */}
      <section className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-amber-50 rounded-lg"><Calendar className="w-3.5 h-3.5 text-amber-600" /></div>
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Overrides</h3>
          </div>
          
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
            <button onClick={() => setIsRange(false)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${!isRange ? "bg-white shadow-sm text-blue-600" : "text-slate-400"}`}>
              <Calendar size={12} /> Single
            </button>
            <button onClick={() => setIsRange(true)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${isRange ? "bg-white shadow-sm text-amber-600" : "text-slate-400"}`}>
              <Layers size={12} /> Batch
            </button>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-sm space-y-8 relative overflow-hidden">
          <div className={`absolute top-0 left-0 right-0 h-1.5 ${isRange ? 'bg-amber-400' : 'bg-blue-400'} transition-colors duration-500`} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">{isRange ? "Start Date" : "Target Date"}</label>
              <input type="date" value={newException.startDate} onChange={e => setNewException({...newException, startDate: e.target.value})} className="w-full h-[52px] bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-xs font-bold focus:border-blue-500 outline-none transition-all" />
            </div>
            <div className="space-y-2 relative">
              <label className={`text-[9px] font-black uppercase tracking-widest ml-1 transition-colors ${isRange ? 'text-slate-400' : 'text-slate-200'}`}>End Date</label>
              <div className="relative h-[52px]">
                <input type="date" value={newException.endDate} disabled={!isRange} onChange={e => setNewException({...newException, endDate: e.target.value})} className={`absolute inset-0 w-full bg-slate-50 border-2 rounded-2xl p-4 text-xs font-bold outline-none transition-all duration-300 ${isRange ? "border-amber-200 opacity-100" : "border-transparent opacity-0 pointer-events-none"}`} />
                <div className={`absolute inset-0 w-full bg-slate-50 border-2 border-dashed border-slate-100 rounded-2xl p-4 text-xs font-bold text-slate-300 flex items-center transition-all duration-300 ${!isRange ? "opacity-100" : "opacity-0 pointer-events-none"}`}>Single Day Locked</div>
              </div>
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Event Label</label>
              <input type="text" placeholder="e.g. Half Term, Sports Trip" value={newException.label} onChange={e => setNewException({...newException, label: e.target.value})} className="w-full h-[52px] bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-xs font-bold focus:border-blue-500 outline-none transition-all" />
            </div>
          </div>
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col md:flex-row items-center gap-8">
            <div className="flex items-center gap-3"><div className="bg-slate-900 p-2 rounded-lg text-white"><Clock size={16}/></div><span className="text-[10px] font-black uppercase text-slate-600">Capacity for day</span></div>
            <input type="range" min="0" max="600" step="30" value={newException.mins} onChange={e => setNewException({...newException, mins: parseInt(e.target.value)})} className="flex-1 accent-slate-900" />
            <span className="text-2xl font-black text-slate-900 italic w-20 text-right">{newException.mins}m</span>
          </div>
          <button onClick={addException} className="w-full py-5 bg-slate-900 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl active:scale-[0.98]">Register Exception{isRange ? "s" : ""}</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(capacityData?.dateOverrides || {}).sort().map(([date, mins]) => (
            <div key={date} className="flex items-center justify-between p-5 bg-white border-2 border-slate-100 rounded-[2rem] hover:border-amber-200 transition-all">
              <div className="min-w-0"><p className="text-[10px] font-black text-slate-900 truncate">{capacityData?.labels[date] || "Custom Override"}</p><p className="text-[9px] font-bold text-slate-400 uppercase italic">{date}</p></div>
              <div className="flex items-center gap-3"><span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">{mins}m</span><button onClick={() => deleteException(date)} className="text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={16} /></button></div>
            </div>
          ))}
        </div>
      </section>

      {/* 🗓️ SECONDARY SECTION: Base Rhythm  */}
      <section className="pt-12 border-t border-slate-100 space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-blue-50 rounded-lg"><Clock className="w-3.5 h-3.5 text-blue-600" /></div>
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Base Rhythm Calibration</h3>
          </div>
          <button onClick={saveWeeklyPattern} disabled={isSaving} className="bg-white border-2 border-slate-900 text-slate-900 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all flex items-center gap-2 shadow-sm">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Sync Global Baseline
          </button>
        </div>

        <div className="bg-slate-50 border-2 border-slate-100 rounded-[3rem] p-8 space-y-2">
          {DAYS_DISPLAY.map((day) => (
            <div key={day.label} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
              <span className="text-[10px] font-black text-slate-500 uppercase italic w-24">{day.label}</span>
              <div className="flex items-center gap-6 flex-1 justify-end">
                <input 
                  type="range" min="0" max="480" step="15" 
                  value={weeklyBudgets[day.index] || 0}
                  onChange={(e) => setWeeklyBudgets(prev => ({ ...prev, [day.index]: parseInt(e.target.value) }))}
                  className="w-full max-w-[250px] accent-blue-600"
                />
                <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg w-16 text-center">{weeklyBudgets[day.index] || 0}m</span>
              </div>
            </div>
          ))}
          <p className="text-center text-[9px] font-bold text-slate-400 uppercase mt-6 tracking-[0.2em] italic opacity-60">
            Standard daily baseline. Applies unless an active Live Override exists above.
          </p>
        </div>
      </section>
      
      <p className="text-center text-[9px] font-bold text-slate-300 uppercase tracking-[0.4em] pb-10">Plan Bee v1.0.4 — Secured Operational Interface</p>
    </main>
  );
}