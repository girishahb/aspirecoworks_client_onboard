import { buildEmailTemplate, escapeHtml, ctaButton } from '../../common/email/email-template';
import type { PaymentGstBreakdownEmail } from '../../payments/payment-gst.util';

export interface PaymentLinkParams {
  companyName: string;
  currency: string;
  paymentLink: string;
  breakdown: PaymentGstBreakdownEmail;
}

function buildBreakdownHtml(breakdown: PaymentGstBreakdownEmail): string {
  if (!breakdown.hasGst) {
    return `<p><strong>Amount:</strong> ${escapeHtml(breakdown.totalAmount)}</p>`;
  }

  const lines = [
    `<p><strong>Base amount:</strong> ${escapeHtml(breakdown.taxableAmount ?? '')}</p>`,
  ];
  if (breakdown.cgstLabel && breakdown.cgstAmount) {
    lines.push(`<p><strong>${escapeHtml(breakdown.cgstLabel)}:</strong> ${escapeHtml(breakdown.cgstAmount)}</p>`);
  }
  if (breakdown.sgstLabel && breakdown.sgstAmount) {
    lines.push(`<p><strong>${escapeHtml(breakdown.sgstLabel)}:</strong> ${escapeHtml(breakdown.sgstAmount)}</p>`);
  }
  if (breakdown.igstLabel && breakdown.igstAmount) {
    lines.push(`<p><strong>${escapeHtml(breakdown.igstLabel)}:</strong> ${escapeHtml(breakdown.igstAmount)}</p>`);
  }
  lines.push(`<p><strong>Total payable:</strong> ${escapeHtml(breakdown.totalAmount)}</p>`);
  return lines.join('\n  ');
}

function buildBreakdownText(breakdown: PaymentGstBreakdownEmail): string {
  if (!breakdown.hasGst) {
    return `Amount: ${breakdown.totalAmount}`;
  }

  const lines = [`Base amount: ${breakdown.taxableAmount}`];
  if (breakdown.cgstLabel && breakdown.cgstAmount) {
    lines.push(`${breakdown.cgstLabel}: ${breakdown.cgstAmount}`);
  }
  if (breakdown.sgstLabel && breakdown.sgstAmount) {
    lines.push(`${breakdown.sgstLabel}: ${breakdown.sgstAmount}`);
  }
  if (breakdown.igstLabel && breakdown.igstAmount) {
    lines.push(`${breakdown.igstLabel}: ${breakdown.igstAmount}`);
  }
  lines.push(`Total payable: ${breakdown.totalAmount}`);
  return lines.join('\n');
}

export function paymentLinkEmail(params: PaymentLinkParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { companyName, currency, paymentLink, breakdown } = params;
  const subject = `Payment Link for ${companyName}`;
  const content = `
  <p>Hello,</p>
  <p>Please use the link below to complete payment for <strong>${escapeHtml(companyName)}</strong>.</p>
  ${buildBreakdownHtml(breakdown)}
  ${ctaButton(paymentLink, 'Pay Now')}
  <p>If you have any questions, please contact support.</p>
  `;
  const html = buildEmailTemplate('Payment Link', content);
  const text = `Hello,\n\nPlease use the link below to complete payment for ${companyName}.\n\n${buildBreakdownText(breakdown)}\n\nPayment Link: ${paymentLink}\n\nIf you have any questions, please contact support.\n\n— Aspire Coworks`;
  return { subject, html, text };
}
