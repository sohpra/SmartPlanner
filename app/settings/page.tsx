"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { 
  Zap, Clock, Calendar, Plus, Trash2, Save, Loader2, ChevronLeft, Layers, LogOut 
} from "lucide-react";
import { usePlannerCapacity } from "@/hooks/use-planner-capacity";
import Link from "next/link";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
  const [user, setUser] = useState<any>(null);
  const { capacityData, loading, refresh } = usePlannerCapacity();
  
  const [weeklyBudgets, setWeeklyBudgets] = useState<Record<number, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  
  // Exception Form State
  const [isRange, setIsRange] = useState(false);
  const [newException, setNewException] = useState({ 
    startDate: "", 
    endDate: "", 
    mins: 150, 
    label: "" 
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (capacityData) {
      setWeeklyBudgets(capacityData.weeklyPattern);
    }
  }, [capacityData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const saveWeeklyPattern = async () => {
    setIsSaving(true);
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return;

    const updates = Object.entries(weeklyBudgets).map(([day, mins]) => ({
      user_id: currentUser.id,
      day_of_week: parseInt(day),
      base_minutes: mins
    }));

    await supabase.from('planner_settings').upsert(updates, { onConflict: 'user_id,day_of_week' });
    await refresh();
    setIsSaving(false);
  };

  const addException = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser || !newException.startDate) return;

    const datesToInsert = [];
    if (isRange && newException.endDate) {
      let current = new Date(newException.startDate);
      const end = new Date(newException.endDate);
      while (current <= end) {
        datesToInsert.push({
          user_id: currentUser.id,
          date: current.toISOString().split('T')[0],
          override_minutes: newException.mins,
          label: newException.label
        });
        current.setDate(current.getDate() + 1);
      }
    } else {
      datesToInsert.push({
        user_id: currentUser.id,
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
    <main className="p-4 md:p-10 space-y-8 max-w-[1200px] mx-auto pb-24 animate-in fade-in duration-500">
      
      {/* 📋 Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-blue-600 fill-current" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 italic">Core Calibration</span>
          </div>
          <h2 className="text-3xl font-black text-slate-900 italic tracking-tighter flex items-center gap-3">
            <Link href="/" className="hover:text-blue-600 transition-colors"><ChevronLeft className="w-8 h-8 inline" /></Link>
            Engine Settings
          </h2>
        </div>
        
        <div className="flex items-center gap-3">
            {/* 🎯 Status Indicator: Shows when everything is synced */}
            <div className="hidden md:flex items-center gap-2 mr-4 px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">System Synced</span>
            </div>

            <button 
                onClick={saveWeeklyPattern}
                className="group bg-slate-900 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl active:scale-95 flex items-center gap-2"
            >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />}
                Update Baseline
            </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* 🚀 LEFT COLUMN: Exceptions */}
        <section className="lg:col-span-7 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-amber-50 rounded-lg"><Calendar className="w-3.5 h-3.5 text-amber-600" /></div>
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Overrides</h3>
            </div>
            
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                    onClick={() => setIsRange(false)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${
                    !isRange ? "bg-white shadow-sm text-blue-600" : "text-slate-400 hover:text-slate-600"
                    }`}
                >
                    <Calendar size={12} /> Single
                </button>
                <button
                    onClick={() => setIsRange(true)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${
                    isRange ? "bg-white shadow-sm text-amber-600" : "text-slate-400 hover:text-slate-600"
                    }`}
                >
                    <Layers size={12} /> Batch
                </button>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-sm space-y-6 relative overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-1 ${isRange ? 'bg-amber-400' : 'bg-blue-400'}`} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* START DATE: Always visible */}
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">
                  {isRange ? "Start Date" : "Date"}
                </label>
                <input 
                  type="date"
                  value={newException.startDate}
                  onChange={e => setNewException({...newException, startDate: e.target.value})}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-xs font-bold focus:border-blue-500 outline-none transition-all h-[52px]" 
                />
              </div>

              {/* END DATE: Always takes up space, but changes appearance */}
              <div className="space-y-2 relative">
                <label className={`text-[9px] font-black uppercase tracking-widest ml-1 transition-colors duration-300 ${
                  isRange ? "text-slate-400" : "text-slate-200"
                }`}>
                  End Date
                </label>
                
                <div className="relative h-[52px]">
                  {/* Actual Input */}
                  <input 
                    type="date" 
                    value={newException.endDate}
                    disabled={!isRange}
                    onChange={e => setNewException({...newException, endDate: e.target.value})}
                    className={`absolute inset-0 w-full bg-slate-50 border-2 rounded-2xl p-4 text-xs font-bold outline-none transition-all duration-300 ${
                      isRange 
                        ? "border-amber-200 opacity-100 translate-y-0" 
                        : "border-transparent opacity-0 translate-y-1 pointer-events-none"
                    }`}
                  />
                  
                  {/* Placeholder that shows when Single is active */}
                  <div 
                    className={`absolute inset-0 w-full bg-slate-50 border-2 border-dashed border-slate-100 rounded-2xl p-4 text-xs font-bold text-slate-300 flex items-center transition-all duration-300 ${
                      !isRange 
                        ? "opacity-100 translate-y-0" 
                        : "opacity-0 -translate-y-1 pointer-events-none"
                    }`}
                  >
                    Single Day Selected
                  </div>
                </div>
              </div>

              {/* LABEL: This will now stay exactly where it is */}
              <div className="md:col-span-2 space-y-2">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">
                  Label (e.g. Half Term Trip)
                </label>
                <input 
                  type="text" 
                  placeholder="Context for this override..." 
                  value={newException.label}
                  onChange={e => setNewException({...newException, label: e.target.value})}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-xs font-bold focus:border-blue-500 outline-none transition-all h-[52px]" 
                />
              </div>
            </div>
            <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 flex flex-col md:flex-row items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-lg text-white"><Clock size={16}/></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-900">Allocation</span>
              </div>
              <input 
                type="range" min="0" max="600" step="30" 
                value={newException.mins}
                onChange={e => setNewException({...newException, mins: parseInt(e.target.value)})}
                className="flex-1 accent-blue-600"
              />
              <span className="text-xl font-black text-blue-600 w-16 text-right">{newException.mins}m</span>
            </div>

            <button onClick={addException} className="w-full py-5 bg-slate-900 text-white rounded-3xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-slate-200">
              Register Exception{isRange ? "s" : ""}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(capacityData?.dateOverrides || {}).sort().map(([date, mins]) => (
              <div key={date} className="flex items-center justify-between p-5 bg-white border-2 border-slate-100 rounded-[2rem] hover:border-amber-200 transition-all">
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-slate-900 truncate">{capacityData?.labels[date] || "Custom Day"}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter italic">{date}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-black text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-xl border border-blue-100">{mins}m</span>
                  <button onClick={() => deleteException(date)} className="p-2 text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 🗓️ RIGHT COLUMN: Rhythm */}
      <aside className="lg:col-span-5 space-y-8">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-blue-50 rounded-lg"><Clock className="w-3.5 h-3.5 text-blue-600" /></div>
          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Base Rhythm</h3>
        </div>

        <div className="bg-slate-50/50 border-2 border-slate-100 rounded-[3rem] p-8 space-y-3">
          {DAYS_DISPLAY.map((day) => (
            <div key={day.label} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl">
              <span className="text-[10px] font-black text-slate-500 uppercase italic w-16">{day.label.slice(0,3)}</span>
              <div className="flex items-center gap-4 flex-1 justify-end">
                <input 
                  type="range" min="0" max="480" step="15" 
                  value={weeklyBudgets[day.index] || 0}
                  onChange={(e) => setWeeklyBudgets(prev => ({ ...prev, [day.index]: parseInt(e.target.value) }))}
                  className="w-full max-w-[120px] accent-blue-600"
                />
                <span className="text-[11px] font-black text-blue-600 w-10 text-right">{weeklyBudgets[day.index] || 0}m</span>
              </div>
            </div>
          ))}
        </div>
      </aside>
      </div>
    </main>
  );
}