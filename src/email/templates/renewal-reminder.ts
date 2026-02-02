function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #333; max-width: 560px;">
  <p>Hello,</p>
  <p>This is a reminder that your Aspire Coworks membership for <strong>${escapeHtml(companyName)}</strong> will expire in <strong>${daysBefore} day${daysBefore === 1 ? '' : 's'}</strong>.</p>
  <p>Renewal date: <strong>${escapeHtml(renewalDateStr)}</strong>.</p>
  <p>To renew or update your billing, visit: ${escapeHtml(dashboardUrl)}</p>
  <p>If you have any questions, please contact support.</p>
  <p>— Aspire Coworks</p>
</body>
</html>`;
  const text = `Hello,\n\nThis is a reminder that your Aspire Coworks membership for ${companyName} will expire in ${daysBefore} day${daysBefore === 1 ? '' : 's'}.\n\nRenewal date: ${renewalDateStr}.\n\nTo renew or update your billing, visit: ${dashboardUrl}\n\nIf you have any questions, please contact support.\n\n— Aspire Coworks`;
  return { subject, html, text };
}
