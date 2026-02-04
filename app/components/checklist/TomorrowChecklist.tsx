"use client";

import { DayPlan } from "@/lib/planner/buildWeekPlan";

export function TomorrowChecklist({ day }: { day: DayPlan }) {
  // Aggregate all items for tomorrow into a single styled list
  const tomorrowItems = [
    ...day.homework.items.map(i => ({ ...i, category: 'Homework' })),
    ...day.weekly.items.map(i => ({ ...i, category: 'Weekly' })),
    ...day.revision.slots.map(s => {
      // 🎯 LOGIC: If it's a competitive exam, use the specific name as the primary title
      // We assume s.exam contains the metadata from the join
      const isCompetitive = s.exam?.exam_type === 'Competitive' || s.exam?.exam_type === 'Board';
      const specificName = s.exam?.competitive_exam_name || s.exam?.exam_board;
      
      return { 
        name: isCompetitive && specificName ? specificName : s.label, 
        minutes: s.slotMinutes, 
        subject: s.subject, 
        category: 'Revision' 
      };
    })
  ];

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 p-5 md:p-6 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-black text-gray-900 tracking-tight italic">Tomorrow</h3>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          {new Date(day.date + "T00:00:00").toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
        </span>
      </div>

      <div className="space-y-3">
        {tomorrowItems.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-slate-50 rounded-[1.5rem]">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 italic">Clear Schedule</p>
          </div>
        ) : (
          tomorrowItems.map((item, idx) => (
            <div key={idx} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 transition-all hover:border-blue-200 group">
              <div className="flex items-start justify-between gap-4 mb-1">
                <p className="text-sm font-black text-slate-800 leading-tight tracking-tight">
                  {item.name}
                </p>
                {item.subject && (
                  <span className="shrink-0 text-[8px] font-black text-blue-600 bg-white border border-blue-50 px-2 py-0.5 rounded-lg uppercase tracking-tighter shadow-sm">
                    {item.subject}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                    {item.minutes}m
                  </span>
                </div>
                <span className="h-1 w-1 rounded-full bg-slate-200" />
                <span className="text-[9px] font-black text-blue-400/60 uppercase tracking-widest italic">
                  {item.category}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}