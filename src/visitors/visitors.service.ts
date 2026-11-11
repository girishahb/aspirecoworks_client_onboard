import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, VisitorVisitStatus } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../storage/r2.service';
import { EmailService } from '../email/email.service';
import { UserRole } from '../common/enums/user-role.enum';
import { formatIstDateTime } from '../email/templates/mail-received';
import { visitorCheckedInEmail } from '../email/templates/visitor-checked-in';
import {
  AADHAAR_CONSENT_TEXT,
  AADHAAR_CONSENT_VERSION,
  VISITOR_IMAGE_MIME,
  VISITOR_MEDIA_MAX_BYTES,
  VISITOR_RETENTION_DAYS,
} from './visitor.constants';
import { checkInVisitorSchema } from './dto/check-in-visitor.dto';

type AuthUser = { id: string; role: UserRole };

type MediaKind = 'face' | 'signature' | 'aadhaar';

function decodeBase64Image(imageBase64: string, mimeType?: string): {
  buffer: Buffer;
  mime: string;
  ext: string;
} {
  const raw = (imageBase64 || '').replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
  let buffer: Buffer;
  try {
    buffer = Buffer.from(raw, 'base64');
  } catch {
    throw new BadRequestException('Invalid imageBase64');
  }
  if (!buffer.length) throw new BadRequestException('Image is required');
  if (buffer.length > VISITOR_MEDIA_MAX_BYTES) {
    throw new BadRequestException('Image must be 8MB or smaller');
  }
  const mime = (mimeType || 'image/jpeg').toLowerCase();
  if (!VISITOR_IMAGE_MIME.has(mime)) {
    throw new BadRequestException('Image must be JPEG, PNG, or WebP');
  }
  const ext = mime.includes('png') ? '.png' : mime.includes('webp') ? '.webp' : '.jpg';
  return { buffer, mime, ext };
}

