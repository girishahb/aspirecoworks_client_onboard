import { Module, forwardRef } from '@nestjs/common';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { EmailModule } from '../email/email.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { ClientProfilesModule } from '../client-profiles/client-profiles.module';
import { PaymentsController } from './payments.controller';
import { AdminPaymentsController } from './admin-payments.controller';
import { PaymentsService } from './payments.service';
import { RazorpayService } from './razorpay.service';

@Module({
  imports: [
    OnboardingModule,
    EmailModule,
    InvoicesModule,
    forwardRef(() => ClientProfilesModule),
  ],
  controllers: [PaymentsController, AdminPaymentsController],
  providers: [PaymentsService, RazorpayService],
  exports: [PaymentsService, RazorpayService],
})
export class PaymentsModule {}
