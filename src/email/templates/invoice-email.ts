import { buildEmailTemplate, escapeHtml, ctaButton } from '../../common/email/email-template';

export interface InvoiceEmailParams {
  invoiceNumber: string;
  companyName: string;
  totalAmount: string;
  pdfUrl?: string;
  hasAttachment?: boolean;
}

export function invoiceEmail(params: InvoiceEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { invoiceNumber, companyName, totalAmount, pdfUrl, hasAttachment = false } = params;
  const subject = `Tax Invoice ${invoiceNumber} – Aspire Coworks`;
  const attachmentNote = hasAttachment
    ? '<p>The invoice PDF is attached to this email.</p>'
    : '';
  const downloadCta = pdfUrl
    ? ctaButton(pdfUrl, 'Download Invoice PDF')
    : '';
  const content = `
  <p>Hello,</p>
  <p>Please find your tax invoice <strong>${escapeHtml(invoiceNumber)}</strong> for <strong>${escapeHtml(companyName)}</strong>.</p>
  <p><strong>Amount:</strong> ₹${escapeHtml(totalAmount)}</p>
  ${attachmentNote}
  ${downloadCta}
  <p>If you have any questions, please contact support.</p>
  `;
  const html = buildEmailTemplate('Your Invoice', content);
  const text = `Hello,\n\nYour tax invoice ${invoiceNumber} for ${companyName}.\n\nAmount: ₹${totalAmount}${pdfUrl ? `\n\nDownload: ${pdfUrl}` : ''}\n\n— Aspire Coworks`;
  return { subject, html, text };
}
