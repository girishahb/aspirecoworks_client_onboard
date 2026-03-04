import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { PaymentsModule } from '../payments/payments.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicBookingsModule } from '../public-bookings/public-bookings.module';

@Module({
  imports: [
    PrismaModule,
    PaymentsModule,
    OnboardingModule,
    InvoicesModule,
    PublicBookingsModule,
  ],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
