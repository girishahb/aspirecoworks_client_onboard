import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientProfileDto } from './dto/create-client-profile.dto';
import { UpdateClientProfileDto } from './dto/update-client-profile.dto';
import { OnboardingStage } from '../common/enums/onboarding-stage.enum';
import { getStageLabel } from '../common/enums/onboarding-stage.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { EmailService } from '../email/email.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { companyActivated } from '../email/templates/company-activated';
import { onboardingStageChanged } from '../email/templates/onboarding-stage-changed';
import { clientInviteSetPassword } from '../email/templates/client-invite-set-password';
import { assertValidTransition } from './onboarding-stage.helper';

const INVITE_TOKEN_EXPIRY_HOURS = 48;

@Injectable()
export class ClientProfilesService {
  private readonly logger = new Logger(ClientProfilesService.name);

  constructor(
    private prisma: PrismaService,
    private auditLogsService: AuditLogsService,
    private emailService: EmailService,
    private onboardingService: OnboardingService,
    private config: ConfigService,
  ) {}

  async create(createClientProfileDto: CreateClientProfileDto, userId: string) {
    if (createClientProfileDto.taxId) {
      const existing = await this.prisma.clientProfile.findUnique({
        where: { taxId: createClientProfileDto.taxId },
      });

      if (existing) {
        throw new ConflictException('Client profile with this tax ID already exists');
      }
    }

    const clientProfile = await this.prisma.clientProfile.create({
      data: {
        ...createClientProfileDto,
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
      clientProfileId: clientProfile.id,
      action: 'CREATE',
      entityType: 'ClientProfile',
      entityId: clientProfile.id,
      changes: createClientProfileDto,
    });

    // Create User for client login + send invite email
    await this.createClientUserAndSendInvite(clientProfile);

    return clientProfile;
  }

  /**
   * Create a User linked to the client profile and send "Set Password" invite email.
   * If a User with contactEmail already exists, skip creation (e.g. they signed up or were invited before).
   */
  private async createClientUserAndSendInvite(clientProfile: {
    id: string;
    companyName: string;
    contactEmail: string;
  }) {
    const email = clientProfile.contactEmail.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // User exists - if not activated and no companyId, we could send invite to link. For now, skip.
      this.logger.log(
        `Client user not created: email ${email} already exists (userId=${existingUser.id}). Consider using Resend Invite.`,
      );
      return;
    }

    const token = randomBytes(32).toString('hex');
    const inviteTokenExpiry = new Date(Date.now() + INVITE_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await this.prisma.user.create({
      data: {
        email,
        passwordHash: null,
        firstName: clientProfile.companyName,
        lastName: '',
        role: UserRole.CLIENT,
        companyId: clientProfile.id,
        isActive: true,
        inviteToken: token,
        inviteTokenExpiry,
        isActivated: false,
      },
    });

    const frontendUrl = (this.config.get<string>('FRONTEND_URL') ?? 'https://app.aspirecoworks.in').replace(/\/$/, '');
    const setPasswordUrl = `${frontendUrl}/set-password?token=${encodeURIComponent(token)}`;

    const { subject, html, text } = clientInviteSetPassword({
      companyName: clientProfile.companyName,
      setPasswordUrl,
      expiryHours: INVITE_TOKEN_EXPIRY_HOURS,
    });

    try {
      await this.emailService.sendEmail({
        to: email,
        subject,
        html,
        text,
      });
      this.logger.log(`Invite email sent to ${email} for company ${clientProfile.companyName}`);
    } catch (err) {
      this.logger.warn(`Failed to send invite email to ${email}: ${err instanceof Error ? err.message : err}`);
    }
  }

  /**
   * Resend invite email for a company. Creates User if missing, or regenerates token if not yet activated.
   */
  async resendInvite(companyId: string): Promise<{ sent: boolean; message: string }> {
    const company = await this.prisma.clientProfile.findUnique({
      where: { id: companyId },
      select: { id: true, companyName: true, contactEmail: true },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const email = company.contactEmail.trim().toLowerCase();
    const existingUser = await this.prisma.user.findFirst({
      where: { companyId, role: UserRole.CLIENT },
    });

    if (existingUser?.isActivated) {
      return { sent: false, message: 'Client has already set their password and can log in.' };
    }

    if (existingUser) {
      // Regenerate token and resend
      const token = randomBytes(32).toString('hex');
      const inviteTokenExpiry = new Date(Date.now() + INVITE_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
      await this.prisma.user.update({
        where: { id: existingUser.id },
        data: { inviteToken: token, inviteTokenExpiry },
      });

      const frontendUrl = (this.config.get<string>('FRONTEND_URL') ?? 'https://app.aspirecoworks.in').replace(/\/$/, '');
      const setPasswordUrl = `${frontendUrl}/set-password?token=${encodeURIComponent(token)}`;

      const { subject, html, text } = clientInviteSetPassword({
        companyName: company.companyName,
        setPasswordUrl,
        expiryHours: INVITE_TOKEN_EXPIRY_HOURS,
      });

      try {
        await this.emailService.sendEmail({ to: email, subject, html, text });
        this.logger.log(`Resend invite email sent to ${email} for company ${company.companyName}`);
        return { sent: true, message: 'Invite email sent.' };
      } catch (err) {
        this.logger.warn(`Failed to resend invite to ${email}: ${err instanceof Error ? err.message : err}`);
        throw new BadRequestException('Failed to send invite email');
      }
    }

    // No user exists - create and send (e.g. was skipped during create due to duplicate email)
    await this.createClientUserAndSendInvite(company);
    return { sent: true, message: 'Invite email sent.' };
  }

  async findAll(userRole: UserRole, userId?: string) {
    const where: any = {};

    // COMPANY_ADMIN users can only see their own company profile (filtered by companyId in service logic)
    // This check is handled elsewhere for COMPANY_ADMIN users

    const list = await this.prisma.clientProfile.findMany({
      where,
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
      orderBy: { createdAt: 'desc' },
    });
    return list.map((p) => {
      const isActive = p.onboardingStage === OnboardingStage.ACTIVE;
      return { ...p, isActive, onboardingLocked: isActive };
    });
  }

  async findOne(id: string, userRole: UserRole, userId?: string) {
    const clientProfile = await this.prisma.clientProfile.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        documents: {
          select: {
            id: true,
            fileName: true,
            documentType: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!clientProfile) {
      throw new NotFoundException(`Client profile with ID ${id} not found`);
    }

    // Authorization check: COMPANY_ADMIN users can only access their own company profile
    // This is handled via companyId check elsewhere for COMPANY_ADMIN users

    const isActive = clientProfile.onboardingStage === OnboardingStage.ACTIVE;
    return {
      ...clientProfile,
      isActive,
      onboardingLocked: isActive,
    };
  }

  async update(
    id: string,
    updateClientProfileDto: UpdateClientProfileDto,
    userId: string,
    userRole: UserRole,
  ) {
    const existing = await this.findOne(id, userRole, userId);

    if (updateClientProfileDto.taxId && updateClientProfileDto.taxId !== existing.taxId) {
      const duplicate = await this.prisma.clientProfile.findUnique({
        where: { taxId: updateClientProfileDto.taxId },
      });

      if (duplicate) {
        throw new ConflictException('Client profile with this tax ID already exists');
      }
    }

    // Authorization check: Only admins/managers can update, or the creator
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.MANAGER && existing.createdById !== userId) {
      throw new ForbiddenException('You do not have permission to update this client profile');
    }

    if (updateClientProfileDto.onboardingStage !== undefined) {
      await this.onboardingService.assertNotActive(id);
      assertValidTransition(existing.onboardingStage, updateClientProfileDto.onboardingStage);
    }

    const updated = await this.prisma.clientProfile.update({
      where: { id },
      data: updateClientProfileDto,
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
      clientProfileId: id,
      action: 'UPDATE',
      entityType: 'ClientProfile',
      entityId: id,
      changes: {
        before: existing,
        after: updated,
      },
    });

    return updated;
  }

  /**
   * Transition onboarding stage safely. Validates allowed transitions before updating.
   */
  async updateStage(
    id: string,
    stage: OnboardingStage,
    userId: string,
    userRole: UserRole,
  ) {
    if (
      userRole !== UserRole.SUPER_ADMIN &&
      userRole !== UserRole.ADMIN &&
      userRole !== UserRole.MANAGER
    ) {
      throw new ForbiddenException('You do not have permission to update onboarding stage');
    }

    await this.onboardingService.assertNotActive(id);
    const existing = await this.findOne(id, userRole, userId);
    assertValidTransition(existing.onboardingStage, stage);

    const updated = await this.prisma.clientProfile.update({
      where: { id },
      data: { onboardingStage: stage },
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
      clientProfileId: id,
      action: 'UPDATE_STATUS',
      entityType: 'ClientProfile',
      entityId: id,
      changes: {
        stage: {
          before: existing.onboardingStage,
          after: stage,
        },
      },
    });

    // Send onboarding email on stage change (skip when dedicated email is sent elsewhere)
    const to = updated.contactEmail?.trim();
    if (to) {
      try {
        const frontendUrl = (this.config.get<string>('FRONTEND_URL') ?? 'https://app.aspirecoworks.in').replace(/\/$/, '');
        const dashboardUrl = `${frontendUrl}/dashboard`;
        if (stage === OnboardingStage.ACTIVE) {
          const { subject, html, text } = companyActivated({
            companyName: updated.companyName,
            dashboardUrl,
          });
          await this.emailService.sendEmail({ to, subject, html, text });
        } else if (
          stage !== OnboardingStage.AGREEMENT_DRAFT_SHARED &&
          stage !== OnboardingStage.FINAL_AGREEMENT_SHARED
        ) {
          const { subject, html, text } = onboardingStageChanged({
            companyName: updated.companyName,
            stage,
            dashboardUrl,
          });
          await this.emailService.sendEmail({ to, subject, html, text });
        }
      } catch (emailErr) {
        this.logger.warn(
          `Onboarding stage email failed companyId=${id}: ${emailErr instanceof Error ? emailErr.message : emailErr}`,
        );
      }
    }

    return updated;
  }

  /**
   * Confirm payment and move stage to KYC_IN_PROGRESS. Call after payment success.
   * Only valid when current stage is PAYMENT_CONFIRMED.
   */
  async confirmPayment(id: string, userId: string, userRole: UserRole) {
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.MANAGER) {
      throw new ForbiddenException('Only ADMIN or MANAGER can confirm payment');
    }

    const existing = await this.findOne(id, userRole, userId);
    const current = existing.onboardingStage as OnboardingStage;

    await this.onboardingService.assertNotActive(id);
    if (current !== OnboardingStage.PAYMENT_CONFIRMED) {
      throw new BadRequestException(
        `Payment cannot be confirmed: current stage is "${getStageLabel(current)}". ` +
          'Stage must be PAYMENT_CONFIRMED before recording payment success. ' +
          'Move the company to PAYMENT_CONFIRMED first (e.g. after payment is received), then call confirm payment to open KYC uploads.',
      );
    }

    await this.onboardingService.updateStage(id, OnboardingStage.KYC_IN_PROGRESS);
    await this.auditLogsService.create({
      userId,
      clientProfileId: id,
      action: 'CONFIRM_PAYMENT',
      entityType: 'ClientProfile',
      entityId: id,
      changes: {
        stageBefore: OnboardingStage.PAYMENT_CONFIRMED,
        stageAfter: OnboardingStage.KYC_IN_PROGRESS,
      },
    });
    return this.findOne(id, userRole, userId);
  }

  /**
   * Activate company: only allowed when onboardingStage is FINAL_AGREEMENT_SHARED.
   * Sets activationDate, updates stage to ACTIVE, and sends activation email to company contact.
   */
  async activateCompany(id: string, userId: string, userRole: UserRole) {
    if (
      userRole !== UserRole.SUPER_ADMIN &&
      userRole !== UserRole.ADMIN &&
      userRole !== UserRole.MANAGER
    ) {
      throw new ForbiddenException('Only SUPER_ADMIN, ADMIN, or MANAGER can activate a company');
    }

    const existing = await this.findOne(id, userRole, userId);
    const current = existing.onboardingStage as OnboardingStage;

    if (current === OnboardingStage.ACTIVE) {
      throw new BadRequestException('Company is already activated.');
    }
    if (current !== OnboardingStage.FINAL_AGREEMENT_SHARED) {
      throw new BadRequestException(
        'Activation only allowed after final agreement has been shared. ' +
          `Current stage: ${getStageLabel(current)}.`,
      );
    }

    const canActivate = await this.onboardingService.canActivateCompany(id);
    if (!canActivate) {
      throw new BadRequestException(
        'Activation requirements not met. Ensure: at least one payment PAID, all KYC approved, at least one final agreement, and stage is Final agreement shared.',
      );
    }

    await this.onboardingService.activateCompany(id);

    const updated = await this.findOne(id, userRole, userId);

    await this.auditLogsService.create({
      userId,
      clientProfileId: id,
      action: 'ACTIVATE_COMPANY',
      entityType: 'ClientProfile',
      entityId: id,
      changes: {
        stage: { before: current, after: OnboardingStage.ACTIVE },
        activationDate: updated.activationDate?.toISOString() ?? new Date().toISOString(),
      },
    });

    const to = updated.contactEmail?.trim();
    if (to) {
      try {
        const frontendUrl = (this.config.get<string>('FRONTEND_URL') ?? 'https://app.aspirecoworks.in').replace(/\/$/, '');
        const { subject, html, text } = companyActivated({
          companyName: updated.companyName,
          activationDate: updated.activationDate ?? undefined,
          dashboardUrl: `${frontendUrl}/dashboard`,
        });
        await this.emailService.sendEmail({ to, subject, html, text });
      } catch (emailErr) {
        this.logger.warn(
          `Company activated email failed companyId=${id}: ${emailErr instanceof Error ? emailErr.message : emailErr}`,
        );
      }
    }

    return updated;
  }

  async remove(id: string, userId: string, userRole: UserRole) {
    const existing = await this.findOne(id, userRole, userId);

    // Only admins can delete
    if (userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not have permission to delete client profiles');
    }

    await this.prisma.clientProfile.delete({
      where: { id },
    });

    await this.auditLogsService.create({
      userId,
      clientProfileId: id,
      action: 'DELETE',
      entityType: 'ClientProfile',
      entityId: id,
      changes: existing,
    });

    return { message: 'Client profile deleted successfully' };
  }

  /**
   * Get aggregated dashboard statistics for admin dashboard.
   * Computes company counts by stage, payment stats, and revenue metrics.
   */
  async getDashboardStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Parallel queries for performance
    const [
      totalCompanies,
      activeCompanies,
      paymentPending,
      kycPending,
      agreementsPending,
      readyForActivation,
      totalRevenueResult,
      revenueThisMonthResult,
      stageCounts,
    ] = await Promise.all([
      // Total companies
      this.prisma.clientProfile.count(),

      // Active companies
      this.prisma.clientProfile.count({
        where: { onboardingStage: OnboardingStage.ACTIVE },
      }),

      // Payment pending
      this.prisma.clientProfile.count({
        where: { onboardingStage: OnboardingStage.PAYMENT_PENDING },
      }),

      // KYC pending (KYC_IN_PROGRESS or KYC_REVIEW)
      this.prisma.clientProfile.count({
        where: {
          onboardingStage: {
            in: [OnboardingStage.KYC_IN_PROGRESS, OnboardingStage.KYC_REVIEW],
          },
        },
      }),

      // Agreements pending
      this.prisma.clientProfile.count({
        where: {
          onboardingStage: {
            in: [
              OnboardingStage.AGREEMENT_DRAFT_SHARED,
              OnboardingStage.SIGNED_AGREEMENT_RECEIVED,
            ],
          },
        },
      }),

      // Ready for activation
      this.prisma.clientProfile.count({
        where: { onboardingStage: OnboardingStage.FINAL_AGREEMENT_SHARED },
      }),

      // Total revenue (sum of all PAID payments)
      this.prisma.payment.aggregate({
        where: { status: 'PAID' },
        _sum: { amount: true },
      }),

      // Revenue this month
      this.prisma.payment.aggregate({
        where: {
          status: 'PAID',
          paidAt: {
            gte: startOfMonth,
          },
        },
        _sum: { amount: true },
      }),

      // Stage counts (group by onboardingStage)
      this.prisma.clientProfile.groupBy({
        by: ['onboardingStage'],
        _count: { id: true },
      }),
    ]);

    // Convert stage counts array to object
    const stageCountsMap: Record<string, number> = {};
    stageCounts.forEach((item) => {
      stageCountsMap[item.onboardingStage] = item._count.id;
    });

    // Ensure all stages are present (even if 0)
    const allStages = Object.values(OnboardingStage);
    allStages.forEach((stage) => {
      if (!(stage in stageCountsMap)) {
        stageCountsMap[stage] = 0;
      }
    });

    return {
      totalCompanies,
      activeCompanies,
      paymentPending,
      kycPending,
      agreementsPending,
      readyForActivation,
      totalRevenue: totalRevenueResult._sum.amount ?? 0,
      revenueThisMonth: revenueThisMonthResult._sum.amount ?? 0,
      stageCounts: stageCountsMap,
    };
  }
}
