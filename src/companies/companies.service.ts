import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { companyActivated } from '../email/templates/company-activated';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateCompanyStatusDto } from './dto/update-status.dto';
import { UpdateCompanyRenewalDto } from './dto/update-renewal.dto';
import { UserRole } from '../common/enums/user-role.enum';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { OnboardingStage } from '../common/enums/onboarding-stage.enum';
import { assertValidTransition } from '../client-profiles/onboarding-stage.helper';

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
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
    // Log for debugging
    this.logger.log(`[findMyCompany] User: ${user.id}, Role: ${user.role}, CompanyId: ${user.companyId || 'NULL'}`);
    
    if (!user.companyId) {
      this.logger.error(`[findMyCompany] User ${user.id} (${user.role}) has no companyId`);
      throw new ForbiddenException(
        `No company associated with this user. User ID: ${user.id}, Role: ${user.role}. Please contact support or ensure your account is linked to a company.`
      );
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

    assertValidTransition(existing.onboardingStage, dto.stage);

    const updated = await this.prisma.clientProfile.update({
      where: { id },
      data: {
        onboardingStage: dto.stage,
      },
    });

    await this.auditLogsService.create({
      userId,
      clientProfileId: id,
      action: 'UPDATE_COMPANY_STATUS',
      entityType: 'Company',
      entityId: id,
      changes: {
        stage: {
          before: existing.onboardingStage,
          after: dto.stage,
        },
      },
    });

    const transitionToActive =
      existing.onboardingStage !== OnboardingStage.COMPLETED &&
      dto.stage === OnboardingStage.COMPLETED;
    if (transitionToActive) {
      const to = updated.contactEmail?.trim();
      if (to) {
        try {
          const frontendUrl = (this.config.get<string>('FRONTEND_URL') ?? 'https://app.aspirecoworks.in').replace(/\/$/, '');
          const { subject, html, text } = companyActivated({
            companyName: updated.companyName,
            dashboardUrl: `${frontendUrl}/dashboard`,
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

