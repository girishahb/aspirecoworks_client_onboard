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

/** All onboarding stages in order for step-index calculation. */
const STAGE_ORDER: OnboardingStage[] = [
  'ADMIN_CREATED',
  'PAYMENT_PENDING',
  'PAYMENT_CONFIRMED',
  'KYC_IN_PROGRESS',
  'KYC_REVIEW',
  'AGREEMENT_DRAFT_SHARED',
  'SIGNED_AGREEMENT_RECEIVED',
  'FINAL_AGREEMENT_SHARED',
  'ACTIVE',
  'COMPLETED',
];

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
    getSubtitle: (s) => (s === 'KYC_REVIEW' ? 'Under admin review' : 'Upload contracts, IDs, licenses'),
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

/** KYC step uses Search icon when in review. */
export function getStepIcon(step: OnboardingStepConfig, stage: OnboardingStage | null): LucideIcon {
  if (step.stepIndex === 2 && stage === 'KYC_REVIEW') return Search;
  return step.icon;
}

/**
 * Returns the 0-based step index for the given onboarding stage.
 * Returns -1 for unknown or REJECTED (caller may treat as 0 or show error state).
 */
export function getStepIndex(stage: string | null | undefined): number {
  if (!stage || stage === 'REJECTED') return stage === 'REJECTED' ? -1 : 0;
  const idx = ONBOARDING_STEPS.findIndex((s) =>
    s.stages.includes(stage as OnboardingStage)
  );
  return idx >= 0 ? idx : 0;
}

/**
 * Context message shown under the stepper (action hints).
 */
export function getActionHint(stage: string | null | undefined): string {
  if (!stage) return 'Getting started…';
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
