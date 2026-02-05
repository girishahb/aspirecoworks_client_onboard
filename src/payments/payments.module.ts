import { Module } from '@nestjs/common';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { EmailModule } from '../email/email.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { PaymentsController } from './payments.controller';
import { AdminPaymentsController } from './admin-payments.controller';
import { PaymentsService } from './payments.service';
import { RazorpayService } from './razorpay.service';

@Module({
  imports: [OnboardingModule, EmailModule, InvoicesModule],
  controllers: [PaymentsController, AdminPaymentsController],
  providers: [PaymentsService, RazorpayService],
  exports: [PaymentsService, RazorpayService],
})
export class PaymentsModule {}
