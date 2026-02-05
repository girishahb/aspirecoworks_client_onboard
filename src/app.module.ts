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
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Rate limiting: More lenient in development, stricter in production
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isDevelopment = configService.get<string>('NODE_ENV') !== 'production';
        return [
          {
            name: 'default',
            ttl: 60000, // 1 minute
            limit: isDevelopment ? 1000 : 100, // 1000 requests/min in dev, 100 in prod
          },
          {
            name: 'auth',
            ttl: 60000, // 1 minute
            limit: isDevelopment ? 50 : 5, // 50 login attempts/min in dev, 5 in prod
          },
          {
            name: 'upload',
            ttl: 60000, // 1 minute
            limit: isDevelopment ? 100 : 10, // 100 uploads/min in dev, 10 in prod
          },
        ];
      },
    }),
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
