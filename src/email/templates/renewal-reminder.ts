import { buildEmailTemplate, escapeHtml, ctaButton } from '../../common/email/email-template';

export interface RenewalReminderParams {
  companyName: string;
  daysBefore: number;
  renewalDateStr: string;
  dashboardUrl?: string;
}

export function renewalReminder(params: RenewalReminderParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { companyName, daysBefore, renewalDateStr, dashboardUrl = 'https://app.aspirecoworks.com/dashboard' } = params;
  const subject = `Your Aspire Coworks membership expires in ${daysBefore} day${daysBefore === 1 ? '' : 's'}`;
  const content = `
  <p>Hello,</p>
  <p>This is a reminder that your Aspire Coworks membership for <strong>${escapeHtml(companyName)}</strong> will expire in <strong>${daysBefore} day${daysBefore === 1 ? '' : 's'}</strong>.</p>
  <p>Renewal date: <strong>${escapeHtml(renewalDateStr)}</strong>.</p>
  <p>To renew or update your billing, please visit your dashboard.</p>
  ${ctaButton(dashboardUrl, 'Go to Dashboard')}
  <p>If you have any questions, please contact support.</p>
  `;
  const html = buildEmailTemplate('Membership Renewal Reminder', content);
  const text = `Hello,\n\nThis is a reminder that your Aspire Coworks membership for ${companyName} will expire in ${daysBefore} day${daysBefore === 1 ? '' : 's'}.\n\nRenewal date: ${renewalDateStr}.\n\nTo renew or update your billing, visit: ${dashboardUrl}\n\nIf you have any questions, please contact support.\n\n— Aspire Coworks`;
  return { subject, html, text };
}
