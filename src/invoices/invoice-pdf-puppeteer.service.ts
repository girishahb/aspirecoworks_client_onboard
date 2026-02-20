import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as puppeteer from 'puppeteer';

export interface InvoiceForPdf {
  id: string;
  invoiceNumber: string;
  amount: number;
  gstAmount: number;
  totalAmount: number;
  cgstAmount?: number | null;
  sgstAmount?: number | null;
  igstAmount?: number | null;
  billingName: string;
  billingAddress: string;
  gstNumber?: string | null;
  createdAt: Date;
  company?: { companyName?: string; contactEmail?: string; gstNumber?: string | null };
  payment?: {
    amount: number;
    currency: string;
    providerPaymentId?: string | null;
    paidAt: Date | null;
  };
}

@Injectable()
export class InvoicePdfPuppeteerService {
  constructor(private config: ConfigService) {}

  /**
   * Resolve Chrome executable path for Render/production where Puppeteer's default
   * cache (/opt/render/.cache/puppeteer) may not contain the browser from build.
   * We install to ./puppeteer-cache during build; find it here.
   */
  private resolveChromeExecutablePath(): string | undefined {
    const explicitPath = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (explicitPath && fs.existsSync(explicitPath)) return explicitPath;

    // Try multiple base paths: env, cwd, and __dirname (bundled app runs from dist/)
    const projectRoot = process.cwd();
    const candidates = [
      process.env.PUPPETEER_CACHE_DIR,
      path.join(projectRoot, 'puppeteer-cache'),
      path.resolve(projectRoot, 'puppeteer-cache'),
      // When bundled, __dirname points to dist/; project root is parent
      path.resolve(__dirname, '..', 'puppeteer-cache'),
      path.resolve(__dirname, '..', '..', 'puppeteer-cache'),
      '/opt/render/project/src/puppeteer-cache', // Render default project path
    ].filter(Boolean) as string[];

    for (const cacheDir of candidates) {
      const chromeDir = path.join(cacheDir, 'chrome');
      if (!fs.existsSync(chromeDir)) continue;
      try {
        const entries = fs.readdirSync(chromeDir, { withFileTypes: true });
        for (const ent of entries) {
          if (!ent.isDirectory() || !ent.name.startsWith('linux-')) continue;
          const versionDir = path.join(chromeDir, ent.name);
          const chrome64 = path.join(versionDir, 'chrome-linux64', 'chrome');
          const chromeDirAlt = path.join(versionDir, 'chrome-linux', 'chrome');
          if (fs.existsSync(chrome64)) return chrome64;
          if (fs.existsSync(chromeDirAlt)) return chromeDirAlt;
        }
      } catch {
        /* ignore */
      }
    }
    return undefined;
  }

