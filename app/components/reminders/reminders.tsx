"use client";

import { useState } from "react";
import { useReminders } from "@/hooks/use-reminders";
import { Bell, Plus, Check, Trash2, Calendar } from "lucide-react";

export function RemindersCard({ date: currentViewDate }: { date: string }) {
  const { reminders, toggleReminder, addReminder, deleteReminder } = useReminders(currentViewDate);
  const [text, setText] = useState("");
  const [targetDate, setTargetDate] = useState(currentViewDate);

  const handleAdd = () => {
    if (!text.trim()) return;
    addReminder(text, targetDate);
    setText("");
  };

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 p-5 shadow-sm flex flex-col h-full min-h-0 overflow-hidden">
      
      {/* ⚡ Header & Compressed Input */}
      <div className="shrink-0 mb-4">
        <div className="flex items-center justify-between px-1 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-50 rounded-lg">
              <Bell className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            </div>
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] italic">
              Reminders
            </h3>
          </div>
          
          <div className="relative group bg-slate-50 border border-slate-100 rounded-md px-1.5 py-0.5 flex items-center gap-1.5 hover:border-amber-200 transition-colors">
            <Calendar className="w-2.5 h-2.5 text-slate-400" />
            <input 
              type="date" 
              value={targetDate} 
              onChange={(e) => setTargetDate(e.target.value)} 
              className="text-[8px] font-black text-slate-500 bg-transparent border-none p-0 focus:ring-0 uppercase cursor-pointer w-[65px]"
            />
          </div>
        </div>

        <div className="relative group">
          <input 
            value={text} 
            onChange={(e) => setText(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()} 
            placeholder="Quick add..." 
            className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2 pl-3 pr-10 text-[11px] font-bold placeholder:text-slate-300 focus:bg-white focus:ring-2 focus:ring-amber-100 transition-all outline-none" 
          />
          <button 
            onClick={handleAdd} 
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 bg-slate-900 text-white rounded-lg flex items-center justify-center hover:bg-amber-500 transition-all active:scale-90 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
          </button>
        </div>
      </div>

      {/* 📋 High-Density Unified List */}
      <div className="flex-1 space-y-1 overflow-y-auto pr-1 custom-scrollbar">
        {reminders.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-50 rounded-xl">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-300 italic">Inbox Clear</p>
          </div>
        ) : (
          reminders.map((rem) => {
            // 🎯 Time Flag Logic (Matches Coming Up)
            const tDate = new Date(currentViewDate + "T00:00:00");
            const rDate = new Date(rem.date + "T00:00:00");
            const diff = Math.round((rDate.getTime() - tDate.getTime()) / (1000 * 60 * 60 * 24));
            
            const isToday = diff === 0;
            const isTomorrow = diff === 1;
            const isOverdue = diff < 0 && !rem.is_completed;

            return (
              <div 
                key={rem.id} 
                className={`group flex items-center gap-2 py-2 px-3 rounded-xl border transition-all ${
                  rem.is_completed 
                    ? 'opacity-30 border-transparent italic scale-[0.98] origin-left' 
                    : isToday 
                      ? 'bg-white border-slate-100 hover:border-amber-200 shadow-sm' 
                      : isOverdue
                        ? 'bg-red-50/30 border-red-100/50'
                        : 'bg-slate-50/50 border-transparent'
                }`}
              >
                {/* 🔘 Checkbox */}
                <button 
                  onClick={() => toggleReminder(rem.id, rem.is_completed)} 
                  className={`h-4 w-4 shrink-0 rounded-md border-2 flex items-center justify-center transition-all ${
                    rem.is_completed ? 'bg-emerald-500 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.2)]' : 'border-slate-200 bg-white'
                  }`}
                >
                  {rem.is_completed && <Check className="w-2.5 h-2.5 text-white stroke-[4]" />}
                </button>
                
                {/* 📝 Task Text */}
                <div className="flex-1 min-w-0">
                  <p className={`text-[11px] font-black truncate transition-all ${
                    rem.is_completed ? 'text-slate-400 line-through' : 'text-slate-700'
                  }`}>
                    {rem.text}
                  </p>
                </div>

                {/* 🚩 THE TIME FLAG */}
                {!rem.is_completed && (
                  <div className={`shrink-0 ml-1 px-1.5 py-0.5 rounded-md text-[7px] font-black tabular-nums tracking-tighter transition-colors ${
                    isToday ? 'bg-amber-100 text-amber-700 uppercase' : 
                    isTomorrow ? 'bg-blue-50 text-blue-600' : 
                    isOverdue ? 'bg-red-600 text-white animate-pulse' :
                    'bg-slate-100 text-slate-400'
                  }`}>
                    {isToday ? 'Today' : isTomorrow ? '1d' : isOverdue ? 'Overdue' : `${diff}d`}
                  </div>
                )}

                {/* 🗑️ Trash (Visible on hover) */}
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                  <button onClick={() => deleteReminder(rem.id)} className="p-0.5 text-slate-300 hover:text-red-400 transition-colors">
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}