/**
 * Global branded email template for Aspire Coworks.
 * All outgoing emails should use buildEmailTemplate for consistent corporate look.
 */

export const COMPANY_NAME = 'Aspire Coworks';
export const COMPANY_TAGLINE = 'Managed Office & Coworking Solutions';
export const LOGO_URL = 'https://aspirecoworks.in/wp-content/uploads/logo.png';
export const WEBSITE_URL = 'https://aspirecoworks.in';

/** Optional footer enhancements - configure via env or pass to buildEmailTemplate */
export interface EmailTemplateFooterOptions {
  supportEmail?: string;
  address?: string;
  gstin?: string;
}

/** Default footer - override via SUPPORT_EMAIL, COMPANY_ADDRESS, COMPANY_GSTIN env vars */
function getDefaultFooter(): EmailTemplateFooterOptions {
  return {
    supportEmail: process.env.SUPPORT_EMAIL ?? 'support@aspirecoworks.in',
    address: process.env.COMPANY_ADDRESS,
    gstin: process.env.COMPANY_GSTIN,
  };
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * CTA button for email content (e.g. "Reset Password", "Go to dashboard").
 */
export function ctaButton(url: string, label: string): string {
  const escapedUrl = escapeHtml(url);
  const escapedLabel = escapeHtml(label);
  return `
  <p style="margin: 24px 0;">
    <a href="${escapedUrl}" 
       style="background:#2563eb; color:#fff; padding:12px 24px; 
              border-radius:6px; text-decoration:none; font-weight:600; font-size:15px; display:inline-block;">
      ${escapedLabel}
    </a>
  </p>`;
}

/**
 * Build global branded email HTML.
 * @param title - Email section title (optional - pass empty string to omit)
 * @param content - HTML body content
 * @param footerOptions - Optional support email, address, GSTIN for footer
 */
export function buildEmailTemplate(
  title: string,
  content: string,
  footerOptions: EmailTemplateFooterOptions = {},
): string {
  const footer = { ...getDefaultFooter(), ...footerOptions };
  const titleBlock = title
    ? `<h3 style="color:#111827; margin:0 0 16px 0; font-size:18px;">${escapeHtml(title)}</h3>`
    : '';

  let footerExtra = '';
  if (footer.supportEmail) {
    footerExtra += `<br/>Support: <a href="mailto:${escapeHtml(footer.supportEmail)}" style="color:#2563eb; text-decoration:none;">${escapeHtml(footer.supportEmail)}</a>`;
  }
  if (footer.address) {
    footerExtra += `<br/>${escapeHtml(footer.address)}`;
  }
  if (footer.gstin) {
    footerExtra += `<br/>GSTIN: ${escapeHtml(footer.gstin)}`;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${COMPANY_NAME}</title>
</head>
<body style="font-family: Arial, sans-serif; background-color:#f4f6f8; padding:20px; margin:0;">
  <div style="max-width:600px; margin:0 auto; background:#ffffff; padding:30px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="text-align:center; margin-bottom:20px;">
      <img src="${LOGO_URL}" 
           alt="${escapeHtml(COMPANY_NAME)}"
           style="height:60px; max-width:180px;" />
      <h2 style="margin:10px 0 0 0; color:#1f2937; font-size:22px; font-weight:700;">
        ${escapeHtml(COMPANY_NAME)}
      </h2>
      <p style="color:#6b7280; font-size:14px; margin:4px 0 0 0;">
        ${escapeHtml(COMPANY_TAGLINE)}
      </p>
    </div>

    <hr style="border:none; border-top:1px solid #e5e7eb; margin:20px 0;" />

    ${titleBlock}

    <div style="font-size:15px; color:#374151; line-height:1.6;">
      ${content}
    </div>

    <hr style="border:none; border-top:1px solid #e5e7eb; margin:30px 0;" />

    <p style="font-size:13px; color:#6b7280; text-align:center; margin:0;">
      Regards,<br/>
      <strong>${escapeHtml(COMPANY_NAME)} Team</strong><br/>
      <a href="${WEBSITE_URL}" 
         style="color:#2563eb; text-decoration:none;">
        aspirecoworks.in
      </a>
      ${footerExtra}
    </p>
  </div>
</body>
</html>`;
}
