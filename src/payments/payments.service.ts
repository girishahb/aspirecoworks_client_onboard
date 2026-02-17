import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { RazorpayService } from './razorpay.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { OnboardingStage } from '../common/enums/onboarding-stage.enum';
import { paymentLinkEmail } from '../email/templates/payment-link';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private razorpayService: RazorpayService,
    private onboardingService: OnboardingService,
  ) {}

  /**
   * Create a payment for a company.
   * Creates Razorpay payment link, saves payment record, updates company stage to PAYMENT_PENDING, and sends email.
   */
  async create(companyId: string, amount: number, currency: string = 'INR') {
    // Verify company exists
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

    // Verify company is in a valid stage for payment creation
    const currentStage = company.onboardingStage as OnboardingStage;
    if (currentStage !== OnboardingStage.ADMIN_CREATED && currentStage !== OnboardingStage.PAYMENT_PENDING) {
      throw new BadRequestException(
        `Cannot create payment. Company is in stage: ${currentStage}. Payment can only be created for companies in ADMIN_CREATED or PAYMENT_PENDING stage.`,
      );
    }

    // Create Razorpay payment link
    let paymentLinkData: { id: string; short_url: string };
    try {
      paymentLinkData = await this.razorpayService.createPaymentLink({
        amount,
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

    // Create payment record
    const payment = await this.prisma.payment.create({
      data: {
        clientProfileId: companyId,
        amount,
        currency,
        status: 'CREATED',
        provider: 'Razorpay',
        providerPaymentId: null, // Will be set when payment is captured
        paymentLink: paymentLinkData.short_url,
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

    // Update company stage to PAYMENT_PENDING if not already there
    if (currentStage === OnboardingStage.ADMIN_CREATED) {
      try {
        await this.onboardingService.updateStage(companyId, OnboardingStage.PAYMENT_PENDING);
        this.logger.log(`Company ${companyId} moved to PAYMENT_PENDING stage`);
      } catch (error) {
        this.logger.warn(`Failed to update company stage to PAYMENT_PENDING: ${error instanceof Error ? error.message : error}`);
        // Don't fail payment creation if stage update fails
      }
    }

    // Send payment link email
    if (company.contactEmail) {
      try {
        const { subject, html, text } = paymentLinkEmail({
          companyName: company.companyName,
          amount: amount.toLocaleString('en-IN'),
          currency,
          paymentLink: paymentLinkData.short_url,
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
        // Don't fail payment creation if email fails
      }
    }

    return payment;
  }

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
   * Find payment by ID. Returns null if not found.
   */
  async findById(
    paymentId: string,
  ): Promise<{ id: string; clientProfileId: string; status: string } | null> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, clientProfileId: true, status: true },
    });
    return payment;
  }

  /**
   * Find payment by Razorpay payment ID (providerPaymentId) across all companies.
   * Used by webhook to resolve payment from event payload.
   */
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

  /**
   * Find first CREATED payment for a company (for webhook fallback when providerPaymentId not yet set).
   */
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

    const { subject, html, text } = paymentLinkEmail({
      companyName: payment.clientProfile.companyName,
      amount: payment.amount.toLocaleString('en-IN'),
      currency: payment.currency,
      paymentLink: payment.paymentLink,
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