  /**
   * Generate GST-compliant invoice PDF using Puppeteer + HTML template.
   * Includes: logo, GSTIN, invoice number, date, Bill To, SAC 997212,
   * CGST/SGST or IGST split, bank details, authorized signature, amount in words.
   */
  async generateInvoicePdf(invoice: InvoiceForPdf): Promise<Buffer> {
    const companyName = this.config.get<string>('COMPANY_NAME') || 'Aspire Coworks';
    const companyLogoUrl = this.config.get<string>('COMPANY_LOGO_URL') || '';
    const companyGstNumber = this.config.get<string>('COMPANY_GST_NUMBER') || '';
    const companyAddress = (this.config.get<string>('COMPANY_ADDRESS') || '')
      .split('\n')
      .filter(Boolean)
      .join('<br/>');
    const bankDetails = this.config.get<string>('BANK_DETAILS') || '';
    const gstRate = parseFloat(this.config.get<string>('GST_RATE') || '18');

    const invoiceDate = new Date(invoice.createdAt).toLocaleDateString('en-IN', {
      dateStyle: 'long',
    });
    const isKarnataka = (invoice.cgstAmount ?? 0) > 0 || (invoice.sgstAmount ?? 0) > 0;
    const amountInWords = this.numberToWords(invoice.totalAmount);

    const billingLines = invoice.billingAddress.split(',').map((s) => s.trim()).filter(Boolean);

    const companyHeaderLogo = companyLogoUrl ? `<img src="${escapeHtml(companyLogoUrl)}" class="logo" alt="${escapeHtml(companyName)}" />` : '';
    const companyHeaderSvg = !companyLogoUrl
      ? (() => {
          const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 40' preserveAspectRatio='xMinYMid meet'><text x='0' y='28' font-family='Arial' font-weight='bold' font-size='18' fill='%23134b7f'>${escapeHtml(companyName)}</text></svg>`;
          return `<img src="data:image/svg+xml,${encodeURIComponent(svg)}" class="logo" alt="${escapeHtml(companyName)}" />`;
        })()
      : '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Tax Invoice ${escapeHtml(invoice.invoiceNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #333; margin: 0; padding: 24px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #134b7f; padding-bottom: 16px; }
    .logo { max-height: 48px; }
    .company { text-align: left; }
    .company h1 { margin: 0 0 4px 0; font-size: 20px; color: #134b7f; font-weight: bold; max-width: 100%; word-wrap: break-word; }
    .company .gstin { font-size: 10px; color: #666; }
    .company .address { font-size: 9px; line-height: 1.4; color: #444; margin-top: 4px; }
    .title { font-size: 22px; font-weight: bold; color: #134b7f; text-align: right; }
    .meta { display: flex; justify-content: space-between; margin: 16px 0; }
    .meta-item { font-size: 10px; }
    .meta-item strong { display: block; margin-bottom: 2px; }
    .bill-to { margin: 20px 0; }
    .bill-to h3 { margin: 0 0 8px 0; font-size: 12px; color: #134b7f; }
    .bill-to .name { font-weight: bold; }
    .bill-to .address { font-size: 10px; line-height: 1.5; color: #444; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { padding: 8px 12px; text-align: left; border: 1px solid #ddd; }
    th { background: #134b7f; color: white; font-size: 10px; }
    td { font-size: 10px; }
    .text-right { text-align: right; }
    .totals { margin-top: 16px; float: right; text-align: right; width: 280px; }
    .totals .row { display: flex; justify-content: space-between; margin: 4px 0; font-size: 10px; }
    .totals .total { font-size: 14px; font-weight: bold; color: #134b7f; margin-top: 8px; }
    .amount-words { margin: 24px 0; font-size: 10px; font-style: italic; }
    .bank-details { margin: 16px 0; font-size: 9px; white-space: pre-wrap; }
    .signature { margin-top: 40px; text-align: right; }
    .signature .label { font-size: 10px; margin-top: 40px; border-top: 1px solid #333; padding-top: 8px; display: inline-block; }
    .footer { margin-top: 48px; font-size: 8px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company">
      ${companyHeaderLogo || companyHeaderSvg}
      <h1 class="company-name">${escapeHtml(companyName)}</h1>
      ${companyGstNumber ? `<div class="gstin">GSTIN: ${escapeHtml(companyGstNumber)}</div>` : ''}
      ${companyAddress ? `<div class="address">${companyAddress}</div>` : ''}
    </div>
    <div class="title">TAX INVOICE</div>
  </div>

  <div class="meta">
    <div class="meta-item">
      <strong>Invoice Number</strong> ${escapeHtml(invoice.invoiceNumber)}
    </div>
    <div class="meta-item">
      <strong>Invoice Date</strong> ${escapeHtml(invoiceDate)}
    </div>
    ${invoice.payment?.providerPaymentId ? `<div class="meta-item"><strong>Payment Ref</strong> ${escapeHtml(invoice.payment.providerPaymentId)}</div>` : ''}
  </div>

  <div class="bill-to">
    <h3>Bill To</h3>
    <div class="name">${escapeHtml(invoice.billingName)}</div>
    ${invoice.gstNumber ? `<div class="address">GSTIN: ${escapeHtml(invoice.gstNumber)}</div>` : ''}
    ${billingLines.length ? `<div class="address">${billingLines.map((l) => escapeHtml(l)).join('<br/>')}</div>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="text-right">HSN/SAC</th>
        <th class="text-right">Amount (₹)</th>
        ${isKarnataka ? '<th class="text-right">CGST (9%)</th><th class="text-right">SGST (9%)</th>' : '<th class="text-right">IGST (18%)</th>'}
        <th class="text-right">Total (₹)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Coworking Service</td>
        <td class="text-right">997212</td>
        <td class="text-right">${invoice.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        ${isKarnataka
          ? `<td class="text-right">${(invoice.cgstAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td><td class="text-right">${(invoice.sgstAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>`
          : `<td class="text-right">${(invoice.igstAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>`
        }
        <td class="text-right">${invoice.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Amount (before GST):</span><span>₹${invoice.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
    ${isKarnataka
      ? `<div class="row"><span>CGST (${gstRate / 2}%):</span><span>₹${(invoice.cgstAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
       <div class="row"><span>SGST (${gstRate / 2}%):</span><span>₹${(invoice.sgstAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>`
      : `<div class="row"><span>IGST (${gstRate}%):</span><span>₹${(invoice.igstAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>`
    }
    <div class="row total"><span>Total Amount:</span><span>₹${invoice.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
  </div>

  <div style="clear: both;"></div>

  <div class="amount-words">
    <strong>Amount in words:</strong> ${escapeHtml(amountInWords)} only
  </div>

  ${bankDetails ? `<div class="bank-details"><strong>Bank Details:</strong><br/>${escapeHtml(bankDetails).replace(/\n/g, '<br/>')}</div>` : ''}

  <div class="signature">
    <div class="label">Authorized Signatory</div>
  </div>

  <div class="footer">
    <p>This is a computer-generated invoice.</p>
    <p>For queries, contact support@aspirecoworks.com</p>
  </div>
</body>
</html>`;

    const executablePath = this.resolveChromeExecutablePath();
    const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    };
    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }
    const browser = await puppeteer.launch(launchOptions);

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: { top: '16px', right: '16px', bottom: '16px', left: '16px' },
        printBackground: true,
      });
      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }

  private numberToWords(num: number): string {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = [
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
    ];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const intPart = Math.floor(num);
    const decPart = Math.round((num - intPart) * 100);

    function toWords(n: number): string {
      if (n === 0) return '';
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) return `${tens[Math.floor(n / 10)]} ${ones[n % 10]}`.trim();
      if (n < 1000) return `${ones[Math.floor(n / 100)]} Hundred ${toWords(n % 100)}`.trim();
      if (n < 100000) return `${toWords(Math.floor(n / 1000))} Thousand ${toWords(n % 1000)}`.trim();
      if (n < 10000000) return `${toWords(Math.floor(n / 100000))} Lakh ${toWords(n % 100000)}`.trim();
      return `${toWords(Math.floor(n / 10000000))} Crore ${toWords(n % 10000000)}`.trim();
    }

    let result = `${toWords(intPart)} Rupees`;
    if (decPart > 0) {
      result += ` and ${toWords(decPart)} Paise`;
    }
    return result;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
