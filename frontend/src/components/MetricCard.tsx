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
  bgColor = 'bg-primary/5',
  iconColor = 'text-primary',
}: MetricCardProps) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted">{title}</p>
          <p className="mt-1 text-2xl font-bold text-text">{value}</p>
        </div>
        <div className={`rounded-lg p-2 ${bgColor}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}
