/**
 * Branded email layout and CTA helpers for Aspire Coworks.
 */

const BRAND_COLOR = '#1565c0';
const FOOTER_COLOR = '#666';

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function brandedHeader(): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; margin: 0 auto;">
  <tr>
    <td style="padding: 24px 0 16px 0; border-bottom: 3px solid ${BRAND_COLOR};">
      <span style="font-size: 20px; font-weight: 700; color: ${BRAND_COLOR};">Aspire Coworks</span>
    </td>
  </tr>
</table>`;
}

export function brandedFooter(): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; margin: 0 auto;">
  <tr>
    <td style="padding: 24px 0; border-top: 1px solid #eee; font-size: 12px; color: ${FOOTER_COLOR};">
      This email was sent by Aspire Coworks. If you have questions, please contact support.
    </td>
  </tr>
</table>`;
}

export function ctaButton(url: string, label: string): string {
  const escapedUrl = escapeHtml(url);
  const escapedLabel = escapeHtml(label);
  return `
<table cellpadding="0" cellspacing="0" style="margin: 20px 0;">
  <tr>
    <td>
      <a href="${escapedUrl}" style="display: inline-block; padding: 14px 28px; background-color: ${BRAND_COLOR}; color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 6px;">
        ${escapedLabel}
      </a>
    </td>
  </tr>
</table>`;
}

export function wrapBrandedEmail(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aspire Coworks</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 560px; margin: 0 auto; padding: 0 16px;">
${brandedHeader()}
<table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px;">
  <tr>
    <td style="padding: 24px 0;">
      ${content}
    </td>
  </tr>
</table>
${brandedFooter()}
</body>
</html>`;
}
