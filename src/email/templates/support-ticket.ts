import { buildEmailTemplate, ctaButton, escapeHtml } from '../../common/email/email-template';

export function formatTicketWhen(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export interface TicketMailFacts {
  ticketNumber: string;
  customerName: string;
  companyName: string;
  customerPhone?: string | null;
  locationName: string;
  issueGroup: string;
  issueDescription: string;
  createdAt: Date;
  departmentName?: string | null;
  assigneeName?: string | null;
  resolutionNotes?: string | null;
  closedAt?: Date | null;
  reason?: string | null;
  staffUrl: string;
  supportEmail: string;
}

function factsBlock(facts: TicketMailFacts, extra?: string): string {
  const phone = facts.customerPhone?.trim()
    ? `<p><strong>Phone:</strong> ${escapeHtml(facts.customerPhone.trim())}</p>`
    : '';
  const department = facts.departmentName
    ? `<p><strong>Department:</strong> ${escapeHtml(facts.departmentName)}</p>`
    : '';
  const assignee = facts.assigneeName
    ? `<p><strong>Assigned to:</strong> ${escapeHtml(facts.assigneeName)}</p>`
    : '<p><strong>Assigned to:</strong> Branch queue</p>';
  return `
    <p><strong>Ticket:</strong> ${escapeHtml(facts.ticketNumber)}</p>
    <p><strong>Customer:</strong> ${escapeHtml(facts.customerName)}</p>
    <p><strong>Company:</strong> ${escapeHtml(facts.companyName)}</p>
    ${phone}
    <p><strong>Location:</strong> ${escapeHtml(facts.locationName)}</p>
    <p><strong>Issue group:</strong> ${escapeHtml(facts.issueGroup)}</p>
    <p><strong>Description:</strong><br/>${escapeHtml(facts.issueDescription).replace(/\n/g, '<br/>')}</p>
    <p><strong>Created:</strong> ${escapeHtml(formatTicketWhen(facts.createdAt))}</p>
    ${department}
    ${assignee}
    ${extra ?? ''}
  `;
}

function textFacts(facts: TicketMailFacts): string[] {
  return [
    `Ticket: ${facts.ticketNumber}`,
    `Customer: ${facts.customerName}`,
    `Company: ${facts.companyName}`,
    facts.customerPhone?.trim() ? `Phone: ${facts.customerPhone.trim()}` : '',
    `Location: ${facts.locationName}`,
    `Issue group: ${facts.issueGroup}`,
    `Description: ${facts.issueDescription}`,
    `Created: ${formatTicketWhen(facts.createdAt)}`,
    facts.departmentName ? `Department: ${facts.departmentName}` : '',
    `Assigned to: ${facts.assigneeName || 'Branch queue'}`,
  ].filter((line) => line !== '');
}

export function internalCreatedEmail(facts: TicketMailFacts): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `[ASPIRE SUPPORT] New Ticket – ${facts.ticketNumber} – ${facts.issueGroup}`;
  const content = `
    <p>A new support ticket has been registered.</p>
    ${factsBlock(facts)}
    ${ctaButton(facts.staffUrl, 'Open ticket')}
  `;
  return {
    subject,
    html: buildEmailTemplate('New support ticket', content),
    text: ['A new support ticket has been registered.', '', ...textFacts(facts), '', facts.staffUrl].join('\n'),
  };
}

