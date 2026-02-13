import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { MailerModule } from './mailer/mailer.module';
import { EmailModule } from './email/email.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClientProfilesModule } from './client-profiles/client-profiles.module';
import { CompaniesModule } from './companies/companies.module';
import { DocumentsModule } from './documents/documents.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { PaymentsModule } from './payments/payments.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { ComplianceModule } from './compliance/compliance.module';
import { RenewalsModule } from './renewals/renewals.module';
import { HealthModule } from './health/health.module';
import { InvoicesModule } from './invoices/invoices.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Rate limiting: Production-friendly (300 req/min per IP). Critical endpoints use @SkipThrottle().
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 1 minute
        limit: 300, // 300 requests per minute per IP
      },
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    MailerModule,
    EmailModule,
    AuthModule,
    UsersModule,
    ClientProfilesModule,
    CompaniesModule,
    DocumentsModule,
    OnboardingModule,
    PaymentsModule,
    AuditLogsModule,
    ComplianceModule,
    RenewalsModule,
    HealthModule,
    InvoicesModule,
    WebhooksModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
