"use client";

import { DayPlan } from "@/lib/planner/buildWeekPlan";

export function TomorrowChecklist({ day }: { day: DayPlan }) {
  // Aggregate all items for tomorrow into a single styled list
  const tomorrowItems = [
    ...day.homework.items.map(i => ({ ...i, category: 'Homework' })),
    ...day.weekly.items.map(i => ({ ...i, category: 'Weekly' })),
    ...day.revision.slots.map(s => ({ 
      name: s.label, 
      minutes: s.slotMinutes, 
      subject: s.subject, 
      category: 'Revision' 
    }))
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-black text-gray-900 tracking-tight">Tomorrow</h3>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          {new Date(day.date + "T00:00:00").toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
        </span>
      </div>

      <div className="space-y-3">
        {tomorrowItems.length === 0 ? (
          <div className="text-center py-6 border-2 border-dashed border-gray-100 rounded-xl">
            <p className="text-xs text-gray-400 font-medium italic">Nothing scheduled yet</p>
          </div>
        ) : (
          tomorrowItems.map((item, idx) => (
            <div key={idx} className="p-4 bg-gray-50/50 rounded-xl border border-gray-100 transition-hover hover:border-blue-100">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-sm font-bold text-gray-700 leading-tight">
                  {item.name}
                </p>
                {item.subject && (
                  <span className="shrink-0 text-[8px] font-black text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded uppercase">
                    {item.subject}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">
                  {item.minutes} mins
                </span>
                <span className="h-1 w-1 rounded-full bg-gray-200" />
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">
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