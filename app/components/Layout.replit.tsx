"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { 
  LayoutDashboard, 
  Calendar, 
  BookOpen, 
  CheckSquare, 
  Zap, 
  User 
} from "lucide-react";

interface LayoutReplitProps {
  children: ReactNode;
}

const navItems = [
  { href: "/planner", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
  { href: "/planner?view=weekly", label: "Weekly View", icon: <Calendar className="w-4 h-4" /> },
  { href: "/planner?view=monthly", label: "Strategic Month", icon: <Zap className="w-4 h-4" /> },
  { href: "/exams", label: "My Exams", icon: <BookOpen className="w-4 h-4" /> },
  { href: "/tasks", label: "Task List", icon: <CheckSquare className="w-4 h-4" /> },
];

export function LayoutReplit({ children }: LayoutReplitProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view");

  // Don't show sidebar on login or home landing
  const isAuthPage = pathname === "/login" || pathname === "/";
  if (isAuthPage) return <>{children}</>;

  return (
    <div className="flex h-screen bg-[#FDFDFD] overflow-hidden">
      {/* 🧭 Professional Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col hidden md:flex">
        <div className="p-8">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 mb-10 group cursor-pointer">
            <div className="bg-blue-600 p-2.5 rounded-2xl shadow-lg shadow-blue-200 rotate-3 group-hover:rotate-0 transition-transform">
              <Zap className="w-5 h-5 text-white fill-current" />
            </div>
            <h1 className="text-xl font-black tracking-tighter italic text-slate-900">
              STUDY<span className="text-blue-600">.OS</span>
            </h1>
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              // Check if current URL matches the item's href exactly, 
              // or matches the specific 'view' query param
              const isActive = (pathname + (searchParams.toString() ? `?view=${currentView}` : "")) === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all
                    ${isActive
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-200" 
                        : "text-slate-400 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Badge */}
        <div className="mt-auto p-6 border-t border-gray-50 flex items-center gap-3 bg-gray-50/50">
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
            <User className="w-4 h-4 text-slate-500" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">Demo User</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase">Pro Plan</span>
          </div>
        </div>
      </aside>

      {/* 🖥️ Main Viewport */}
      <main className="flex-1 overflow-y-auto h-screen custom-scrollbar">
        <div className="max-w-7xl mx-auto p-6 md:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}