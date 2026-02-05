type BadgeVariant = 'active' | 'inactive' | 'pending' | 'expired' | 'approved' | 'rejected';

const variantClasses: Record<BadgeVariant, string> = {
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  inactive: 'bg-gray-100 text-gray-800 border-gray-200',
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  expired: 'bg-red-100 text-red-800 border-red-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

/**
 * Status badge for ACTIVE / PENDING / EXPIRED (and document status).
 */
export default function Badge({ variant, children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-sm font-medium shrink-0 ${variantClasses[variant]} ${className}`.trim()}
    >
      {children}
    </span>
  );
}
