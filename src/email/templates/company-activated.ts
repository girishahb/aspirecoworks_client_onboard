function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface CompanyActivatedParams {
  companyName: string;
  dashboardUrl?: string;
}

export function companyActivated(params: CompanyActivatedParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { companyName, dashboardUrl = 'https://app.aspirecoworks.com/dashboard' } = params;
  const subject = `Access enabled – ${companyName}`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #333; max-width: 560px;">
  <p>Hello,</p>
  <p><strong>${escapeHtml(companyName)}</strong> is now active on Aspire Coworks.</p>
  <p>Access enabled – welcome to Aspire Coworks. Go to your dashboard: ${escapeHtml(dashboardUrl)}</p>
  <p>— Aspire Coworks</p>
</body>
</html>`;
  const text = `Hello,\n\n${companyName} is now active on Aspire Coworks.\n\nAccess enabled – welcome to Aspire Coworks. Go to your dashboard: ${dashboardUrl}\n\n— Aspire Coworks`;
  return { subject, html, text };
}
