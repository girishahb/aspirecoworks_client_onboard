import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';

export type RazorpayMode = 'test' | 'live';

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private razorpayClient: Razorpay;
  private readonly mode: RazorpayMode;
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor(private config: ConfigService) {
    this.keyId = this.config.get<string>('RAZORPAY_KEY_ID') || '';
    this.keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET') || '';
    this.webhookSecret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET') || '';
    this.mode = (this.config.get<string>('RAZORPAY_MODE') || 'test').toLowerCase() as RazorpayMode;

    // Validate mode
    if (this.mode !== 'test' && this.mode !== 'live') {
      throw new Error(`Invalid RAZORPAY_MODE: ${this.mode}. Must be 'test' or 'live'`);
    }

    // Validate credentials
    if (!this.keyId || !this.keySecret) {
      this.logger.warn('Razorpay credentials not configured. Payment links will not be created.');
    } else {
      // Initialize Razorpay client
      this.razorpayClient = new Razorpay({
        key_id: this.keyId,
        key_secret: this.keySecret,
      });

      // Log mode on initialization
      const modeLabel = this.mode.toUpperCase();
      this.logger.log(`Razorpay running in ${modeLabel} mode`);

      // Safety check: warn if live mode is used in non-production
      const nodeEnv = this.config.get<string>('NODE_ENV') || 'development';
      if (this.mode === 'live' && nodeEnv !== 'production') {
        this.logger.warn(
          '⚠️  WARNING: Live Razorpay keys used in non-production environment. ' +
            `NODE_ENV=${nodeEnv}, RAZORPAY_MODE=${this.mode}`,
        );
      }
    }
  }

  /**
   * Get current Razorpay mode.
   */
  getMode(): RazorpayMode {
    return this.mode;
  }

  /**
   * Check if Razorpay is configured.
   */
  isConfigured(): boolean {
    return !!this.keyId && !!this.keySecret && !!this.razorpayClient;
  }

  /**
   * Create a payment link for a company.
   * Logs companyId, amount, and environment mode for safety.
   */
  async createPaymentLink(params: {
    amount: number;
    currency?: string;
    companyId: string;
    companyName: string;
    description?: string;
    customer?: {
      name?: string;
      email?: string;
      contact?: string;
    };
  }): Promise<{ id: string; short_url: string }> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Razorpay is not configured. Please check environment variables.');
    }

    // Safety logging before creating payment link
    this.logger.log(
      `Creating payment link: companyId=${params.companyId}, ` +
        `amount=${params.amount}, mode=${this.mode.toUpperCase()}`,
    );

    const options: any = {
      amount: params.amount * 100, // Razorpay expects amount in paise
      currency: params.currency || 'INR',
      description: params.description || `Payment for ${params.companyName}`,
      customer: params.customer,
      notify: {
        sms: true,
        email: true,
      },
      reminder_enable: true,
      notes: {
        companyId: params.companyId,
        companyName: params.companyName,
        mode: this.mode,
      },
      options: {
        checkout: {
          theme: {
            hide_topbar: false,
            color: '#0A2540',
          },
        },
      },
    };

    try {
      const paymentLink: any = await this.razorpayClient.paymentLink.create(options);
      this.logger.log(
        `Payment link created: id=${paymentLink.id}, ` +
          `companyId=${params.companyId}, mode=${this.mode.toUpperCase()}`,
      );
      return {
        id: paymentLink.id,
        short_url: paymentLink.short_url,
      };
    } catch (error) {
      this.logger.error(`Failed to create payment link for companyId=${params.companyId}`, error);
      throw new BadRequestException(
        `Failed to create payment link: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Verify Razorpay webhook signature.
   * Uses RAZORPAY_WEBHOOK_SECRET and X-Razorpay-Signature header.
   * 
   * Note: For accurate verification, pass the raw request body as string.
   * If an object is passed, it will be JSON.stringify'd, which may not match
   * the exact bytes that Razorpay signed (due to whitespace/ordering differences).
   */
  verifyWebhookSignature(
    payload: string | object,
    signature: string,
  ): boolean {
    if (!this.webhookSecret) {
      this.logger.warn('RAZORPAY_WEBHOOK_SECRET not configured. Webhook signature verification skipped.');
      return false;
    }

    if (!signature) {
      this.logger.warn('Webhook signature header missing. Rejecting webhook.');
      return false;
    }

    try {
      // Convert payload to string if it's an object
      // Razorpay expects the raw request body as string
      const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);

      // Razorpay uses HMAC SHA256
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payloadString)
        .digest('hex');

      // Razorpay sends signature as raw hex string in X-Razorpay-Signature header
      // Remove any potential prefix (some webhook systems add "sha256=" prefix)
      const receivedSignature = signature.replace(/^sha256=/, '').trim();

      // Use timing-safe comparison to prevent timing attacks
      if (expectedSignature.length !== receivedSignature.length) {
        this.logger.warn('Webhook signature length mismatch. Rejecting webhook.');
        return false;
      }

      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(receivedSignature, 'hex'),
      );

      if (!isValid) {
        this.logger.warn('Webhook signature verification failed. Rejecting webhook.');
      } else {
        this.logger.debug('Webhook signature verified successfully');
      }

      return isValid;
    } catch (error) {
      this.logger.error('Error verifying webhook signature', error);
      return false;
    }
  }

  /**
   * Get payment details from Razorpay.
   */
  async getPayment(paymentId: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Razorpay is not configured.');
    }

    try {
      const payment = await this.razorpayClient.payments.fetch(paymentId);
      return payment;
    } catch (error) {
      this.logger.error(`Failed to fetch payment ${paymentId}`, error);
      throw new BadRequestException(
        `Failed to fetch payment: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
