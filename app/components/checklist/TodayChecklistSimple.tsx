"use client";

type Task = { id: string; name: string; dueDate: string; minutes: number; };

type Props = {
  tasks: Task[];
  completedIds: Set<string>;
  onToggle: (id: string) => void;
};

export default function TodayChecklistSimple({ tasks, completedIds, onToggle }: Props) {
  return (
    <div className="grid gap-3">
      {tasks.map((task) => {
        const isDone = completedIds.has(task.id);

        return (
          <label
            key={task.id}
            className={`flex items-center justify-between rounded-xl border p-4 transition-all cursor-pointer hover:border-blue-200 active:scale-[0.98] ${
              isDone ? "bg-gray-50 opacity-60" : "bg-white shadow-sm"
            }`}
          >
            <div className="flex items-center gap-4">
              <input
                type="checkbox"
                checked={isDone}
                onChange={() => onToggle(task.id)}
                className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <div className="flex flex-col">
                <span className={`font-medium ${isDone ? "line-through text-gray-400" : "text-gray-900"}`}>
                  {task.name}
                </span>
                <span className="text-xs text-gray-500">{task.minutes} mins</span>
              </div>
            </div>

            <span className="text-xs font-medium px-2 py-1 bg-gray-100 rounded text-gray-600">
              {task.dueDate}
            </span>
          </label>
        );
      })}
    </div>
  );
}