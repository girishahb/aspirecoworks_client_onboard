import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { InvoicePdfService } from './invoice-pdf.service';
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
   * Generate invoice number in format: AC-YYYY-0001
   * Resets counter yearly.
   */
  async generateInvoiceNumber(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = `AC-${currentYear}-`;

    // Find the latest invoice for this year
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
      // Extract number from format AC-YYYY-NNNN
      const match = latestInvoice.invoiceNumber.match(/-(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    // Format with leading zeros (4 digits)
    const numberStr = nextNumber.toString().padStart(4, '0');
    return `${prefix}${numberStr}`;
  }

  /**
   * Create invoice automatically after payment success.
   * Prevents duplicate invoices for the same payment.
   */
  async createInvoiceForPayment(paymentId: string): Promise<any> {
    // Check if invoice already exists for this payment
    const existing = await this.prisma.invoice.findFirst({
      where: { paymentId },
    });

    if (existing) {
      this.logger.warn(`Invoice already exists for payment ${paymentId}`);
      return existing;
    }

    // Fetch payment and company details
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        clientProfile: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment not found: ${paymentId}`);
    }

    if (payment.status !== 'PAID') {
      throw new BadRequestException(`Payment status is not PAID: ${payment.status}`);
    }

    const company = payment.clientProfile;

    // Get GST configuration
    const gstRate = parseFloat(this.config.get<string>('GST_RATE') || '18') / 100;
    const companyGstNumber = this.config.get<string>('COMPANY_GST_NUMBER') || '';
    const companyName = this.config.get<string>('COMPANY_NAME') || 'Aspire Coworks';
    const companyAddress = this.config.get<string>('COMPANY_ADDRESS') || '';

    // Calculate GST amounts
    const baseAmount = payment.amount;
    const gstAmount = baseAmount * gstRate;
    const totalAmount = baseAmount + gstAmount;

    // Get billing details from company
    const billingName = company.billingName || company.companyName;
    const billingAddress =
      company.billingAddress ||
      [
        company.address,
        company.city,
        company.state,
        company.zipCode,
        company.country,
      ]
        .filter(Boolean)
        .join(', ') ||
      'Address not provided';

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber();

    // Create invoice record
    const invoice = await this.prisma.invoice.create({
      data: {
        companyId: company.id,
        paymentId: payment.id,
        invoiceNumber,
        amount: baseAmount,
        gstAmount,
        totalAmount,
        gstNumber: company.gstNumber || null,
        billingName,
        billingAddress,
      },
      include: {
        company: {
          select: {
            id: true,
            companyName: true,
            contactEmail: true,
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

    // Generate PDF asynchronously (don't block invoice creation)
    this.generateAndStorePdf(invoice.id).catch((err) => {
      this.logger.error(`Failed to generate PDF for invoice ${invoice.id}`, err);
    });

    // Send email asynchronously
    this.sendInvoiceEmail(invoice.id).catch((err) => {
      this.logger.error(`Failed to send invoice email for invoice ${invoice.id}`, err);
    });

    return invoice;
  }

  /**
   * Generate PDF and store in R2/S3.
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

    // Generate PDF
    const pdfBuffer = await this.pdfService.generateInvoicePdf(invoice);

    // Upload to storage
    const fileKey = `invoices/${invoice.companyId}/${invoice.invoiceNumber}.pdf`;

    // Upload directly using S3 client
    if (!this.s3Client || !this.bucketName) {
      throw new Error('Storage not configured');
    }

    const putCommand = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
    });

    await this.s3Client.send(putCommand);

    // Generate download URL and update invoice
    const downloadUrl = await this.r2Service.generateDownloadUrl(fileKey, 3600 * 24 * 365); // 1 year expiry

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
   * Send invoice email to client.
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
    const { companyId, page = 1, limit = 50 } = filters;
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
