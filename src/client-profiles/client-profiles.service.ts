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
import { R2Service } from '../storage/r2.service';
import { companyActivated } from '../email/templates/company-activated';
import { onboardingStageChanged } from '../email/templates/onboarding-stage-changed';
import { clientInviteSetPassword } from '../email/templates/client-invite-set-password';
import { assertValidTransition } from './onboarding-stage.helper';
import { AggregatorProfileService } from '../aggregator-profile/aggregator-profile.service';
import { leadSourceToClientChannel } from '../common/constants/client-ops-options';
import {
  agreementOperationalStatus,
  isActiveFromAgreement,
} from '../common/utils/agreement-status';
import { ClientChannel, OperationalStatus, Prisma } from '@prisma/client';
import type {
  AggregatorBookingInput,
  InvoiceToOverrideInput,
} from './dto/aggregator-booking-input';
import {
  assertExternalBookingIdAvailable,
  DUPLICATE_EXTERNAL_BOOKING_ID_MESSAGE,
  isExternalBookingIdUniqueViolation,
  normalizeExternalBookingId,
} from './external-booking-id.helper';

const INVITE_TOKEN_EXPIRY_HOURS = 48;

@Injectable()
export class ClientProfilesService {
  private readonly logger = new Logger(ClientProfilesService.name);

  private parseDateOnly(iso?: string | null): Date | null {
    if (!iso) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
    if (!m) throw new BadRequestException(`Invalid date (expected YYYY-MM-DD): ${iso}`);
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  }

  constructor(
    private prisma: PrismaService,
    private auditLogsService: AuditLogsService,
    private emailService: EmailService,
    private onboardingService: OnboardingService,
    private config: ConfigService,
    private r2Service: R2Service,
    private aggregatorProfileService: AggregatorProfileService,
  ) {}

