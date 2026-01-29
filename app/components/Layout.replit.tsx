"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface LayoutReplitProps {
  children: ReactNode;
}

const navItems = [
  { href: "/planner", label: "Dashboard" },
  { href: "/calendar", label: "Calendar" },
  { href: "/exams", label: "Exams" },
  { href: "/weekly", label: "Weekly Tasks" },
  { href: "/generator", label: "Generator" },
];

export function LayoutReplit({ children }: LayoutReplitProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-gray-200 sticky top-0 h-auto md:h-screen">
        <div className="p-6">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-blue-100 p-2 rounded-lg">🎓</div>
            <h1 className="text-xl font-bold tracking-tight">
              SmartPlanner
            </h1>
          </div>

          {/* Navigation */}
          <nav className="space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-4 py-3 rounded-xl text-sm transition-colors
                    ${
                      isActive
                        ? "bg-blue-600 text-white font-medium"
                        : "text-gray-600 hover:bg-gray-100"
                    }
                  `}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Account placeholder */}
        <div className="mt-auto p-6 border-t border-gray-200 text-sm text-gray-600">
          demo@user
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto h-screen">
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
