/**
 * Local script to validate renewal cron logic.
 * Creates 3 test companies (renewalDate: +30d, +7d, yesterday), runs RenewalsService,
 * then prints which reminders triggered and which company expired.
 *
 * Run: npx ts-node scripts/test-renewals.ts
 * Requires: DB migrated (renewalDate, renewalStatus on ClientProfile), at least one User (e.g. prisma/seed).
 */

import { PrismaClient } from '@prisma/client';
import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../src/prisma/prisma.module';
import { EmailModule } from '../src/email/email.module';
import { RenewalsModule } from '../src/renewals/renewals.module';
import { RenewalsService } from '../src/renewals/renewals.service';

const prisma = new PrismaClient();

const TEST_PREFIX = '[Test Renewal]';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ScheduleModule.forRoot(),
    PrismaModule,
    EmailModule,
    RenewalsModule,
  ],
})
class TestRenewalsAppModule {}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

async function main() {
  const today = startOfDay(new Date());
  const yesterday = addDays(today, -1);
  const in30Days = addDays(today, 30);
  const in7Days = addDays(today, 7);

  console.log('Today (date-only):', today.toISOString().slice(0, 10));
  console.log('Creating 3 test companies...\n');

  const user = await prisma.user.findFirst();
  if (!user) {
    console.error('No user in DB. Run prisma/seed first.');
    process.exit(1);
  }

  const company30 = await prisma.clientProfile.create({
    data: {
      companyName: `${TEST_PREFIX} 30 days`,
      contactEmail: 'test-30@example.com',
      contactPhone: null,
      taxId: `TEST-RENEWAL-30-${Date.now()}`,
      createdById: user.id,
      renewalDate: in30Days,
      renewalStatus: null,
    },
  });

  const company7 = await prisma.clientProfile.create({
    data: {
      companyName: `${TEST_PREFIX} 7 days`,
      contactEmail: 'test-7@example.com',
      contactPhone: null,
      taxId: `TEST-RENEWAL-7-${Date.now()}`,
      createdById: user.id,
      renewalDate: in7Days,
      renewalStatus: null,
    },
  });

  const companyExpired = await prisma.clientProfile.create({
    data: {
      companyName: `${TEST_PREFIX} expired`,
      contactEmail: 'test-expired@example.com',
      contactPhone: null,
      taxId: `TEST-RENEWAL-EXP-${Date.now()}`,
      createdById: user.id,
      renewalDate: yesterday,
      renewalStatus: null,
    },
  });

  const testIds = [company30.id, company7.id, companyExpired.id];
  console.log('  a. renewalDate = today + 30 days:', company30.id, company30.companyName);
  console.log('  b. renewalDate = today + 7 days:', company7.id, company7.companyName);
  console.log('  c. renewalDate = yesterday:', companyExpired.id, companyExpired.companyName);
  console.log('');

  console.log('Running RenewalsService.runDailyRenewalReminders()...\n');
  const app = await NestFactory.createApplicationContext(TestRenewalsAppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const renewalsService = app.get(RenewalsService);
  await renewalsService.runDailyRenewalReminders();
  await app.close();

  console.log('\n--- Results ---\n');

  const profiles = await prisma.clientProfile.findMany({
    where: { id: { in: testIds } },
    select: { id: true, companyName: true, renewalDate: true, renewalStatus: true },
  });

  const reminders = await prisma.renewalReminder.findMany({
    where: { companyId: { in: testIds } },
    select: { companyId: true, daysBefore: true, sentAt: true },
  });

  const expired = profiles.filter((p) => p.renewalStatus === 'EXPIRED');
  const reminder30 = reminders.filter((r) => r.daysBefore === 30);
  const reminder7 = reminders.filter((r) => r.daysBefore === 7);

  console.log('Company expired (renewalDate < today):');
  if (expired.length === 0) {
    console.log('  (none)');
  } else {
    expired.forEach((p) => {
      console.log(`  - ${p.companyName} (id=${p.id}, renewalDate=${p.renewalDate?.toISOString().slice(0, 10) ?? 'null'})`);
    });
  }

  console.log('\nReminders triggered:');
  console.log('  REMINDER_30 (today + 30 days):');
  if (reminder30.length === 0) {
    console.log('    (none)');
  } else {
    reminder30.forEach((r) => {
      const name = profiles.find((p) => p.id === r.companyId)?.companyName ?? r.companyId;
      console.log(`    - ${name} (sentAt=${r.sentAt.toISOString()})`);
    });
  }
  console.log('  REMINDER_7 (today + 7 days):');
  if (reminder7.length === 0) {
    console.log('    (none)');
  } else {
    reminder7.forEach((r) => {
      const name = profiles.find((p) => p.id === r.companyId)?.companyName ?? r.companyId;
      console.log(`    - ${name} (sentAt=${r.sentAt.toISOString()})`);
    });
  }

  console.log('\nCleaning up test companies...');
  await prisma.renewalReminder.deleteMany({ where: { companyId: { in: testIds } } });
  await prisma.clientProfile.deleteMany({ where: { id: { in: testIds } } });
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
