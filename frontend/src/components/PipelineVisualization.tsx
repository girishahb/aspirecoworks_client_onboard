import type { DashboardStats } from '../services/admin';

export interface PipelineVisualizationProps {
  stats: DashboardStats;
}

/** Pipeline stages in order for visualization. */
const PIPELINE_STAGES = [
  { key: 'ADMIN_CREATED', label: 'Registration' },
  { key: 'PAYMENT_PENDING', label: 'Payment' },
  { key: 'PAYMENT_CONFIRMED', label: 'Payment' },
  { key: 'KYC_IN_PROGRESS', label: 'KYC' },
  { key: 'KYC_REVIEW', label: 'KYC' },
  { key: 'AGREEMENT_DRAFT_SHARED', label: 'Agreements' },
  { key: 'SIGNED_AGREEMENT_RECEIVED', label: 'Agreements' },
  { key: 'FINAL_AGREEMENT_SHARED', label: 'Agreements' },
  { key: 'ACTIVE', label: 'Active' },
] as const;

/** Group stages into pipeline buckets. */
const PIPELINE_BUCKETS = [
  {
    label: 'Registration',
    stages: ['ADMIN_CREATED'],
  },
  {
    label: 'Payment',
    stages: ['PAYMENT_PENDING', 'PAYMENT_CONFIRMED'],
  },
  {
    label: 'KYC',
    stages: ['KYC_IN_PROGRESS', 'KYC_REVIEW'],
  },
  {
    label: 'Agreements',
    stages: [
      'AGREEMENT_DRAFT_SHARED',
      'SIGNED_AGREEMENT_RECEIVED',
      'FINAL_AGREEMENT_SHARED',
    ],
  },
  {
    label: 'Active',
    stages: ['ACTIVE'],
  },
] as const;

export default function PipelineVisualization({ stats }: PipelineVisualizationProps) {
  const bucketCounts = PIPELINE_BUCKETS.map((bucket) => {
    const count = bucket.stages.reduce(
      (sum, stage) => sum + (stats.stageCounts[stage] || 0),
      0,
    );
    return { ...bucket, count };
  });

  return (
    <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-text">Onboarding Pipeline</h3>
      <div className="flex flex-wrap items-center gap-4 md:flex-nowrap">
        {bucketCounts.map((bucket, index) => (
          <div key={bucket.label} className="flex flex-1 flex-col items-center">
            {/* Connector line before (except first) */}
            {index > 0 && (
              <div className="hidden h-0.5 flex-1 bg-border md:block" />
            )}
            {/* Stage box */}
            <div className="flex w-full flex-col items-center rounded-lg border border-border bg-background p-3 md:w-auto md:min-w-[120px]">
              <p className="text-xs font-medium text-muted">{bucket.label}</p>
              <p className="mt-1 text-xl font-bold text-text">{bucket.count}</p>
            </div>
            {/* Connector line after (except last) */}
            {index < bucketCounts.length - 1 && (
              <div className="hidden h-0.5 flex-1 bg-border md:block" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
