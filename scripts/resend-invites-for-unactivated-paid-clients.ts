/**
 * Resend set-password invites for paid companies whose client has not activated yet.
 * Use after deploying post-payment invite fix to remediate historical stuck customers.
 *
 * Run:
 *   npx ts-node scripts/resend-invites-for-unactivated-paid-clients.ts --dry-run
 *   npx ts-node scripts/resend-invites-for-unactivated-paid-clients.ts
 *
 * Requires: DATABASE_URL and email config (RESEND_API_KEY, FRONTEND_URL) in .env
 */

import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../src/prisma/prisma.module';
import { EmailModule } from '../src/email/email.module';
import { AuditLogsModule } from '../src/audit-logs/audit-logs.module';
import { OnboardingModule } from '../src/onboarding/onboarding.module';
import { StorageModule } from '../src/storage/storage.module';
import { AggregatorProfileModule } from '../src/aggregator-profile/aggregator-profile.module';
import { ClientProfilesModule } from '../src/client-profiles/client-profiles.module';
import { ClientProfilesService } from '../src/client-profiles/client-profiles.service';
import { PrismaService } from '../src/prisma/prisma.service';

const dryRun = process.argv.includes('--dry-run');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    PrismaModule,
    EmailModule,
    AuditLogsModule,
    OnboardingModule,
    StorageModule,
    AggregatorProfileModule,
    ClientProfilesModule,
  ],
})
class ResendInvitesAppModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(ResendInvitesAppModule, {
    logger: ['error', 'warn'],
  });

  const prisma = app.get(PrismaService);
  const clientProfilesService = app.get(ClientProfilesService);

  try {
    const companies = await prisma.clientProfile.findMany({
      where: {
        payments: { some: { status: 'PAID' } },
      },
      select: {
        id: true,
        companyName: true,
        contactEmail: true,
        users: {
          where: { role: 'CLIENT' },
          select: { isActivated: true, email: true },
        },
      },
      orderBy: { companyName: 'asc' },
    });

    const needsInvite = companies.filter((company) => {
      const clientUser = company.users[0];
      return !clientUser || !clientUser.isActivated;
    });

    console.log(
      `Found ${needsInvite.length} paid company/companies with missing or unactivated client user (of ${companies.length} paid total).\n`,
    );

    if (needsInvite.length === 0) {
      console.log('Nothing to do.');
      return;
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const company of needsInvite) {
      const clientUser = company.users[0];
      const status = clientUser
        ? `unactivated (${clientUser.email})`
        : 'no CLIENT user';

      if (dryRun) {
        console.log(`[dry-run] Would resend invite: "${company.companyName}" — ${status}`);
        continue;
      }

      try {
        const result = await clientProfilesService.resendInvite(company.id);
        console.log(`"${company.companyName}": ${result.message} (sent=${result.sent})`);
        if (result.sent) sent++;
        else skipped++;
      } catch (err) {
        failed++;
        console.error(
          `"${company.companyName}": FAILED — ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    if (!dryRun) {
      console.log(`\nDone. Sent=${sent}, skipped=${skipped}, failed=${failed}`);
    } else {
      console.log('\nDry run complete. Re-run without --dry-run to send invites.');
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
