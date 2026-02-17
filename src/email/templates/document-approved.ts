import { escapeHtml, wrapBrandedEmail, ctaButton } from './layout';

export interface DocumentApprovedParams {
  companyName: string;
  documentType: string;
  statusUrl?: string;
}

export function documentApproved(params: DocumentApprovedParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { companyName, documentType, statusUrl = 'https://app.aspirecoworks.in/dashboard' } = params;
  const subject = `Document approved – ${companyName}`;

  const content = `
  <p>Hello,</p>
  <p>Your document (<strong>${escapeHtml(documentType)}</strong>) for <strong>${escapeHtml(companyName)}</strong> has been approved.</p>
  <p>View your onboarding status and any next steps in your dashboard.</p>
  ${ctaButton(statusUrl, 'View dashboard')}
  `;

  const html = wrapBrandedEmail(content, 'Document Approved');
  const text = `Hello,\n\nYour document (${documentType}) for ${companyName} has been approved.\n\nView your onboarding status: ${statusUrl}\n\n— Aspire Coworks`;
  return { subject, html, text };
}
