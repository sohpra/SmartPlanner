"use client";

import { ReactNode } from "react";

interface LayoutReplitProps {
  children: ReactNode;
}

export function LayoutReplit({ children }: LayoutReplitProps) {
  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-gray-200 sticky top-0 h-auto md:h-screen">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-blue-100 p-2 rounded-lg">🎓</div>
            <h1 className="text-xl font-bold tracking-tight">
              SmartPlanner
            </h1>
          </div>

          <nav className="space-y-2 text-sm">
            <div className="px-4 py-3 rounded-xl bg-blue-600 text-white font-medium">
              Dashboard
            </div>
            <div className="px-4 py-3 rounded-xl text-gray-500">
              Calendar
            </div>
            <div className="px-4 py-3 rounded-xl text-gray-500">
              Exams
            </div>
            <div className="px-4 py-3 rounded-xl text-gray-500">
              Weekly Tasks
            </div>
            <div className="px-4 py-3 rounded-xl text-gray-500">
              Generator
            </div>
          </nav>
        </div>

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