function visitorMediaKey(visitId: string, kind: MediaKind, ext: string): string {
  return `visitors/${visitId}/${kind}/${randomUUID()}${ext}`;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function endOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

function parseDayBound(raw: string | undefined, endOfDay: boolean): Date | undefined {
  if (!raw?.trim()) return undefined;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00.000Z`);
    return endOfDay ? endOfUtcDay(d) : startOfUtcDay(d);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function maskAadhaarLast4(last4: string | null | undefined): string | null {
  if (!last4) return null;
  return `XXXX-XXXX-${last4}`;
}

@Injectable()
export class VisitorsService {
  private readonly logger = new Logger(VisitorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
    private readonly email: EmailService,
  ) {}

  getConsentMeta() {
    return {
      version: AADHAAR_CONSENT_VERSION,
      text: AADHAAR_CONSENT_TEXT,
      retentionDays: VISITOR_RETENTION_DAYS,
    };
  }

  private serializeListItem(visit: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    company: string | null;
    purpose: string;
    hostName: string | null;
    hostEmail: string | null;
    status: VisitorVisitStatus;
    checkInAt: Date;
    checkOutAt: Date | null;
    aadhaarConsent: boolean;
    aadhaarLast4: string | null;
    locationId: string | null;
    location: { id: string; name: string; code: string | null } | null;
    hostEmailSent: boolean;
  }) {
    return {
      id: visit.id,
      name: visit.name,
      phone: visit.phone,
      email: visit.email,
      company: visit.company,
      purpose: visit.purpose,
      hostName: visit.hostName,
      hostEmail: visit.hostEmail,
      status: visit.status,
      checkInAt: visit.checkInAt.toISOString(),
      checkOutAt: visit.checkOutAt?.toISOString() ?? null,
      aadhaarConsent: visit.aadhaarConsent,
      aadhaarLast4Masked: maskAadhaarLast4(visit.aadhaarLast4),
      locationId: visit.locationId,
      location: visit.location,
      hostEmailSent: visit.hostEmailSent,
    };
  }

  private serializeDetail(
    visit: Prisma.VisitorVisitGetPayload<{
      include: {
        location: { select: { id: true; name: true; code: true } };
        checkedInBy: { select: { id: true; email: true; firstName: true; lastName: true } };
        checkedOutBy: { select: { id: true; email: true; firstName: true; lastName: true } };
      };
    }>,
  ) {
    return {
      ...this.serializeListItem(visit),
      aadhaarLast4: visit.aadhaarLast4,
      aadhaarConsentAt: visit.aadhaarConsentAt?.toISOString() ?? null,
      aadhaarConsentVersion: visit.aadhaarConsentVersion,
      hasFacePhoto: !!visit.facePhotoKey,
      hasSignature: !!visit.signatureKey,
      hasAadhaarPhoto: !!visit.aadhaarPhotoKey,
      hostEmailError: visit.hostEmailError,
      checkedInBy: visit.checkedInBy,
      checkedOutBy: visit.checkedOutBy,
      createdAt: visit.createdAt.toISOString(),
    };
  }

  async checkIn(raw: unknown, user: AuthUser) {
    const parsed = checkInVisitorSchema.safeParse(raw);
    if (!parsed.success) {
      const detailedMessage = parsed.error.errors
        .map((e) => `${e.path.join('.') || 'root'}: ${e.message}`)
        .join('; ');
      throw new BadRequestException(`Validation failed: ${detailedMessage}`);
    }
    const dto = parsed.data;

    if (dto.locationId) {
      const loc = await this.prisma.location.findFirst({
        where: { id: dto.locationId, isActive: true },
      });
      if (!loc) throw new BadRequestException('Invalid locationId');
    }

    const face = decodeBase64Image(dto.facePhoto.imageBase64, dto.facePhoto.mimeType);
    const signature = decodeBase64Image(dto.signature.imageBase64, dto.signature.mimeType);
    let aadhaarPhoto: ReturnType<typeof decodeBase64Image> | null = null;
    if (dto.aadhaarConsent && dto.aadhaarPhoto?.imageBase64) {
      aadhaarPhoto = decodeBase64Image(dto.aadhaarPhoto.imageBase64, dto.aadhaarPhoto.mimeType);
    }

    const visitId = randomUUID();
    const facePhotoKey = visitorMediaKey(visitId, 'face', face.ext);
    const signatureKey = visitorMediaKey(visitId, 'signature', signature.ext);
    const aadhaarPhotoKey = aadhaarPhoto
      ? visitorMediaKey(visitId, 'aadhaar', aadhaarPhoto.ext)
      : null;

    await this.r2.uploadFile(facePhotoKey, face.buffer, face.mime);
    await this.r2.uploadFile(signatureKey, signature.buffer, signature.mime);
    if (aadhaarPhoto && aadhaarPhotoKey) {
      await this.r2.uploadFile(aadhaarPhotoKey, aadhaarPhoto.buffer, aadhaarPhoto.mime);
    }

    const checkInAt = new Date();
    const consent = !!dto.aadhaarConsent;

    const visit = await this.prisma.visitorVisit.create({
      data: {
        id: visitId,
        name: dto.name.trim(),
        phone: dto.phone.trim(),
        email: dto.email?.trim() || null,
        company: dto.company?.trim() || null,
        purpose: dto.purpose.trim(),
        hostName: dto.hostName?.trim() || null,
        hostEmail: dto.hostEmail?.trim().toLowerCase() || null,
        locationId: dto.locationId || null,
        status: VisitorVisitStatus.CHECKED_IN,
        checkInAt,
        aadhaarConsent: consent,
        aadhaarConsentAt: consent ? checkInAt : null,
        aadhaarConsentVersion: consent ? AADHAAR_CONSENT_VERSION : null,
        aadhaarLast4: consent ? dto.aadhaarLast4! : null,
        facePhotoKey,
        signatureKey,
        aadhaarPhotoKey,
        checkedInById: user.id,
      },
      include: {
        location: { select: { id: true, name: true, code: true } },
        checkedInBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        checkedOutBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    let hostEmailSent = false;
    let hostEmailError: string | null = null;
    if (visit.hostEmail) {
      const checkInAtIst = formatIstDateTime(checkInAt);
      const { subject, html, text } = visitorCheckedInEmail({
        visitorName: visit.name,
        visitorPhone: visit.phone,
        visitorCompany: visit.company,
        purpose: visit.purpose,
        hostName: visit.hostName,
        checkInAtIst,
        locationName: visit.location?.name,
      });
      const result = await this.email.sendEmail({
        to: visit.hostEmail,
        subject,
        html,
        text,
      });
      hostEmailSent = result.success;
      hostEmailError = result.success ? null : result.error || 'Failed to send host email';
      if (!result.success) {
        this.logger.warn(
          `Host email skipped/failed for visit ${visit.id}: ${hostEmailError}`,
        );
      }
      await this.prisma.visitorVisit.update({
        where: { id: visit.id },
        data: { hostEmailSent, hostEmailError },
      });
    }

    return {
      ...this.serializeDetail({ ...visit, hostEmailSent, hostEmailError }),
      hostEmailAttempted: !!visit.hostEmail,
    };
  }

  async listToday(opts: { locationId?: string; date?: string }) {
    const day = opts.date?.trim()
      ? parseDayBound(opts.date, false) || startOfUtcDay(new Date())
      : startOfUtcDay(new Date());
    const from = startOfUtcDay(day);
    const to = endOfUtcDay(day);

    const where: Prisma.VisitorVisitWhereInput = {
      deletedAt: null,
      checkInAt: { gte: from, lte: to },
      ...(opts.locationId ? { locationId: opts.locationId } : {}),
    };

    const rows = await this.prisma.visitorVisit.findMany({
      where,
      orderBy: [{ status: 'asc' }, { checkInAt: 'desc' }],
      include: {
        location: { select: { id: true, name: true, code: true } },
      },
    });

    // CHECKED_IN first (enum order may not guarantee); stable sort
    rows.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === VisitorVisitStatus.CHECKED_IN ? -1 : 1;
      }
      return b.checkInAt.getTime() - a.checkInAt.getTime();
    });

    return {
      date: from.toISOString().slice(0, 10),
      rows: rows.map((r) => this.serializeListItem(r)),
    };
  }

  async findOne(id: string) {
    const visit = await this.prisma.visitorVisit.findFirst({
      where: { id, deletedAt: null },
      include: {
        location: { select: { id: true, name: true, code: true } },
        checkedInBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        checkedOutBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    if (!visit) throw new NotFoundException('Visit not found');
    return this.serializeDetail(visit);
  }

  async checkout(id: string, user: AuthUser) {
    const visit = await this.prisma.visitorVisit.findFirst({
      where: { id, deletedAt: null },
    });
    if (!visit) throw new NotFoundException('Visit not found');
    if (visit.status === VisitorVisitStatus.CHECKED_OUT) {
      throw new BadRequestException('Visitor is already checked out');
    }

    const updated = await this.prisma.visitorVisit.update({
      where: { id },
      data: {
        status: VisitorVisitStatus.CHECKED_OUT,
        checkOutAt: new Date(),
        checkedOutById: user.id,
      },
      include: {
        location: { select: { id: true, name: true, code: true } },
        checkedInBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        checkedOutBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    return this.serializeDetail(updated);
  }

  async getMediaBuffer(id: string, kind: MediaKind): Promise<{ buffer: Buffer; contentType: string }> {
    const visit = await this.prisma.visitorVisit.findFirst({
      where: { id, deletedAt: null },
      select: {
        facePhotoKey: true,
        signatureKey: true,
        aadhaarPhotoKey: true,
      },
    });
    if (!visit) throw new NotFoundException('Visit not found');

    const key =
      kind === 'face'
        ? visit.facePhotoKey
        : kind === 'signature'
          ? visit.signatureKey
          : visit.aadhaarPhotoKey;
    if (!key) throw new NotFoundException('Media not found');

    const { buffer, contentType } = await this.r2.getFileBuffer(key);
    return { buffer, contentType: contentType || 'image/jpeg' };
  }

  private assertAdmin(role?: UserRole) {
    if (
      role !== UserRole.SUPER_ADMIN &&
      role !== UserRole.ADMIN &&
      role !== UserRole.MANAGER &&
      role !== UserRole.FINANCE
    ) {
      throw new ForbiddenException('You do not have permission to view visitor reports');
    }
  }

  async adminList(
    opts: {
      from?: string;
      to?: string;
      locationId?: string;
      q?: string;
      status?: 'CHECKED_IN' | 'CHECKED_OUT' | 'all';
    },
    role: UserRole,
  ) {
    this.assertAdmin(role);
    const from = parseDayBound(opts.from, false) || startOfUtcDay(new Date(Date.now() - 6 * 86400000));
    const to = parseDayBound(opts.to, true) || endOfUtcDay(new Date());

    const q = opts.q?.trim();
    const where: Prisma.VisitorVisitWhereInput = {
      deletedAt: null,
      checkInAt: { gte: from, lte: to },
      ...(opts.locationId ? { locationId: opts.locationId } : {}),
      ...(opts.status && opts.status !== 'all' ? { status: opts.status } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
              { company: { contains: q, mode: 'insensitive' } },
              { hostName: { contains: q, mode: 'insensitive' } },
              { hostEmail: { contains: q, mode: 'insensitive' } },
              { purpose: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.visitorVisit.findMany({
      where,
      orderBy: { checkInAt: 'desc' },
      take: 500,
      include: {
        location: { select: { id: true, name: true, code: true } },
        checkedInBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      rows: rows.map((r) => ({
        ...this.serializeListItem(r),
        checkedInBy: r.checkedInBy,
      })),
    };
  }

  async exportExcel(
    opts: {
      from?: string;
      to?: string;
      locationId?: string;
      q?: string;
      status?: 'CHECKED_IN' | 'CHECKED_OUT' | 'all';
    },
    role: UserRole,
  ) {
    const { rows, from, to } = await this.adminList(opts, role);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Visitors');
    sheet.columns = [
      { header: 'Check-in', key: 'checkInAt', width: 22 },
      { header: 'Check-out', key: 'checkOutAt', width: 22 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Name', key: 'name', width: 24 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Email', key: 'email', width: 24 },
      { header: 'Company', key: 'company', width: 24 },
      { header: 'Purpose', key: 'purpose', width: 28 },
      { header: 'Host', key: 'hostName', width: 20 },
      { header: 'Host email', key: 'hostEmail', width: 24 },
      { header: 'Location', key: 'location', width: 20 },
      { header: 'Aadhaar (masked)', key: 'aadhaar', width: 18 },
      { header: 'Host email sent', key: 'hostEmailSent', width: 14 },
    ];

    for (const r of rows) {
      sheet.addRow({
        checkInAt: r.checkInAt,
        checkOutAt: r.checkOutAt || '',
        status: r.status,
        name: r.name,
        phone: r.phone,
        email: r.email || '',
        company: r.company || '',
        purpose: r.purpose,
        hostName: r.hostName || '',
        hostEmail: r.hostEmail || '',
        location: r.location?.name || '',
        aadhaar: r.aadhaarLast4Masked || '',
        hostEmailSent: r.hostEmailSent ? 'yes' : 'no',
      });
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const fromDay = from.slice(0, 10);
    const toDay = to.slice(0, 10);
    return {
      buffer,
      fileName: `visitors-${fromDay}-to-${toDay}.xlsx`,
    };
  }
}
