import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClientChannel,
  DocumentOwner,
  DocumentStatus,
  DocumentType,
  OnboardingStage,
  OperationalStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../storage/r2.service';
import { EmailService } from '../email/email.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { formatIstDateTime, mailReceivedEmail } from '../email/templates/mail-received';
import { CreateMobileClientDto, UpdateMobileClientDto } from './dto/mobile-client.dto';
import {
  assertExternalBookingIdAvailable,
  DUPLICATE_EXTERNAL_BOOKING_ID_MESSAGE,
  isExternalBookingIdUniqueViolation,
  normalizeExternalBookingId,
} from '../client-profiles/external-booking-id.helper';
import { isActiveFromAgreement } from '../common/utils/agreement-status';

type AuthUser = { id: string; role: UserRole };

const MAIL_MAX_BYTES = 8 * 1024 * 1024;
const MAIL_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

@Injectable()
export class MobileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
    private readonly emailService: EmailService,
    private readonly auditLogs: AuditLogsService,
    private readonly config: ConfigService,
  ) {}

  private parseDateOnly(iso?: string | null): Date | null {
    if (!iso) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
    if (!m) throw new BadRequestException(`Invalid date (expected YYYY-MM-DD): ${iso}`);
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  }

  private agreementStatus(p: {
    contractStartDate?: Date | string | null;
    contractEndDate?: Date | string | null;
  }) {
    const isActive = isActiveFromAgreement(p);
    return {
      isActive,
      operationalStatus: isActive ? OperationalStatus.ACTIVE : OperationalStatus.INACTIVE,
    };
  }

  toReceptionDto(p: any) {
    const status = this.agreementStatus(p);
    return {
      id: p.id,
      companyName: p.companyName,
      contactPersonName: p.contactPersonName,
      contactEmail: p.contactEmail,
      contactPhone: p.contactPhone,
      address: p.address,
      contractStartDate: p.contractStartDate,
      contractEndDate: p.contractEndDate,
      operationalStatus: status.operationalStatus,
      isActive: status.isActive,
      location: p.location
        ? { id: p.location.id, name: p.location.name, code: p.location.code }
        : null,
    };
  }

  /** Full client profile for STAFF — everything except payments / invoices / rate money fields. */
  toStaffDto(p: any) {
    return {
      ...this.toReceptionDto(p),
      membershipType: p.membershipType,
      officeType: p.officeType,
      leadSource: p.leadSource,
      contractMonths: p.contractMonths,
      city: p.city,
      state: p.state,
      zipCode: p.zipCode,
      country: p.country,
      taxId: p.taxId,
      gstNumber: p.gstNumber,
      contactPersonTitle: p.contactPersonTitle,
      contactPersonPhone: p.contactPersonPhone,
      externalBookingId: p.externalBookingId,
      clientChannel: p.clientChannel,
      aggregatorName: p.aggregatorName,
      vendor: p.vendor ? { id: p.vendor.id, name: p.vendor.name, code: p.vendor.code } : null,
      onboardingStage: p.onboardingStage,
      activationDate: p.activationDate,
      kycCompleted: p.kycCompleted,
      renewalDate: p.renewalDate,
      renewalStatus: p.renewalStatus,
      lastContactedAt: p.lastContactedAt,
      notes: p.notes,
    };
  }

  /** Map client membership labels (e.g. "GST Registration Plan (G.R)") → rate-card keys. */
  private membershipMatchKey(raw?: string | null): string {
    const s = (raw || '').trim().toLowerCase();
    if (!s) return '';
    if (s.includes('flipkart')) return 'flipkart';
    if (/\bm\.?\s*a\b/.test(s) || s.includes('mailing')) return 'mailing';
    if (/\bg\.?\s*r\b/.test(s) || s.includes('gst registration') || /^gr$/.test(s)) return 'gr';
    if (/\bb\.?\s*r\b/.test(s) || s.includes('business registration') || /^br$/.test(s)) return 'br';
    return s.replace(/[^a-z0-9]+/g, '');
  }

  private findApplicableRate(
    membershipType: string | null | undefined,
    rateCards: { membershipType: string; rateExclusive: number; currency: string }[],
  ) {
    const key = this.membershipMatchKey(membershipType);
    if (!key) return null;
    return (
      rateCards.find((r) => this.membershipMatchKey(r.membershipType) === key) ||
      rateCards.find((r) => r.membershipType.trim().toLowerCase() === (membershipType || '').trim().toLowerCase()) ||
      null
    );
  }

  toFinanceDto(p: any, rateCards: { membershipType: string; rateExclusive: number; currency: string }[] = []) {
    const applicable = this.findApplicableRate(p.membershipType, rateCards);
    return {
      ...this.toStaffDto(p),
      legacyPaymentStatus: p.legacyPaymentStatus,
      legacyCharges: p.legacyCharges,
      rateCard: rateCards.map((r) => ({
        membershipType: r.membershipType,
        rateExclusive: r.rateExclusive,
        currency: r.currency,
      })),
      applicableRate: applicable
        ? {
            membershipType: applicable.membershipType,
            rateExclusive: applicable.rateExclusive,
            currency: applicable.currency,
          }
        : null,
      payments: (p.payments || []).map((pay: any) => ({
        id: pay.id,
        amount: pay.amount,
        status: pay.status,
        currency: pay.currency,
        paidAt: pay.paidAt,
        createdAt: pay.createdAt,
      })),
      invoices: (p.invoices || []).map((inv: any) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        totalAmount: inv.totalAmount,
        amount: inv.amount,
        gstAmount: inv.gstAmount,
        createdAt: inv.createdAt,
      })),
    };
  }

  private isFinanceRole(role: UserRole) {
    return (
      role === UserRole.FINANCE ||
      role === UserRole.ADMIN ||
      role === UserRole.SUPER_ADMIN
    );
  }

  private async loadRateCardsByVendorCodes(codes: string[]) {
    const unique = [...new Set(codes.filter(Boolean))];
    if (!unique.length) return new Map<string, { membershipType: string; rateExclusive: number; currency: string }[]>();
    const rows = await this.prisma.vendorRateCard.findMany({
      where: { vendorCode: { in: unique }, isActive: true },
      select: { vendorCode: true, membershipType: true, rateExclusive: true, currency: true },
      orderBy: { membershipType: 'asc' },
    });
    const map = new Map<string, { membershipType: string; rateExclusive: number; currency: string }[]>();
    for (const r of rows) {
      const list = map.get(r.vendorCode) || [];
      list.push({
        membershipType: r.membershipType,
        rateExclusive: r.rateExclusive,
        currency: r.currency,
      });
      map.set(r.vendorCode, list);
    }
    return map;
  }

  serializeForRole(
    p: any,
    role: UserRole,
    rateCards: { membershipType: string; rateExclusive: number; currency: string }[] = [],
  ) {
    if (role === UserRole.RECEPTION) return this.toReceptionDto(p);
    if (role === UserRole.STAFF || role === UserRole.MANAGER) return this.toStaffDto(p);
    return this.toFinanceDto(p, rateCards);
  }

  private async serializeWithRates(p: any, role: UserRole) {
    if (!this.isFinanceRole(role) || !p.vendor?.code) {
      return this.serializeForRole(p, role);
    }
    const map = await this.loadRateCardsByVendorCodes([p.vendor.code]);
    return this.serializeForRole(p, role, map.get(p.vendor.code) || []);
  }

  private includeForRole(role: UserRole): Prisma.ClientProfileInclude {
    const base: Prisma.ClientProfileInclude = {
      location: { select: { id: true, name: true, code: true } },
      vendor: { select: { id: true, name: true, code: true } },
    };
    if (this.isFinanceRole(role)) {
      return {
        ...base,
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            amount: true,
            status: true,
            currency: true,
            paidAt: true,
            createdAt: true,
          },
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            amount: true,
            gstAmount: true,
            createdAt: true,
          },
        },
      };
    }
    return base;
  }

  async listLocations() {
    return this.prisma.location.findMany({
      where: { isActive: true, code: { not: null } },
      select: { id: true, name: true, code: true, area: true },
      orderBy: { name: 'asc' },
    });
  }

  async listVendors(locationId?: string) {
    return this.prisma.vendor.findMany({
      where: {
        isActive: true,
        ...(locationId ? { locationId } : {}),
      },
      select: { id: true, name: true, code: true, locationId: true, sourceSheet: true },
      orderBy: { name: 'asc' },
    });
  }

  async lookup(q: string, role: UserRole, limit = 20) {
    const term = (q || '').trim();
    if (term.length < 2) {
      throw new BadRequestException('Query must be at least 2 characters');
    }
    const profiles = await this.prisma.clientProfile.findMany({
      where: {
        OR: [
          { companyName: { contains: term, mode: 'insensitive' } },
          { contactPersonName: { contains: term, mode: 'insensitive' } },
          { contactPhone: { contains: term } },
          { taxId: { contains: term.toUpperCase(), mode: 'insensitive' } },
          { contactEmail: { contains: term, mode: 'insensitive' } },
          { externalBookingId: { contains: term, mode: 'insensitive' } },
        ],
      },
      take: Math.min(limit, 50),
      orderBy: { companyName: 'asc' },
      include: this.includeForRole(role),
    });

    let rateByCode = new Map<string, { membershipType: string; rateExclusive: number; currency: string }[]>();
    if (this.isFinanceRole(role)) {
      rateByCode = await this.loadRateCardsByVendorCodes(
        profiles.map((p) => p.vendor?.code).filter(Boolean) as string[],
      );
    }

    return profiles.map((p) =>
      this.serializeForRole(p, role, p.vendor?.code ? rateByCode.get(p.vendor.code) || [] : []),
    );
  }

  async getStatus(id: string, role: UserRole) {
    const p = await this.prisma.clientProfile.findUnique({
      where: { id },
      include: this.includeForRole(role),
    });
    if (!p) throw new NotFoundException('Client not found');
    return this.serializeWithRates(p, role);
  }

  async create(dto: CreateMobileClientDto, user: AuthUser) {
    if (user.role === UserRole.RECEPTION) {
      throw new ForbiddenException('Reception cannot create clients');
    }
    const location = await this.prisma.location.findUnique({ where: { id: dto.locationId } });
    if (!location) throw new BadRequestException('Invalid locationId');
    if (dto.vendorId) {
      const vendor = await this.prisma.vendor.findFirst({
        where: { id: dto.vendorId, locationId: dto.locationId },
      });
      if (!vendor) throw new BadRequestException('Invalid vendorId for location');
    }

    const operationalStatus = (dto.operationalStatus as OperationalStatus) || OperationalStatus.UNKNOWN;
    const onboardingStage =
      operationalStatus === OperationalStatus.ACTIVE
        ? OnboardingStage.ACTIVE
        : OnboardingStage.ADMIN_CREATED;

    const email =
      dto.contactEmail ||
      `unknown+mobile-${Date.now()}@aspire.import`;

    const leadSource = dto.leadSource || null;
    const clientChannel =
      leadSource?.toLowerCase() === 'direct'
        ? ClientChannel.DIRECT
        : ClientChannel.AGGREGATOR;

    const externalBookingId = await assertExternalBookingIdAvailable(
      this.prisma,
      dto.externalBookingId,
    );

    let created;
    try {
      created = await this.prisma.clientProfile.create({
        data: {
          companyName: dto.companyName,
          contactEmail: email,
          contactPhone: dto.contactPhone,
          contactPersonName: dto.contactPersonName,
          contactPersonTitle: dto.contactPersonTitle,
          contactPersonPhone: dto.contactPersonPhone,
          address: dto.address,
          city: dto.city,
          taxId: dto.taxId?.toUpperCase() || null,
          gstNumber: dto.gstNumber,
          membershipType: dto.membershipType,
          officeType: dto.officeType,
          leadSource,
          contractMonths: dto.contractMonths ?? null,
          locationId: dto.locationId,
          vendorId: dto.vendorId,
          contractStartDate: this.parseDateOnly(dto.contractStartDate),
          contractEndDate: this.parseDateOnly(dto.contractEndDate),
          renewalDate: this.parseDateOnly(dto.contractEndDate),
          operationalStatus,
          onboardingStage,
          notes: dto.notes,
          externalBookingId,
          clientChannel,
          aggregatorName: dto.aggregatorName,
          createdById: user.id,
        },
        include: this.includeForRole(user.role),
      });
    } catch (err) {
      if (isExternalBookingIdUniqueViolation(err)) {
        throw new ConflictException(DUPLICATE_EXTERNAL_BOOKING_ID_MESSAGE);
      }
      throw err;
    }
    return this.serializeWithRates(created, user.role);
  }

  async update(id: string, dto: UpdateMobileClientDto, user: AuthUser) {
    if (user.role === UserRole.RECEPTION) {
      throw new ForbiddenException('Reception cannot update clients');
    }
    const existing = await this.prisma.clientProfile.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Client not found');

    if (dto.locationId) {
      const location = await this.prisma.location.findUnique({ where: { id: dto.locationId } });
      if (!location) throw new BadRequestException('Invalid locationId');
    }
    if (dto.vendorId && (dto.locationId || existing.locationId)) {
      const locId = dto.locationId || existing.locationId!;
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
    if (dto.taxId !== undefined) data.taxId = dto.taxId ? dto.taxId.toUpperCase() : null;
    if (dto.gstNumber !== undefined) data.gstNumber = dto.gstNumber;
    if (dto.membershipType !== undefined) data.membershipType = dto.membershipType;
    if (dto.officeType !== undefined) data.officeType = dto.officeType;
    if (dto.leadSource !== undefined) {
      data.leadSource = dto.leadSource;
      data.clientChannel =
        dto.leadSource?.toLowerCase() === 'direct'
          ? ClientChannel.DIRECT
          : ClientChannel.AGGREGATOR;
    }
    if (dto.contractMonths !== undefined) data.contractMonths = dto.contractMonths ?? null;
    if (dto.notes !== undefined) data.notes = dto.notes.trim() || null;
    if (dto.externalBookingId !== undefined) {
      const next = normalizeExternalBookingId(dto.externalBookingId);
      if (next !== normalizeExternalBookingId(existing.externalBookingId)) {
        data.externalBookingId = await assertExternalBookingIdAvailable(
          this.prisma,
          dto.externalBookingId,
          id,
        );
      } else {
        data.externalBookingId = next;
      }
    }
    if (dto.aggregatorName !== undefined) data.aggregatorName = dto.aggregatorName;
    if (dto.locationId !== undefined) data.location = { connect: { id: dto.locationId } };
    if (dto.vendorId !== undefined) {
      data.vendor = dto.vendorId ? { connect: { id: dto.vendorId } } : { disconnect: true };
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
      if (dto.operationalStatus === 'ACTIVE') data.onboardingStage = OnboardingStage.ACTIVE;
    }

    let updated;
    try {
      updated = await this.prisma.clientProfile.update({
        where: { id },
        data,
        include: this.includeForRole(user.role),
      });
    } catch (err) {
      if (isExternalBookingIdUniqueViolation(err)) {
        throw new ConflictException(DUPLICATE_EXTERNAL_BOOKING_ID_MESSAGE);
      }
      throw err;
    }
    return this.serializeWithRates(updated, user.role);
  }

  /**
   * Reception (and mobile ops roles): capture photo of physical mail → store + email client.
   * Mobile sends JPEG/PNG as base64 JSON (avoids RN FormData bugs).
   * receivedAt is the moment Send is processed on the server.
   */
  async notifyMailReceivedFromBase64(
    clientId: string,
    dto: {
      imageBase64: string;
      mimeType?: string;
      fileName?: string;
      note?: string;
    },
    user: AuthUser,
  ) {
    const raw = (dto.imageBase64 || '').replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
    let buffer: Buffer;
    try {
      buffer = Buffer.from(raw, 'base64');
    } catch {
      throw new BadRequestException('Invalid imageBase64');
    }
    if (!buffer.length) throw new BadRequestException('Photo file is required');

    const mime = (dto.mimeType || 'image/jpeg').toLowerCase();
    const ext =
      mime.includes('png') ? '.png' : mime.includes('webp') ? '.webp' : '.jpg';
    const fileName =
      (dto.fileName || `mail-received${ext}`).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200) ||
      `mail-received${ext}`;

    return this.notifyMailReceived(
      clientId,
      {
        buffer,
        originalname: fileName,
        mimetype: mime,
        size: buffer.length,
      },
      user,
      dto.note,
    );
  }

  async notifyMailReceived(
    clientId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    user: AuthUser,
    note?: string,
  ) {
    const client = await this.prisma.clientProfile.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Client not found');

    const to = (client.contactEmail || '').trim();
    if (!to) {
      throw new BadRequestException(
        'This client has no contact email. Ask staff to add one before sending mail notification.',
      );
    }
    if (to.toLowerCase().endsWith('@aspire.import')) {
      throw new BadRequestException(
        'This client only has a placeholder import email. Ask staff to set a real contact email first.',
      );
    }

    if (!file?.buffer?.length) {
      throw new BadRequestException('Photo file is required');
    }
    if (file.size > MAIL_MAX_BYTES) {
      throw new BadRequestException('Photo must be 8MB or smaller');
    }
    const mime = (file.mimetype || '').toLowerCase();
    if (!MAIL_MIME.has(mime)) {
      throw new BadRequestException('Photo must be JPEG, PNG, or WebP');
    }

    const receivedAt = new Date();
    const receivedAtIst = formatIstDateTime(receivedAt);
    const uuid = randomUUID();
    const original = (file.originalname || 'mail.jpg').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
    const ext =
      original.toLowerCase().match(/\.(jpe?g|png|webp)$/)?.[0] ||
      (mime.includes('png') ? '.png' : mime.includes('webp') ? '.webp' : '.jpg');
    const fileName = `mail-received-${receivedAt.toISOString().slice(0, 10)}${ext}`;
    const fileKey = this.r2.generateFileKey(
      clientId,
      DocumentType.RECEIVED_MAIL,
      fileName,
      uuid,
    );

    await this.r2.uploadFile(fileKey, file.buffer, mime || 'image/jpeg');

    const reviewNotes = [
      `Mail received: ${receivedAtIst}`,
      note?.trim() ? `Note: ${note.trim()}` : null,
      `Emailed to: ${to}`,
    ]
      .filter(Boolean)
      .join('\n');

    const document = await this.prisma.document.create({
      data: {
        clientProfileId: clientId,
        uploadedById: user.id,
        ownerId: user.id,
        documentOwner: DocumentOwner.ADMIN,
        fileName,
        fileKey,
        documentType: DocumentType.RECEIVED_MAIL,
        fileSize: file.size,
        mimeType: mime || 'image/jpeg',
        status: DocumentStatus.UPLOADED,
        version: 1,
        reviewNotes,
      },
    });

    const { subject, html, text } = mailReceivedEmail({
      companyName: client.companyName,
      contactPersonName: client.contactPersonName,
      receivedAtIst,
      note: note?.trim() || null,
    });

    const mailFrom =
      this.config.get<string>('EMAIL_FROM_MAIL')?.trim() ||
      this.config.get<string>('EMAIL_FROM')?.trim() ||
      undefined;
    const sendResult = await this.emailService.sendEmail({
      to,
      subject,
      html,
      text,
      from: mailFrom,
      attachments: [{ filename: fileName, content: file.buffer }],
    });

    if (!sendResult.success) {
      const errorMessage =
        sendResult.error || 'Failed to send email. Photo was saved; try again or check email config.';
      await this.auditLogs.create({
        userId: user.id,
        clientProfileId: clientId,
        documentId: document.id,
        action: 'MAIL_RECEIVED_FAILED',
        entityType: 'ClientProfile',
        entityId: clientId,
        changes: {
          status: 'failed',
          to,
          receivedAt: receivedAt.toISOString(),
          receivedAtIst,
          documentId: document.id,
          error: errorMessage,
          note: note?.trim() || null,
        },
      });
      throw new BadRequestException(errorMessage);
    }

    await this.auditLogs.create({
      userId: user.id,
      clientProfileId: clientId,
      documentId: document.id,
      action: 'MAIL_RECEIVED_NOTIFIED',
      entityType: 'ClientProfile',
      entityId: clientId,
      changes: {
        status: 'success',
        to,
        receivedAt: receivedAt.toISOString(),
        receivedAtIst,
        documentId: document.id,
        messageId: sendResult.messageId,
        note: note?.trim() || null,
      },
    });

    return {
      sent: true,
      to,
      receivedAt: receivedAt.toISOString(),
      receivedAtIst,
      documentId: document.id,
    };
  }
}
