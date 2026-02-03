"use client";

interface ComingUpProps {
  deadlines: any[];
  exams: any[];
}

export function ComingUp({ deadlines, exams }: ComingUpProps) {
  // Combine and sort by date
  const events = [
    ...exams.map(e => ({ name: `${e.subject} Exam`, date: e.date, type: 'Exam', subject: e.subject })),
    ...deadlines.map(d => ({ name: d.name, date: d.due_date, type: 'Due', subject: d.subject }))
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 4);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Coming Up</h3>
      
      <div className="space-y-3">
        {events.map((event, idx) => {
          const diff = Math.ceil((new Date(event.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
          return (
            <div key={idx} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-white shadow-sm">
              <div>
                <p className="text-sm font-bold text-gray-800">{event.name}</p>
                {event.subject && <p className="text-[9px] font-bold text-blue-500 uppercase">{event.subject}</p>}
              </div>
              <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase ${diff <= 2 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                In {diff} {diff === 1 ? 'day' : 'days'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}