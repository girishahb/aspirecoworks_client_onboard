import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { RazorpayService } from './razorpay.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { OnboardingStage } from '../common/enums/onboarding-stage.enum';
import { paymentLinkEmail } from '../email/templates/payment-link';
import {
  computePaymentTotals,
  formatPaymentAmountForEmail,
  type PaymentGstMode,
  type PaymentTotals,
} from './payment-gst.util';

export interface CreatePaymentOptions {
  companyId: string;
  currency?: string;
  gstMode?: PaymentGstMode;
  amount?: number;
  taxableAmount?: number;
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
}

function mapPaymentGstFields(p: {
  amount: number;
  taxableAmount: number | null;
  gstMode: string | null;
  cgstRate: number | null;
  sgstRate: number | null;
  igstRate: number | null;
  cgstAmount: number | null;
  sgstAmount: number | null;
  igstAmount: number | null;
}) {
  return {
    amount: p.amount,
    taxableAmount: p.taxableAmount,
    gstMode: p.gstMode,
    cgstRate: p.cgstRate,
    sgstRate: p.sgstRate,
    igstRate: p.igstRate,
    cgstAmount: p.cgstAmount,
    sgstAmount: p.sgstAmount,
    igstAmount: p.igstAmount,
  };
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private razorpayService: RazorpayService,
    private onboardingService: OnboardingService,
  ) {}

  private buildEmailBreakdown(
    totals: PaymentTotals,
    currency: string,
    payment: {
      amount: number;
      taxableAmount: number | null;
      gstMode: string | null;
      cgstRate: number | null;
      sgstRate: number | null;
      igstRate: number | null;
      cgstAmount: number | null;
      sgstAmount: number | null;
      igstAmount: number | null;
    },
  ) {
    if (payment.gstMode && payment.gstMode !== 'NONE' && payment.taxableAmount != null) {
      return formatPaymentAmountForEmail(
        {
          gstMode: payment.gstMode as PaymentGstMode,
          taxableAmount: payment.taxableAmount,
          cgstRate: payment.cgstRate,
          sgstRate: payment.sgstRate,
          igstRate: payment.igstRate,
          cgstAmount: payment.cgstAmount ?? 0,
          sgstAmount: payment.sgstAmount ?? 0,
          igstAmount: payment.igstAmount ?? 0,
          totalAmount: payment.amount,
        },
        currency,
      );
    }
    return formatPaymentAmountForEmail(totals, currency);
  }

  /**
   * Create a payment for a company.
   * Creates Razorpay payment link, saves payment record, updates company stage to PAYMENT_PENDING, and sends email.
   */
  async create(options: CreatePaymentOptions) {
    const currency = options.currency ?? 'INR';
    const companyId = options.companyId;

    let totals: PaymentTotals;
    try {
      totals = computePaymentTotals({
        gstMode: options.gstMode ?? 'NONE',
        amount: options.amount,
        taxableAmount: options.taxableAmount,
        cgstRate: options.cgstRate,
        sgstRate: options.sgstRate,
        igstRate: options.igstRate,
      });
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid payment amounts');
    }

    const company = await this.prisma.clientProfile.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        companyName: true,
        contactEmail: true,
        contactPhone: true,
        onboardingStage: true,
      },
    });

    if (!company) {
      throw new NotFoundException(`Company with ID ${companyId} not found`);
    }

    const currentStage = company.onboardingStage as OnboardingStage;
    if (currentStage !== OnboardingStage.ADMIN_CREATED && currentStage !== OnboardingStage.PAYMENT_PENDING) {
      throw new BadRequestException(
        `Cannot create payment. Company is in stage: ${currentStage}. Payment can only be created for companies in ADMIN_CREATED or PAYMENT_PENDING stage.`,
      );
    }

    let paymentLinkData: { id: string; short_url: string };
    try {
      paymentLinkData = await this.razorpayService.createPaymentLink({
        amount: totals.totalAmount,
        currency,
        companyId: company.id,
        companyName: company.companyName,
        description: `Onboarding Fee - ${company.companyName}`,
        customer: {
          name: company.companyName,
          email: company.contactEmail || undefined,
          contact: company.contactPhone || undefined,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create Razorpay payment link for company ${companyId}`, error);
      throw new BadRequestException(
        `Failed to create payment link: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    const payment = await this.prisma.payment.create({
      data: {
        clientProfileId: companyId,
        amount: totals.totalAmount,
        currency,
        status: 'CREATED',
        provider: 'Razorpay',
        providerPaymentId: null,
        razorpayPaymentLinkId: paymentLinkData.id ?? undefined,
        paymentLink: paymentLinkData.short_url,
        taxableAmount: totals.gstMode === 'NONE' ? null : totals.taxableAmount,
        gstMode: totals.gstMode,
        cgstRate: totals.cgstRate,
        sgstRate: totals.sgstRate,
        igstRate: totals.igstRate,
        cgstAmount: totals.cgstAmount,
        sgstAmount: totals.sgstAmount,
        igstAmount: totals.igstAmount,
      },
      include: {
        clientProfile: {
          select: {
            id: true,
            companyName: true,
            onboardingStage: true,
          },
        },
      },
    });

    if (currentStage === OnboardingStage.ADMIN_CREATED) {
      try {
        await this.onboardingService.updateStage(companyId, OnboardingStage.PAYMENT_PENDING);
        this.logger.log(`Company ${companyId} moved to PAYMENT_PENDING stage`);
      } catch (error) {
        this.logger.warn(
          `Failed to update company stage to PAYMENT_PENDING: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    if (company.contactEmail) {
      try {
        const breakdown = this.buildEmailBreakdown(totals, currency, payment);
        const { subject, html, text } = paymentLinkEmail({
          companyName: company.companyName,
          currency,
          paymentLink: paymentLinkData.short_url,
          breakdown,
        });
        await this.emailService.sendEmail({
          to: company.contactEmail,
          subject,
          html,
          text,
        });
        this.logger.log(`Payment link email sent to ${company.contactEmail}`);
      } catch (error) {
        this.logger.warn(`Failed to send payment link email: ${error instanceof Error ? error.message : error}`);
      }
    }

    return payment;
  }

  async findAll(filters: {
    status?: 'CREATED' | 'PAID' | 'FAILED';
    companyId?: string;
    fromDate?: Date;
    toDate?: Date;
    page?: number;
    limit?: number;
    createdById?: string;
  }) {
    const {
      status,
      companyId,
      fromDate,
      toDate,
      page = 1,
      limit = 50,
      createdById,
    } = filters;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (companyId) {
      where.clientProfileId = companyId;
    }

    if (createdById) {
      where.clientProfile = { createdById };
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        where.createdAt.gte = fromDate;
      }
      if (toDate) {
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
        currency: p.currency,
        status: p.status,
        provider: p.provider,
        providerPaymentId: p.providerPaymentId,
        paymentLink: p.paymentLink,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
        ...mapPaymentGstFields(p),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByCompanyId(companyId: string, createdById?: string) {
    const company = await this.prisma.clientProfile.findUnique({
      where: { id: companyId },
      select: { id: true, companyName: true, createdById: true },
    });

    if (!company) {
      throw new NotFoundException(`Company with ID ${companyId} not found`);
    }

    if (createdById && company.createdById !== createdById) {
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
        currency: p.currency,
        status: p.status,
        provider: p.provider,
        providerPaymentId: p.providerPaymentId,
        paymentLink: p.paymentLink,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
        ...mapPaymentGstFields(p),
      })),
    };
  }

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

  async findById(
    paymentId: string,
  ): Promise<{ id: string; clientProfileId: string; status: string } | null> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, clientProfileId: true, status: true },
    });
    return payment;
  }

  async findByProviderPaymentId(providerPaymentId: string): Promise<{
    id: string;
    clientProfileId: string;
    status: string;
    providerPaymentId: string | null;
  } | null> {
    if (!providerPaymentId) return null;

    return this.prisma.payment.findFirst({
      where: { providerPaymentId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        clientProfileId: true,
        status: true,
        providerPaymentId: true,
      },
    });
  }

  async findByRazorpayPaymentLinkId(razorpayPaymentLinkId: string): Promise<{
    id: string;
    clientProfileId: string;
    status: string;
    providerPaymentId: string | null;
  } | null> {
    if (!razorpayPaymentLinkId) return null;
    return this.prisma.payment.findFirst({
      where: { razorpayPaymentLinkId, status: 'CREATED' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        clientProfileId: true,
        status: true,
        providerPaymentId: true,
      },
    });
  }

  async findFirstCreatedByCompanyId(companyId: string): Promise<{
    id: string;
    clientProfileId: string;
    status: string;
    providerPaymentId: string | null;
  } | null> {
    return this.prisma.payment.findFirst({
      where: { clientProfileId: companyId, status: 'CREATED' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        clientProfileId: true,
        status: true,
        providerPaymentId: true,
      },
    });
  }

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

    const gstMode = (payment.gstMode as PaymentGstMode | null) ?? 'NONE';
    const totals = computePaymentTotals({
      gstMode,
      amount: gstMode === 'NONE' ? payment.amount : undefined,
      taxableAmount: payment.taxableAmount ?? undefined,
      cgstRate: payment.cgstRate ?? undefined,
      sgstRate: payment.sgstRate ?? undefined,
      igstRate: payment.igstRate ?? undefined,
    });
    const breakdown = this.buildEmailBreakdown(totals, payment.currency, payment);

    const { subject, html, text } = paymentLinkEmail({
      companyName: payment.clientProfile.companyName,
      currency: payment.currency,
      paymentLink: payment.paymentLink,
      breakdown,
    });

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
