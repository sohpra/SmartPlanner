"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, ClipboardList, GraduationCap, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase/client"; // Ensure this path is correct

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Redirect to landing or login
    router.push("/");
    router.refresh();
  };

  const navItems = [
    { label: "Plan", href: "/planner", icon: LayoutDashboard },
    { label: "Tasks", href: "/tasks", icon: ClipboardList },
    { label: "Exams", href: "/exams", icon: GraduationCap },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 block md:hidden bg-white/80 backdrop-blur-lg border-t border-gray-100 pb-safe">
      <div className="flex items-center justify-around h-16 px-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 transition-all ${
                isActive ? "text-blue-600" : "text-gray-400"
              }`}
            >
              <item.icon size={20} strokeWidth={isActive ? 3 : 2} />
              <span className="text-[10px] font-black uppercase tracking-widest">
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* 🎯 Logout Button (Separate from the Link loop) */}
        <button 
          onClick={handleLogout}
          className="flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-red-500 transition-all"
        >
          <LogOut size={20} strokeWidth={2} />
          <span className="text-[10px] font-black uppercase tracking-widest">
            Logout
          </span>
        </button>
      </div>
    </nav>
  );
}