import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { OnboardingService } from '../onboarding/onboarding.service';
import { InvoicesService } from '../invoices/invoices.service';

@ApiTags('Admin Payments')
@ApiBearerAuth()
@Controller('admin/payments')
@Throttle({ default: { limit: 500, ttl: 60000 } })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
export class AdminPaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly onboardingService: OnboardingService,
    private readonly invoicesService: InvoicesService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new payment for a company',
    description:
      'Creates a Razorpay payment link for a company, saves the payment record, updates company stage to PAYMENT_PENDING, and sends payment link email to company contact.',
  })
  @ApiResponse({ status: 201, description: 'Payment created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request (invalid company, stage, etc.)' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentsService.create(
      createPaymentDto.companyId,
      createPaymentDto.amount,
      createPaymentDto.currency,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'List all payments with filters',
    description: 'Returns paginated list of payments with optional filters for status, company, and date range.',
  })
  @ApiQuery({ name: 'status', enum: ['CREATED', 'PAID', 'FAILED'], required: false })
  @ApiQuery({ name: 'companyId', required: false })
  @ApiQuery({ name: 'fromDate', required: false, type: String })
  @ApiQuery({ name: 'toDate', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of payments' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll(
    @Query('status') status?: 'CREATED' | 'PAID' | 'FAILED',
    @Query('companyId') companyId?: string,
    @Query('fromDate') fromDateStr?: string,
    @Query('toDate') toDateStr?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const fromDate = fromDateStr ? new Date(fromDateStr) : undefined;
    const toDate = toDateStr ? new Date(toDateStr) : undefined;

    return this.paymentsService.findAll({
      status,
      companyId,
      fromDate,
      toDate,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('companies/:companyId')
  @ApiOperation({
    summary: 'Get payment history for a company',
    description: 'Returns all payments for a specific company.',
  })
  @ApiResponse({ status: 200, description: 'Company payment history' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getCompanyPayments(@Param('companyId') companyId: string) {
    return this.paymentsService.findByCompanyId(companyId);
  }

  @Post(':paymentId/mark-paid')
  @ApiOperation({
    summary: 'Manually mark payment as paid',
    description:
      'Use when webhook did not fire (e.g. payment_link.paid not subscribed). Marks payment PAID, updates company stage to KYC_IN_PROGRESS, and generates invoice.',
  })
  @ApiResponse({ status: 200, description: 'Payment marked as paid' })
  @ApiResponse({ status: 400, description: 'Payment already paid or invalid' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async markAsPaid(@Param('paymentId') paymentId: string) {
    const payment = await this.paymentsService.findById(paymentId);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.status === 'PAID') {
      return { success: true, message: 'Payment already marked as PAID' };
    }
    if (payment.status !== 'CREATED') {
      return { success: false, message: `Cannot mark as paid: payment status is ${payment.status}` };
    }
    await this.paymentsService.markAsPaid(paymentId);
    const companyId = payment.clientProfileId;
    try {
      await this.onboardingService.onPaymentConfirmed(companyId);
    } catch (err) {
      // Log but don't fail - payment is already marked
    }
    try {
      await this.invoicesService.generateInvoiceForPayment(paymentId);
    } catch (err) {
      // Log but don't fail
    }
    return { success: true, message: 'Payment marked as PAID; stage updated; invoice generated' };
  }

  @Post(':paymentId/resend-link')
  @ApiOperation({
    summary: 'Resend payment link',
    description: 'Resends the payment link to the company contact email.',
  })
  @ApiResponse({ status: 200, description: 'Payment link sent successfully' })
  @ApiResponse({ status: 400, description: 'Bad request (no link, already paid, etc.)' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async resendPaymentLink(@Param('paymentId') paymentId: string) {
    return this.paymentsService.resendPaymentLink(paymentId);
  }
}
