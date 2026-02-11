"use client";

import { addDays } from "@/lib/planner/revisionEngine";

interface ComingUpProps {
  exams: any[];
  projects: any[];
}

export function ComingUp({ exams, projects = [] }: ComingUpProps) {
  const today = new Date().toISOString().slice(0, 10);
  // 🎯 Removed 'tomorrow' as a filter constraint to allow all upcoming items

  const upcomingMilestones = [
    ...(exams || []).map(e => {
      let displayName = `${e.subject} Exam`;
      
      if (e.exam_type === 'Competitive' && e.competitive_exam_name) {
        displayName = e.competitive_exam_name;
      } else if (e.exam_type === 'Board' && e.exam_board) {
        displayName = `${e.subject} (${e.exam_board})`;
      }

      return { 
        name: displayName, 
        date: e.date.slice(0, 10), 
        type: 'Exam', 
        subject: e.subject 
      };
    }),
    ...(projects || []).map(p => ({ 
      name: p.name, 
      date: p.due_date, 
      type: 'Project', 
      subject: p.subject 
    }))
  ]
  // 🎯 THE FIX: Changed to >= today to include today and tomorrow
  .filter(event => event.date >= today)
  .sort((a, b) => a.date.localeCompare(b.date))
  .slice(0, 4);

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter italic">
            Coming Up
          </h3>
        </div>
      </div>
      
      <div className="space-y-3">
        {upcomingMilestones.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-slate-50 rounded-3xl">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 italic">No major milestones</p>
          </div>
        ) : (
          upcomingMilestones.map((event, idx) => {
            const diff = Math.ceil(
              (new Date(event.date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) 
              / (1000 * 60 * 60 * 24)
            );

            // 🎯 NEW: Urgency detection
            const isTomorrow = diff === 1;
            const isToday = diff === 0;

            return (
              <div key={idx} className={`p-4 rounded-2xl border transition-all hover:border-blue-200 group ${
                isToday || isTomorrow ? 'bg-red-50/30 border-red-100' : 'bg-white border-slate-100 shadow-sm'
              }`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                       { (isToday || isTomorrow) && <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> }
                       <h4 className={`text-sm font-black leading-tight italic tracking-tight ${
                         isToday || isTomorrow ? 'text-red-900' : 'text-slate-800'
                       }`}>
                         {event.name}
                       </h4>
                    </div>
                    {event.subject && (
                      <div className="flex items-center gap-2">
                        <span className={`text-[8px] font-black uppercase tracking-tighter ${
                          isToday || isTomorrow ? 'text-red-600' : 'text-blue-600'
                        }`}>
                          {event.subject}
                        </span>
                        <span className="h-0.5 w-0.5 rounded-full bg-slate-200" />
                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">
                          {event.type}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-col items-end">
                    <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase border shadow-sm ${
                      isToday ? 'bg-red-600 text-white border-red-700' :
                      isTomorrow ? 'bg-red-50 text-red-600 border-red-100' :
                      'bg-blue-50 text-blue-600 border-blue-100'
                    }`}>
                      {isToday ? 'TODAY' : isTomorrow ? 'TOMORROW' : `In ${diff}d`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}