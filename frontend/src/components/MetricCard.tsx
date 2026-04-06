import type { LucideIcon } from 'lucide-react';

export interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  /** Optional background color class (e.g., 'bg-primary/10') */
  bgColor?: string;
  /** Optional icon color class (e.g., 'text-primary') */
  iconColor?: string;
}

export default function MetricCard({
  title,
  value,
  icon: Icon,
  bgColor = 'bg-slate-100',
  iconColor = 'text-slate-600',
}: MetricCardProps) {
  return (
    <div className="card p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`rounded-xl p-2.5 shrink-0 ${bgColor}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}
