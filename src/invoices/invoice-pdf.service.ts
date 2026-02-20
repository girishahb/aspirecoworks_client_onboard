import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';

@Injectable()
export class InvoicePdfService {
  constructor(private config: ConfigService) {}

  /**
   * Generate GST-compliant invoice PDF.
   */
  async generateInvoicePdf(invoice: any): Promise<Buffer> {
    const companyName = this.config.get<string>('COMPANY_NAME') || 'Aspire Coworks';
    const companyLogoUrl = this.config.get<string>('COMPANY_LOGO_URL') || '';
    const companyGstNumber = this.config.get<string>('COMPANY_GST_NUMBER') || '';
    const companyAddress = this.config.get<string>('COMPANY_ADDRESS') || '';
    const gstRate = parseFloat(this.config.get<string>('GST_RATE') || '18');

    let logoBuffer: Buffer | null = null;
    if (companyLogoUrl) {
      try {
        const res = await fetch(companyLogoUrl);
        if (res.ok) logoBuffer = Buffer.from(await res.arrayBuffer());
      } catch {
        /* fallback to text-only */
      }
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];
      // A4: 595.28 x 841.89 pt; content width with margin 50 each side
      const pageContentWidth = 595.28 - 100;

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // Header
      const headerY = 50;
      if (logoBuffer) {
        doc.image(logoBuffer, 50, headerY, { fit: [120, 48] });
        doc.y = headerY + 48 + 8;
      }
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .text(companyName, 50, doc.y, { width: pageContentWidth, align: 'left' })
        .moveDown(0.5);

      if (companyGstNumber) {
        doc
          .fontSize(10)
          .font('Helvetica')
          .text(`GSTIN: ${companyGstNumber}`, { align: 'left' })
          .moveDown(0.3);
      }

      if (companyAddress) {
        const addressLines = companyAddress.split('\n').filter(Boolean);
        addressLines.forEach((line) => {
          doc
            .fontSize(9)
            .font('Helvetica')
            .text(line, { align: 'left' });
        });
        doc.moveDown(1);
      }

      // Invoice Title
      doc
        .fontSize(24)
        .font('Helvetica-Bold')
        .text('TAX INVOICE', { align: 'right' })
        .moveDown(1);

      // Invoice Details Section
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Invoice Number: ${invoice.invoiceNumber}`, { align: 'left' })
        .text(`Date: ${new Date(invoice.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' })}`, {
          align: 'left',
        })
        .moveDown(1);

      // Bill To Section
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('Bill To:', { align: 'left' })
        .moveDown(0.3);

      doc
        .fontSize(10)
        .font('Helvetica')
        .text(invoice.billingName, { align: 'left' })
        .moveDown(0.2);

      if (invoice.gstNumber) {
        doc.text(`GSTIN: ${invoice.gstNumber}`, { align: 'left' }).moveDown(0.2);
      }

      const billingLines = invoice.billingAddress.split(',').filter(Boolean);
      billingLines.forEach((line: string) => {
        doc.text(line.trim(), { align: 'left' });
      });
      doc.moveDown(2);

      // Payment Reference
      if (invoice.payment?.providerPaymentId) {
        doc
          .fontSize(9)
          .font('Helvetica')
          .text(`Payment Reference: ${invoice.payment.providerPaymentId}`, { align: 'left' })
          .moveDown(1);
      }

      // Items Table: columns fit within content width (495pt)
      const colDescX = 50;
      const colDescWidth = 310;
      const colAmountX = 50 + colDescWidth;
      const colAmountWidth = 60;
      const colGstX = colAmountX + colAmountWidth;
      const colGstWidth = 60;
      const colTotalX = colGstX + colGstWidth;
      const colTotalWidth = 60;
      const tableRight = colTotalX + colTotalWidth;

      // Items Table Header (each cell has explicit width)
      const tableTop = doc.y;
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Description', colDescX, tableTop, { width: colDescWidth });
      doc.text('Amount', colAmountX, tableTop, { width: colAmountWidth, align: 'right' });
      doc.text('GST (18%)', colGstX, tableTop, { width: colGstWidth, align: 'right' });
      doc.text('Total', colTotalX, tableTop, { width: colTotalWidth, align: 'right' });
      doc.moveDown(0.5);

      doc
        .moveTo(colDescX, doc.y)
        .lineTo(tableRight, doc.y)
        .stroke()
        .moveDown(0.5);

      // Invoice Item row: description in its column; amounts in their columns with width
      const itemRowY = doc.y;
      doc.fontSize(10).font('Helvetica');
      doc.text('Coworking Service', colDescX, itemRowY, { width: colDescWidth });
      doc.text(`₹${invoice.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, colAmountX, itemRowY, {
        width: colAmountWidth,
        align: 'right',
      });
      doc.text(`₹${invoice.gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, colGstX, itemRowY, {
        width: colGstWidth,
        align: 'right',
      });
      doc.text(`₹${invoice.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, colTotalX, itemRowY, {
        width: colTotalWidth,
        align: 'right',
      });
      doc.y = Math.max(doc.y, itemRowY);
      doc.moveDown(1);

      doc
        .moveTo(colDescX, doc.y)
        .lineTo(tableRight, doc.y)
        .stroke()
        .moveDown(0.5);

      // Total Section: single line in a right-aligned box so it is not clipped
      const totalY = doc.y;
      const rightBlockX = 350;
      const rightBlockWidth = pageContentWidth - (rightBlockX - 50);
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text(
        `Total Amount: ₹${invoice.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        rightBlockX,
        totalY,
        { width: rightBlockWidth, align: 'right' },
      );
      doc.moveDown(2);

      // GST Breakdown: same right-side box so "Amount (before GST):" is not cut off
      doc.fontSize(9).font('Helvetica');
      doc.text(
        `Amount (before GST): ₹${invoice.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        rightBlockX,
        doc.y,
        { width: rightBlockWidth, align: 'right' },
      );
      doc.text(
        `GST (${gstRate}%): ₹${invoice.gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        rightBlockX,
        doc.y,
        { width: rightBlockWidth, align: 'right' },
      );
      doc.moveDown(2);

      // Footer: full content width so center alignment works
      const footerY = doc.page.height - 100;
      doc.fontSize(8).font('Helvetica-Oblique');
      doc.text('This is a system generated invoice.', 50, footerY, {
        width: pageContentWidth,
        align: 'center',
      });
      doc.text('For any queries, please contact support@aspirecoworks.com', 50, doc.y, {
        width: pageContentWidth,
        align: 'center',
      });

      doc.end();
    });
  }
}
