import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  /** Override default EMAIL_FROM (e.g. courier mailbox for mail-notify). */
  from?: string;
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
    const { to, subject, html, text, attachments, from } = options;
    const toList = Array.isArray(to) ? to : [to];
    const fromAddress = (from?.trim() || this.from).trim();

    if (!this.resend) {
      this.logger.log('Email (no Resend client):', {
        to: toList,
        from: fromAddress,
        subject,
        html: html?.slice(0, 200) + ((html?.length ?? 0) > 200 ? '…' : ''),
        text: text?.slice(0, 200) + ((text?.length ?? 0) > 200 ? '…' : ''),
      });
      return {
        success: false,
        error: 'RESEND_API_KEY not configured',
      };
    }

    const resendAttachments = attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
    }));

    try {
      const { data, error } = await this.resend.emails.send({
        from: fromAddress,
        to: toList,
        subject,
        html,
        text: text ?? undefined,
        attachments: resendAttachments,
      });

      if (error) {
        this.logger.error(
          `Resend error (from=${fromAddress} to=${toList.join(', ')}): ${error.message}`,
          error,
        );
        return {
          success: false,
          error: error.message,
        };
      }

      this.logger.log(
        `Email sent from=${fromAddress} to=${toList.join(', ')} id=${data?.id ?? 'unknown'}`,
      );
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
