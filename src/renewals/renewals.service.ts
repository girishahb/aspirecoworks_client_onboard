import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { PrismaClient } from '.prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '../mailer/mailer.service';

/** Days before renewal to send reminders. No hardcoded company IDs or dates. */
const REMINDER_DAYS_BEFORE = [30, 7, 1] as const;

@Injectable()
export class RenewalsService {
  private readonly logger = new Logger(RenewalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {}

  private get db(): PrismaClient {
    return this.prisma as unknown as PrismaClient;
  }

  /**
   * Daily cron: run once per day at 3:00 AM.
   * - Fetches companies with renewalDate > today
   * - For each company, if days remaining is 30, 7, or 1: check if reminder already sent; if not, send and insert record.
   * Idempotent, no duplicate emails, exceptions in one company do not stop the loop.
   */
  @Cron('0 3 * * *', { name: 'renewal-reminders' })
  async runDailyRenewalReminders(): Promise<void> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let companies: Array<{
      id: string;
      companyName: string;
      contactEmail: string;
      renewalDate: Date | null;
    }>;

    try {
      companies = await this.db.clientProfile.findMany({
        where: {
          renewalDate: { gt: today },
        },
        select: {
          id: true,
          companyName: true,
          contactEmail: true,
          renewalDate: true,
        },
      });
    } catch (err) {
      this.logger.error('Failed to fetch companies for renewal reminders', err);
      return;
    }

    for (const company of companies) {
      try {
        await this.processCompanyRenewalReminders(company, today);
      } catch (err) {
        this.logger.warn(
          `Renewal reminder loop: skip company ${company.id} after error`,
          err instanceof Error ? err.message : err,
        );
        // Continue loop; do not throw
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

      const alreadySent = await this.db.renewalReminder.findUnique({
        where: {
          companyId_daysBefore: {
            companyId: company.id,
            daysBefore,
          },
        },
      });

      if (alreadySent) continue;

      try {
        await this.mailer.sendRenewalReminder(
          {
            id: company.id,
            companyName: company.companyName,
            contactEmail: company.contactEmail,
            renewalDate: company.renewalDate,
          },
          daysBefore,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to send renewal reminder company=${company.id} daysBefore=${daysBefore}`,
          err instanceof Error ? err.message : err,
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
          `Failed to create RenewalReminder record company=${company.id} daysBefore=${daysBefore} (email may have been sent)`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }
}
