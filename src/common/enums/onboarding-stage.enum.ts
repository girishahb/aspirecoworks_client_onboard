/**
 * Onboarding lifecycle stages for a company (ClientProfile).
 * Default for new companies is ADMIN_CREATED.
 * KYC uploads are allowed only when stage is PAYMENT_CONFIRMED or KYC_IN_PROGRESS.
 */
export enum OnboardingStage {
  ADMIN_CREATED = 'ADMIN_CREATED',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  PENDING_DOCUMENTS = 'PENDING_DOCUMENTS',
  DOCUMENTS_SUBMITTED = 'DOCUMENTS_SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  PAYMENT_CONFIRMED = 'PAYMENT_CONFIRMED',
  KYC_IN_PROGRESS = 'KYC_IN_PROGRESS',
  KYC_REVIEW = 'KYC_REVIEW',
  AGREEMENT_DRAFT_SHARED = 'AGREEMENT_DRAFT_SHARED',
  SIGNED_AGREEMENT_RECEIVED = 'SIGNED_AGREEMENT_RECEIVED',
  FINAL_AGREEMENT_SHARED = 'FINAL_AGREEMENT_SHARED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}

/**
 * Stages at which KYC (document) uploads are allowed.
 */
export const KYC_UPLOAD_ALLOWED_STAGES: OnboardingStage[] = [
  OnboardingStage.PAYMENT_CONFIRMED,
  OnboardingStage.KYC_IN_PROGRESS,
  OnboardingStage.KYC_REVIEW,
];

export function isKycUploadAllowed(stage: OnboardingStage): boolean {
  return KYC_UPLOAD_ALLOWED_STAGES.includes(stage);
}

/**
 * Allowed stage transitions. Each key can transition to the listed stages.
 */
export const ALLOWED_STAGE_TRANSITIONS: Record<OnboardingStage, OnboardingStage[]> = {
  [OnboardingStage.ADMIN_CREATED]: [OnboardingStage.PAYMENT_PENDING, OnboardingStage.PENDING_DOCUMENTS, OnboardingStage.REJECTED],
  [OnboardingStage.PAYMENT_PENDING]: [OnboardingStage.PAYMENT_CONFIRMED, OnboardingStage.REJECTED],
  [OnboardingStage.PENDING_DOCUMENTS]: [OnboardingStage.DOCUMENTS_SUBMITTED, OnboardingStage.REJECTED],
  [OnboardingStage.DOCUMENTS_SUBMITTED]: [OnboardingStage.UNDER_REVIEW, OnboardingStage.PENDING_DOCUMENTS],
  [OnboardingStage.UNDER_REVIEW]: [OnboardingStage.COMPLETED, OnboardingStage.REJECTED, OnboardingStage.DOCUMENTS_SUBMITTED, OnboardingStage.PAYMENT_CONFIRMED],
  [OnboardingStage.PAYMENT_CONFIRMED]: [OnboardingStage.KYC_IN_PROGRESS],
  [OnboardingStage.KYC_IN_PROGRESS]: [OnboardingStage.KYC_REVIEW, OnboardingStage.DOCUMENTS_SUBMITTED, OnboardingStage.REJECTED],
  [OnboardingStage.KYC_REVIEW]: [OnboardingStage.AGREEMENT_DRAFT_SHARED, OnboardingStage.KYC_IN_PROGRESS, OnboardingStage.REJECTED],
  [OnboardingStage.AGREEMENT_DRAFT_SHARED]: [OnboardingStage.SIGNED_AGREEMENT_RECEIVED, OnboardingStage.REJECTED],
  [OnboardingStage.SIGNED_AGREEMENT_RECEIVED]: [OnboardingStage.FINAL_AGREEMENT_SHARED, OnboardingStage.REJECTED],
  [OnboardingStage.FINAL_AGREEMENT_SHARED]: [OnboardingStage.ACTIVE, OnboardingStage.REJECTED],
  [OnboardingStage.ACTIVE]: [], // terminal (activated)
  [OnboardingStage.COMPLETED]: [], // terminal (legacy)
  [OnboardingStage.REJECTED]: [OnboardingStage.PENDING_DOCUMENTS],
};

/**
 * Check if a transition from `from` to `to` is allowed.
 */
export function canTransitionStage(from: OnboardingStage, to: OnboardingStage): boolean {
  return ALLOWED_STAGE_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get human-readable label for a stage.
 */
export function getStageLabel(stage: OnboardingStage): string {
  const labels: Record<OnboardingStage, string> = {
    [OnboardingStage.ADMIN_CREATED]: 'Admin created',
    [OnboardingStage.PAYMENT_PENDING]: 'Payment pending',
    [OnboardingStage.PENDING_DOCUMENTS]: 'Pending documents',
    [OnboardingStage.DOCUMENTS_SUBMITTED]: 'Documents submitted',
    [OnboardingStage.UNDER_REVIEW]: 'Under review',
    [OnboardingStage.PAYMENT_CONFIRMED]: 'Payment confirmed',
    [OnboardingStage.KYC_IN_PROGRESS]: 'KYC in progress',
    [OnboardingStage.KYC_REVIEW]: 'KYC review',
    [OnboardingStage.AGREEMENT_DRAFT_SHARED]: 'Agreement draft shared',
    [OnboardingStage.SIGNED_AGREEMENT_RECEIVED]: 'Signed agreement received',
    [OnboardingStage.FINAL_AGREEMENT_SHARED]: 'Final agreement shared',
    [OnboardingStage.ACTIVE]: 'Active',
    [OnboardingStage.COMPLETED]: 'Completed',
    [OnboardingStage.REJECTED]: 'Rejected',
  };
  return labels[stage] ?? stage;
}
