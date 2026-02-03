"use client";

import { addDays } from "@/lib/planner/revisionEngine";

interface ComingUpProps {
  exams: any[];
  projects: any[]; // Changed from 'deadlines'
}

export function ComingUp({ exams, projects = [] }: ComingUpProps) {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = addDays(today, 1);

  const upcomingMilestones = [
    ...(exams || []).map(e => ({ 
      name: `${e.subject} Exam`, 
      date: e.date.slice(0, 10), 
      type: 'Exam', 
      subject: e.subject 
    })),
    // Changed 'deadlines' to 'projects' here
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
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">
        Upcoming Milestones
      </h3>
      
      <div className="space-y-3">
        {upcomingMilestones.length === 0 ? (
          <div className="text-center py-6 border-2 border-dashed border-gray-100 rounded-xl">
            <p className="text-xs text-gray-400 font-medium italic">No major milestones ahead</p>
          </div>
        ) : (
          upcomingMilestones.map((event, idx) => {
            const diff = Math.ceil(
              (new Date(event.date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) 
              / (1000 * 60 * 60 * 24)
            );

            return (
              <div key={idx} className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm transition-colors hover:border-blue-100">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                       <p className="text-sm font-bold text-gray-800 leading-tight">{event.name}</p>
                       <span className="text-[7px] font-black text-gray-300 uppercase border border-gray-100 px-1 rounded">
                         {event.type}
                       </span>
                    </div>
                    {event.subject && (
                      <p className="text-[9px] font-black text-blue-500 uppercase">
                        {event.subject}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-[9px] font-black px-2 py-1 rounded-full uppercase bg-blue-50 text-blue-600">
                    In {diff} days
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}