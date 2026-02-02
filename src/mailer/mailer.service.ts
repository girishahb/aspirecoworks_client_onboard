import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

/** Company shape expected by sendRenewalReminder (ClientProfile subset). */
export interface RenewalReminderCompany {
  id: string;
  companyName: string;
  contactEmail: string;
  renewalDate?: Date | null;
}

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly resend: Resend | null = null;
  private readonly from: string;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn('RESEND_API_KEY not set; renewal emails will not be sent.');
    }
    this.from =
      this.config.get<string>('EMAIL_FROM') ??
      'Aspire Coworks <noreply@aspirecoworks.com>';
    this.baseUrl =
      this.config.get<string>('APP_BASE_URL') ?? 'https://app.aspirecoworks.com';
  }

  /**
   * Send a renewal reminder email via Resend.
   * Does not throw: logs errors so the cron continues.
   */
  async sendRenewalReminder(
    company: RenewalReminderCompany,
    daysBefore: number,
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        `Renewal reminder skipped (no Resend client): company=${company.id} daysBefore=${daysBefore}`,
      );
      return;
    }

    const to = company.contactEmail?.trim();
    if (!to) {
      this.logger.warn(
        `Renewal reminder skipped (no recipient): company=${company.id}`,
      );
      return;
    }

    const renewalDateStr = company.renewalDate
      ? new Date(company.renewalDate).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'your renewal date';

    const subject = `Your Aspire Coworks membership expires in ${daysBefore} day${daysBefore === 1 ? '' : 's'}`;
    const dashboardUrl = `${this.baseUrl.replace(/\/$/, '')}/dashboard`;
    const billingUrl = `${this.baseUrl.replace(/\/$/, '')}/billing`;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #333; max-width: 560px;">
  <p>Hello,</p>
  <p>This is a reminder that your Aspire Coworks membership for <strong>${escapeHtml(company.companyName)}</strong> will expire in <strong>${daysBefore} day${daysBefore === 1 ? '' : 's'}</strong>.</p>
  <p>Renewal date: <strong>${escapeHtml(renewalDateStr)}</strong>.</p>
  <p>To renew or update your billing, please visit:</p>
  <p><a href="${escapeHtml(dashboardUrl)}" style="color: #2563eb;">${escapeHtml(dashboardUrl)}</a></p>
  <p><a href="${escapeHtml(billingUrl)}" style="color: #2563eb;">${escapeHtml(billingUrl)}</a></p>
  <p>If you have any questions, please contact support.</p>
  <p>— Aspire Coworks</p>
</body>
</html>`;

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.from,
        to: [to],
        subject,
        html,
      });

      if (error) {
        this.logger.error(
          `Resend error sending renewal reminder company=${company.id} daysBefore=${daysBefore}: ${error.message}`,
          error,
        );
        return;
      }

      this.logger.log(
        `Renewal reminder sent company=${company.id} daysBefore=${daysBefore} id=${data?.id ?? 'unknown'}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send renewal reminder company=${company.id} daysBefore=${daysBefore}`,
        err instanceof Error ? err.message : err,
      );
      // Do not rethrow: cron must not fail
    }
  }

  /**
   * Send magic-link (passwordless) login email.
   * Does not throw: logs errors so the auth flow can return a generic response.
   */
  async sendMagicLink(to: string, magicLink: string): Promise<void> {
    if (!this.resend) {
      this.logger.warn('Magic link skipped (no Resend client)');
      return;
    }

    const trimmed = to?.trim();
    if (!trimmed) {
      this.logger.warn('Magic link skipped (no recipient)');
      return;
    }

    const subject = 'Sign in to Aspire Coworks';
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #333; max-width: 560px;">
  <p>Hello,</p>
  <p>Use the link below to sign in to your Aspire Coworks account. This link expires in 15 minutes.</p>
  <p><a href="${escapeHtml(magicLink)}" style="color: #2563eb;">Sign in</a></p>
  <p>If you didn't request this email, you can ignore it.</p>
  <p>— Aspire Coworks</p>
</body>
</html>`;

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.from,
        to: [trimmed],
        subject,
        html,
      });

      if (error) {
        this.logger.error(
          `Resend error sending magic link: ${error.message}`,
          error,
        );
        return;
      }

      this.logger.log(`Magic link sent to ${trimmed} id=${data?.id ?? 'unknown'}`);
    } catch (err) {
      this.logger.error(
        'Failed to send magic link',
        err instanceof Error ? err.message : err,
      );
      // Do not rethrow: caller returns generic success
    }
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
