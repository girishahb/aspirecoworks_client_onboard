import { escapeHtml, wrapBrandedEmail, ctaButton } from './layout';

export interface DocumentRejectedParams {
  companyName: string;
  documentType: string;
  rejectionReason: string;
  uploadUrl?: string;
}

export function documentRejected(params: DocumentRejectedParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { companyName, documentType, rejectionReason, uploadUrl = 'https://app.aspirecoworks.in/dashboard' } = params;
  const subject = `Document needs attention – ${companyName}`;

  const content = `
  <p>Hello,</p>
  <p>Your document (<strong>${escapeHtml(documentType)}</strong>) for <strong>${escapeHtml(companyName)}</strong> was not approved.</p>
  <p><strong>Reason:</strong> ${escapeHtml(rejectionReason)}</p>
  <p>Please sign in and upload a new version or contact us if you have questions.</p>
  ${ctaButton(uploadUrl, 'Upload new document')}
  `;

  const html = wrapBrandedEmail(content, 'Document Needs Attention');
  const text = `Hello,\n\nYour document (${documentType}) for ${companyName} was not approved.\n\nReason: ${rejectionReason}\n\nPlease upload a new version: ${uploadUrl}\n\n— Aspire Coworks`;
  return { subject, html, text };
}
