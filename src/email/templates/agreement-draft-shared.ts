import { escapeHtml, wrapBrandedEmail, ctaButton } from './layout';

export interface AgreementDraftSharedParams {
  companyName: string;
  dashboardUrl?: string;
}

export function agreementDraftShared(params: AgreementDraftSharedParams): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    companyName,
    dashboardUrl = 'https://app.aspirecoworks.in/dashboard',
  } = params;
  const subject = `Agreement draft ready – ${companyName}`;

  const content = `
  <p>Hello,</p>
  <p>An agreement draft has been shared with you for <strong>${escapeHtml(companyName)}</strong>.</p>
  <p>Please sign in to your dashboard to view and download the document, then upload your signed copy when ready.</p>
  ${ctaButton(dashboardUrl, 'View dashboard & upload signed agreement')}
  `;

  const html = wrapBrandedEmail(content, 'Agreement Draft Ready');
  const text = `Hello,\n\nAn agreement draft has been shared with you for ${companyName}.\n\nPlease sign in to your dashboard to view and download the document, then upload your signed copy when ready.\n\nView dashboard: ${dashboardUrl}\n\n— Aspire Coworks`;
  return { subject, html, text };
}
