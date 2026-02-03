"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { AddTaskModal } from "../components/tasks/AddTaskModal";
import { useWeeklyTasks } from "@/hooks/use-weekly-tasks";
import { useProjects } from "@/hooks/use-projects";
import { useDeadlineTasks } from "@/hooks/use-deadline-tasks";
import { Trash2, Plus, Repeat, Calendar, Rocket, Clock } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function TasksPage() {
  const [openAddTask, setOpenAddTask] = useState(false);

  // 1. Data Hooks
  const { tasks: weeklyFromHook, isLoading: weeklyLoading } = useWeeklyTasks();
  const { tasks: deadlineFromHook, isLoading: deadlineLoading } = useDeadlineTasks();
  const { projects: projectsFromHook, isLoading: projectsLoading } = useProjects();

  // 2. Local State for Optimistic UI
  const [weeklyTasks, setWeeklyTasks] = useState(weeklyFromHook);
  const [deadlineTasks, setDeadlineTasks] = useState(deadlineFromHook);
  const [projects, setProjects] = useState(projectsFromHook);

  useEffect(() => { setWeeklyTasks(weeklyFromHook); }, [weeklyFromHook]);
  useEffect(() => { setDeadlineTasks(deadlineFromHook); }, [deadlineFromHook]);
  useEffect(() => { setProjects(projectsFromHook); }, [projectsFromHook]);

  const loading = weeklyLoading || deadlineLoading || projectsLoading;

  async function deleteRow(table: "recurring_tasks" | "deadline_tasks" | "projects", id: string) {
    if (!confirm("Remove this objective from the registry?")) return;
    
    if (table === "recurring_tasks") setWeeklyTasks(t => t.filter(x => x.id !== id));
    if (table === "deadline_tasks") setDeadlineTasks(t => t.filter(x => x.id !== id));
    if (table === "projects") setProjects(t => t.filter(x => x.id !== id));

    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) {
      alert(error.message);
      window.location.reload(); 
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-10 space-y-12 pb-20 animate-in fade-in duration-500">
      
      {/* 📋 Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-gray-100 pb-10">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mb-1">Operational Inventory</p>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter italic">Task Registry</h1>
        </div>
        <button
          onClick={() => setOpenAddTask(true)}
          className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-8 py-4 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-600 transition-all shadow-xl shadow-slate-200 active:scale-95"
        >
          <Plus className="w-4 h-4" /> Add Task
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* ⬅️ LEFT COLUMN (7/12): PRIMARY (Homework & Projects) */}
        <div className="lg:col-span-7 space-y-12">
          
          {/* Homework & Deadlines Section */}
          <section className="space-y-6">
            {/* ⬅️ LEFT COLUMN: HOMEWORK & DEADLINES */}
            <div className="space-y-4">
              {deadlineTasks.map((task) => (
                <div key={task.id} className="group flex items-center justify-between p-6 bg-white border-2 border-slate-100 rounded-[2rem] hover:border-blue-500/20 hover:bg-blue-50/5 transition-all duration-300">
                  <div className="space-y-1">
                    {/* 🎯 TONED DOWN: Sentence Case, slightly smaller, still bold italic */}
                    <div className="text-xl font-black italic tracking-tight text-slate-800 leading-tight">
                      {task.name}
                    </div>
                    
                    <div className="flex items-center gap-3 text-slate-400 pt-1">
                      <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest opacity-70">
                        <Clock className="w-3 h-3" /> {task.estimated_minutes}m
                      </div>
                      <div className="text-[9px] font-black uppercase tracking-widest bg-slate-50 text-slate-500 px-2.5 py-1 rounded-lg border border-slate-100">
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

          {/* Long-term Projects Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sky-50 rounded-xl"><Rocket className="w-4 h-4 text-sky-600" /></div>
              <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Strategic Projects</h2>
            </div>
            <div className="space-y-3">
              {projects.map((project) => (
                <div key={project.id} className="group flex items-center justify-between p-6 bg-white border-2 border-slate-50 rounded-[2rem] hover:border-sky-200 hover:bg-sky-50/30 transition-all">
                  <div className="text-xl font-black italic tracking-tighter uppercase text-slate-900">
                    {project.name}
                  </div>
                  <button onClick={() => deleteRow("projects", project.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-200 hover:text-red-500 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ➡️ RIGHT COLUMN (5/12): SECONDARY (Weekly Routine) */}
        <aside className="lg:col-span-5">
          <div className="bg-gray-50/50 rounded-[2.5rem] p-8 border border-gray-100 sticky top-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-indigo-50 rounded-xl"><Repeat className="w-4 h-4 text-indigo-600" /></div>
              <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Weekly Routine</h2>
            </div>
            <div className="space-y-3">
              {weeklyTasks.map((task) => (
                <div key={task.id} className="group flex items-center justify-between p-5 bg-white border border-gray-100 rounded-2xl hover:shadow-lg transition-all">
                  <div>
                    <div className="text-sm font-bold text-slate-900 tracking-tight">{task.name}</div>
                    <div className="text-[9px] font-black text-indigo-500 uppercase mt-1 tracking-widest opacity-70">
                      {DAYS[task.day_of_week]} • {task.duration_minutes}M
                    </div>
                  </div>
                  <button onClick={() => deleteRow("recurring_tasks", task.id)} className="opacity-0 group-hover:opacity-100 p-2 text-gray-200 hover:text-red-500 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <AddTaskModal open={openAddTask} onClose={() => setOpenAddTask(false)} />
    </div>
  );
}