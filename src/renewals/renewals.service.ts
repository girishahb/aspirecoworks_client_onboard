import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import type { PrismaClient } from '.prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { renewalReminder } from '../email/templates/renewal-reminder';
import { ReminderType } from './renewal.types';

/** Days before renewal to send reminders (matches ReminderType). */
const REMINDER_DAYS_BEFORE = [30, 7] as const;

function formatRenewalDate(d: Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

@Injectable()
export class RenewalsService {
  private readonly logger = new Logger(RenewalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  private get db(): PrismaClient {
    return this.prisma as unknown as PrismaClient;
  }

  /**
   * Daily cron: run once per day at 2 AM.
   * - Marks companies with renewalDate < today as EXPIRED.
   * - Sends REMINDER_30 / REMINDER_7 for companies at 30 or 7 days before renewal.
   * - Avoids duplicate reminders via RenewalReminder table.
   * - One company failure does not crash the job.
   */
  @Cron('0 2 * * *', { name: 'renewal-reminders' })
  async runDailyRenewalReminders(): Promise<void> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    this.logger.log('Renewal cron: checking companies (reminders + expiration).');

    // 1. Mark EXPIRED where renewalDate < today and send expired email
    let expired: Array<{
      id: string;
      companyName: string;
      contactEmail: string;
      renewalDate: Date | null;
    }>;
    try {
      expired = await this.db.clientProfile.findMany({
        where: {
          renewalDate: { lt: today },
          OR: [{ renewalStatus: null }, { renewalStatus: 'ACTIVE' }],
        },
        select: {
          id: true,
          companyName: true,
          contactEmail: true,
          renewalDate: true,
        },
      });
    } catch (err) {
      this.logger.error('Failed to fetch companies for expiration', err);
      return;
    }

    for (const company of expired) {
      try {
        await this.db.clientProfile.update({
          where: { id: company.id },
          data: { renewalStatus: 'EXPIRED' },
        });
        this.logger.log(
          `Renewal expired: company=${company.id} companyName=${company.companyName} renewalDate=${company.renewalDate?.toISOString() ?? 'null'}`,
        );
        const to = company.contactEmail?.trim();
        if (to) {
          try {
        const frontendUrl = (this.config.get<string>('FRONTEND_URL') ?? 'https://app.aspirecoworks.in').replace(/\/$/, '');
        const { subject, html, text } = renewalReminder({
          companyName: company.companyName,
          daysBefore: 0,
          renewalDateStr: formatRenewalDate(company.renewalDate),
          dashboardUrl: `${frontendUrl}/dashboard`,
        });
            await this.email.sendEmail({ to, subject, html, text });
          } catch (emailErr) {
            this.logger.warn(
              `Expired email failed company=${company.id}: ${emailErr instanceof Error ? emailErr.message : emailErr}`,
            );
          }
        }
      } catch (err) {
        this.logger.warn(
          `Renewal expiration skip company ${company.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    // 2. Reminders for renewalDate in 30 or 7 days
    let upcoming: Array<{
      id: string;
      companyName: string;
      contactEmail: string;
      renewalDate: Date | null;
    }>;
    try {
      upcoming = await this.db.clientProfile.findMany({
        where: {
          renewalDate: { gte: today },
        },
        select: {
          id: true,
          companyName: true,
          contactEmail: true,
          renewalDate: true,
        },
      });
    } catch (err) {
      this.logger.error('Failed to fetch companies for reminders', err);
      return;
    }

    for (const company of upcoming) {
      try {
        await this.processCompanyRenewalReminders(company, today);
      } catch (err) {
        this.logger.warn(
          `Renewal reminder skip company ${company.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  private async processCompanyRenewalReminders(
    company: {
      id: string;
      companyName: string;
      contactEmail: string;
      renewalDate: Date | null;
    },
    today: Date,
  ): Promise<void> {
    if (!company.renewalDate) return;

    const renewalDate = new Date(company.renewalDate);
    const renewalDay = new Date(
      renewalDate.getFullYear(),
      renewalDate.getMonth(),
      renewalDate.getDate(),
    );
    const diffMs = renewalDay.getTime() - today.getTime();
    const daysRemaining = Math.round(diffMs / (24 * 60 * 60 * 1000));

    if (daysRemaining <= 0) return;

    for (const daysBefore of REMINDER_DAYS_BEFORE) {
      if (daysRemaining !== daysBefore) continue;

      const reminderType =
        daysBefore === 30 ? ReminderType.REMINDER_30 : ReminderType.REMINDER_7;

      const alreadySent = await this.db.renewalReminder.findUnique({
        where: {
          companyId_daysBefore: {
            companyId: company.id,
            daysBefore,
          },
        },
      });

      if (alreadySent) continue;

      const to = company.contactEmail?.trim();
      if (!to) {
        this.logger.warn(`Renewal reminder skipped (no contact email): company=${company.id}`);
        continue;
      }
      try {
        const frontendUrl = (this.config.get<string>('FRONTEND_URL') ?? 'https://app.aspirecoworks.in').replace(/\/$/, '');
        const { subject, html, text } = renewalReminder({
          companyName: company.companyName,
          daysBefore,
          renewalDateStr: formatRenewalDate(company.renewalDate),
          dashboardUrl: `${frontendUrl}/dashboard`,
        });
        await this.email.sendEmail({ to, subject, html, text });
        this.logger.log(
          `Reminder sent: company=${company.id} type=${reminderType} daysBefore=${daysBefore}`,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to send renewal reminder company=${company.id} daysBefore=${daysBefore}: ${err instanceof Error ? err.message : err}`,
        );
        continue;
      }

      try {
        await this.db.renewalReminder.create({
          data: {
            companyId: company.id,
            daysBefore,
          },
        });
      } catch (err) {
        this.logger.warn(
          `Failed to create RenewalReminder company=${company.id} daysBefore=${daysBefore} (email may have been sent): ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }
}
