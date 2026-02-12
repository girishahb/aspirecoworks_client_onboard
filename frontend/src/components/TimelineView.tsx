import { Check, Circle, Clock } from 'lucide-react';
import { getStepIndex } from '../onboardingSteps';

export interface TimelineViewProps {
  stage: string | null | undefined;
}

export default function TimelineView({ stage }: TimelineViewProps) {
  const steps = [
    { label: 'Registration Created', stages: ['ADMIN_CREATED'] },
    { label: 'Payment Completed', stages: ['PAYMENT_CONFIRMED'] },
    { label: 'KYC Uploaded', stages: ['KYC_IN_PROGRESS'] },
    { label: 'KYC Under Review', stages: ['KYC_REVIEW'] },
    { label: 'Agreement Signing', stages: ['AGREEMENT_DRAFT_SHARED', 'SIGNED_AGREEMENT_RECEIVED'] },
    { label: 'Final Agreement', stages: ['FINAL_AGREEMENT_SHARED'] },
    { label: 'Account Activated', stages: ['ACTIVE', 'COMPLETED'] },
  ];

  const currentIndex = getStepIndex(stage);
  const safeIndex = currentIndex < 0 ? 0 : currentIndex;

  return (
    <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-text">Your Onboarding Timeline</h3>
      <div className="space-y-4">
        {steps.map((step, index) => {
          const isLastTwoSteps = index >= steps.length - 2;
          const isCompleted = index < safeIndex || (index === safeIndex && isLastTwoSteps);
          const isCurrent = index === safeIndex && !isCompleted;
          const isReached = isCompleted || isCurrent;

          return (
            <div key={step.label} className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                {isCompleted ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success text-white">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </div>
                ) : isCurrent ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary bg-primary text-white">
                    <Clock className="h-4 w-4" strokeWidth={2.5} />
                  </div>
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-border bg-white text-muted">
                    <Circle className="h-4 w-4" fill="currentColor" strokeWidth={0} />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p
                  className={`text-sm font-medium ${
                    isReached ? 'text-text' : 'text-muted'
                  }`}
                >
                  {step.label}
                </p>
                {isCurrent && (
                  <p className="mt-1 text-xs text-muted">In progress</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
