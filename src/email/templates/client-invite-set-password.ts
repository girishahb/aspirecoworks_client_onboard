import { escapeHtml, wrapBrandedEmail, ctaButton } from './layout';

export interface ClientInviteSetPasswordParams {
  companyName: string;
  setPasswordUrl: string;
  expiryHours?: number;
}

export function clientInviteSetPassword(params: ClientInviteSetPasswordParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { companyName, setPasswordUrl, expiryHours = 48 } = params;

  const subject = 'Welcome to Aspire Coworks – Set Your Password';
  const content = `
  <p>Hello,</p>
  <p>You have been onboarded to <strong>Aspire Coworks</strong> for <strong>${escapeHtml(companyName)}</strong>.</p>
  <p>Click the button below to set your password and access your client portal. This link expires in ${expiryHours} hours.</p>
  ${ctaButton(setPasswordUrl, 'Set Password')}
  <p>If you didn't expect this email, you can ignore it.</p>
  `;

  const html = wrapBrandedEmail(content, 'Set Your Password');
  const text = `Hello,\n\nYou have been onboarded to Aspire Coworks for ${companyName}.\n\nSet your password: ${setPasswordUrl}\n\nThis link expires in ${expiryHours} hours.\n\nIf you didn't expect this email, you can ignore it.\n\n— Aspire Coworks`;
  return { subject, html, text };
}
