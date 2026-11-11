import { escapeHtml, wrapBrandedEmail } from './layout';

export interface VisitorCheckedInParams {
  visitorName: string;
  visitorPhone: string;
  visitorCompany?: string | null;
  purpose: string;
  hostName?: string | null;
  checkInAtIst: string;
  locationName?: string | null;
}

export function visitorCheckedInEmail(params: VisitorCheckedInParams): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    visitorName,
    visitorPhone,
    visitorCompany,
    purpose,
    hostName,
    checkInAtIst,
    locationName,
  } = params;

  const greeting = hostName?.trim()
    ? `Hello ${escapeHtml(hostName.trim())},`
    : 'Hello,';

  const subject = `Visitor checked in — ${visitorName}`;
  const companyLine = visitorCompany?.trim()
    ? `<p><strong>Company:</strong> ${escapeHtml(visitorCompany.trim())}</p>`
    : '';
  const locationLine = locationName?.trim()
    ? `<p><strong>Location:</strong> ${escapeHtml(locationName.trim())}</p>`
    : '';

  const content = `
  <p>${greeting}</p>
  <p>A visitor has checked in at Aspire Coworks reception and listed you as their host.</p>
  <p><strong>Visitor:</strong> ${escapeHtml(visitorName)}</p>
  <p><strong>Phone:</strong> ${escapeHtml(visitorPhone)}</p>
  ${companyLine}
  <p><strong>Purpose:</strong> ${escapeHtml(purpose)}</p>
  <p><strong>Checked in:</strong> ${escapeHtml(checkInAtIst)}</p>
  ${locationLine}
  <p>Please meet them at reception when ready.</p>
  <p>Thank you</p>
  `;

  const html = wrapBrandedEmail(content, 'Visitor checked in');
  const text = [
    hostName?.trim() ? `Hello ${hostName.trim()},` : 'Hello,',
    '',
    'A visitor has checked in at Aspire Coworks reception and listed you as their host.',
    `Visitor: ${visitorName}`,
    `Phone: ${visitorPhone}`,
    visitorCompany?.trim() ? `Company: ${visitorCompany.trim()}` : '',
    `Purpose: ${purpose}`,
    `Checked in: ${checkInAtIst}`,
    locationName?.trim() ? `Location: ${locationName.trim()}` : '',
    'Please meet them at reception when ready.',
    'Thank you',
  ]
    .filter((line) => line !== '')
    .join('\n');

  return { subject, html, text };
}
