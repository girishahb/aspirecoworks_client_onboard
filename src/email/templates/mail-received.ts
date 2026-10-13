import { escapeHtml, wrapBrandedEmail } from './layout';

export interface MailReceivedParams {
  companyName: string;
  contactPersonName?: string | null;
  receivedAtIst: string;
  note?: string | null;
}

export function mailReceivedEmail(params: MailReceivedParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { companyName, contactPersonName, receivedAtIst, note } = params;
  const greeting = contactPersonName?.trim()
    ? `Hello ${escapeHtml(contactPersonName.trim())},`
    : 'Hello,';

  const subject = `Mail received at Aspire Coworks — ${companyName}`;
  const noteBlock = note?.trim()
    ? `<p><strong>Reception note:</strong> ${escapeHtml(note.trim())}</p>`
    : '';

  const content = `
  <p>${greeting}</p>
  <p>We have received physical mail for <strong>${escapeHtml(companyName)}</strong> at Aspire Coworks.</p>
  <p><strong>Mail received:</strong> ${escapeHtml(receivedAtIst)}</p>
  ${noteBlock}
  <p>A photo of the courier is attached to this email for your records.</p>
  <p>Please collect it from reception at your earliest convenience, or reply to this email else you can dial to this number +91 97314 84411 for more informaion.</p>
  <p>Thank you</p>
  `;

  const html = wrapBrandedEmail(content, 'Mail received');
  const text = [
    contactPersonName?.trim() ? `Hello ${contactPersonName.trim()},` : 'Hello,',
    '',
    `We have received physical mail for ${companyName} at Aspire Coworks.`,
    `Mail received: ${receivedAtIst}`,
    note?.trim() ? `Reception note: ${note.trim()}` : '',
    'A photo of the courier is attached to this email for your records.',
    'Please collect it from reception at your earliest convenience, or reply to this email else you can dial to this number +91 97314 84411 for more informaion.',
    'Thank you',
  ]
    .filter((line) => line !== '')
    .join('\n');

  return { subject, html, text };
}

/** Format a Date as calendar + clock in Asia/Kolkata for email display. */
export function formatIstDateTime(d: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d) + ' IST';
}
