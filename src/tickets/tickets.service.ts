import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';
import * as QRCode from 'qrcode';
import * as ExcelJS from 'exceljs';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../storage/r2.service';
import { ZodError, ZodType } from 'zod';
import {
  assignSchema,
  attachmentSchema,
  closeSchema,
  commentSchema,
  createGroupSchema,
  createQrSchema,
  createTicketSchema,
  reopenSchema,
  saveRouteSchema,
  setHomeLocationSchema,
  updateGroupSchema,
  updateQrSchema,
  type CreateTicketInput,
} from './dto/ticket.schemas';
import { decodeTicketFile, newTicketFileKey } from './ticket-files';
import { buildQrPostersPdf } from './ticket-poster';
import { findIssueRoute } from './ticket-routing';
import {
  GLOBAL_ROUTE_KEY,
  MAX_ATTACHMENTS_PER_TICKET,
  TICKET_CONFIRMATION_MESSAGE,
} from './ticket.constants';
import { TicketMailService } from './ticket-mail.service';

export interface TicketActor {
  id: string;
  role: UserRole;
}

const ASSIGNABLE_ROLES: UserRole[] = [
  UserRole.RECEPTION,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.SUPER_ADMIN,
];

const listInclude = {
  location: { select: { id: true, name: true } },
  issueGroup: { select: { id: true, name: true } },
  assignedDepartment: { select: { id: true, name: true } },
  assignedUser: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.TicketInclude;

const detailInclude = {
  ...listInclude,
  assignedUser: { select: { id: true, firstName: true, lastName: true, email: true } },
  closedBy: { select: { id: true, firstName: true, lastName: true } },
  qrCode: { select: { id: true, label: true } },
  events: {
    orderBy: { createdAt: 'asc' as const },
    include: { actor: { select: { firstName: true, lastName: true } } },
  },
  attachments: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      fileName: true,
      contentType: true,
      sizeBytes: true,
      createdAt: true,
      uploadedById: true,
    },
  },
  notifications: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      kind: true,
      status: true,
      error: true,
      attempt: true,
      createdAt: true,
      sentAt: true,
      toEmails: true,
    },
  },
} satisfies Prisma.TicketInclude;

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
    private readonly config: ConfigService,
    private readonly mail: TicketMailService,
  ) {}

  async formContext(token: string) {
    const qr = await this.requireActiveQr(token);
    const groups = await this.prisma.issueGroup.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    });
    return { locationName: qr.location.name, groups };
  }

  async createPublic(body: unknown) {
    const dto = parseBody(createTicketSchema, body);
    if (dto.website?.trim()) {
      throw new BadRequestException('Unable to submit this form');
    }
    if (dto.clientRequestId) {
      const existing = await this.prisma.ticket.findUnique({
        where: { clientRequestId: dto.clientRequestId },
      });
      if (existing) return this.confirmation(existing.ticketNumber, true);
    }

    const qr = await this.requireActiveQr(dto.token);
    const group = await this.prisma.issueGroup.findFirst({
      where: { id: dto.issueGroupId, isActive: true },
    });
    if (!group) throw new BadRequestException('Choose a valid issue group');

    const route = await findIssueRoute(this.prisma, group.id, qr.locationId);
    const departmentId = route?.department.isActive ? route.departmentId : null;
    const assigneeId = pickAssignee(route, qr.locationId);
    const uploaded = dto.attachment
      ? await this.storeIncomingFile(dto.attachment.fileName, dto.attachment.contentBase64)
      : null;

    try {
      const ticket = await this.prisma.$transaction(async (tx) => {
        const ticketNumber = await this.nextTicketNumber(tx);
        const created = await tx.ticket.create({
          data: {
            ticketNumber,
            clientRequestId: dto.clientRequestId,
            customerName: dto.customerName,
            companyName: dto.companyName,
            customerEmail: dto.customerEmail?.toLowerCase(),
            customerPhone: dto.customerPhone,
            locationId: qr.locationId,
            qrCodeId: qr.id,
            issueGroupId: group.id,
            issueDescription: dto.issueDescription,
            status: 'IN_PROGRESS',
            assignedDepartmentId: departmentId,
            assignedUserId: assigneeId,
          },
        });
        await tx.ticketEvent.create({
          data: {
            ticketId: created.id,
            type: 'CREATED',
            details: { location: qr.location.name, issueGroup: group.name },
          },
        });
        await tx.ticketEvent.create({
          data: {
            ticketId: created.id,
            type: 'ASSIGNED',
            details: {
              automatic: true,
              department: route?.department.name ?? null,
              assigneeId,
            },
          },
        });
        if (uploaded) {
          await tx.ticketAttachment.create({
            data: {
              ticketId: created.id,
              fileKey: uploaded.fileKey,
              fileName: uploaded.fileName,
              contentType: uploaded.contentType,
              sizeBytes: uploaded.sizeBytes,
            },
          });
          await tx.ticketEvent.create({
            data: {
              ticketId: created.id,
              type: 'ATTACHMENT',
              details: { fileName: uploaded.fileName, source: 'customer' },
            },
          });
        }
        return created;
      });

      void this.mail.notifyCreated(ticket.id).catch((err) => {
        this.logger.error('Ticket creation email failed', err instanceof Error ? err.message : err);
      });
      return this.confirmation(ticket.ticketNumber, true);
    } catch (err) {
      if (uploaded) {
        await this.r2.deleteFile(uploaded.fileKey).catch(() => undefined);
      }
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        dto.clientRequestId
      ) {
        const existing = await this.prisma.ticket.findUnique({
          where: { clientRequestId: dto.clientRequestId },
        });
        if (existing) return this.confirmation(existing.ticketNumber, true);
      }
      throw err;
    }
  }

  async deskSummary(actor: TicketActor) {
    const scope = await this.locationScope(actor);
    const locationFilter = scope ? { locationId: scope } : {};
    const [assignedToMe, branchQueue, inProgress, closed] = await Promise.all([
      this.prisma.ticket.count({
        where: { ...locationFilter, assignedUserId: actor.id, status: 'IN_PROGRESS' },
      }),
      this.prisma.ticket.count({
        where: { ...locationFilter, assignedUserId: null, status: 'IN_PROGRESS' },
      }),
      this.prisma.ticket.count({ where: { ...locationFilter, status: 'IN_PROGRESS' } }),
      this.prisma.ticket.count({ where: { ...locationFilter, status: 'CLOSED' } }),
    ]);
    const homeLocation = scope
      ? await this.prisma.location.findUnique({
          where: { id: scope },
          select: { id: true, name: true },
        })
      : null;
    return {
      assignedToMe,
      branchQueue,
      inProgress,
      closed,
      homeLocation,
      showingAllBranches: !scope,
    };
  }

  async deskList(actor: TicketActor, query: { view?: string; q?: string; page?: string; pageSize?: string }) {
    const view = query.view === 'queue' || query.view === 'closed' ? query.view : 'mine';
    const scope = await this.locationScope(actor);
    const where: Prisma.TicketWhereInput = {};
    if (scope) where.locationId = scope;
    if (view === 'mine') {
      where.assignedUserId = actor.id;
      where.status = 'IN_PROGRESS';
    } else if (view === 'queue') {
      where.assignedUserId = null;
      where.status = 'IN_PROGRESS';
    } else {
      where.status = 'CLOSED';
    }
    applySearch(where, query.q);
    return this.pageTickets(where, query.page, query.pageSize);
  }

  async adminSummary() {
    const today = todayYmdIst();
    const from = startOfIstDay(today);
    const to = endOfIstDay(today);
    const [total, inProgress, closed, createdToday, closedToday, unassigned] = await Promise.all([
      this.prisma.ticket.count(),
      this.prisma.ticket.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.ticket.count({ where: { status: 'CLOSED' } }),
      this.prisma.ticket.count({ where: { createdAt: { gte: from, lte: to } } }),
      this.prisma.ticket.count({ where: { closedAt: { gte: from, lte: to } } }),
      this.prisma.ticket.count({ where: { status: 'IN_PROGRESS', assignedUserId: null } }),
    ]);
    const unconfiguredGroups = await this.unconfiguredGroupNames();
    const [locations, groups] = await Promise.all([
      this.prisma.location.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      this.prisma.issueGroup.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true },
      }),
    ]);
    return {
      total,
      inProgress,
      closed,
      createdToday,
      closedToday,
      unassigned,
      unconfiguredGroups,
      locations,
      groups,
    };
  }

  async adminList(query: Record<string, string | undefined>) {
    const where = this.adminWhere(query);
    return this.pageTickets(where, query.page, query.pageSize);
  }

  async exportExcel(query: Record<string, string | undefined>): Promise<Buffer> {
    const where = this.adminWhere(query);
    const rows = await this.prisma.ticket.findMany({
      where,
      include: listInclude,
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Tickets');
    sheet.columns = [
      { header: 'Ticket', key: 'ticketNumber', width: 18 },
      { header: 'Created', key: 'createdAt', width: 22 },
      { header: 'Customer', key: 'customerName', width: 22 },
      { header: 'Company', key: 'companyName', width: 22 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Email', key: 'email', width: 26 },
      { header: 'Location', key: 'location', width: 28 },
      { header: 'Issue group', key: 'issueGroup', width: 24 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Department', key: 'department', width: 18 },
      { header: 'Assigned to', key: 'assignee', width: 22 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Updated', key: 'updatedAt', width: 22 },
    ];
    for (const row of rows) {
      const item = this.toListItem(row);
      sheet.addRow({
        ticketNumber: item.ticketNumber,
        createdAt: item.createdAt,
        customerName: item.customerName,
        companyName: item.companyName,
        phone: row.customerPhone ?? '',
        email: row.customerEmail ?? '',
        location: item.location,
        issueGroup: item.issueGroup,
        description: row.issueDescription,
        department: item.department ?? '',
        assignee: item.assignee ?? '',
        status: item.status,
        updatedAt: item.updatedAt,
      });
    }
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async getTicket(actor: TicketActor, id: string, oversight: boolean) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id }, include: detailInclude });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (!oversight) await this.assertInScope(actor, ticket.locationId);
    return this.toDetail(ticket);
  }

  async comment(actor: TicketActor, id: string, body: unknown, oversight: boolean) {
    const dto = parseBody(commentSchema, body);
    const ticket = await this.loadScoped(actor, id, oversight);
    this.assertOpen(ticket);
    await this.prisma.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        type: 'COMMENTED',
        actorId: actor.id,
        details: { body: dto.body },
      },
    });
    return this.getTicket(actor, id, oversight);
  }

  async take(actor: TicketActor, id: string, oversight: boolean) {
    const ticket = await this.loadScoped(actor, id, oversight);
    this.assertOpen(ticket);
    if (ticket.assignedUserId && ticket.assignedUserId !== actor.id) {
      throw new BadRequestException('This ticket is already assigned. Hand it over with a reason.');
    }
    if (ticket.assignedUserId !== actor.id) {
      await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: { assignedUserId: actor.id },
      });
      await this.prisma.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          type: 'ASSIGNED',
          actorId: actor.id,
          details: { via: 'take', assigneeId: actor.id },
        },
      });
    }
    return this.getTicket(actor, id, oversight);
  }

  async assign(actor: TicketActor, id: string, body: unknown, oversight: boolean) {
    const dto = parseBody(assignSchema, body);
    const ticket = await this.loadScoped(actor, id, oversight);
    this.assertOpen(ticket);
    const assignee = await this.prisma.user.findFirst({
      where: { id: dto.assigneeId, isActive: true, role: { in: ASSIGNABLE_ROLES } },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, homeLocationId: true },
    });
    if (!assignee) throw new BadRequestException('Choose an active teammate');
    if (actor.role === UserRole.RECEPTION && assignee.role === UserRole.RECEPTION) {
      const scope = await this.locationScope(actor);
      if (scope && assignee.homeLocationId && assignee.homeLocationId !== scope) {
        throw new BadRequestException('Choose a receptionist at your branch');
      }
    }
    if (ticket.assignedUserId === assignee.id) {
      throw new BadRequestException('This ticket is already assigned to that person');
    }
    const previous = ticket.assignedUser;
    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: { assignedUserId: assignee.id },
    });
    await this.prisma.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        type: 'ASSIGNED',
        actorId: actor.id,
        details: {
          reason: dto.reason,
          from: previous ? personName(previous) : null,
          to: personName(assignee),
          assigneeId: assignee.id,
        },
      },
    });
    void this.mail
      .notifyReassigned(ticket.id, previous?.email ?? null, dto.reason)
      .catch((err) => this.logger.error('Reassignment email failed', err instanceof Error ? err.message : err));
    return this.getTicket(actor, id, oversight);
  }

  async close(actor: TicketActor, id: string, body: unknown, oversight: boolean) {
    const dto = parseBody(closeSchema, body);
    const ticket = await this.loadScoped(actor, id, oversight);
    this.assertOpen(ticket);
    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'CLOSED',
        resolutionNotes: dto.resolutionNotes,
        closedAt: new Date(),
        closedById: actor.id,
      },
    });
    await this.prisma.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        type: 'STATUS_CHANGED',
        actorId: actor.id,
        details: { from: 'IN_PROGRESS', to: 'CLOSED', resolutionNotes: dto.resolutionNotes },
      },
    });
    void this.mail.notifyClosed(ticket.id).catch((err) => {
      this.logger.error('Closure email failed', err instanceof Error ? err.message : err);
    });
    return this.getTicket(actor, id, oversight);
  }

  async reopen(actor: TicketActor, id: string, body: unknown) {
    if (actor.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only a super admin can reopen a ticket');
    }
    const dto = parseBody(reopenSchema, body);
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.status !== 'CLOSED') throw new BadRequestException('This ticket is already in progress');
    await this.prisma.ticket.update({
      where: { id },
      data: { status: 'IN_PROGRESS', closedAt: null, closedById: null },
    });
    await this.prisma.ticketEvent.create({
      data: {
        ticketId: id,
        type: 'STATUS_CHANGED',
        actorId: actor.id,
        details: { from: 'CLOSED', to: 'IN_PROGRESS', reason: dto.reason },
      },
    });
    void this.mail.notifyReopened(id).catch((err) => {
      this.logger.error('Reopen email failed', err instanceof Error ? err.message : err);
    });
    return this.getTicket(actor, id, true);
  }

  async addAttachment(actor: TicketActor, id: string, body: unknown, oversight: boolean) {
    const dto = parseBody(attachmentSchema, body);
    const ticket = await this.loadScoped(actor, id, oversight);
    this.assertOpen(ticket);
    const count = await this.prisma.ticketAttachment.count({ where: { ticketId: id } });
    if (count >= MAX_ATTACHMENTS_PER_TICKET) {
      throw new BadRequestException(`A ticket can have up to ${MAX_ATTACHMENTS_PER_TICKET} files`);
    }
    const file = decodeTicketFile(dto.fileName, dto.contentBase64);
    const fileKey = newTicketFileKey(id, file.ext);
    await this.r2.uploadFile(fileKey, file.buffer, file.contentType);
    await this.prisma.ticketAttachment.create({
      data: {
        ticketId: id,
        fileKey,
        fileName: file.fileName,
        contentType: file.contentType,
        sizeBytes: file.sizeBytes,
        uploadedById: actor.id,
      },
    });
    await this.prisma.ticketEvent.create({
      data: {
        ticketId: id,
        type: 'ATTACHMENT',
        actorId: actor.id,
        details: { fileName: file.fileName },
      },
    });
    return this.getTicket(actor, id, oversight);
  }

  async attachmentFile(actor: TicketActor, id: string, attachmentId: string, oversight: boolean) {
    const ticket = await this.loadScoped(actor, id, oversight);
    const attachment = await this.prisma.ticketAttachment.findFirst({
      where: { id: attachmentId, ticketId: ticket.id },
    });
    if (!attachment) throw new NotFoundException('File not found');
    const stored = await this.r2.getFileBuffer(attachment.fileKey);
    return {
      buffer: stored.buffer,
      contentType: attachment.contentType,
      fileName: attachment.fileName,
    };
  }

  async colleagues(actor: TicketActor) {
    const scope = await this.locationScope(actor);
    const users = await this.prisma.user.findMany({
      where: { isActive: true, role: { in: ASSIGNABLE_ROLES } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        homeLocationId: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    return users
      .filter((user) => {
        if (actor.role !== UserRole.RECEPTION) return true;
        if (user.role !== UserRole.RECEPTION) return true;
        if (!scope || !user.homeLocationId) return true;
        return user.homeLocationId === scope;
      })
      .map((user) => ({
        id: user.id,
        name: personName(user),
        email: user.email,
        role: user.role,
      }));
  }

  async settings() {
    const [departments, groups, locations, qrCodes, receptionUsers] = await Promise.all([
      this.prisma.department.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      this.prisma.issueGroup.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          routes: {
            where: { locationKey: GLOBAL_ROUTE_KEY },
            include: {
              recipients: true,
              department: { select: { name: true } },
              defaultAssignee: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      this.prisma.location.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true },
      }),
      this.prisma.qrCode.findMany({
        orderBy: { createdAt: 'desc' },
        include: { location: { select: { id: true, name: true } } },
      }),
      this.prisma.user.findMany({
        where: { role: UserRole.RECEPTION, isActive: true },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          homeLocationId: true,
          homeLocation: { select: { name: true } },
        },
      }),
    ]);
    return {
      departments,
      groups: groups.map((group) => {
        const route = group.routes[0];
        return {
          id: group.id,
          name: group.name,
          isActive: group.isActive,
          sortOrder: group.sortOrder,
          route: route
            ? {
                id: route.id,
                departmentId: route.departmentId,
                departmentName: route.department.name,
                defaultAssigneeId: route.defaultAssigneeId,
                assigneeName: route.defaultAssignee ? personName(route.defaultAssignee) : null,
                toEmails: route.recipients.filter((r) => r.kind === 'TO').map((r) => r.email),
                ccEmails: route.recipients.filter((r) => r.kind === 'CC').map((r) => r.email),
              }
            : null,
        };
      }),
      locations,
      qrCodes: qrCodes.map((code) => ({
        id: code.id,
        label: code.label,
        isActive: code.isActive,
        locationId: code.locationId,
        locationName: code.location.name,
        url: this.publicUrl(code.publicToken),
        createdAt: code.createdAt,
      })),
      receptionUsers: receptionUsers.map((user) => ({
        id: user.id,
        name: personName(user),
        email: user.email,
        homeLocationId: user.homeLocationId,
        homeLocationName: user.homeLocation?.name ?? null,
      })),
      unconfiguredGroups: await this.unconfiguredGroupNames(),
    };
  }

  async createGroup(body: unknown) {
    const dto = parseBody(createGroupSchema, body);
    const existing = await this.prisma.issueGroup.findFirst({
      where: { name: { equals: dto.name, mode: 'insensitive' } },
    });
    if (existing) throw new BadRequestException('That issue group already exists');
    const last = await this.prisma.issueGroup.aggregate({ _max: { sortOrder: true } });
    await this.prisma.issueGroup.create({
      data: { name: dto.name, sortOrder: (last._max.sortOrder ?? 0) + 1 },
    });
    return this.settings();
  }

  async updateGroup(id: string, body: unknown) {
    const dto = parseBody(updateGroupSchema, body);
    const group = await this.prisma.issueGroup.findUnique({ where: { id } });
    if (!group) throw new NotFoundException('Issue group not found');
    await this.prisma.issueGroup.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
      },
    });
    return this.settings();
  }

  async saveRoute(issueGroupId: string, body: unknown) {
    const dto = parseBody(saveRouteSchema, body);
    const group = await this.prisma.issueGroup.findUnique({ where: { id: issueGroupId } });
    if (!group) throw new NotFoundException('Issue group not found');
    const department = await this.prisma.department.findFirst({
      where: { id: dto.departmentId, isActive: true },
    });
    if (!department) throw new BadRequestException('Choose a department');
    if (dto.defaultAssigneeId) {
      const assignee = await this.prisma.user.findFirst({
        where: { id: dto.defaultAssigneeId, isActive: true, role: { in: ASSIGNABLE_ROLES } },
      });
      if (!assignee) throw new BadRequestException('Choose an active teammate');
    }
    const locationKey = dto.locationId || GLOBAL_ROUTE_KEY;
    if (dto.locationId) {
      const location = await this.prisma.location.findFirst({
        where: { id: dto.locationId, isActive: true },
      });
      if (!location) throw new BadRequestException('Choose a location');
    }
    const toEmails = uniqueEmails(dto.toEmails);
    const ccEmails = uniqueEmails(dto.ccEmails ?? []).filter((email) => !toEmails.includes(email));
    await this.prisma.$transaction(async (tx) => {
      const route = await tx.issueGroupRoute.upsert({
        where: { issueGroupId_locationKey: { issueGroupId, locationKey } },
        create: {
          issueGroupId,
          locationKey,
          locationId: dto.locationId ?? null,
          departmentId: dto.departmentId,
          defaultAssigneeId: dto.defaultAssigneeId ?? null,
        },
        update: {
          departmentId: dto.departmentId,
          defaultAssigneeId: dto.defaultAssigneeId ?? null,
          locationId: dto.locationId ?? null,
          isActive: true,
        },
      });
      await tx.issueGroupRecipient.deleteMany({ where: { routeId: route.id } });
      if (toEmails.length + ccEmails.length > 0) {
        await tx.issueGroupRecipient.createMany({
          data: [
            ...toEmails.map((email) => ({ routeId: route.id, email, kind: 'TO' as const })),
            ...ccEmails.map((email) => ({ routeId: route.id, email, kind: 'CC' as const })),
          ],
        });
      }
    });
    return this.settings();
  }

  async createQr(actor: TicketActor, body: unknown) {
    const dto = parseBody(createQrSchema, body);
    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, isActive: true },
    });
    if (!location) throw new BadRequestException('Choose a location');
    const code = await this.prisma.qrCode.create({
      data: {
        locationId: location.id,
        label: dto.label?.trim() || `${location.name} reception`,
        publicToken: randomBytes(24).toString('base64url'),
        createdById: actor.id,
      },
    });
    return { id: code.id, url: this.publicUrl(code.publicToken) };
  }

  async updateQr(id: string, body: unknown) {
    const dto = parseBody(updateQrSchema, body);
    const code = await this.prisma.qrCode.findUnique({ where: { id } });
    if (!code) throw new NotFoundException('QR code not found');
    await this.prisma.qrCode.update({ where: { id }, data: { isActive: dto.isActive } });
    return this.settings();
  }

  async regenerateQr(id: string) {
    const code = await this.prisma.qrCode.findUnique({ where: { id } });
    if (!code) throw new NotFoundException('QR code not found');
    const updated = await this.prisma.qrCode.update({
      where: { id },
      data: { publicToken: randomBytes(24).toString('base64url'), isActive: true },
    });
    return { id: updated.id, url: this.publicUrl(updated.publicToken) };
  }

  async qrPoster(id: string) {
    const code = await this.loadPosterQr(id);
    const buffer = await buildQrPostersPdf([this.toPosterPage(code)]);
    return {
      buffer,
      contentType: 'application/pdf',
      fileName: `${this.posterSlug(code.location.name)}.pdf`,
    };
  }

  async allQrPosters() {
    const codes = await this.prisma.qrCode.findMany({
      where: { isActive: true, location: { isActive: true } },
      include: { location: true },
      orderBy: { location: { name: 'asc' } },
    });
    if (codes.length === 0) throw new NotFoundException('No active QR codes to print');
    const buffer = await buildQrPostersPdf(codes.map((code) => this.toPosterPage(code)));
    return {
      buffer,
      contentType: 'application/pdf',
      fileName: 'aspire-support-posters.pdf',
    };
  }

  async qrImage(id: string, format: string): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
    const code = await this.prisma.qrCode.findUnique({
      where: { id },
      include: { location: { select: { name: true } } },
    });
    if (!code) throw new NotFoundException('QR code not found');
    const url = this.publicUrl(code.publicToken);
    const slug = code.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'qr';
    if (format === 'svg') {
      const svg = await QRCode.toString(url, { type: 'svg', margin: 1, width: 512 });
      return {
        buffer: Buffer.from(svg),
        contentType: 'image/svg+xml',
        fileName: `${slug}.svg`,
      };
    }
    const png = await QRCode.toBuffer(url, { type: 'png', margin: 1, width: 512 });
    return { buffer: png, contentType: 'image/png', fileName: `${slug}.png` };
  }

  async setReceptionHome(userId: string, body: unknown) {
    const dto = parseBody(setHomeLocationSchema, body);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, role: UserRole.RECEPTION },
    });
    if (!user) throw new NotFoundException('Reception user not found');
    if (dto.locationId) {
      const location = await this.prisma.location.findFirst({
        where: { id: dto.locationId, isActive: true },
      });
      if (!location) throw new BadRequestException('Choose a location');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { homeLocationId: dto.locationId },
    });
    return this.settings();
  }

  private async pageTickets(where: Prisma.TicketWhereInput, pageRaw?: string, pageSizeRaw?: string) {
    const page = Math.max(1, Number(pageRaw) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(pageSizeRaw) || 25));
    const [total, rows] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        include: listInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { rows: rows.map((row) => this.toListItem(row)), total, page, pageSize };
  }

  private adminWhere(query: Record<string, string | undefined>): Prisma.TicketWhereInput {
    const where: Prisma.TicketWhereInput = {};
    const locationId = optionalUuid(query.locationId);
    const issueGroupId = optionalUuid(query.issueGroupId);
    const departmentId = optionalUuid(query.departmentId);
    const assigneeId = optionalUuid(query.assigneeId);
    if (locationId) where.locationId = locationId;
    if (issueGroupId) where.issueGroupId = issueGroupId;
    if (departmentId) where.assignedDepartmentId = departmentId;
    if (assigneeId) where.assignedUserId = assigneeId;
    if (query.unassigned === '1') where.assignedUserId = null;
    if (query.status === 'IN_PROGRESS' || query.status === 'CLOSED') where.status = query.status;
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from && /^\d{4}-\d{2}-\d{2}$/.test(query.from)) {
        where.createdAt.gte = startOfIstDay(query.from);
      }
      if (query.to && /^\d{4}-\d{2}-\d{2}$/.test(query.to)) {
        where.createdAt.lte = endOfIstDay(query.to);
      }
    }
    applySearch(where, query.q);
    return where;
  }

  private toListItem(row: Prisma.TicketGetPayload<{ include: typeof listInclude }>) {
    return {
      id: row.id,
      ticketNumber: row.ticketNumber,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      customerName: row.customerName,
      companyName: row.companyName,
      location: row.location.name,
      locationId: row.locationId,
      issueGroup: row.issueGroup.name,
      description: row.issueDescription.length > 140
        ? `${row.issueDescription.slice(0, 140)}…`
        : row.issueDescription,
      department: row.assignedDepartment?.name ?? null,
      assignee: row.assignedUser ? personName(row.assignedUser) : null,
      assignedUserId: row.assignedUserId,
      status: row.status,
    };
  }

  private toDetail(ticket: Prisma.TicketGetPayload<{ include: typeof detailInclude }>) {
    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      customerName: ticket.customerName,
      companyName: ticket.companyName,
      customerEmail: ticket.customerEmail,
      customerPhone: ticket.customerPhone,
      location: ticket.location,
      issueGroup: ticket.issueGroup,
      issueDescription: ticket.issueDescription,
      status: ticket.status,
      department: ticket.assignedDepartment,
      assignee: ticket.assignedUser
        ? { id: ticket.assignedUser.id, name: personName(ticket.assignedUser), email: ticket.assignedUser.email }
        : null,
      resolutionNotes: ticket.resolutionNotes,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      closedAt: ticket.closedAt,
      closedBy: ticket.closedBy ? personName(ticket.closedBy) : null,
      qrLabel: ticket.qrCode.label,
      events: ticket.events.map((event) => ({
        id: event.id,
        type: event.type,
        createdAt: event.createdAt,
        actorName: event.actor ? personName(event.actor) : null,
        details: event.details,
      })),
      attachments: ticket.attachments,
      notifications: ticket.notifications,
    };
  }

  private async loadScoped(actor: TicketActor, id: string, oversight: boolean) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: { assignedUser: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (!oversight) await this.assertInScope(actor, ticket.locationId);
    return ticket;
  }

  private async locationScope(actor: TicketActor): Promise<string | null> {
    if (actor.role !== UserRole.RECEPTION) return null;
    const user = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: { homeLocationId: true },
    });
    return user?.homeLocationId ?? null;
  }

  private async assertInScope(actor: TicketActor, locationId: string) {
    const scope = await this.locationScope(actor);
    if (scope && scope !== locationId) throw new NotFoundException('Ticket not found');
  }

  private assertOpen(ticket: { status: string }) {
    if (ticket.status !== 'IN_PROGRESS') {
      throw new BadRequestException('This ticket is closed');
    }
  }

  private async requireActiveQr(token: string) {
    const trimmed = token?.trim();
    if (!trimmed) {
      throw new BadRequestException('Scan the QR code at your Aspire Coworks branch');
    }
    const qr = await this.prisma.qrCode.findUnique({
      where: { publicToken: trimmed },
      include: { location: true },
    });
    if (!qr || !qr.isActive || !qr.location.isActive) {
      throw new NotFoundException('This QR code is not active. Please ask reception for help.');
    }
    return qr;
  }

  private async nextTicketNumber(tx: Prisma.TransactionClient): Promise<string> {
    const year = Number(
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric' }).format(new Date()),
    );
    const rows = await tx.$queryRaw<Array<{ lastNumber: number }>>`
      INSERT INTO ticket_sequences (year, "lastNumber")
      VALUES (${year}, 1)
      ON CONFLICT (year)
      DO UPDATE SET "lastNumber" = ticket_sequences."lastNumber" + 1
      RETURNING "lastNumber"
    `;
    const n = rows[0]?.lastNumber;
    if (!n) throw new BadRequestException('Could not allocate a ticket number');
    return `ACW-${year}-${String(n).padStart(6, '0')}`;
  }

  private async storeIncomingFile(fileName: string, contentBase64: string) {
    const file = decodeTicketFile(fileName, contentBase64);
    const fileKey = `tickets/incoming/${randomUUID()}.${file.ext}`;
    await this.r2.uploadFile(fileKey, file.buffer, file.contentType);
    return { fileKey, fileName: file.fileName, contentType: file.contentType, sizeBytes: file.sizeBytes };
  }

  private confirmation(ticketNumber: string, attachmentSaved: boolean) {
    return {
      ticketNumber,
      message: TICKET_CONFIRMATION_MESSAGE,
      attachmentSaved,
    };
  }

  private async loadPosterQr(id: string) {
    const code = await this.prisma.qrCode.findUnique({
      where: { id },
      include: { location: true },
    });
    if (!code) throw new NotFoundException('QR code not found');
    if (!code.isActive || !code.location.isActive) {
      throw new BadRequestException('Turn this QR code on before printing the poster');
    }
    return code;
  }

  private toPosterPage(code: {
    label: string;
    publicToken: string;
    location: { name: string; address: string };
  }) {
    return {
      locationName: code.location.name,
      address: code.location.address,
      label: code.label,
      url: this.publicUrl(code.publicToken),
    };
  }

  private posterSlug(locationName: string): string {
    const slug = locationName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `${slug || 'location'}-support-poster`;
  }

  private publicUrl(token: string): string {
    const frontend = (this.config.get<string>('FRONTEND_URL') ?? 'https://app.aspirecoworks.in').replace(
      /\/$/,
      '',
    );
    return `${frontend}/raise-ticket?t=${encodeURIComponent(token)}`;
  }

  private async unconfiguredGroupNames(): Promise<string[]> {
    const groups = await this.prisma.issueGroup.findMany({
      where: { isActive: true },
      include: {
        routes: {
          where: { locationKey: GLOBAL_ROUTE_KEY, isActive: true },
          include: { recipients: true },
        },
      },
    });
    return groups
      .filter((group) => {
        const route = group.routes[0];
        return !route || route.recipients.every((recipient) => recipient.kind !== 'TO');
      })
      .map((group) => group.name);
  }
}

function pickAssignee(
  route: Awaited<ReturnType<typeof findIssueRoute>>,
  locationId: string,
): string | null {
  const person = route?.defaultAssignee;
  if (!person?.isActive) return null;
  if (route?.locationId) return person.id;
  if (!person.homeLocationId || person.homeLocationId === locationId) return person.id;
  return null;
}

function personName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

function uniqueEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of emails) {
    const email = raw.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

function applySearch(where: Prisma.TicketWhereInput, q?: string) {
  const term = q?.trim();
  if (!term) return;
  where.OR = [
    { ticketNumber: { contains: term, mode: 'insensitive' } },
    { customerName: { contains: term, mode: 'insensitive' } },
    { companyName: { contains: term, mode: 'insensitive' } },
  ];
}

function optionalUuid(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  const parsed = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
  if (!parsed) throw new BadRequestException('Invalid id');
  return value.trim();
}

function startOfIstDay(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000+05:30`);
}

function endOfIstDay(ymd: string): Date {
  return new Date(`${ymd}T23:59:59.999+05:30`);
}

function todayYmdIst(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function parseBody<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestException(zodMessage(result.error));
  }
  return result.data;
}

function zodMessage(error: ZodError): string {
  return error.errors.map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`).join('; ');
}
