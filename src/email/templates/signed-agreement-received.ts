import { escapeHtml, wrapBrandedEmail, ctaButton } from './layout';

export interface SignedAgreementReceivedParams {
  companyName: string;
  dashboardUrl?: string;
}

export function signedAgreementReceived(params: SignedAgreementReceivedParams): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    companyName,
    dashboardUrl = 'https://app.aspirecoworks.com/dashboard',
  } = params;
  const subject = `We've received your signed agreement – ${companyName}`;

  const content = `
  <p>Hello,</p>
  <p>We've received your signed agreement for <strong>${escapeHtml(companyName)}</strong>.</p>
  <p>We're preparing your final agreement and will notify you when it's ready. You don't need to take any action right now.</p>
  ${ctaButton(dashboardUrl, 'View dashboard')}
  `;

  const html = wrapBrandedEmail(content, 'Signed Agreement Received');
  const text = `Hello,\n\nWe've received your signed agreement for ${companyName}.\n\nWe're preparing your final agreement and will notify you when it's ready.\n\nView dashboard: ${dashboardUrl}\n\n— Aspire Coworks`;

  return { subject, html, text };
}
