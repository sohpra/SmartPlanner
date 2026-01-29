import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  color?: "primary" | "secondary" | "accent" | "green";
}

export function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  description, 
  trend,
  trendValue,
  color = "primary" 
}: StatCardProps) {
  
  const colors = {
    primary: "bg-blue-50 text-blue-600 border-blue-100",
    secondary: "bg-gray-50 text-gray-600 border-gray-100",
    accent: "bg-purple-50 text-purple-600 border-purple-100",
    green: "bg-green-50 text-green-600 border-green-100",
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-border/50 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h3 className="text-2xl font-bold mt-2 text-foreground tracking-tight">{value}</h3>
        </div>
        <div className={cn("p-3 rounded-xl border", colors[color])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {(description || trend) && (
        <div className="mt-4 flex items-center gap-2">
          {trend && (
            <span className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              trend === "up" ? "bg-green-100 text-green-700" : 
              trend === "down" ? "bg-red-100 text-red-700" : 
              "bg-gray-100 text-gray-700"
            )}>
              {trendValue}
            </span>
          )}
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      )}
    </div>
  );
}
