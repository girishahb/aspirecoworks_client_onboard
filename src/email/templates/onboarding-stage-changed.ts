import { escapeHtml, wrapBrandedEmail, ctaButton } from './layout';

const STAGE_LABELS: Record<string, string> = {
  PAYMENT_CONFIRMED: 'Payment confirmed',
  KYC_IN_PROGRESS: 'KYC in progress',
  KYC_REVIEW: 'KYC review',
  AGREEMENT_DRAFT_SHARED: 'Agreement draft shared',
  SIGNED_AGREEMENT_RECEIVED: 'Signed agreement received',
  FINAL_AGREEMENT_SHARED: 'Final agreement shared',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
};

export interface OnboardingStageChangedParams {
  companyName: string;
  stage: string;
  dashboardUrl?: string;
}

function getStageMessage(stage: string, companyName: string): { body: string; ctaLabel: string } {
  const label = STAGE_LABELS[stage] ?? stage;
  switch (stage) {
    case 'PAYMENT_CONFIRMED':
      return {
        body: `Payment has been confirmed for <strong>${escapeHtml(companyName)}</strong>. You’ll be able to upload KYC documents once we’ve moved you to the next step.`,
        ctaLabel: 'View dashboard',
      };
    case 'KYC_IN_PROGRESS':
      return {
        body: `Your onboarding is now in the <strong>KYC documents</strong> step. Please upload your contracts, licenses, identification, and any other required documents.`,
        ctaLabel: 'Upload KYC documents',
      };
    case 'KYC_REVIEW':
      return {
        body: `We’re reviewing your KYC documents for <strong>${escapeHtml(companyName)}</strong>. We’ll notify you when the review is complete and share the next steps.`,
        ctaLabel: 'View dashboard',
      };
    case 'SIGNED_AGREEMENT_RECEIVED':
      return {
        body: `We’ve received your signed agreement. We’re preparing your final agreement and will notify you when it’s ready.`,
        ctaLabel: 'View dashboard',
      };
    case 'REJECTED':
      return {
        body: `Your application for <strong>${escapeHtml(companyName)}</strong> has been updated. Please contact support if you have questions.`,
        ctaLabel: 'View dashboard',
      };
    default:
      return {
        body: `Your onboarding stage for <strong>${escapeHtml(companyName)}</strong> is now: <strong>${escapeHtml(label)}</strong>.`,
        ctaLabel: 'View dashboard',
      };
  }
}

export function onboardingStageChanged(params: OnboardingStageChangedParams): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    companyName,
    stage,
    dashboardUrl = 'https://app.aspirecoworks.com/dashboard',
  } = params;
  const label = STAGE_LABELS[stage] ?? stage;
  const subject = `Onboarding update: ${label} – ${companyName}`;
  const { body, ctaLabel } = getStageMessage(stage, companyName);

  const content = `
  <p>Hello,</p>
  <p>${body}</p>
  ${ctaButton(dashboardUrl, ctaLabel)}
  `;

  const html = wrapBrandedEmail(content);

  const textBody = body.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
  const text = `Hello,\n\n${textBody}\n\n${ctaLabel}: ${dashboardUrl}\n\n— Aspire Coworks`;

  return { subject, html, text };
}
