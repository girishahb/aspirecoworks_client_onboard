import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null = null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn('RESEND_API_KEY not set; emails will be logged only.');
    }
    this.from =
      this.config.get<string>('EMAIL_FROM') ??
      'Aspire Coworks <noreply@aspirecoworks.com>';
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const { to, subject, html, text } = options;
    const toList = Array.isArray(to) ? to : [to];

    if (!this.resend) {
      this.logger.log('Email (no Resend client):', {
        to: toList,
        subject,
        html: html?.slice(0, 200) + ((html?.length ?? 0) > 200 ? '…' : ''),
        text: text?.slice(0, 200) + ((text?.length ?? 0) > 200 ? '…' : ''),
      });
      return {
        success: false,
        error: 'RESEND_API_KEY not configured',
      };
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.from,
        to: toList,
        subject,
        html,
        text: text ?? undefined,
      });

      if (error) {
        this.logger.error(`Resend error: ${error.message}`, error);
        return {
          success: false,
          error: error.message,
        };
      }

      this.logger.log(`Email sent to ${toList.join(', ')} id=${data?.id ?? 'unknown'}`);
      return {
        success: true,
        messageId: data?.id,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error('Failed to send email', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
