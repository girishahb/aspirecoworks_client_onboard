import { buildEmailTemplate, escapeHtml, ctaButton } from '../../common/email/email-template';

export interface PaymentLinkParams {
  companyName: string;
  amount: string;
  currency: string;
  paymentLink: string;
}

export function paymentLinkEmail(params: PaymentLinkParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { companyName, amount, currency, paymentLink } = params;
  const subject = `Payment Link for ${companyName}`;
  const content = `
  <p>Hello,</p>
  <p>Please use the link below to complete payment for <strong>${escapeHtml(companyName)}</strong>.</p>
  <p><strong>Amount:</strong> ${escapeHtml(currency)} ${escapeHtml(amount)}</p>
  ${ctaButton(paymentLink, 'Pay Now')}
  <p>If you have any questions, please contact support.</p>
  `;
  const html = buildEmailTemplate('Payment Link', content);
  const text = `Hello,\n\nPlease use the link below to complete payment for ${companyName}.\n\nAmount: ${currency} ${amount}\n\nPayment Link: ${paymentLink}\n\nIf you have any questions, please contact support.\n\n— Aspire Coworks`;
  return { subject, html, text };
}
