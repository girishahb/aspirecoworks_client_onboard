import { escapeHtml, wrapBrandedEmail, ctaButton } from './layout';

export interface CompanyActivatedParams {
  companyName: string;
  activationDate?: Date;
  dashboardUrl?: string;
  supportEmail?: string;
}

export function companyActivated(params: CompanyActivatedParams): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    companyName,
    activationDate = new Date(),
    dashboardUrl = 'https://app.aspirecoworks.in/dashboard',
    supportEmail = 'support@aspirecoworks.com',
  } = params;
  const subject = 'Welcome to Aspire Coworks – Account Activated';
  const startDate = activationDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const content = `
  <p>Hello,</p>
  <p><strong>Welcome to Aspire Coworks.</strong> Your account for <strong>${escapeHtml(companyName)}</strong> is now activated.</p>
  <p><strong>Confirmation:</strong> Your onboarding is complete and access is enabled.</p>
  <p><strong>Start date:</strong> ${escapeHtml(startDate)}</p>
  <p>Sign in to your dashboard to access resources. For any questions, contact us at <a href="mailto:${supportEmail}">${escapeHtml(supportEmail)}</a>.</p>
  ${ctaButton(dashboardUrl, 'Go to dashboard')}
  `;

  const html = wrapBrandedEmail(content, 'Account Activated');
  const text = `Hello,\n\nWelcome to Aspire Coworks. Your account for ${companyName} is now activated.\n\nConfirmation: Your onboarding is complete and access is enabled.\nStart date: ${startDate}\n\nSign in to your dashboard: ${dashboardUrl}\nFor support: ${supportEmail}\n\n— Aspire Coworks`;
  return { subject, html, text };
}
