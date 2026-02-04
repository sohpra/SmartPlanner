"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { AddTaskModal } from "../components/tasks/AddTaskModal";
import { useWeeklyTasks } from "@/hooks/use-weekly-tasks";
import { useProjects } from "@/hooks/use-projects";
import { useDeadlineTasks } from "@/hooks/use-deadline-tasks";
import { 
  Trash2, Plus, Repeat, Calendar, Rocket, Clock, 
  ChevronDown, ChevronRight 
} from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SORTED_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function TasksPage() {
  const [openAddTask, setOpenAddTask] = useState(false);
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({});

  const { tasks: weeklyFromHook } = useWeeklyTasks();
  const { tasks: deadlineFromHook } = useDeadlineTasks();
  const { projects: projectsFromHook } = useProjects();

  const [weeklyTasks, setWeeklyTasks] = useState(weeklyFromHook);
  const [deadlineTasks, setDeadlineTasks] = useState(deadlineFromHook);
  const [projects, setProjects] = useState(projectsFromHook);

  useEffect(() => { setWeeklyTasks(weeklyFromHook); }, [weeklyFromHook]);
  
  //useEffect(() => { setDeadlineTasks(deadlineFromHook); }, [deadlineFromHook]);
  // Filter strictly for active tasks
  useEffect(() => { 
    // Only show tasks that are NOT completed in the Register
    const activeOnly = (deadlineFromHook || []).filter(t => t.status === 'active');
    setDeadlineTasks(activeOnly); 
  }, [deadlineFromHook]);

  //useEffect(() => { setProjects(projectsFromHook); }, [projectsFromHook]);
  // Filter for active projects
  useEffect(() => { 
    const activeProjects = (projectsFromHook || []).filter(p => p.status === 'active' || !p.status);
    setProjects(activeProjects); 
  }, [projectsFromHook]);

  // Grouping Weekly Tasks by Day
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
    <div className="max-w-6xl mx-auto p-4 md:p-10 space-y-12 pb-20 animate-in fade-in duration-500">
      
      {/* 📋 Header: The Masterplan Style */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-gray-100 pb-10">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mb-1">
            Inventory 
          </p>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter italic text-balance">Task Register</h1>

        </div>
        <button
          onClick={() => setOpenAddTask(true)}
          className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-8 py-4 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-600 transition-all shadow-xl active:scale-95"
        >
          <Plus className="w-4 h-4" /> Add Task
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* ⬅️ LEFT COLUMN: Homework & Projects */}
        <div className="lg:col-span-7 space-y-12">
          
          {/* 1. Homework and Assignments */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-xl"><Calendar className="w-4 h-4 text-blue-600" /></div>
              <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Homework</h2>
            </div>
            <div className="space-y-4">
              {deadlineTasks.map((task) => (
                <div key={task.id} className="group flex items-center justify-between p-6 bg-white border-2 border-slate-100 rounded-[2rem] hover:border-blue-500/20 transition-all">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="text-xl font-black italic tracking-tight text-slate-800">{task.name}</div>
                      {task.subject && (
                        <span className="text-[9px] font-black uppercase tracking-widest bg-blue-100 text-blue-600 px-2 py-0.5 rounded-lg">
                          {task.subject}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-slate-400 pt-1 text-[9px] font-black uppercase tracking-widest">
                      <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> {task.estimated_minutes}m</div>
                      <div className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                        Due {new Date(task.due_date).toLocaleDateString("en-GB", { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => deleteRow("deadline_tasks", task.id)} className="p-2 text-slate-200 hover:text-red-500 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* 2. Strategic Projects (THE MISSING PIECE) */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sky-50 rounded-xl"><Rocket className="w-4 h-4 text-sky-600" /></div>
              <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Projects</h2>
            </div>
            <div className="space-y-4">
              {projects.map((project) => (
                <div key={project.id} className="group flex items-center justify-between p-6 bg-white border-2 border-slate-100 rounded-[2rem] hover:border-sky-500/20 transition-all">
                  <div className="space-y-1">
                    <div className="text-xl font-black italic tracking-tight text-slate-800">
                      {project.name}
                    </div>
                    <div className="flex items-center gap-3 text-slate-400 pt-1 text-[9px] font-black uppercase tracking-widest">
                      <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> {project.estimated_minutes}m</div>
                      <div className="text-sky-600 font-bold italic lowercase opacity-80">
                        // active_initiative
                      </div>
                    </div>
                  </div>
                  <button onClick={() => deleteRow("projects", project.id)} className="p-2 text-slate-200 hover:text-red-500 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {projects.length === 0 && (
                <div className="p-8 border-2 border-dashed border-slate-100 rounded-[2rem] text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">No active strategic projects</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ➡️ RIGHT COLUMN: Weekly Routine (Collapsible & Monday Start) */}
        <aside className="lg:col-span-5">
          <div className="bg-gray-50/50 rounded-[2.5rem] p-8 border border-gray-100 sticky top-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-indigo-50 rounded-xl"><Repeat className="w-4 h-4 text-indigo-600" /></div>
              <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Weekly Routine</h2>
            </div>

            <div className="space-y-6">
              {SORTED_DAYS.map((day) => {
                const dayTasks = groupedWeekly[day] || [];
                if (dayTasks.length === 0) return null;
                const isCollapsed = collapsedDays[day];

                return (
                  <div key={day} className="space-y-3">
                    <button 
                      onClick={() => toggleDay(day)}
                      className="flex items-center justify-between w-full group"
                    >
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 italic">{day}</h3>
                      <div className="h-[1px] flex-grow mx-4 bg-indigo-100" />
                      {isCollapsed ? <ChevronRight className="w-3 h-3 text-indigo-300" /> : <ChevronDown className="w-3 h-3 text-indigo-300" />}
                    </button>

                    {!isCollapsed && (
                      <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                        {dayTasks.map((task) => (
                          <div key={task.id} className="group flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:shadow-lg transition-all">
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-bold text-slate-900">{task.name}</div>
                                {task.task_type && task.task_type !== "Regular Study Slot" && (
                                  <span className="text-[8px] font-black uppercase text-indigo-400 border border-indigo-100 px-1.5 rounded">{task.task_type}</span>
                                )}
                              </div>
                              <div className="text-[9px] font-black text-slate-400 uppercase mt-0.5 tracking-widest">{task.duration_minutes}M</div>
                            </div>
                            <button onClick={() => deleteRow("recurring_tasks", task.id)} className="opacity-0 group-hover:opacity-100 p-2 text-gray-200 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
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