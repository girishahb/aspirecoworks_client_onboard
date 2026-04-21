/**
 * Onboarding stage → step mapping and action hints for the Visual Onboarding Progress Tracker.
 * Used by OnboardingStepper on Client dashboard and Admin company detail page.
 */

import type { LucideIcon } from 'lucide-react';
import {
  UserPlus,
  CreditCard,
  FileCheck,
  Search,
  FileText,
  PenTool,
  Stamp,
  CheckCircle,
} from 'lucide-react';

export type OnboardingStage =
  | 'ADMIN_CREATED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_CONFIRMED'
  | 'KYC_IN_PROGRESS'
  | 'KYC_REVIEW'
  | 'AGREEMENT_DRAFT_SHARED'
  | 'SIGNED_AGREEMENT_RECEIVED'
  | 'FINAL_AGREEMENT_SHARED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'REJECTED';

export interface OnboardingStepConfig {
  stepIndex: number;
  stages: OnboardingStage[];
  /** Step title; for multi-stage steps, pass current stage to get stage-specific title. */
  getTitle: (stage: OnboardingStage | null) => string;
  /** Short subtitle for the step. */
  getSubtitle: (stage: OnboardingStage | null) => string;
  icon: LucideIcon;
}

// All onboarding stages in order for step-index calculation (reserved for future use)
// const STAGE_ORDER: OnboardingStage[] = [
//   'ADMIN_CREATED',
//   'PAYMENT_PENDING',
//   'PAYMENT_CONFIRMED',
//   'KYC_IN_PROGRESS',
//   'KYC_REVIEW',
//   'AGREEMENT_DRAFT_SHARED',
//   'SIGNED_AGREEMENT_RECEIVED',
//   'FINAL_AGREEMENT_SHARED',
//   'ACTIVE',
//   'COMPLETED',
// ];

export const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  {
    stepIndex: 0,
    stages: ['ADMIN_CREATED'],
    getTitle: () => 'Registration Created',
    getSubtitle: () => 'Account created by admin',
    icon: UserPlus,
  },
  {
    stepIndex: 1,
    stages: ['PAYMENT_PENDING', 'PAYMENT_CONFIRMED'],
    getTitle: (s) => (s === 'PAYMENT_CONFIRMED' ? 'Payment Completed' : 'Awaiting Payment'),
    getSubtitle: (s) => (s === 'PAYMENT_CONFIRMED' ? 'Payment recorded' : 'Waiting for payment'),
    icon: CreditCard,
  },
  {
    stepIndex: 2,
    stages: ['KYC_IN_PROGRESS', 'KYC_REVIEW'],
    getTitle: (s) => (s === 'KYC_REVIEW' ? 'KYC Under Review' : 'Upload KYC Documents'),
    getSubtitle: (s) => (s === 'KYC_REVIEW' ? 'Under admin review' : 'Upload Aadhaar and PAN'),
    icon: FileCheck,
  },
  {
    stepIndex: 3,
    stages: ['AGREEMENT_DRAFT_SHARED'],
    getTitle: () => 'Agreement Draft Shared',
    getSubtitle: () => 'Draft sent to client',
    icon: FileText,
  },
  {
    stepIndex: 4,
    stages: ['SIGNED_AGREEMENT_RECEIVED'],
    getTitle: () => 'Signed Agreement Received',
    getSubtitle: () => 'Client signed copy received',
    icon: PenTool,
  },
  {
    stepIndex: 5,
    stages: ['FINAL_AGREEMENT_SHARED'],
    getTitle: () => 'Final Agreement Ready',
    getSubtitle: () => 'Final document shared',
    icon: Stamp,
  },
  {
    stepIndex: 6,
    stages: ['ACTIVE', 'COMPLETED'],
    getTitle: () => 'Account Activated',
    getSubtitle: () => 'Onboarding complete',
    icon: CheckCircle,
  },
];

/**
 * Aggregator-portal-specific 4-step view for AGGREGATOR-channel clients.
 *
 * Aggregators don't need to see the admin-only back-office stages (Signed
 * Agreement Received and Final Agreement Ready) — those are collapsed into
 * "Agreement Draft Shared" from their perspective, so the stepper stays on
 * step 2 (current) until the admin activates the account. The aggregator
 * still uploads the signed agreement via a separate card on the client
 * detail page; that action doesn't move the visible stepper.
 */
export const AGGREGATOR_VIEW_ONBOARDING_STEPS: OnboardingStepConfig[] = [
  {
    stepIndex: 0,
    stages: [
      'ADMIN_CREATED',
      'PAYMENT_PENDING',
      'PAYMENT_CONFIRMED',
      'KYC_IN_PROGRESS',
    ],
    getTitle: () => 'Registration Created',
    getSubtitle: () => 'Account created and KYC uploaded',
    icon: UserPlus,
  },
  {
    stepIndex: 1,
    stages: ['KYC_REVIEW'],
    getTitle: () => 'KYC Under Review',
    getSubtitle: () => 'Under admin review',
    icon: Search,
  },
  {
    stepIndex: 2,
    stages: [
      'AGREEMENT_DRAFT_SHARED',
      'SIGNED_AGREEMENT_RECEIVED',
      'FINAL_AGREEMENT_SHARED',
    ],
    getTitle: () => 'Agreement Draft Shared',
    getSubtitle: () => 'Draft sent; awaiting activation',
    icon: FileText,
  },
  {
    stepIndex: 3,
    stages: ['ACTIVE', 'COMPLETED'],
    getTitle: () => 'Account Activated',
    getSubtitle: () => 'Onboarding complete',
    icon: CheckCircle,
  },
];

