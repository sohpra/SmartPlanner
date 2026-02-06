"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { AddTaskModal } from "../components/tasks/AddTaskModal";
import { useWeeklyTasks } from "@/hooks/use-weekly-tasks";
import { useProjects } from "@/hooks/use-projects";
import { useDeadlineTasks } from "@/hooks/use-deadline-tasks";
import { 
  Trash2, Plus, Repeat, Calendar, Rocket, Clock, 
  ChevronDown, ChevronRight , CheckCircle2
} from "lucide-react";


const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SORTED_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

async function completeTask(task: any) {
  if (!confirm(`Mark "${task.name}" as done today?`)) return;

  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // 1. Mark as completed in the main registry
  const { error: updateErr } = await supabase
    .from("deadline_tasks")
    .update({ status: 'completed' })
    .eq("id", task.id);

  if (updateErr) return alert(updateErr.message);

  // 2. Log it as a completion for TODAY
  await supabase.from("daily_completions").insert([{
    user_id: user.id,
    source_id: task.id,
    source_type: 'deadline_task',
    date: todayStr,
    task_name: task.name
  }]);

  window.location.reload();
}

export default function TasksPage() {
  const [openAddTask, setOpenAddTask] = useState(false);
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({});

  const { tasks: weeklyFromHook } = useWeeklyTasks();
  const { tasks: deadlineFromHook } = useDeadlineTasks();
  const { projects: projectsFromHook } = useProjects();

  const [weeklyTasks, setWeeklyTasks] = useState(weeklyFromHook);
  const [deadlineTasks, setDeadlineTasks] = useState(deadlineFromHook);
  const [projects, setProjects] = useState(projectsFromHook);

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => { setWeeklyTasks(weeklyFromHook); }, [weeklyFromHook]);
  
  useEffect(() => { 
    const activeOnly = (deadlineFromHook || []).filter(t => t.status === 'active');
    setDeadlineTasks(activeOnly); 
  }, [deadlineFromHook]);

  useEffect(() => { 
    const activeProjects = (projectsFromHook || []).filter(p => p.status === 'active' || !p.status);
    setProjects(activeProjects); 
  }, [projectsFromHook]);

  const groupedWeekly = weeklyTasks.reduce((acc, task: any) => {
    const dayName = DAYS[task.day_of_week];
    if (!acc[dayName]) acc[dayName] = [];
    acc[dayName].push(task);
    return acc;
  }, {} as Record<string, any[]>);

  const toggleDay = (day: string) => {
    setCollapsedDays(prev => ({ ...prev, [day]: !prev[day] }));
  };

  async function deleteRow(table: "recurring_tasks" | "deadline_tasks" | "projects", id: string) {
    if (!confirm("Remove from registry?")) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (!error) window.location.reload();
  }


  return (

    
    <div className="max-w-6xl mx-auto p-4 md:p-10 space-y-8 md:space-y-12 pb-24 animate-in fade-in duration-500">
      
      {/* 📋 Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 border-b border-gray-100 pb-6 md:pb-10">
        <div>
          <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mb-1">
            Inventory 
          </p>
          <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter italic">Task Register</h1>
        </div>
        <button
          onClick={() => setOpenAddTask(true)}
          className="flex items-center justify-center gap-2 rounded-xl md:rounded-2xl bg-slate-900 px-6 py-3 md:px-8 md:py-4 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-600 transition-all shadow-xl active:scale-95 w-full md:w-auto"
        >
          <Plus className="w-4 h-4" /> Add Task
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-10">
        
        {/* ⬅️ LEFT COLUMN: Homework & Projects */}
        <div className="lg:col-span-7 space-y-8 md:space-y-12">
          
          {/* 1. Homework */}
          <section className="space-y-4 md:space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-blue-50 rounded-lg"><Calendar className="w-3.5 h-3.5 text-blue-600" /></div>
              <h2 className="text-[9px] md:text-[11px] font-black uppercase tracking-widest text-slate-400">Homework</h2>
            </div>
            <div className="space-y-3 md:space-y-4">
              {deadlineTasks.map((task) => {
                // 🎯 STEP 1: Calculate overdue status here for this specific task
                const isOverdue = task.due_date < todayStr;

                return (
                  <div 
                    key={task.id} 
                    className={`group flex items-center justify-between p-4 md:p-6 bg-white border-2 rounded-[1.5rem] md:rounded-[2rem] transition-all ${
                      isOverdue ? "border-red-100 bg-red-50/10" : "border-slate-100 hover:border-blue-500/20"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className={`text-lg md:text-xl font-black italic tracking-tight ${isOverdue ? "text-red-700" : "text-slate-800"}`}>
                          {task.name}
                        </div>
                        
                        {/* 🎯 STEP 2: The Overdue Badge */}
                        {isOverdue && (
                          <span className="text-[7px] md:text-[9px] font-black uppercase tracking-widest bg-red-600 text-white px-2 py-0.5 rounded-md animate-pulse">
                            Overdue
                          </span>
                        )}

                        {task.subject && (
                          <span className={`text-[7px] md:text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md md:rounded-lg ${
                            isOverdue ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-600"
                          }`}>
                            {task.subject}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 md:gap-3 text-slate-400 text-[8px] md:text-[9px] font-black uppercase tracking-widest">
                        <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> {task.estimated_minutes}m</div>
                        
                        {/* 🎯 STEP 3: The Date Chip (turns red if overdue) */}
                        <div className={`px-2 py-0.5 rounded-md border ${
                          isOverdue ? "bg-red-50 border-red-200 text-red-600" : "bg-slate-50 border-slate-100 text-slate-400"
                        }`}>
                          Due {new Date(task.due_date).toLocaleDateString("en-GB", { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 md:gap-2">
                      <button 
                        onClick={() => completeTask(task)} 
                        className="p-2 text-slate-200 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                        title="Mark Done Today"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>

                      <button onClick={() => deleteRow("deadline_tasks", task.id)} className="p-2 text-slate-200 hover:text-red-500 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 2. Projects */}
          <section className="space-y-4 md:space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-sky-50 rounded-lg"><Rocket className="w-3.5 h-3.5 text-sky-600" /></div>
              <h2 className="text-[9px] md:text-[11px] font-black uppercase tracking-widest text-slate-400">Projects</h2>
            </div>
            <div className="space-y-3 md:space-y-4">
              {projects.map((project) => (
                <div key={project.id} className="group flex items-center justify-between p-4 md:p-6 bg-white border-2 border-slate-100 rounded-[1.5rem] md:rounded-[2rem] hover:border-sky-500/20 transition-all">
                  <div className="space-y-1">
                    <div className="text-lg md:text-xl font-black italic tracking-tight text-slate-800">{project.name}</div>
                    <div className="flex items-center gap-2 text-slate-400 text-[8px] md:text-[9px] font-black uppercase tracking-widest italic lowercase opacity-80">
                      // active_initiative • {project.estimated_minutes}m
                    </div>
                  </div>
                  <button onClick={() => deleteRow("projects", project.id)} className="p-2 text-slate-200 hover:text-red-500 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ➡️ RIGHT COLUMN: Weekly Routine */}
        <aside className="lg:col-span-5">
          <div className="bg-gray-50/50 rounded-[2rem] md:rounded-[2.5rem] p-5 md:p-8 border border-gray-100 md:sticky md:top-8">
            <div className="flex items-center gap-3 mb-6 md:mb-8">
              <div className="p-1.5 bg-indigo-50 rounded-lg"><Repeat className="w-3.5 h-3.5 text-indigo-600" /></div>
              <h2 className="text-[9px] md:text-[11px] font-black uppercase tracking-widest text-slate-400">Weekly Routine</h2>
            </div>

            <div className="space-y-4 md:space-y-6">
              {SORTED_DAYS.map((day) => {
                const dayTasks = groupedWeekly[day] || [];
                if (dayTasks.length === 0) return null;
                const isCollapsed = collapsedDays[day];

                return (
                  <div key={day} className="space-y-2 md:space-y-3">
                    <button onClick={() => toggleDay(day)} className="flex items-center justify-between w-full">
                      <h3 className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-indigo-500 italic">{day}</h3>
                      <div className="h-[1px] flex-grow mx-3 bg-indigo-100" />
                      {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                    </button>

                    {!isCollapsed && (
                      <div className="space-y-2">
                        {dayTasks.map((task) => (
                          <div key={task.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl">
                            <div>
                              <div className="text-xs md:text-sm font-bold text-slate-900">{task.name}</div>
                              <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{task.duration_minutes}M</div>
                            </div>
                            <button onClick={() => deleteRow("recurring_tasks", task.id)} className="p-2 text-gray-200 hover:text-red-500"><Trash2 size={14} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      <AddTaskModal open={openAddTask} onClose={() => setOpenAddTask(false)} />
    </div>
  );
}