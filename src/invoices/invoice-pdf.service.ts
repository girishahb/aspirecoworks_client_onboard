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
    const companyGstNumber = this.config.get<string>('COMPANY_GST_NUMBER') || '';
    const companyAddress = this.config.get<string>('COMPANY_ADDRESS') || '';
    const gstRate = parseFloat(this.config.get<string>('GST_RATE') || '18');

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // Header
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .text(companyName, { align: 'left' })
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

      // Items Table Header
      const tableTop = doc.y;
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Description', 50, tableTop)
        .text('Amount', 400, tableTop, { align: 'right' })
        .text('GST (18%)', 480, tableTop, { align: 'right' })
        .text('Total', 550, tableTop, { align: 'right' })
        .moveDown(0.5);

      // Draw line under header
      doc
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .stroke()
        .moveDown(0.5);

      // Invoice Item
      doc
        .fontSize(10)
        .font('Helvetica')
        .text('Coworking Service', 50, doc.y)
        .text(`₹${invoice.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 400, doc.y, {
          align: 'right',
        })
        .text(`₹${invoice.gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 480, doc.y, {
          align: 'right',
        })
        .text(`₹${invoice.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 550, doc.y, {
          align: 'right',
        })
        .moveDown(1);

      // Draw line under item
      doc
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .stroke()
        .moveDown(0.5);

      // Total Section
      const totalY = doc.y;
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('Total Amount:', 400, totalY, { align: 'right' })
        .text(`₹${invoice.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 550, totalY, {
          align: 'right',
        })
        .moveDown(2);

      // GST Breakdown
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(`Amount (before GST): ₹${invoice.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, {
          align: 'right',
        })
        .text(`GST (${gstRate}%): ₹${invoice.gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, {
          align: 'right',
        })
        .moveDown(2);

      // Footer
      doc
        .fontSize(8)
        .font('Helvetica-Oblique')
        .text('This is a system generated invoice.', 50, doc.page.height - 100, {
          align: 'center',
        })
        .text('For any queries, please contact support@aspirecoworks.com', 50, doc.y, {
          align: 'center',
        });

      doc.end();
    });
  }
}
