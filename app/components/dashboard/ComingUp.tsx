"use client";

import { addDays } from "@/lib/planner/revisionEngine";

interface ComingUpProps {
  exams: any[];
  projects: any[];
}

export function ComingUp({ exams, projects = [] }: ComingUpProps) {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = addDays(today, 1);

  const upcomingMilestones = [
    ...(exams || []).map(e => {
      // 🎯 THE FIX: Check for Competitive Name or Board before generic subject
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
  .filter(event => event.date > tomorrow)
  .sort((a, b) => a.date.localeCompare(b.date))
  .slice(0, 4);

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 italic">
        Upcoming Milestones
      </h3>
      
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

            return (
              <div key={idx} className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm transition-all hover:border-blue-200 group">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                       <h4 className="text-sm font-black text-slate-800 leading-tight italic tracking-tight">
                         {event.name}
                       </h4>
                    </div>
                    {event.subject && (
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black text-blue-600 uppercase tracking-tighter">
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
                    <span className="text-[9px] font-black px-2.5 py-1 rounded-lg uppercase bg-blue-50 text-blue-600 border border-blue-100 shadow-sm">
                      In {diff}d
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