export function customerCreatedEmail(facts: TicketMailFacts): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Aspire Coworks – Support Ticket Registered – ${facts.ticketNumber}`;
  const content = `
    <p>Hello ${escapeHtml(facts.customerName)},</p>
    <p>Thank you for contacting Aspire Coworks. Your support request has been registered and our team will look into it shortly.</p>
    <p><strong>Ticket:</strong> ${escapeHtml(facts.ticketNumber)}</p>
    <p><strong>Issue group:</strong> ${escapeHtml(facts.issueGroup)}</p>
    <p><strong>Summary:</strong><br/>${escapeHtml(facts.issueDescription).replace(/\n/g, '<br/>')}</p>
    <p><strong>Status:</strong> In progress</p>
    <p>If you need to add anything, please speak with the reception desk at ${escapeHtml(facts.locationName)} and quote this ticket number.</p>
  `;
  const text = [
    `Hello ${facts.customerName},`,
    '',
    'Thank you for contacting Aspire Coworks. Your support request has been registered.',
    `Ticket: ${facts.ticketNumber}`,
    `Issue group: ${facts.issueGroup}`,
    `Summary: ${facts.issueDescription}`,
    'Status: In progress',
    `Location: ${facts.locationName}`,
  ].join('\n');
  return { subject, html: buildEmailTemplate('Support ticket registered', content), text };
}

export function customerClosedEmail(facts: TicketMailFacts): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Aspire Coworks – Your Support Ticket Has Been Closed – ${facts.ticketNumber}`;
  const notes = facts.resolutionNotes?.trim() || 'The issue has been resolved.';
  const when = facts.closedAt ? formatTicketWhen(facts.closedAt) : formatTicketWhen(new Date());
  const content = `
    <p>Hello ${escapeHtml(facts.customerName)},</p>
    <p>Your support ticket has been closed.</p>
    <p><strong>Ticket:</strong> ${escapeHtml(facts.ticketNumber)}</p>
    <p><strong>Issue group:</strong> ${escapeHtml(facts.issueGroup)}</p>
    <p><strong>Original request:</strong><br/>${escapeHtml(facts.issueDescription).replace(/\n/g, '<br/>')}</p>
    <p><strong>Resolution:</strong><br/>${escapeHtml(notes).replace(/\n/g, '<br/>')}</p>
    <p><strong>Closed:</strong> ${escapeHtml(when)}</p>
    <p>If something is still unresolved, please tell the reception desk at ${escapeHtml(facts.locationName)} or write to ${escapeHtml(facts.supportEmail)}.</p>
  `;
  const text = [
    `Hello ${facts.customerName},`,
    '',
    'Your support ticket has been closed.',
    `Ticket: ${facts.ticketNumber}`,
    `Issue group: ${facts.issueGroup}`,
    `Original request: ${facts.issueDescription}`,
    `Resolution: ${notes}`,
    `Closed: ${when}`,
    `Contact: ${facts.supportEmail}`,
  ].join('\n');
  return { subject, html: buildEmailTemplate('Support ticket closed', content), text };
}

export function internalClosedEmail(facts: TicketMailFacts): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `[ASPIRE SUPPORT] Ticket closed – ${facts.ticketNumber}`;
  const notes = facts.resolutionNotes?.trim() || '';
  const content = `
    <p>A support ticket has been closed.</p>
    ${factsBlock(facts, `<p><strong>Resolution:</strong><br/>${escapeHtml(notes).replace(/\n/g, '<br/>')}</p>`)}
    ${ctaButton(facts.staffUrl, 'Open ticket')}
  `;
  return {
    subject,
    html: buildEmailTemplate('Ticket closed', content),
    text: ['A support ticket has been closed.', '', ...textFacts(facts), `Resolution: ${notes}`, '', facts.staffUrl].join('\n'),
  };
}

export function reassignedEmail(facts: TicketMailFacts, who: string): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `[ASPIRE SUPPORT] Ticket reassigned – ${facts.ticketNumber}`;
  const content = `
    <p>Hello ${escapeHtml(who)},</p>
    <p>Support ticket ${escapeHtml(facts.ticketNumber)} has been assigned to you.</p>
    ${facts.reason ? `<p><strong>Reason:</strong> ${escapeHtml(facts.reason)}</p>` : ''}
    ${factsBlock(facts)}
    ${ctaButton(facts.staffUrl, 'Open ticket')}
  `;
  return {
    subject,
    html: buildEmailTemplate('Ticket assigned to you', content),
    text: [
      `Hello ${who},`,
      '',
      `Support ticket ${facts.ticketNumber} has been assigned to you.`,
      facts.reason ? `Reason: ${facts.reason}` : '',
      '',
      ...textFacts(facts),
      '',
      facts.staffUrl,
    ]
      .filter((line) => line !== '')
      .join('\n'),
  };
}

export function customerReopenedEmail(facts: TicketMailFacts): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Aspire Coworks – Support Ticket Reopened – ${facts.ticketNumber}`;
  const content = `
    <p>Hello ${escapeHtml(facts.customerName)},</p>
    <p>Your support ticket ${escapeHtml(facts.ticketNumber)} is in progress again.</p>
    ${facts.reason ? `<p><strong>Note:</strong> ${escapeHtml(facts.reason)}</p>` : ''}
    <p><strong>Issue group:</strong> ${escapeHtml(facts.issueGroup)}</p>
    <p>The team at ${escapeHtml(facts.locationName)} will follow up.</p>
  `;
  return {
    subject,
    html: buildEmailTemplate('Support ticket reopened', content),
    text: [
      `Hello ${facts.customerName},`,
      '',
      `Your support ticket ${facts.ticketNumber} is in progress again.`,
      facts.reason ? `Note: ${facts.reason}` : '',
      `Issue group: ${facts.issueGroup}`,
    ]
      .filter((line) => line !== '')
      .join('\n'),
  };
}
