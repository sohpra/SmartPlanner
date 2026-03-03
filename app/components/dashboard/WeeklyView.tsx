"use client";

import React, { useState, useMemo } from "react";
import type { WeekPlan, DayPlan } from "@/lib/planner/buildWeekPlan";
import { ChevronLeft, ChevronRight, Calendar, Star, Crown } from "lucide-react";
import { usePlannerCapacity } from "@/hooks/use-planner-capacity";

type Props = {
  plan: WeekPlan;
  exams: any[];
  projects: any[];
};

export function WeeklyView({ plan, exams, projects }: Props) {
  const [weekOffset, setWeekOffset] = useState(0);
  const { capacityData } = usePlannerCapacity();

  const visibleDays = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); 
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const anchorMonday = new Date(today);
    anchorMonday.setHours(0, 0, 0, 0);
    anchorMonday.setDate(today.getDate() + diffToMonday + (weekOffset * 7));
    
    const weekWindow: DayPlan[] = [];
    
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(anchorMonday);
      dayDate.setDate(anchorMonday.getDate() + i);
      
      const dateStr = [
        dayDate.getFullYear(),
        String(dayDate.getMonth() + 1).padStart(2, '0'),
        String(dayDate.getDate()).padStart(2, '0')
      ].join('-');
      
      const planDay = plan.days.find(d => d.date === dateStr);
      
      if (planDay) {
        weekWindow.push(planDay);
      } else {
        weekWindow.push({
          date: dateStr,
          totalPlanned: 0,
          totalCompleted: 0,
          baseCapacity: 150, 
          weekly: { items: [] },
          homework: { items: [] },
          revision: { items: [] },
          projects: { items: [] }
        } as unknown as DayPlan);
      }
    }
    return weekWindow;
  }, [plan, weekOffset]);

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-black text-gray-900 tracking-tight italic uppercase">
              {weekOffset === 0 ? "This Week" : weekOffset === 1 ? "Next Week" : `Week +${weekOffset}`}
            </h3>
            {weekOffset === 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black uppercase rounded-full border border-blue-100">
                <Calendar className="w-3 h-3" /> Current
              </span>
            )}
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {new Date(visibleDays[0].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — {new Date(visibleDays[6].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(prev => prev - 1)} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-all"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
          <button onClick={() => setWeekOffset(0)} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50 rounded-lg transition-all">Current Week</button>
          <button onClick={() => setWeekOffset(prev => prev + 1)} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-all"><ChevronRight className="w-5 h-5 text-gray-600" /></button>
        </div>
      </div>

      {/* GRID SECTION */}
      <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
        <div className="grid grid-cols-7 gap-4 min-w-[1000px]">
          {visibleDays.map((day) => (
            <DayColumn 
              key={day.date} 
              day={day} 
              isPast={day.date < todayStr} 
              isToday={day.date === todayStr}
              exams={exams}
              projects={projects}
              overrideLabel={capacityData.labels[day.date]}
              isOverride={day.date in capacityData.dateOverrides}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayColumn({ day, isPast, isToday, exams, projects, overrideLabel, isOverride }: { 
  day: DayPlan; 
  isPast: boolean; 
  isToday: boolean;
  exams: any[];
  projects: any[];
  overrideLabel?: string;
  isOverride: boolean;
}) {
  const dateObj = new Date(day.date + "T00:00:00");
  const dayName = dateObj.toLocaleDateString("en-GB", { weekday: "short" });
  const dayNum = dateObj.getDate();
  const isOverloaded = day.totalPlanned > day.baseCapacity;

  // 🎯 CRITICAL FIX: Improved matching logic for Exams/Projects
  const dayExams = (exams || []).filter(e => (e.date || e.due_date || "").slice(0, 10) === day.date);
  const dayProjects = (projects || []).filter(p => (p.due_date || p.date || "").slice(0, 10) === day.date);

  return (
    <div className={`flex flex-col gap-3 p-2 rounded-2xl border transition-all 
      ${isPast ? "opacity-30 grayscale-[0.4]" : "opacity-100"}
      ${isToday ? "bg-blue-50/30 border-blue-200 shadow-sm ring-1 ring-blue-100" : "border-transparent"}
    `}>
      
      {/* 🚩 EXCEPTION BAR */}
      <div className="h-6 flex items-center justify-center">
        {isOverride ? (
          <div className="w-full py-0.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-center gap-1 shadow-sm px-1 overflow-hidden">
            <span className="text-[7px] font-black text-amber-700 uppercase tracking-widest italic truncate">
              ⚠️ {overrideLabel || "Modified"}
            </span>
          </div>
        ) : day.baseCapacity === 0 ? (
          <div className="w-full py-0.5 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center">
            <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Rest</span>
          </div>
        ) : null}
      </div>

      <div className="text-center">
        <div className={`text-[10px] font-black uppercase tracking-widest ${isToday ? "text-blue-600" : "text-gray-400"}`}>
          {dayName}
        </div>
        <div className={`text-2xl font-black ${isToday ? "text-blue-600" : isOverloaded ? "text-red-500" : "text-gray-900"}`}>
          {dayNum}
        </div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200/50 overflow-hidden">
          <div
            className={`h-full transition-all duration-700 ${isOverloaded ? "bg-red-500" : "bg-blue-500"}`}
            style={{ width: `${Math.min(100, (day.totalPlanned / (day.baseCapacity || 1)) * 100)}%` }}
          />
        </div>
      </div>

      {/* EXAMS & PROJECTS DISPLAY */}
      {(dayExams.length > 0 || dayProjects.length > 0) && (
        <div className="flex flex-col gap-1 px-1 mt-1">
          {dayExams.map((exam, i) => (
            <div 
              key={i} 
              className={`px-2 py-1 rounded-[6px] text-[8px] font-black uppercase shadow-sm flex items-center gap-1 text-white
                ${exam.exam_type === 'Competitive' ? 'bg-purple-600' : 'bg-amber-500'}`}
            >
              <Crown className="w-2.5 h-2.5" /> 
              <span className="truncate">{exam.subject}</span>
            </div>
          ))}
          {dayProjects.map((proj, i) => (
            <div key={i} className="px-2 py-1 rounded-[6px] bg-blue-600 text-white text-[8px] font-black uppercase shadow-sm flex items-center gap-1">
              <Star className="w-2.5 h-2.5" /> <span className="truncate">{proj.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* TASK LIST */}
      <div className="flex flex-col gap-2 mt-1">
        {day.weekly.items.map((item) => <TaskBlock key={`w-${item.id}`} label={item.name} minutes={item.minutes} type="Weekly" color="indigo" />)}
        {day.homework.items.map((item) => <TaskBlock key={`h-${item.id}`} label={item.name} minutes={item.minutes} type="Hwk" subject={item.subject} color="emerald" />)}
        {day.revision.items.map((item, i) => (
          <TaskBlock key={`rev-${item.id || i}`} label={item.label || item.name || "Revision"} minutes={item.minutes} type="Rev" subject={item.subject} color="amber" /> 
        ))}
        {day.projects.items.map((p) => <TaskBlock key={`p-${p.projectId}`} label={p.name} minutes={p.minutes} type="Proj" subject={p.subject} color="sky" />)}
        
        {day.totalPlanned === 0 && dayExams.length === 0 && dayProjects.length === 0 && (
          <div className="py-12 text-center text-[9px] font-black uppercase tracking-tighter text-gray-300 border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50">
            Empty
          </div>
        )}
      </div>
    </div>
  );
}

function TaskBlock({ label, minutes, type, color, subject }: any) {
  const colors: any = {
    indigo: "bg-indigo-50/50 border-indigo-100 text-indigo-700",
    emerald: "bg-emerald-50/50 border-emerald-100 text-emerald-700",
    amber: "bg-amber-50/50 border-amber-100 text-amber-700",
    sky: "bg-sky-50/50 border-sky-100 text-sky-700",
  };

  return (
    <div className={`group rounded-xl border p-2.5 shadow-sm bg-white transition-all hover:scale-[1.02] ${colors[color] || colors.indigo}`}>
      <div className="flex flex-wrap gap-1 mb-1">
        <span className="text-[7px] font-black uppercase px-1 rounded bg-white/80">{type}</span>
        {subject && <span className="text-[7px] font-black uppercase px-1 rounded bg-blue-600 text-white truncate max-w-[40px]">{subject}</span>}
      </div>
      <div className="text-[11px] font-bold leading-tight line-clamp-2 mb-1 text-gray-800 tracking-tight">{label}</div>
      <div className="text-[9px] font-black opacity-60 uppercase tracking-tighter">{minutes}m</div>
    </div>
  );
}