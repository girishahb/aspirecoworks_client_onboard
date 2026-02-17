import { escapeHtml, wrapBrandedEmail, ctaButton } from './layout';

export interface ResetPasswordParams {
  resetUrl: string;
  expiryMinutes?: number;
}

export function resetPasswordEmail(params: ResetPasswordParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { resetUrl, expiryMinutes = 30 } = params;

  const subject = 'Reset your Aspire Coworks password';
  const content = `
  <p>Hello,</p>
  <p>Click the button below to set a new password.</p>
  ${ctaButton(resetUrl, 'Reset Password')}
  <p>This link is valid for ${expiryMinutes} minutes.</p>
  <p>If you didn't request this, you can safely ignore this email.</p>
  `;

  const html = wrapBrandedEmail(content, 'Reset Your Password');
  const text = `Hello,\n\nClick below to set a new password: ${resetUrl}\n\nValid for ${expiryMinutes} minutes.\n\nIf you didn't request this, you can safely ignore this email.\n\n— Aspire Coworks`;
  return { subject, html, text };
}