/** KYC step uses Search icon when in review (admin/client views only). */
export function getStepIcon(step: OnboardingStepConfig, stage: OnboardingStage | null): LucideIcon {
  if (step.stepIndex === 2 && stage === 'KYC_REVIEW') return Search;
  return step.icon;
}

export type ClientChannel = 'DIRECT' | 'AGGREGATOR';
export type StepperView = 'admin' | 'aggregator' | 'client';

/**
 * Returns the onboarding steps applicable to the given client channel and
 * viewer. AGGREGATOR clients skip the Payment step. The aggregator portal
 * view collapses the post-draft admin-only stages into the shared "Agreement
 * Draft Shared" step so aggregators see a cleaner 4-step timeline.
 */
export function getOnboardingSteps(
  channel?: ClientChannel | null,
  view?: StepperView | null,
): OnboardingStepConfig[] {
  if (channel === 'AGGREGATOR' && view === 'aggregator') {
    return AGGREGATOR_VIEW_ONBOARDING_STEPS;
  }
  if (channel === 'AGGREGATOR') {
    // Admin / client view on an aggregator-channel client: 6 steps (no
    // payment). Step 0 subtitle is tweaked so admins see "Account created by
    // aggregator" instead of the direct-client default ("Account created by
    // admin"). All other steps are shared with the direct-client list.
    return ONBOARDING_STEPS.filter((s) => s.stepIndex !== 1).map((s) =>
      s.stepIndex === 0
        ? {
            ...s,
            getSubtitle: () => 'Account created by aggregator',
          }
        : s,
    );
  }
  return ONBOARDING_STEPS;
}

/**
 * Returns the 0-based step index for the given onboarding stage within the
 * steps for the given channel + view. Returns -1 for REJECTED; 0 for unknown.
 */
export function getStepIndex(
  stage: string | null | undefined,
  channel?: ClientChannel | null,
  view?: StepperView | null,
): number {
  if (!stage || stage === 'REJECTED') return stage === 'REJECTED' ? -1 : 0;
  const steps = getOnboardingSteps(channel, view);
  const idx = steps.findIndex((s) => s.stages.includes(stage as OnboardingStage));
  return idx >= 0 ? idx : 0;
}

/**
 * Context message shown under the stepper (action hints). Aggregator-view
 * hints are tailored to what the aggregator can do next; other views keep
 * the existing admin/client messaging.
 */
export function getActionHint(
  stage: string | null | undefined,
  view?: StepperView | null,
): string {
  if (!stage) return 'Getting started…';
  if (view === 'aggregator') {
    const aggHints: Record<string, string> = {
      ADMIN_CREATED: 'Client account created; KYC upload next.',
      PAYMENT_PENDING: 'Client account created; KYC upload next.',
      PAYMENT_CONFIRMED: 'Client account created; KYC upload next.',
      KYC_IN_PROGRESS: 'Upload your client’s KYC documents.',
      KYC_REVIEW: 'Admin is reviewing the KYC documents.',
      AGREEMENT_DRAFT_SHARED: 'Agreement draft shared. Upload the signed copy once ready.',
      SIGNED_AGREEMENT_RECEIVED: 'Signed agreement received. Admin will activate the account.',
      FINAL_AGREEMENT_SHARED: 'Final agreement shared. Admin will activate the account.',
      ACTIVE: 'Client onboarding complete.',
      COMPLETED: 'Client onboarding complete.',
      REJECTED: 'Application was rejected.',
    };
    return aggHints[stage] ?? 'In progress…';
  }
  const hints: Record<string, string> = {
    ADMIN_CREATED: 'Registration created; payment pending.',
    PAYMENT_PENDING: 'Waiting for client payment.',
    PAYMENT_CONFIRMED: 'Payment completed; next: KYC documents.',
    KYC_IN_PROGRESS: 'Client must upload documents.',
    KYC_REVIEW: 'Admin review required.',
    AGREEMENT_DRAFT_SHARED: 'Client must sign agreement.',
    SIGNED_AGREEMENT_RECEIVED: 'Admin must upload final agreement.',
    FINAL_AGREEMENT_SHARED: 'Ready for activation.',
    ACTIVE: 'Onboarding complete.',
    COMPLETED: 'Onboarding complete.',
    REJECTED: 'Application was rejected.',
  };
  return hints[stage] ?? 'In progress…';
}

/** Total number of steps (for progress percentage). */
export const TOTAL_ONBOARDING_STEPS = ONBOARDING_STEPS.length;

/** Total number of steps for a specific channel + view. */
export function getTotalOnboardingSteps(
  channel?: ClientChannel | null,
  view?: StepperView | null,
): number {
  return getOnboardingSteps(channel, view).length;
}
