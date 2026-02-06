"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { 
  LayoutDashboard, 
  ClipboardList, 
  GraduationCap, 
  Settings2, 
  LogOut, 
  Zap 
} from "lucide-react";

export default function LayoutReplit({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    };
    getUser();
  }, []);

  const navItems = [
    { name: "Planner", href: "/planner", icon: LayoutDashboard },
    { name: "Tasks", href: "/tasks", icon: ClipboardList },
    { name: "Exams", href: "/exams", icon: GraduationCap },
    { name: "Settings", href: "/settings", icon: Settings2 },
];

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* 🛠️ SIDEBAR - Hidden on mobile, flex on desktop (md:) */}
      <aside className="hidden md:flex w-64 border-r border-slate-100 flex-col bg-[#FDFDFD] shrink-0">
        {/* Logo Section */}
        <div className="p-8">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl rotate-3 shadow-lg shadow-blue-100">
              <Zap className="w-5 h-5 text-white fill-current" /> 
            </div>
            <span className="text-xl font-black italic tracking-tighter text-slate-900">
              Plan <span className="text-blue-600">Bee</span>
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  isActive
                    ? "bg-slate-900 text-white shadow-xl shadow-slate-200"
                    : "text-slate-400 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <item.icon className={`w-4 h-4 ${isActive ? "text-blue-400" : ""}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* 👤 BOTTOM ACCOUNT SECTION */}
        <div className="mt-auto p-4 border-t border-slate-50">
          <div className="bg-slate-50/50 rounded-[2rem] p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-blue-600 font-black text-xs shadow-sm">
                {user?.email?.[0].toUpperCase() || "?"}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-black text-slate-900 truncate uppercase tracking-tighter">
                  {user?.email?.split('@')[0] || "Guest User"}
                </span>
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                  Session Active
                </span>
              </div>
            </div>
            
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/login";
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all border border-transparent hover:border-red-100"
            >
              <LogOut className="w-3.5 h-3.5" />
              Terminate
            </button>
          </div>
        </div>
      </aside>

      {/* 🚀 MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto bg-white relative">
        {children}
      </main>
    </div>
  );
}