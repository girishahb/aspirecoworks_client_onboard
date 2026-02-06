import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { PaymentsModule } from '../payments/payments.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [PaymentsModule, OnboardingModule, InvoicesModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
