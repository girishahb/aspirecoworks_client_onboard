import { escapeHtml, wrapBrandedEmail, ctaButton } from './layout';

export interface AggregatorInviteCredentialsParams {
  aggregatorName: string;
  email: string;
  defaultPassword: string;
  loginUrl: string;
}

/**
 * Email sent to a newly-provisioned aggregator partner user with their login
 * credentials (default password). They can change the password after login.
 */
export function aggregatorInviteCredentials(params: AggregatorInviteCredentialsParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { aggregatorName, email, defaultPassword, loginUrl } = params;

  const subject = 'Welcome to Aspire Coworks – Your Partner Portal Access';

  const content = `
  <p>Hello,</p>
  <p>
    You have been set up as a partner user on the <strong>Aspire Coworks</strong>
    aggregator portal for <strong>${escapeHtml(aggregatorName)}</strong>.
  </p>
  <p>Use the credentials below to sign in:</p>
  <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">
    <tr>
      <td style="padding:8px 12px;background:#f1f5f9;border:1px solid #e2e8f0;font-family:monospace;font-size:14px;color:#334155;">
        <strong>Email:</strong> ${escapeHtml(email)}<br/>
        <strong>Password:</strong> ${escapeHtml(defaultPassword)}
      </td>
    </tr>
  </table>
  ${ctaButton(loginUrl, 'Sign in to your portal')}
  <p style="margin-top:18px;">
    Your password has been set to the value above. For security, please change it after
    your first sign-in from your portal account settings.
  </p>
  `;

  const html = wrapBrandedEmail(content, 'Your Partner Portal Access');

  const text = `Hello,

You have been set up as a partner user on the Aspire Coworks aggregator portal for ${aggregatorName}.

Sign in with these credentials:
  Email: ${email}
  Password: ${defaultPassword}

Sign in: ${loginUrl}

Your password has been set to the value above. For security, please change it after your first sign-in from your portal account settings.

— Aspire Coworks`;

  return { subject, html, text };
}
