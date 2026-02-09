import {
  ONBOARDING_STEPS,
  getStepIndex,
  getActionHint,
  getStepIcon,
  TOTAL_ONBOARDING_STEPS,
} from '../onboardingSteps';
import { Check } from 'lucide-react';

export interface OnboardingStepperProps {
  /** Current company onboarding stage from API. */
  stage: string | null | undefined;
  /** Optional: show progress percentage (e.g. "Onboarding 65% complete") */
  showPercentage?: boolean;
  /** Optional: compact mode for smaller spaces */
  compact?: boolean;
}

export default function OnboardingStepper({
  stage,
  showPercentage = true,
  compact = false,
}: OnboardingStepperProps) {
  const currentIndex = getStepIndex(stage);
  const safeIndex = currentIndex < 0 ? 0 : currentIndex;
  const displayPercent =
    TOTAL_ONBOARDING_STEPS <= 1
      ? 0
      : Math.min(100, Math.round((safeIndex / (TOTAL_ONBOARDING_STEPS - 1)) * 100));

  const actionHint = getActionHint(stage);

  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm md:p-5">
      {showPercentage && (
        <p className="mb-3 text-sm font-medium text-muted">
          Onboarding {displayPercent}% complete
        </p>
      )}
      {/* Desktop: horizontal */}
      <div className="hidden md:block">
        <div className="flex items-stretch gap-0">
          {ONBOARDING_STEPS.map((step, index) => {
            const completed = currentIndex > index;
            const current = currentIndex === index;
            const stageForLabel =
              completed && step.stages.length > 0
                ? (step.stages[step.stages.length - 1] as import('../onboardingSteps').OnboardingStage)
                : (stage as import('../onboardingSteps').OnboardingStage) ?? null;
            const Icon = getStepIcon(step, (stage as import('../onboardingSteps').OnboardingStage) ?? null);
            const title = step.getTitle(stageForLabel);
            const subtitle = step.getSubtitle(stageForLabel);

            return (
              <div key={step.stepIndex} className="flex flex-1 flex-col items-center">
                <div className="flex w-full flex-1 items-center">
                  {/* Connector line before (except first) */}
                  {index > 0 && (
                    <div
                      className="h-0.5 flex-1"
                      style={{
                        backgroundColor: completed ? 'var(--color-success)' : 'var(--color-border)',
                      }}
                    />
                  )}
                  {/* Step circle + content */}
                  <div className="flex flex-col items-center px-1">
                    <div
                      className={`
                        flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2
                        ${completed ? 'border-success bg-success text-white' : ''}
                        ${current ? 'border-primary bg-primary text-white' : ''}
                        ${!completed && !current ? 'border-border bg-white text-muted' : ''}
                      `}
                    >
                      {completed ? (
                        <Check className="h-5 w-5" strokeWidth={2.5} />
                      ) : (
                        <Icon className="h-5 w-5" strokeWidth={2} />
                      )}
                    </div>
                    <div className="mt-2 max-w-[120px] text-center">
                      <p
                        className={`text-xs font-semibold md:text-sm ${
                          current ? 'text-primary' : completed ? 'text-success' : 'text-muted'
                        }`}
                      >
                        {title}
                      </p>
                      {!compact && (
                        <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
                      )}
                    </div>
                  </div>
                  {/* Connector line after (except last) */}
                  {index < ONBOARDING_STEPS.length - 1 && (
                    <div
                      className="h-0.5 flex-1"
                      style={{
                        backgroundColor: completed ? 'var(--color-success)' : 'var(--color-border)',
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: vertical stack */}
      <div className="md:hidden space-y-3">
        {ONBOARDING_STEPS.map((step, index) => {
          const completed = currentIndex > index;
          const current = currentIndex === index;
          const stageForLabel =
            completed && step.stages.length > 0
              ? (step.stages[step.stages.length - 1] as import('../onboardingSteps').OnboardingStage)
              : (stage as import('../onboardingSteps').OnboardingStage) ?? null;
          const Icon = getStepIcon(step, (stage as import('../onboardingSteps').OnboardingStage) ?? null);
          const title = step.getTitle(stageForLabel);
          const subtitle = step.getSubtitle(stageForLabel);

          return (
            <div
              key={step.stepIndex}
              className={`flex items-start gap-3 rounded-lg border p-3 ${
                current ? 'border-primary bg-primary/5' : 'border-border bg-white'
              }`}
            >
              <div
                className={`
                  flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2
                  ${completed ? 'border-success bg-success text-white' : ''}
                  ${current ? 'border-primary bg-primary text-white' : ''}
                  ${!completed && !current ? 'border-border bg-white text-muted' : ''}
                `}
              >
                {completed ? (
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                ) : (
                  <Icon className="h-4 w-4" strokeWidth={2} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-semibold ${
                    current ? 'text-primary' : completed ? 'text-success' : 'text-muted'
                  }`}
                >
                  {title}
                </p>
                {!compact && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action hint */}
      <div className="mt-4 rounded-md bg-muted/20 px-3 py-2">
        <p className="text-sm text-muted">{actionHint}</p>
      </div>
    </div>
  );
}
