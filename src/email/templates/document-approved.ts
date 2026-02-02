function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
  const { companyName, documentType, statusUrl = 'https://app.aspirecoworks.com/status' } = params;
  const subject = `Document approved – ${companyName}`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #333; max-width: 560px;">
  <p>Hello,</p>
  <p>Your document (<strong>${escapeHtml(documentType)}</strong>) for <strong>${escapeHtml(companyName)}</strong> has been approved.</p>
  <p>View your onboarding status: ${escapeHtml(statusUrl)}</p>
  <p>— Aspire Coworks</p>
</body>
</html>`;
  const text = `Hello,\n\nYour document (${documentType}) for ${companyName} has been approved.\n\nView your onboarding status: ${statusUrl}\n\n— Aspire Coworks`;
  return { subject, html, text };
}
