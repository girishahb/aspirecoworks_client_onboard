function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
  const { companyName, documentType, rejectionReason, uploadUrl = 'https://app.aspirecoworks.com/upload-documents' } = params;
  const subject = `Document needs attention – ${companyName}`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #333; max-width: 560px;">
  <p>Hello,</p>
  <p>Your document (<strong>${escapeHtml(documentType)}</strong>) for <strong>${escapeHtml(companyName)}</strong> was not approved.</p>
  <p>Reason: ${escapeHtml(rejectionReason)}</p>
  <p>Please upload a new version: ${escapeHtml(uploadUrl)}</p>
  <p>— Aspire Coworks</p>
</body>
</html>`;
  const text = `Hello,\n\nYour document (${documentType}) for ${companyName} was not approved.\n\nReason: ${rejectionReason}\n\nPlease upload a new version: ${uploadUrl}\n\n— Aspire Coworks`;
  return { subject, html, text };
}
