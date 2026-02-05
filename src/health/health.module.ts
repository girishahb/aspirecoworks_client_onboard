import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PrismaModule, StorageModule, PaymentsModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
