import {
  Controller,
  Post,
  Req,
  Headers,
  UnauthorizedException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { RazorpayService } from '../payments/razorpay.service';
import { PaymentsService } from '../payments/payments.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { InvoicesService } from '../invoices/invoices.service';
import type { Request } from 'express';

const HANDLED_EVENTS = ['payment.captured', 'order.paid', 'payment_link.paid'];

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly razorpayService: RazorpayService,
    private readonly paymentsService: PaymentsService,
    private readonly onboardingService: OnboardingService,
    private readonly invoicesService: InvoicesService,
  ) {}

  @Post('razorpay')
  @Public()
  @ApiOperation({
    summary: 'Razorpay webhook',
    description:
      'Receives payment success events (payment.captured, order.paid, payment_link.paid). Verifies signature, marks payment PAID, moves company to PAYMENT_CONFIRMED then KYC_IN_PROGRESS, and generates GST invoice. Requires raw body for signature verification.',
  })
  @ApiHeader({
    name: 'x-razorpay-signature',
    description: 'Razorpay webhook signature (HMAC SHA256 of raw body)',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 400, description: 'Invalid payload or event not handled' })
  @ApiResponse({ status: 401, description: 'Invalid signature' })
  async razorpayWebhook(
    @Req() req: Request & { body: Buffer },
    @Headers('x-razorpay-signature') signature?: string,
  ) {
    // 1. Read raw body (set by express.raw() in main.ts)
    const rawBody = req.body;
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      this.logger.warn('Razorpay webhook: raw body missing or not a buffer');
      throw new BadRequestException('Invalid request body');
    }

    const rawBodyStr = rawBody.toString('utf8');

    // 2 & 3. Verify signature using RAZORPAY_WEBHOOK_SECRET
    if (!signature) {
      this.logger.warn('Razorpay webhook: x-razorpay-signature header missing');
      throw new UnauthorizedException('Missing x-razorpay-signature');
    }

    const isValid = this.razorpayService.verifyWebhookSignature(rawBodyStr, signature);
    if (!isValid) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // 4. Parse event and handle payment.captured / order.paid
    let payload: { event?: string; payload?: any };
    try {
      payload = JSON.parse(rawBodyStr);
    } catch {
      this.logger.warn('Razorpay webhook: invalid JSON body');
      throw new BadRequestException('Invalid JSON body');
    }

    const event = payload?.event;
    if (!event) {
      this.logger.warn('Razorpay webhook: missing event field');
      throw new BadRequestException('Missing event');
    }

    if (!HANDLED_EVENTS.includes(event)) {
      this.logger.log(`Razorpay webhook: ignoring event ${event}`);
      return { ok: true, message: 'Event ignored' };
    }

    // Extract Razorpay payment ID and optional companyId from notes
    // payment.captured/order.paid: payload.payment.entity; payment_link.paid: payload.payment.entity
    const paymentEntity = payload.payload?.payment?.entity ?? payload.payload?.payment;
    const orderEntity = payload.payload?.order?.entity ?? payload.payload?.order;
    const paymentLinkNotes = payload.payload?.payment_link?.entity?.notes ?? {};
    const razorpayPaymentId = paymentEntity?.id;
    const notes = { ...paymentLinkNotes, ...(paymentEntity?.notes ?? {}), ...(orderEntity?.notes ?? {}) };
    const companyId = typeof notes.companyId === 'string' ? notes.companyId : undefined;

    if (!razorpayPaymentId) {
      this.logger.warn('Razorpay webhook: could not extract payment id from payload');
      throw new BadRequestException('Missing payment id in payload');
    }

    // 5. Find payment by razorpayPaymentId (or by companyId + CREATED as fallback)
    let payment = await this.paymentsService.findByProviderPaymentId(razorpayPaymentId);
    if (!payment && companyId) {
      payment = await this.paymentsService.findFirstCreatedByCompanyId(companyId);
    }

    if (!payment) {
      this.logger.warn(
        `Razorpay webhook: no matching payment for razorpayPaymentId=${razorpayPaymentId}, companyId=${companyId ?? 'n/a'}`,
      );
      throw new BadRequestException('No matching payment found');
    }

    if (payment.status === 'PAID') {
      this.logger.log(`Razorpay webhook: payment ${payment.id} already PAID, skipping`);
      return { ok: true, message: 'Already processed' };
    }

    // 6. Update status = PAID (and set providerPaymentId if not already set)
    await this.paymentsService.markAsPaid(payment.id, razorpayPaymentId);

    const companyIdForStage = payment.clientProfileId;

    // 7. Move company stage → PAYMENT_CONFIRMED then KYC_IN_PROGRESS
    try {
      await this.onboardingService.onPaymentConfirmed(companyIdForStage);
    } catch (err) {
      this.logger.error(
        `Razorpay webhook: onboarding stage update failed for companyId=${companyIdForStage}`,
        err,
      );
      // Still return 200 so Razorpay doesn't retry; payment is already marked PAID
    }

    // 8. Invoice generation (GST-compliant PDF, email with attachment)
    try {
      await this.invoicesService.generateInvoiceForPayment(payment.id);
    } catch (err) {
      this.logger.error(`Razorpay webhook: invoice generation failed for paymentId=${payment.id}`, err);
      // Don't fail the webhook
    }

    this.logger.log(
      `Razorpay webhook: payment ${payment.id} marked PAID, companyId=${companyIdForStage}, event=${event}`,
    );

    return { ok: true, message: 'Payment confirmed; stage updated; invoice generated' };
  }
}
