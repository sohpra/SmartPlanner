"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardList, GraduationCap, LogOut } from "lucide-react";


export function MobileNav() {
  const pathname = usePathname();

  const navItems = [
    { label: "Plan", href: "/planner", icon: LayoutDashboard },
    { label: "Tasks", href: "/tasks", icon: ClipboardList },
    { label: "Exams", href: "/exams", icon: GraduationCap },
    { label: "Logout", href: "/settings", icon: LogOut },
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
      </div>
    </nav>
  );
}