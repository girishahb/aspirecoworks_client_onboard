import { escapeHtml, wrapBrandedEmail, ctaButton } from './layout';

export interface FinalAgreementSharedParams {
  companyName: string;
  dashboardUrl?: string;
}

export function finalAgreementShared(params: FinalAgreementSharedParams): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    companyName,
    dashboardUrl = 'https://app.aspirecoworks.com/dashboard',
  } = params;
  const subject = `Final stamped agreement available – ${companyName}`;

  const content = `
  <p>Hello,</p>
  <p>The final stamped agreement is available for <strong>${escapeHtml(companyName)}</strong>.</p>
  <p>Download your copy from the dashboard. We'll activate your account shortly.</p>
  ${ctaButton(dashboardUrl, 'Download final agreement')}
  `;

  const html = wrapBrandedEmail(content, 'Final Agreement Available');
  const text = `Hello,\n\nThe final stamped agreement is available for ${companyName}.\n\nDownload your copy from the dashboard. We'll activate your account shortly.\n\nDashboard: ${dashboardUrl}\n\n— Aspire Coworks`;
  return { subject, html, text };
}
