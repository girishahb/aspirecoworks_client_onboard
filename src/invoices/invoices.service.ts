import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicePdfPuppeteerService } from './invoice-pdf-puppeteer.service';
import { R2Service } from '../storage/r2.service';
import { EmailService } from '../email/email.service';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  private s3Client: S3Client;
  private bucketName: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private pdfService: InvoicePdfService,
    private pdfPuppeteerService: InvoicePdfPuppeteerService,
    private r2Service: R2Service,
    private emailService: EmailService,
  ) {
    // Initialize S3 client for direct uploads
    const endpoint = this.config.get<string>('R2_ENDPOINT');
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY');
    const bucket = this.config.get<string>('R2_BUCKET_NAME');

    if (endpoint && accessKeyId && secretAccessKey && bucket) {
      this.bucketName = bucket;
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    }
  }

  /**
   * Generate invoice number in format: INV/AC{FY}/{runningNumber}
   * FY: If month >= April: currentYear-nextYear (e.g. 25-26)
   *     Else: previousYear-currentYear (e.g. 24-25)
   */
  async generateInvoiceNumber(): Promise<string> {
    const now = new Date();
    const month = now.getMonth();
    const currentYear = now.getFullYear();

    let fyStart: number;
    let fyEnd: number;
    if (month >= 3) {
      // April (3) onward: FY = currentYear - nextYear
      fyStart = currentYear;
      fyEnd = currentYear + 1;
    } else {
      fyStart = currentYear - 1;
      fyEnd = currentYear;
    }
    const fyLabel = `${fyStart.toString().slice(-2)}-${fyEnd.toString().slice(-2)}`;
    const prefix = `INV/AC${fyLabel}/`;

    const latestInvoice = await this.prisma.invoice.findFirst({
      where: {
        invoiceNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        invoiceNumber: 'desc',
      },
    });

    let nextNumber = 1;
    if (latestInvoice) {
      const match = latestInvoice.invoiceNumber.match(/\/(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    const numberStr = nextNumber.toString().padStart(4, '0');
    return `${prefix}${numberStr}`;
  }

  /**
   * Generate invoice automatically after payment success.
   * Prevents duplicate invoices. Applies GST (Karnataka→CGST+SGST, other→IGST),
   * TDS if configured, creates PDF via Puppeteer, emails with attachment.
   */
  async generateInvoiceForPayment(paymentId: string): Promise<any> {
    // STEP 7: Prevent duplicate invoice
    const existing = await this.prisma.invoice.findFirst({
      where: { paymentId },
    });
    if (existing) {
      this.logger.log(
        `Invoice already exists for paymentId=${paymentId}, invoiceNumber=${existing.invoiceNumber}`,
      );
      return existing;
    }

    // STEP 1: Fetch payment and company
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { clientProfile: true },
    });
    if (!payment) {
      throw new NotFoundException(`Payment not found: ${paymentId}`);
    }
    if (payment.status !== 'PAID') {
      throw new BadRequestException(`Payment status is not PAID: ${payment.status}`);
    }
    const company = payment.clientProfile;

    // STEP 2-3: Taxable amount and GST logic
    const taxableAmount = payment.amount;
    const gstRate = parseFloat(this.config.get<string>('GST_RATE') || '18') / 100;
    const isKarnataka = this.isKarnatakaState(company.state, company.gstNumber);
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;
    if (isKarnataka) {
      cgstAmount = taxableAmount * (gstRate / 2);
      sgstAmount = taxableAmount * (gstRate / 2);
    } else {
      igstAmount = taxableAmount * gstRate;
    }
    const gstAmount = cgstAmount + sgstAmount + igstAmount;

    // STEP 5: TDS logic (if applicable)
    const tdsRate = parseFloat(this.config.get<string>('TDS_RATE') || '0');
    const tdsApplicable = this.config.get<string>('TDS_APPLICABLE') === 'true' && tdsRate > 0;
    const tdsAmount = tdsApplicable ? taxableAmount * (tdsRate / 100) : 0;
    const totalAmount = taxableAmount + gstAmount - tdsAmount;

    const billingName = company.billingName || company.companyName;
    const billingAddress =
      company.billingAddress ||
      [company.address, company.city, company.state, company.zipCode, company.country]
        .filter(Boolean)
        .join(', ') ||
      'Address not provided';

    // STEP 4: Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber();

    // STEP 6: Create invoice DB record
    const invoice = await this.prisma.invoice.create({
      data: {
        companyId: company.id,
        paymentId: payment.id,
        invoiceNumber,
        amount: taxableAmount,
        gstAmount,
        totalAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        gstNumber: company.gstNumber || null,
        billingName,
        billingAddress,
      },
      include: {
        company: { select: { id: true, companyName: true, contactEmail: true } },
        payment: {
          select: { id: true, amount: true, currency: true, providerPaymentId: true, paidAt: true },
        },
      },
    });

    // STEP 8: Logging
    this.logger.log(
      `Invoice created for companyId=${company.id}, invoiceNumber=${invoiceNumber}, paymentId=${paymentId}`,
    );

    // Generate PDF, upload, send email with attachment (sequential so we can attach PDF)
    try {
      const pdfBuffer = await this.pdfPuppeteerService.generateInvoicePdf(invoice as any);
      const fileKey = `invoices/${invoice.companyId}/${invoice.invoiceNumber}.pdf`;
      if (!this.s3Client || !this.bucketName) {
        throw new ServiceUnavailableException(
          'Storage not configured. Set R2_* env vars for invoice PDFs.',
        );
      }
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: fileKey,
          Body: pdfBuffer,
          ContentType: 'application/pdf',
        }),
      );
      const downloadUrl = await this.r2Service.generateDownloadUrl(fileKey, 3600 * 24 * 7);
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { pdfUrl: downloadUrl, pdfFileKey: fileKey },
      });
      await this.sendInvoiceEmailWithAttachment(invoice.id, pdfBuffer);
    } catch (err) {
      this.logger.error(
        `Invoice PDF/email failed for invoiceId=${invoice.id}, invoiceNumber=${invoiceNumber}`,
        err,
      );
      // Fallback: try legacy PDF + link email
      try {
        await this.generateAndStorePdf(invoice.id);
        await this.sendInvoiceEmail(invoice.id);
      } catch (fallbackErr) {
        this.logger.error(`Fallback PDF/email also failed for invoice ${invoice.id}`, fallbackErr);
      }
    }

    return invoice;
  }

  /** @deprecated Use generateInvoiceForPayment */
  async createInvoiceForPayment(paymentId: string): Promise<any> {
    return this.generateInvoiceForPayment(paymentId);
  }

  private isKarnatakaState(state?: string | null, gstNumber?: string | null): boolean {
    const s = (state || '').toLowerCase().trim();
    if (s === 'karnataka' || s === 'ka') return true;
    const gst = (gstNumber || '').trim();
    if (gst.length >= 2 && gst.slice(0, 2) === '29') return true; // State code 29 = Karnataka
    return false;
  }

  /**
   * Generate PDF and store in R2/S3.
   * Uses Puppeteer (HTML template) when invoice has CGST/SGST/IGST split, else PDFKit.
   */
  async generateAndStorePdf(invoiceId: string): Promise<void> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        company: {
          select: {
            companyName: true,
            contactEmail: true,
            gstNumber: true,
          },
        },
        payment: {
          select: {
            amount: true,
            currency: true,
            providerPaymentId: true,
            paidAt: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice not found: ${invoiceId}`);
    }

    const usePuppeteer =
      (invoice.cgstAmount != null && invoice.cgstAmount > 0) ||
      (invoice.sgstAmount != null && invoice.sgstAmount > 0) ||
      (invoice.igstAmount != null && invoice.igstAmount > 0);
    const pdfBuffer = usePuppeteer
      ? await this.pdfPuppeteerService.generateInvoicePdf(invoice as any)
      : await this.pdfService.generateInvoicePdf(invoice);

    // Upload to storage
    const fileKey = `invoices/${invoice.companyId}/${invoice.invoiceNumber}.pdf`;

    // Upload directly using S3 client
    if (!this.s3Client || !this.bucketName) {
      throw new ServiceUnavailableException(
        'Storage is not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME to generate invoice PDFs.',
      );
    }

    const putCommand = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
    });

    await this.s3Client.send(putCommand);

    // Generate download URL and update invoice
    // S3/R2 Sig V4: presigned URLs must expire in ≤ 7 days (604800 seconds)
    const downloadUrl = await this.r2Service.generateDownloadUrl(fileKey, 3600 * 24 * 7);

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        pdfUrl: downloadUrl,
        pdfFileKey: fileKey,
      },
    });

    this.logger.log(`PDF generated and stored for invoice ${invoice.invoiceNumber}`);
  }

  /**
   * Send invoice email with PDF attachment.
   * Subject: Tax Invoice INV/ACxx/xxxx – Aspire Coworks
   */
  async sendInvoiceEmailWithAttachment(invoiceId: string, pdfBuffer: Buffer): Promise<void> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        company: { select: { companyName: true, contactEmail: true } },
      },
    });
    if (!invoice) return;
    const to = invoice.company?.contactEmail;
    if (!to) {
      this.logger.warn(`No contact email for company ${invoice.companyId}`);
      return;
    }
    const subject = `Tax Invoice ${invoice.invoiceNumber} – Aspire Coworks`;
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #333; max-width: 560px;">
  <p>Hello,</p>
  <p>Please find your tax invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong> for <strong>${escapeHtml(invoice.company?.companyName ?? '')}</strong> attached.</p>
  <p><strong>Amount:</strong> ₹${invoice.totalAmount.toLocaleString('en-IN')}</p>
  <p>The invoice PDF is attached to this email.</p>
  <p>If you have any questions, please contact support.</p>
  <p>— Aspire Coworks</p>
</body>
</html>`;
    const text = `Your tax invoice ${invoice.invoiceNumber} is attached. Amount: ₹${invoice.totalAmount.toLocaleString('en-IN')}. — Aspire Coworks`;
    await this.emailService.sendEmail({
      to,
      subject,
      html,
      text,
      attachments: [{ filename: `${invoice.invoiceNumber}.pdf`, content: pdfBuffer }],
    });
    this.logger.log(`Invoice email with attachment sent for ${invoice.invoiceNumber}`);
  }

  /**
   * Send invoice email with download link (fallback when PDF attachment fails).
   */
  async sendInvoiceEmail(invoiceId: string): Promise<void> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        company: {
          select: {
            companyName: true,
            contactEmail: true,
          },
        },
      },
    });

    if (!invoice || !invoice.pdfUrl) {
      this.logger.warn(`Invoice ${invoiceId} PDF not ready yet, skipping email`);
      return;
    }

    const to = invoice.company.contactEmail;
    if (!to) {
      this.logger.warn(`No contact email for company ${invoice.companyId}`);
      return;
    }

    const subject = `Your Invoice from Aspire Coworks - ${invoice.invoiceNumber}`;
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #333; max-width: 560px;">
  <p>Hello,</p>
  <p>Your invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong> for <strong>${escapeHtml(invoice.company.companyName)}</strong> is ready.</p>
  <p><strong>Amount:</strong> ₹${invoice.totalAmount.toLocaleString('en-IN')}</p>
  <p><a href="${escapeHtml(invoice.pdfUrl)}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Download Invoice PDF</a></p>
  <p>If you have any questions, please contact support.</p>
  <p>— Aspire Coworks</p>
