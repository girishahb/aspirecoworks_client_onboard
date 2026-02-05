import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  /**
   * List all payments with optional filters.
   * Supports filtering by status, companyId, and date range.
   */
  async findAll(filters: {
    status?: 'CREATED' | 'PAID' | 'FAILED';
    companyId?: string;
    fromDate?: Date;
    toDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const {
      status,
      companyId,
      fromDate,
      toDate,
      page = 1,
      limit = 50,
    } = filters;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (companyId) {
      where.clientProfileId = companyId;
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        where.createdAt.gte = fromDate;
      }
      if (toDate) {
        // Include the entire day
        const endOfDay = new Date(toDate);
        endOfDay.setHours(23, 59, 59, 999);
        where.createdAt.lte = endOfDay;
      }
    }

    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          clientProfile: {
            select: {
              id: true,
              companyName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: payments.map((p) => ({
        id: p.id,
        companyId: p.clientProfileId,
        companyName: p.clientProfile.companyName,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        provider: p.provider,
        providerPaymentId: p.providerPaymentId,
        paymentLink: p.paymentLink,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get all payments for a specific company.
   */
  async findByCompanyId(companyId: string) {
    const company = await this.prisma.clientProfile.findUnique({
      where: { id: companyId },
      select: { id: true, companyName: true },
    });

    if (!company) {
      throw new NotFoundException(`Company with ID ${companyId} not found`);
    }

    const payments = await this.prisma.payment.findMany({
      where: { clientProfileId: companyId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      companyId: company.id,
      companyName: company.companyName,
      payments: payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        provider: p.provider,
        providerPaymentId: p.providerPaymentId,
        paymentLink: p.paymentLink,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
      })),
    };
  }

  /**
   * Mark payment as PAID.
   */
  async markAsPaid(paymentId: string, providerPaymentId?: string): Promise<void> {
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        ...(providerPaymentId && { providerPaymentId }),
      },
    });
  }

  /**
   * Find payment by company ID and provider payment ID.
   */
  async findByCompanyAndProvider(
    companyId: string,
    providerPaymentId?: string,
  ): Promise<any | null> {
    if (!providerPaymentId) return null;

    return this.prisma.payment.findFirst({
      where: {
        clientProfileId: companyId,
        providerPaymentId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Resend payment link to company contact email.
   */
  async resendPaymentLink(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        clientProfile: {
          select: {
            id: true,
            companyName: true,
            contactEmail: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    if (!payment.paymentLink) {
      throw new BadRequestException('Payment does not have a payment link');
    }

    if (payment.status === 'PAID') {
      throw new BadRequestException('Payment is already paid');
    }

    const to = payment.clientProfile.contactEmail?.trim();
    if (!to) {
      throw new BadRequestException('Company does not have a contact email');
    }

    const subject = `Payment Link for ${payment.clientProfile.companyName}`;
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #333; max-width: 560px;">
  <p>Hello,</p>
  <p>Please use the link below to complete payment for <strong>${escapeHtml(payment.clientProfile.companyName)}</strong>.</p>
  <p><strong>Amount:</strong> ${payment.currency} ${payment.amount.toLocaleString('en-IN')}</p>
  <p><a href="${escapeHtml(payment.paymentLink)}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Pay Now</a></p>
  <p>If you have any questions, please contact support.</p>
  <p>— Aspire Coworks</p>
</body>
</html>`;

    const text = `Hello,\n\nPlease use the link below to complete payment for ${payment.clientProfile.companyName}.\n\nAmount: ${payment.currency} ${payment.amount.toLocaleString('en-IN')}\n\nPayment Link: ${payment.paymentLink}\n\nIf you have any questions, please contact support.\n\n— Aspire Coworks`;

    const result = await this.emailService.sendEmail({
      to,
      subject,
      html,
      text,
    });

    if (!result.success) {
      throw new BadRequestException(`Failed to send email: ${result.error}`);
    }

    return {
      success: true,
      message: 'Payment link sent successfully',
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
