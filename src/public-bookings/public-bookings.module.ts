import { Module } from '@nestjs/common';
import { PublicBookingsController } from './public-bookings.controller';
import { PublicBookingsService } from './public-bookings.service';
import { AdminLocationsController } from './admin-locations.controller';
import { AdminResourcesController } from './admin-resources.controller';
import { AdminPricingController } from './admin-pricing.controller';
import { AdminTimeSlotsController } from './admin-time-slots.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentsModule } from '../payments/payments.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, PaymentsModule, EmailModule],
  controllers: [
    PublicBookingsController,
    AdminLocationsController,
    AdminResourcesController,
    AdminPricingController,
    AdminTimeSlotsController,
  ],
  providers: [PublicBookingsService],
  exports: [PublicBookingsService],
})
export class PublicBookingsModule {}