  async create(
    createClientProfileDto: CreateClientProfileDto,
    userId: string,
    actor?: { role?: UserRole; aggregatorName?: string | null },
  ) {
    if (createClientProfileDto.taxId) {
      const existing = await this.prisma.clientProfile.findUnique({
        where: { taxId: createClientProfileDto.taxId },
      });

      if (existing) {
        throw new ConflictException('Client profile with this tax ID already exists');
      }
    }

    const externalBookingId = await assertExternalBookingIdAvailable(
      this.prisma,
      createClientProfileDto.externalBookingId,
    );

    // Resolve channel + aggregator from payload and actor context.
    // AGGREGATOR users cannot choose the channel; it is always forced to AGGREGATOR
    // and aggregatorName is taken from the authenticated user.
    // leadSource (Aggregator/Direct) also drives clientChannel when provided.
    let clientChannel: 'DIRECT' | 'AGGREGATOR' =
      (createClientProfileDto.clientChannel as 'DIRECT' | 'AGGREGATOR' | undefined) ?? 'DIRECT';
    let aggregatorName: string | null =
      (createClientProfileDto.aggregatorName as string | undefined) ?? null;

    if (createClientProfileDto.leadSource) {
      clientChannel = leadSourceToClientChannel(createClientProfileDto.leadSource);
    }

    if (actor?.role === UserRole.AGGREGATOR) {
      clientChannel = 'AGGREGATOR';
      aggregatorName = actor.aggregatorName ?? null;
      if (!aggregatorName) {
        throw new BadRequestException(
          'Aggregator user is missing aggregatorName on their profile.',
        );
      }
    }

    if (clientChannel === 'AGGREGATOR' && !aggregatorName?.trim()) {
      throw new BadRequestException(
        'aggregatorName is required when clientChannel is AGGREGATOR',
      );
    }

    // AGGREGATOR clients skip internal payment and land on KYC upload on first login.
    const initialStage =
      clientChannel === 'AGGREGATOR'
        ? OnboardingStage.KYC_IN_PROGRESS
        : (createClientProfileDto.onboardingStage ?? OnboardingStage.ADMIN_CREATED);

    // Booking + Invoice-To payloads are only honored on the AGGREGATOR code path.
    const isAggregatorCreation =
      actor?.role === UserRole.AGGREGATOR && clientChannel === 'AGGREGATOR';
    const booking = isAggregatorCreation ? createClientProfileDto.booking : undefined;
    const invoiceToOverride = isAggregatorCreation ? createClientProfileDto.invoiceTo : undefined;
    const saveInvoiceToProfile = isAggregatorCreation
      ? Boolean(createClientProfileDto.saveInvoiceToProfile)
      : false;

    // Resolve Invoice-To snapshot: override wins field-by-field over saved profile.
    let invoiceSnapshot: {
      legalName: string | null;
      constitution: string | null;
      gstin: string | null;
      pan: string | null;
      registeredAddress: string | null;
    } | null = null;

    if (isAggregatorCreation) {
      const savedProfile = await this.aggregatorProfileService.findForUser(userId);
      invoiceSnapshot = {
        legalName:
          invoiceToOverride?.legalName ?? savedProfile?.legalName ?? null,
        constitution:
          invoiceToOverride?.constitution ?? savedProfile?.constitution ?? null,
        gstin: invoiceToOverride?.gstin ?? savedProfile?.gstin ?? null,
        pan: invoiceToOverride?.pan ?? savedProfile?.pan ?? null,
        registeredAddress:
          invoiceToOverride?.registeredAddress ?? savedProfile?.registeredAddress ?? null,
      };
    }

    const {
      clientChannel: _c,
      aggregatorName: _a,
      onboardingStage: _s,
      booking: _b,
      invoiceTo: _it,
      saveInvoiceToProfile: _sp,
      externalBookingId: _eb,
      ...rest
    } = createClientProfileDto as any;

    let result;
    try {
      result = await this.prisma.$transaction(async (tx) => {
        const clientProfile = await tx.clientProfile.create({
          data: {
            ...rest,
            externalBookingId,
            clientChannel,
            aggregatorName,
            onboardingStage: initialStage,
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

        if (isAggregatorCreation) {
          await this.createAggregatorBookingTx(tx, {
            clientProfileId: clientProfile.id,
            createdById: userId,
            booking,
            invoiceSnapshot,
          });

          if (saveInvoiceToProfile && invoiceSnapshot?.legalName) {
            // Upsert the aggregator's saved invoice profile using the resolved snapshot.
            await tx.aggregatorInvoiceProfile.upsert({
              where: { userId },
              create: {
                userId,
                legalName: invoiceSnapshot.legalName,
                constitution: invoiceSnapshot.constitution,
                gstin: invoiceSnapshot.gstin,
                pan: invoiceSnapshot.pan,
                registeredAddress: invoiceSnapshot.registeredAddress,
              },
              update: {
                legalName: invoiceSnapshot.legalName,
                constitution: invoiceSnapshot.constitution,
                gstin: invoiceSnapshot.gstin,
                pan: invoiceSnapshot.pan,
                registeredAddress: invoiceSnapshot.registeredAddress,
              },
            });
          }
        }

        return clientProfile;
      });
    } catch (err) {
      if (isExternalBookingIdUniqueViolation(err)) {
        throw new ConflictException(DUPLICATE_EXTERNAL_BOOKING_ID_MESSAGE);
      }
      throw err;
    }

    await this.auditLogsService.create({
      userId,
      clientProfileId: result.id,
      action: 'CREATE',
      entityType: 'ClientProfile',
      entityId: result.id,
      changes: createClientProfileDto,
    });

    // Create User for client login + send invite email (outside the transaction to avoid
    // slow email sends holding DB locks; creation of the client is already committed).
    // Do not fail the create API if email delivery fails — company/user already exist.
    const invite = await this.createClientUserAndSendInvite(result);
    if (invite.status === 'failed') {
      this.logger.warn(
        `Client ${result.id} created but invite email failed: ${invite.message}`,
      );
    }

    return {
      ...result,
      inviteSent: invite.status === 'sent',
      inviteStatus: invite.status,
      inviteError: invite.status === 'failed' ? invite.message : null,
      inviteMessage: invite.message,
    };
  }

  /**
   * Inside-transaction helper: create an AggregatorBooking row tied to the newly
   * created ClientProfile. Snapshots the resolved Invoice-To for auditability.
   */
  private async createAggregatorBookingTx(
    tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
    args: {
      clientProfileId: string;
      createdById: string;
      booking: AggregatorBookingInput | undefined;
      invoiceSnapshot: {
        legalName: string | null;
        constitution: string | null;
        gstin: string | null;
        pan: string | null;
        registeredAddress: string | null;
      } | null;
    },
  ) {
    const { clientProfileId, createdById, booking, invoiceSnapshot } = args;
    const currency = booking?.currency?.toUpperCase() || 'INR';
    await tx.aggregatorBooking.create({
      data: {
        clientProfileId,
        createdById,
        bookingReference: booking?.bookingReference ?? null,
        planType: booking?.planType ?? null,
        venueName: booking?.venueName ?? null,
        venueAddress: booking?.venueAddress ?? null,
        durationMonths: booking?.durationMonths ?? null,
        amount: booking?.amount == null ? null : booking.amount,
        currency,
        gstApplicable: booking?.gstApplicable ?? true,
        paymentTerms: booking?.paymentTerms ?? null,
        signageTerms: booking?.signageTerms ?? null,
        clientContactName: booking?.clientContactName ?? null,
        pocName: booking?.pocName ?? null,
        pocContact: booking?.pocContact ?? null,
        clientFatherOrSpouseName: booking?.clientFatherOrSpouseName ?? null,
        clientPan: booking?.clientPan ?? null,
        clientAadhaar: booking?.clientAadhaar ?? null,
        invoiceLegalName: invoiceSnapshot?.legalName ?? null,
        invoiceConstitution: invoiceSnapshot?.constitution ?? null,
        invoiceGstin: invoiceSnapshot?.gstin ?? null,
        invoicePan: invoiceSnapshot?.pan ?? null,
        invoiceRegisteredAddress: invoiceSnapshot?.registeredAddress ?? null,
      },
    });
  }

  /**
   * List AggregatorBooking rows attached to a client profile. Aggregators can
   * only read bookings for clients they onboarded; admins can read any.
   */
  async listBookings(
    clientProfileId: string,
    actor: { id: string; role: UserRole },
  ) {
    const company = await this.prisma.clientProfile.findUnique({
      where: { id: clientProfileId },
      select: { id: true, createdById: true, clientChannel: true },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    if (actor.role === UserRole.AGGREGATOR) {
      if (company.clientChannel !== 'AGGREGATOR' || company.createdById !== actor.id) {
        throw new ForbiddenException('You can only view bookings for clients you onboarded');
      }
    } else if (
      actor.role !== UserRole.SUPER_ADMIN &&
      actor.role !== UserRole.ADMIN &&
      actor.role !== UserRole.MANAGER
    ) {
      throw new ForbiddenException('Not authorized');
    }

    return this.prisma.aggregatorBooking.findMany({
      where: { clientProfileId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private buildInviteTokenExpiry(): Date {
    return new Date(Date.now() + INVITE_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
  }

  private async sendSetPasswordInviteEmail(
    companyName: string,
    email: string,
    token: string,
  ): Promise<void> {
    const frontendUrl = (this.config.get<string>('FRONTEND_URL') ?? 'https://app.aspirecoworks.in').replace(/\/$/, '');
    const setPasswordUrl = `${frontendUrl}/set-password?token=${encodeURIComponent(token)}`;
    const { subject, html, text } = clientInviteSetPassword({
      companyName,
      setPasswordUrl,
      expiryHours: INVITE_TOKEN_EXPIRY_HOURS,
    });
    // Prefer invite-specific from; fall back to EMAIL_FROM (do not use courier mailbox for invites).
    const inviteFrom =
      this.config.get<string>('EMAIL_FROM_INVITE')?.trim() ||
      this.config.get<string>('EMAIL_FROM')?.trim() ||
      undefined;
    const result = await this.emailService.sendEmail({
      to: email,
      subject,
      html,
      text,
      from: inviteFrom,
    });
    if (!result.success) {
      throw new BadRequestException(
        result.error || 'Failed to send invite email. Check Resend domain / recipient limits.',
      );
    }
  }

  /**
   * Create a User linked to the client profile and send "Set Password" invite email.
   * If a User with contactEmail already exists but is not activated, link them and resend invite.
   */
  private async createClientUserAndSendInvite(clientProfile: {
    id: string;
    companyName: string;
    contactEmail: string;
  }): Promise<{
    status: 'sent' | 'already_activated' | 'failed';
    message: string;
  }> {
    const email = clientProfile.contactEmail.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    const token = randomBytes(32).toString('hex');
    const inviteTokenExpiry = this.buildInviteTokenExpiry();

    try {
      if (existingUser) {
        if (existingUser.isActivated) {
          this.logger.log(
            `Client invite skipped: email ${email} already activated (userId=${existingUser.id}).`,
          );
          // Only attach login when it is not already bound to a different company.
          if (!existingUser.companyId) {
            await this.prisma.user.update({
              where: { id: existingUser.id },
              data: {
                companyId: clientProfile.id,
                role: UserRole.CLIENT,
                isActive: true,
              },
            });
            return {
              status: 'already_activated',
              message:
                'This email already has a password set. Login was linked to this client — they can sign in with their existing password (no invite sent).',
            };
          }
          if (existingUser.companyId === clientProfile.id) {
            return {
              status: 'already_activated',
              message:
                'This email already has a client login with a password set. No invite was sent — they can sign in with their existing password.',
            };
          }
          return {
            status: 'already_activated',
            message:
              'This email is already used by another activated client account. Use a different contact email for a new invite, or sign in with that account’s existing password.',
          };
        }

        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            companyId: clientProfile.id,
            role: UserRole.CLIENT,
            inviteToken: token,
            inviteTokenExpiry,
            isActive: true,
          },
        });

        await this.sendSetPasswordInviteEmail(clientProfile.companyName, email, token);
        this.logger.log(
          `Invite email sent to existing user ${email} for company ${clientProfile.companyName}`,
        );
        return { status: 'sent', message: 'Invite email sent.' };
      }

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

      await this.sendSetPasswordInviteEmail(clientProfile.companyName, email, token);
      this.logger.log(`Invite email sent to ${email} for company ${clientProfile.companyName}`);
      return { status: 'sent', message: 'Invite email sent.' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: 'failed', message };
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
    let existingUser = await this.prisma.user.findFirst({
      where: { companyId, role: UserRole.CLIENT },
    });

    if (!existingUser) {
      existingUser = await this.prisma.user.findUnique({ where: { email } });
      if (existingUser && !existingUser.companyId) {
        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: { companyId, role: UserRole.CLIENT },
        });
      }
    }

    if (existingUser?.isActivated) {
      return { sent: false, message: 'Client has already set their password and can log in.' };
    }

    if (existingUser) {
      const token = randomBytes(32).toString('hex');
      const inviteTokenExpiry = this.buildInviteTokenExpiry();
      await this.prisma.user.update({
        where: { id: existingUser.id },
        data: { inviteToken: token, inviteTokenExpiry },
      });

      await this.sendSetPasswordInviteEmail(company.companyName, email, token);
      this.logger.log(`Resend invite email sent to ${email} for company ${company.companyName}`);
      return { sent: true, message: 'Invite email sent.' };
    }

    // No user exists - create and send
    const invite = await this.createClientUserAndSendInvite(company);
    if (invite.status === 'already_activated') {
      return { sent: false, message: invite.message };
    }
    if (invite.status !== 'sent') {
      throw new BadRequestException(invite.message || 'Failed to send invite email');
    }
    return { sent: true, message: 'Invite email sent.' };
  }

  /**
   * After payment success: send a fresh set-password invite if the client has not activated yet.
   * Safe for webhooks — logs and swallows errors so payment processing is not blocked.
   */
  async sendInviteAfterPaymentIfNeeded(companyId: string): Promise<void> {
    try {
      const result = await this.resendInvite(companyId);
      this.logger.log(
        `Post-payment invite for company ${companyId}: ${result.message} (sent=${result.sent})`,
      );
    } catch (err) {
      this.logger.warn(
        `Post-payment invite failed for company ${companyId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  async findAll(userRole: UserRole, userId?: string) {
    const where: any = {};

    // COMPANY_ADMIN users can only see their own company profile (filtered by companyId in service logic)
    // This check is handled elsewhere for COMPANY_ADMIN users

    // AGGREGATOR partners only see clients they onboarded.
    if (userRole === UserRole.AGGREGATOR && userId) {
      where.createdById = userId;
    }

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
        location: {
          select: { id: true, name: true, code: true, area: true },
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
      const onboardingLocked = p.onboardingStage === OnboardingStage.ACTIVE;
      const isActive = isActiveFromAgreement(p);
      return {
        ...p,
        isActive,
        operationalStatus: agreementOperationalStatus(p),
        onboardingLocked,
      };
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
        location: {
          select: { id: true, name: true, code: true, area: true },
        },
        vendor: {
          select: { id: true, name: true, code: true },
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

    // AGGREGATOR users can only view clients they created.
    if (
      userRole === UserRole.AGGREGATOR &&
      userId &&
      clientProfile.createdById !== userId
    ) {
      throw new ForbiddenException(
        'You do not have permission to view this client profile',
      );
    }

    const onboardingLocked = clientProfile.onboardingStage === OnboardingStage.ACTIVE;
    const isActive = isActiveFromAgreement(clientProfile);

    const clientUser = await this.prisma.user.findFirst({
      where: { companyId: id, role: UserRole.CLIENT },
      select: { isActivated: true },
    });

    return {
      ...clientProfile,
      isActive,
      operationalStatus: agreementOperationalStatus(clientProfile),
      onboardingLocked,
      clientUser: clientUser ?? null,
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

    let normalizedExternalBookingId: string | null | undefined;
    if (updateClientProfileDto.externalBookingId !== undefined) {
      const next = normalizeExternalBookingId(updateClientProfileDto.externalBookingId);
      if (next !== normalizeExternalBookingId(existing.externalBookingId)) {
        normalizedExternalBookingId = await assertExternalBookingIdAvailable(
          this.prisma,
          updateClientProfileDto.externalBookingId,
          id,
        );
      } else {
        normalizedExternalBookingId = next;
      }
    }

    // Authorization check: Only admins/managers can update, or the creator
    if (
      userRole !== UserRole.ADMIN &&
      userRole !== UserRole.MANAGER &&
      userRole !== UserRole.SUPER_ADMIN &&
      userRole !== UserRole.AGGREGATOR &&
      existing.createdById !== userId
    ) {
      throw new ForbiddenException('You do not have permission to update this client profile');
    }

    if (updateClientProfileDto.onboardingStage !== undefined) {
      await this.onboardingService.assertNotActive(id);
      assertValidTransition(existing.onboardingStage, updateClientProfileDto.onboardingStage);
    }

    const dto = { ...updateClientProfileDto };
    if (userRole === UserRole.AGGREGATOR) {
      delete dto.clientChannel;
      delete dto.aggregatorName;
    }

    if (dto.locationId) {
      const location = await this.prisma.location.findUnique({ where: { id: dto.locationId } });
      if (!location) throw new BadRequestException('Invalid locationId');
    }
    if (dto.vendorId && dto.vendorId !== '' && (dto.locationId || existing.locationId)) {
      const locId = (dto.locationId && dto.locationId !== '' ? dto.locationId : null) || existing.locationId!;
      const vendor = await this.prisma.vendor.findFirst({
        where: { id: dto.vendorId, locationId: locId },
      });
      if (!vendor) throw new BadRequestException('Invalid vendorId for location');
    }

    const data: Prisma.ClientProfileUpdateInput = {};
    if (dto.companyName !== undefined) data.companyName = dto.companyName;
    if (dto.contactEmail !== undefined) data.contactEmail = dto.contactEmail;
    if (dto.contactPhone !== undefined) data.contactPhone = dto.contactPhone;
    if (dto.contactPersonName !== undefined) data.contactPersonName = dto.contactPersonName;
    if (dto.contactPersonTitle !== undefined) data.contactPersonTitle = dto.contactPersonTitle;
    if (dto.contactPersonPhone !== undefined) data.contactPersonPhone = dto.contactPersonPhone;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.state !== undefined) data.state = dto.state;
    if (dto.zipCode !== undefined) data.zipCode = dto.zipCode;
    if (dto.country !== undefined) data.country = dto.country;
    if (dto.taxId !== undefined) data.taxId = dto.taxId ? dto.taxId.replace(/\s+/g, '').toUpperCase() : null;
    if (dto.gstNumber !== undefined) data.gstNumber = dto.gstNumber;
    if (dto.membershipType !== undefined) data.membershipType = dto.membershipType;
    if (dto.officeType !== undefined) data.officeType = dto.officeType;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (normalizedExternalBookingId !== undefined) {
      data.externalBookingId = normalizedExternalBookingId;
    }
    if (dto.contractMonths !== undefined) data.contractMonths = dto.contractMonths ?? null;
    if (dto.onboardingStage !== undefined) data.onboardingStage = dto.onboardingStage;
    if (dto.clientChannel !== undefined) data.clientChannel = dto.clientChannel;
    if (dto.aggregatorName !== undefined) data.aggregatorName = dto.aggregatorName;
    if (dto.leadSource !== undefined) {
      data.leadSource = dto.leadSource;
      data.clientChannel =
        leadSourceToClientChannel(dto.leadSource) === 'AGGREGATOR'
          ? ClientChannel.AGGREGATOR
          : ClientChannel.DIRECT;
    }
    if (dto.locationId !== undefined) {
      data.location =
        dto.locationId && dto.locationId !== ''
          ? { connect: { id: dto.locationId } }
          : { disconnect: true };
    }
    if (dto.vendorId !== undefined) {
      data.vendor =
        dto.vendorId && dto.vendorId !== ''
          ? { connect: { id: dto.vendorId } }
          : { disconnect: true };
    }
    if (dto.contractStartDate !== undefined) {
      data.contractStartDate = this.parseDateOnly(dto.contractStartDate);
    }
    if (dto.contractEndDate !== undefined) {
      const end = this.parseDateOnly(dto.contractEndDate);
      data.contractEndDate = end;
      data.renewalDate = end;
    }
    if (dto.operationalStatus !== undefined) {
      data.operationalStatus = dto.operationalStatus as OperationalStatus;
    }

    let updated;
    try {
      updated = await this.prisma.clientProfile.update({
        where: { id },
        data,
        include: {
          createdBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          location: {
            select: { id: true, name: true, code: true, area: true },
          },
          vendor: {
            select: { id: true, name: true, code: true },
          },
        },
      });
    } catch (err) {
      if (isExternalBookingIdUniqueViolation(err)) {
        throw new ConflictException(DUPLICATE_EXTERNAL_BOOKING_ID_MESSAGE);
      }
      throw err;
    }

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

    return this.findOne(id, userRole, userId);
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
  async activateCompany(
    id: string,
    userId: string,
    userRole: UserRole,
    options?: { contractStartDate?: Date | string; contractEndDate?: Date | string },
  ) {
    if (
      userRole !== UserRole.SUPER_ADMIN &&
      userRole !== UserRole.ADMIN &&
      userRole !== UserRole.MANAGER
    ) {
      throw new ForbiddenException('Only SUPER_ADMIN, ADMIN, or MANAGER can activate a company');
    }

    // The global ValidationPipe is configured with `transform: false`, so Zod-based DTOs
    // arrive as plain JSON (strings). Coerce contract dates here so downstream code can
    // safely call Date methods.
    const coerceDate = (v: Date | string | undefined): Date | undefined => {
      if (v == null) return undefined;
      if (v instanceof Date) return isNaN(v.getTime()) ? undefined : v;
      const parsed = new Date(v);
      if (isNaN(parsed.getTime())) {
        throw new BadRequestException(`Invalid date value: ${String(v)}`);
      }
      return parsed;
    };
    const contractStartDate = coerceDate(options?.contractStartDate);
    const contractEndDate = coerceDate(options?.contractEndDate);

    const existing = await this.findOne(id, userRole, userId);
    const current = existing.onboardingStage as OnboardingStage;
    const isAggregator = existing.clientChannel === 'AGGREGATOR';

    if (current === OnboardingStage.ACTIVE) {
      throw new BadRequestException('Company is already activated.');
    }
    if (current !== OnboardingStage.FINAL_AGREEMENT_SHARED) {
      throw new BadRequestException(
        'Activation only allowed after final agreement has been shared. ' +
          `Current stage: ${getStageLabel(current)}.`,
      );
    }

    if (isAggregator) {
      if (!contractStartDate || !contractEndDate) {
        throw new BadRequestException(
          'contractStartDate and contractEndDate are required to activate an aggregator company.',
        );
      }
    }

    if (contractStartDate && contractEndDate && contractEndDate.getTime() <= contractStartDate.getTime()) {
      throw new BadRequestException('contractEndDate must be after contractStartDate.');
    }

    const canActivate = await this.onboardingService.canActivateCompany(id);
    if (!canActivate) {
      throw new BadRequestException(
        isAggregator
          ? 'Activation requirements not met. Ensure all KYC approved, at least one final agreement, and stage is Final agreement shared.'
          : 'Activation requirements not met. Ensure: at least one payment PAID, all KYC approved, at least one final agreement, and stage is Final agreement shared.',
      );
    }

    await this.onboardingService.activateCompany(id, { contractStartDate, contractEndDate });

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
        ...(contractStartDate
          ? { contractStartDate: contractStartDate.toISOString() }
          : {}),
        ...(contractEndDate
          ? { contractEndDate: contractEndDate.toISOString() }
          : {}),
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

    // 1. Fetch user IDs linked to this company (before disconnecting)
    const linkedUsers = await this.prisma.user.findMany({
      where: { companyId: id },
      select: { id: true },
    });
    const linkedUserIds = linkedUsers.map((u) => u.id);

    // 2. Disconnect Users (severs FK so ClientProfile can be deleted)
    await this.prisma.user.updateMany({
      where: { companyId: id },
      data: { companyId: null },
    });

    // 3. Clear AuditLog references
    await this.prisma.auditLog.updateMany({
      where: { clientProfileId: id },
      data: { clientProfileId: null },
    });

    // 4. Delete R2 files (best-effort; do not fail overall delete if R2 fails)
    const documents = await this.prisma.document.findMany({
      where: { clientProfileId: id },
      select: { fileKey: true },
    });
    for (const doc of documents) {
      try {
        await this.r2Service.deleteFile(doc.fileKey);
      } catch (err) {
        this.logger.warn(
          `Failed to delete R2 document file key=${doc.fileKey}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    const invoices = await this.prisma.invoice.findMany({
      where: { companyId: id },
      select: { pdfFileKey: true },
    });
    for (const inv of invoices) {
      if (inv.pdfFileKey) {
        try {
          await this.r2Service.deleteFile(inv.pdfFileKey);
        } catch (err) {
          this.logger.warn(
            `Failed to delete R2 invoice PDF key=${inv.pdfFileKey}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    }

    // 5. Delete ClientProfile (cascades: Documents, Payments, Invoices, RenewalReminders)
    await this.prisma.clientProfile.delete({
      where: { id },
    });

    // 6. Delete client users that were linked to this company
    if (linkedUserIds.length > 0) {
      await this.prisma.user.deleteMany({
        where: { id: { in: linkedUserIds } },
      });
    }

    // Audit log: use null for clientProfileId since profile is deleted
    await this.auditLogsService.create({
      userId,
      clientProfileId: null,
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

      // Active by agreement dates (same rule as mobile / desk status)
      this.prisma.clientProfile
        .findMany({
          select: { contractStartDate: true, contractEndDate: true },
        })
        .then((rows) => rows.filter((r) => isActiveFromAgreement(r)).length),

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