</body>
</html>`;

    const text = `Hello,\n\nYour invoice ${invoice.invoiceNumber} for ${invoice.company.companyName} is ready.\n\nAmount: ₹${invoice.totalAmount.toLocaleString('en-IN')}\n\nDownload: ${invoice.pdfUrl}\n\n— Aspire Coworks`;

    await this.emailService.sendEmail({
      to,
      subject,
      html,
      text,
    });

    this.logger.log(`Invoice email sent for ${invoice.invoiceNumber}`);
  }

  /**
   * List invoices for admin.
   */
  async findAll(filters: {
    companyId?: string;
    page?: number;
    limit?: number;
  }) {
    const { companyId, page: pageIn = 1, limit: limitIn = 50 } = filters;
    const page = typeof pageIn === 'number' && Number.isFinite(pageIn) ? pageIn : 1;
    const limit = typeof limitIn === 'number' && Number.isFinite(limitIn) ? limitIn : 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          company: {
            select: {
              id: true,
              companyName: true,
            },
          },
          payment: {
            select: {
              id: true,
              providerPaymentId: true,
              paidAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data: invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get invoice by ID.
   */
  async findOne(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        company: {
          select: {
            id: true,
            companyName: true,
            contactEmail: true,
            gstNumber: true,
          },
        },
        payment: {
          select: {
            id: true,
            amount: true,
            currency: true,
            providerPaymentId: true,
            paidAt: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice not found: ${invoiceId}`);
    }

    return invoice;
  }

  /**
   * Get download URL for invoice PDF.
   */
  async getDownloadUrl(invoiceId: string): Promise<{ downloadUrl: string; fileName: string }> {
    try {
      const invoice = await this.findOne(invoiceId);

      if (!invoice.pdfFileKey) {
        // Generate PDF if not exists
        await this.generateAndStorePdf(invoiceId);
        const updated = await this.findOne(invoiceId);
        if (!updated.pdfUrl) {
          throw new BadRequestException('PDF generation in progress. Please try again later.');
        }
        return {
          downloadUrl: updated.pdfUrl!,
          fileName: `${invoice.invoiceNumber}.pdf`,
        };
      }

      // Generate fresh presigned URL
      const downloadUrl = await this.r2Service.generateDownloadUrl(
        invoice.pdfFileKey,
        3600, // 1 hour expiry
      );

      return {
        downloadUrl,
        fileName: `${invoice.invoiceNumber}.pdf`,
      };
    } catch (err: any) {
      // Re-throw Nest HTTP exceptions as-is so they return proper status + message
      if (
        err instanceof NotFoundException ||
        err instanceof BadRequestException ||
        err instanceof ServiceUnavailableException
      ) {
        throw err;
      }
      const rawMessage = err?.message ?? String(err);
      this.logger.warn(`Invoice download failed for ${invoiceId}: ${rawMessage}`, err?.stack);
      // Surface the actual error so user can fix config (e.g. bucket name, permissions)
      const safeMessage =
        typeof rawMessage === 'string' && rawMessage.length < 200
          ? rawMessage
          : 'Storage or PDF generation failed. Check server logs.';
      throw new ServiceUnavailableException(
        `Unable to generate download link: ${safeMessage}`,
      );
    }
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
