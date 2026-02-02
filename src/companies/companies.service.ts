import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { companyActivated } from '../email/templates/company-activated';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateCompanyStatusDto } from './dto/update-status.dto';
import { UpdateCompanyRenewalDto } from './dto/update-renewal.dto';
import { UserRole } from '../common/enums/user-role.enum';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { OnboardingStatus } from '../common/enums/onboarding-status.enum';

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly emailService: EmailService,
  ) {}

  async create(createCompanyDto: CreateCompanyDto, userId: string) {
    if (createCompanyDto.taxId) {
      const existing = await this.prisma.clientProfile.findUnique({
        where: { taxId: createCompanyDto.taxId },
      });

      if (existing) {
        throw new ConflictException('Company with this tax ID already exists');
      }
    }

    const company = await this.prisma.clientProfile.create({
      data: {
        ...createCompanyDto,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    await this.auditLogsService.create({
      userId,
      clientProfileId: company.id,
      action: 'CREATE_COMPANY',
      entityType: 'Company',
      entityId: company.id,
      changes: createCompanyDto,
    });

    return company;
  }

  async findMyCompany(user: { id: string; companyId?: string | null; role: UserRole }) {
    if (!user.companyId) {
      throw new ForbiddenException('No company associated with this user');
    }

    const company = await this.prisma.clientProfile.findUnique({
      where: { id: user.companyId },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            documents: true,
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  async updateMyCompany(
    user: { id: string; companyId?: string | null; role: UserRole },
    updateCompanyDto: UpdateCompanyDto,
  ) {
    if (!user.companyId) {
      throw new ForbiddenException('No company associated with this user');
    }

    const existing = await this.prisma.clientProfile.findUnique({
      where: { id: user.companyId },
    });

    if (!existing) {
      throw new NotFoundException('Company not found');
    }

    if (updateCompanyDto.taxId && updateCompanyDto.taxId !== existing.taxId) {
      const duplicate = await this.prisma.clientProfile.findUnique({
        where: { taxId: updateCompanyDto.taxId },
      });

      if (duplicate) {
        throw new ConflictException('Company with this tax ID already exists');
      }
    }

    const updated = await this.prisma.clientProfile.update({
      where: { id: user.companyId },
      data: updateCompanyDto,
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    await this.auditLogsService.create({
      userId: user.id,
      clientProfileId: updated.id,
      action: 'UPDATE_COMPANY',
      entityType: 'Company',
      entityId: updated.id,
      changes: {
        before: existing,
        after: updated,
      },
    });

    return updated;
  }

  async findAll() {
    return this.prisma.clientProfile.findMany({
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            documents: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateStatus(id: string, dto: UpdateCompanyStatusDto, userId: string) {
    const existing = await this.prisma.clientProfile.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Company not found');
    }

    const updated = await this.prisma.clientProfile.update({
      where: { id },
      data: {
        onboardingStatus: dto.status,
      },
    });

    await this.auditLogsService.create({
      userId,
      clientProfileId: id,
      action: 'UPDATE_COMPANY_STATUS',
      entityType: 'Company',
      entityId: id,
      changes: {
        status: {
          before: existing.onboardingStatus,
          after: dto.status,
        },
      },
    });

    const transitionToActive =
      existing.onboardingStatus !== OnboardingStatus.COMPLETED &&
      dto.status === OnboardingStatus.COMPLETED;
    if (transitionToActive) {
      const to = updated.contactEmail?.trim();
      if (to) {
        try {
          const { subject, html, text } = companyActivated({
            companyName: updated.companyName,
          });
          await this.emailService.sendEmail({ to, subject, html, text });
        } catch (emailErr) {
          this.logger.warn(
            `Company activated email failed companyId=${id}: ${emailErr instanceof Error ? emailErr.message : emailErr}`,
          );
        }
      }
    }

    return updated;
  }

  async updateRenewal(id: string, dto: UpdateCompanyRenewalDto, userId: string) {
    const existing = await this.prisma.clientProfile.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Company not found');
    }

    const updated = await this.prisma.clientProfile.update({
      where: { id },
      data: {
        notes:
          dto.notes ??
          existing.notes ??
          `Renewal updated at ${new Date().toISOString()} by user ${userId}`,
      },
    });

    await this.auditLogsService.create({
      userId,
      clientProfileId: id,
      action: 'UPDATE_COMPANY_RENEWAL',
      entityType: 'Company',
      entityId: id,
      changes: {
        before: existing.notes,
        after: updated.notes,
      },
    });

    return updated;
  }
}

