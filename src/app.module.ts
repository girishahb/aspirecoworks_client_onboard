import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { MailerModule } from './mailer/mailer.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClientProfilesModule } from './client-profiles/client-profiles.module';
import { CompaniesModule } from './companies/companies.module';
import { DocumentsModule } from './documents/documents.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { ComplianceModule } from './compliance/compliance.module';
import { RenewalsModule } from './renewals/renewals.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    MailerModule,
    AuthModule,
    UsersModule,
    ClientProfilesModule,
    CompaniesModule,
    DocumentsModule,
    AuditLogsModule,
    ComplianceModule,
    RenewalsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
