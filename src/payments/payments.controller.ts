import { Body, Controller, Get, Post, Headers, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags, ApiHeader } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { OnboardingService } from '../onboarding/onboarding.service';
import { PaymentsService } from './payments.service';
import { InvoicesService } from '../invoices/invoices.service';
import { RazorpayService } from './razorpay.service';
import { UseGuards } from '@nestjs/common';

/** DTO for payment webhook payload. In production, verify provider signature and map providerPaymentId to companyId. */
export class PaymentWebhookDto {
  /** ClientProfile id (company) that made the payment. */
  companyId!: string;
  /** Payment ID (optional, if payment record exists) */
  paymentId?: string;
  /** Provider payment ID (e.g. Razorpay payment ID) */
  providerPaymentId?: string;
}

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly paymentsService: PaymentsService,
    private readonly invoicesService: InvoicesService,
    private readonly razorpayService: RazorpayService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.COMPANY_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payments for current user\'s company' })
  @ApiResponse({ status: 200, description: 'List of payments for the company' })
  @ApiResponse({ status: 403, description: 'Forbidden – user has no company' })
  async getMyPayments(@CurrentUser() user: { companyId?: string | null }) {
    if (!user?.companyId) {
      throw new ForbiddenException('No company linked to your account');
    }
    const result = await this.paymentsService.findByCompanyId(user.companyId);
    return result.payments;
  }

  @Post('webhook')
  @Public()
  @ApiOperation({
    summary: 'Payment success webhook',
    description:
      'Razorpay webhook endpoint. Verifies webhook signature, updates payment status to PAID, moves company from PAYMENT_PENDING to PAYMENT_CONFIRMED then KYC_IN_PROGRESS, and creates invoice.',
  })
  @ApiHeader({
    name: 'X-Razorpay-Signature',
    description: 'Razorpay webhook signature for verification',
    required: false,
  })
  @ApiBody({ type: PaymentWebhookDto })
  @ApiResponse({ status: 200, description: 'Payment confirmed; stage updated; invoice created' })
  @ApiResponse({ status: 400, description: 'Invalid stage or company not found' })
  @ApiResponse({ status: 401, description: 'Invalid webhook signature' })
  async paymentWebhook(
    @Body() body: PaymentWebhookDto,
    @Headers('x-razorpay-signature') signature?: string,
  ) {
    // Verify webhook signature if configured
    // Note: For accurate signature verification, raw request body should be used.
    // Current implementation uses JSON.stringify(body), which works for most cases.
    // For production, consider configuring Express raw body middleware for this route.
    if (this.razorpayService.isConfigured()) {
      const isValid = this.razorpayService.verifyWebhookSignature(body, signature || '');
      if (!isValid) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }
    // Update payment status to PAID if paymentId provided
    if (body.paymentId) {
      await this.paymentsService.markAsPaid(body.paymentId, body.providerPaymentId);
    } else {
      // Find payment by companyId and providerPaymentId
      const payment = await this.paymentsService.findByCompanyAndProvider(
        body.companyId,
        body.providerPaymentId,
      );
      if (payment) {
        await this.paymentsService.markAsPaid(payment.id, body.providerPaymentId);
        body.paymentId = payment.id;
      }
    }

    // Update onboarding stage
    await this.onboardingService.onPaymentConfirmed(body.companyId);

    // Create invoice if paymentId is available
    if (body.paymentId) {
      try {
        await this.invoicesService.generateInvoiceForPayment(body.paymentId);
      } catch (err) {
        // Log but don't fail webhook if invoice creation fails
        console.error('Failed to create invoice:', err);
      }
    }

    return {
      success: true,
      message: 'Payment confirmed; onboarding stage updated to KYC_IN_PROGRESS.',
    };
  }
}
