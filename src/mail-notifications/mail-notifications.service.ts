import { ForbiddenException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../common/enums/user-role.enum';

const MAIL_ACTIONS = ['MAIL_RECEIVED_NOTIFIED', 'MAIL_RECEIVED_FAILED'] as const;

export type MailNotifyStatusFilter = 'success' | 'failed' | 'all';

export type MailNotificationRow = {
  id: string;
  status: 'success' | 'failed';
  createdAt: string;
  receivedAtIst: string | null;
  to: string | null;
  messageId: string | null;
  error: string | null;
  note: string | null;
  receptionist: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  client: {
    id: string;
    companyName: string;
  } | null;
  document: {
    id: string;
    fileName: string;
  } | null;
};

function assertReportAccess(role?: UserRole) {
  if (
    role !== UserRole.SUPER_ADMIN &&
    role !== UserRole.ADMIN &&
    role !== UserRole.MANAGER &&
    role !== UserRole.FINANCE
  ) {
    throw new ForbiddenException('You do not have permission to view mail notification reports');
  }
}

function defaultFromDate(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - 6); // last 7 calendar days including today
  return d;
}

function parseDateBound(raw: string | undefined, endOfDay: boolean): Date | undefined {
  if (!raw?.trim()) return undefined;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function mapRow(entry: {
  id: string;
  action: string;
  createdAt: Date;
  changes: unknown;
  user: MailNotificationRow['receptionist'];
  clientProfile: MailNotificationRow['client'];
  document: MailNotificationRow['document'];
}): MailNotificationRow {
  const changes = (entry.changes ?? {}) as Record<string, unknown>;
  const status: 'success' | 'failed' =
    entry.action === 'MAIL_RECEIVED_FAILED' || changes.status === 'failed'
      ? 'failed'
      : 'success';
  return {
    id: entry.id,
    status,
    createdAt: entry.createdAt.toISOString(),
    receivedAtIst: typeof changes.receivedAtIst === 'string' ? changes.receivedAtIst : null,
    to: typeof changes.to === 'string' ? changes.to : null,
    messageId: typeof changes.messageId === 'string' ? changes.messageId : null,
    error: typeof changes.error === 'string' ? changes.error : null,
    note: typeof changes.note === 'string' ? changes.note : null,
    receptionist: entry.user,
    client: entry.clientProfile,
    document: entry.document,
  };
}

@Injectable()
export class MailNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    opts: {
      status?: MailNotifyStatusFilter;
      from?: string;
      to?: string;
      receptionistId?: string;
      clientProfileId?: string;
      limit?: number;
    },
    role?: UserRole,
  ): Promise<{ rows: MailNotificationRow[]; from: string; to: string; status: MailNotifyStatusFilter }> {
    assertReportAccess(role);

    const status: MailNotifyStatusFilter = opts.status ?? 'success';
    const fromDate = parseDateBound(opts.from, false) ?? defaultFromDate();
    const toDate = parseDateBound(opts.to, true) ?? new Date();
    const limit = Math.min(Math.max(opts.limit ?? 500, 1), 2000);

    const actions: string[] =
      status === 'success'
        ? ['MAIL_RECEIVED_NOTIFIED']
        : status === 'failed'
          ? ['MAIL_RECEIVED_FAILED']
          : [...MAIL_ACTIONS];

    const where: Prisma.AuditLogWhereInput = {
      action: { in: actions },
      createdAt: { gte: fromDate, lte: toDate },
      ...(opts.receptionistId ? { userId: opts.receptionistId } : {}),
      ...(opts.clientProfileId ? { clientProfileId: opts.clientProfileId } : {}),
    };

    const entries = await this.prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        clientProfile: {
          select: { id: true, companyName: true },
        },
        document: {
          select: { id: true, fileName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return {
      rows: entries.map(mapRow),
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      status,
    };
  }

  async exportExcel(
    opts: {
      status?: MailNotifyStatusFilter;
      from?: string;
      to?: string;
      receptionistId?: string;
      clientProfileId?: string;
    },
    role?: UserRole,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const { rows, from, to, status } = await this.list({ ...opts, limit: 2000 }, role);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Aspire Coworks';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Mail notifications');

    sheet.columns = [
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Sent at (UTC)', key: 'createdAt', width: 24 },
      { header: 'Received (IST)', key: 'receivedAtIst', width: 24 },
      { header: 'Receptionist', key: 'receptionist', width: 28 },
      { header: 'Company', key: 'company', width: 32 },
      { header: 'Email to', key: 'to', width: 32 },
      { header: 'Resend message ID', key: 'messageId', width: 36 },
      { header: 'Document', key: 'document', width: 28 },
      { header: 'Note', key: 'note', width: 40 },
      { header: 'Error', key: 'error', width: 40 },
    ];

    sheet.getRow(1).font = { bold: true };

    for (const r of rows) {
      const name = r.receptionist
        ? `${r.receptionist.firstName ?? ''} ${r.receptionist.lastName ?? ''}`.trim() ||
          r.receptionist.email
        : '';
      sheet.addRow({
        status: r.status,
        createdAt: r.createdAt,
        receivedAtIst: r.receivedAtIst ?? '',
        receptionist: name ? `${name} <${r.receptionist?.email ?? ''}>` : r.receptionist?.email ?? '',
        company: r.client?.companyName ?? '',
        to: r.to ?? '',
        messageId: r.messageId ?? '',
        document: r.document?.fileName ?? '',
        note: r.note ?? '',
        error: r.error ?? '',
      });
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const fromDay = from.slice(0, 10);
    const toDay = to.slice(0, 10);
    const fileName = `mail-notifications-${status}-${fromDay}_to_${toDay}.xlsx`;
    return { buffer, fileName };
  }
}
