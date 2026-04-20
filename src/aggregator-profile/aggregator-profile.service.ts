import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../common/enums/user-role.enum';
import { UpsertAggregatorInvoiceProfileDto } from './dto/upsert-aggregator-invoice-profile.dto';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

/**
 * Aggregator-owned "Invoice To" profile. Stored once per aggregator user
 * and reused (with optional override) on every new client registration.
 */
@Injectable()
export class AggregatorProfileService {
  constructor(private readonly prisma: PrismaService) {}

  private assertAggregator(user: AuthenticatedUser): void {
    if (user.role !== UserRole.AGGREGATOR) {
      throw new ForbiddenException('Only AGGREGATOR users can access this resource');
    }
  }

  async getMyInvoiceProfile(user: AuthenticatedUser) {
    this.assertAggregator(user);
    const profile = await this.prisma.aggregatorInvoiceProfile.findUnique({
      where: { userId: user.id },
    });
    return profile; // may be null
  }

  /**
   * Internal helper used by the client-profiles service when creating an
   * aggregator-onboarded client – returns the profile or null.
   */
  async findForUser(userId: string) {
    return this.prisma.aggregatorInvoiceProfile.findUnique({ where: { userId } });
  }

  async upsertMyInvoiceProfile(
    user: AuthenticatedUser,
    dto: UpsertAggregatorInvoiceProfileDto,
  ) {
    this.assertAggregator(user);
    const data = {
      legalName: dto.legalName.trim(),
      constitution: dto.constitution ?? null,
      gstin: dto.gstin ?? null,
      pan: dto.pan ?? null,
      registeredAddress: dto.registeredAddress ?? null,
    };
    return this.prisma.aggregatorInvoiceProfile.upsert({
      where: { userId: user.id },
      update: data,
      create: { userId: user.id, ...data },
    });
  }

  async deleteMyInvoiceProfile(user: AuthenticatedUser) {
    this.assertAggregator(user);
    const existing = await this.prisma.aggregatorInvoiceProfile.findUnique({
      where: { userId: user.id },
    });
    if (!existing) {
      throw new NotFoundException('No invoice profile to delete');
    }
    await this.prisma.aggregatorInvoiceProfile.delete({ where: { userId: user.id } });
    return { deleted: true };
  }
}
