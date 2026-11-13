import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { findIssueRoute, splitRecipients } from './ticket-routing';
import {
  customerClosedEmail,
  customerCreatedEmail,
  customerReopenedEmail,
  internalClosedEmail,
  internalCreatedEmail,
  reassignedEmail,
  type TicketMailFacts,
} from '../email/templates/support-ticket';

@Injectable()
export class TicketMailService {
  private readonly logger = new Logger(TicketMailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async notifyCreated(ticketId: string): Promise<void> {
    const loaded = await this.load(ticketId);
    if (!loaded) return;
    const { facts, to, cc } = loaded;
    const internal = internalCreatedEmail(facts);
    await this.sendAndLog({
      ticketId,
      kind: 'INTERNAL_CREATED',
      ...internal,
      to,
      cc,
    });
    if (loaded.customerEmail) {
      const customer = customerCreatedEmail(facts);
      await this.sendAndLog({
        ticketId,
        kind: 'CUSTOMER_CREATED',
        ...customer,
        to: [loaded.customerEmail],
        cc: [],
      });
    }
  }

  async notifyClosed(ticketId: string): Promise<void> {
    const loaded = await this.load(ticketId);
    if (!loaded) return;
    const { facts, to, cc, customerEmail } = loaded;
    if (customerEmail) {
      const customer = customerClosedEmail(facts);
      await this.sendAndLog({
        ticketId,
        kind: 'CUSTOMER_CLOSED',
        ...customer,
        to: [customerEmail],
        cc: [],
      });
    }
    const internal = internalClosedEmail(facts);
    await this.sendAndLog({
      ticketId,
      kind: 'INTERNAL_CLOSED',
      ...internal,
      to,
      cc,
    });
  }

  async notifyReassigned(
    ticketId: string,
    previousEmail: string | null,
    reason: string,
  ): Promise<void> {
    const loaded = await this.load(ticketId);
    if (!loaded?.assigneeEmail) return;
    const message = reassignedEmail(
      { ...loaded.facts, reason },
      loaded.facts.assigneeName || 'there',
    );
    await this.sendAndLog({
      ticketId,
      kind: 'REASSIGNED',
      ...message,
      to: [loaded.assigneeEmail],
      cc: previousEmail && previousEmail !== loaded.assigneeEmail ? [previousEmail] : [],
    });
  }

  async notifyReopened(ticketId: string): Promise<void> {
    const loaded = await this.load(ticketId);
    if (!loaded) return;
    if (loaded.customerEmail) {
      const customer = customerReopenedEmail(loaded.facts);
      await this.sendAndLog({
        ticketId,
        kind: 'CUSTOMER_REOPENED',
        ...customer,
        to: [loaded.customerEmail],
        cc: [],
      });
    }
    const internal = internalCreatedEmail(loaded.facts);
    await this.sendAndLog({
      ticketId,
      kind: 'INTERNAL_REOPENED',
      subject: `[ASPIRE SUPPORT] Ticket reopened – ${loaded.facts.ticketNumber}`,
      html: internal.html.replace('A new support ticket has been registered.', 'A support ticket has been reopened.'),
      text: internal.text.replace(
        'A new support ticket has been registered.',
        'A support ticket has been reopened.',
      ),
      to: loaded.to,
      cc: loaded.cc,
    });
  }

  @Cron('*/5 * * * *', { name: 'retry-ticket-emails' })
  async retryFailed(): Promise<void> {
    const pending = await this.prisma.notificationLog.findMany({
      where: { status: 'FAILED', attempt: { lt: 3 } },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
    for (const log of pending) {
      const attempt = log.attempt + 1;
      const result = await this.email.sendEmail({
        to: log.toEmails,
        cc: log.ccEmails,
        subject: log.subject,
        html: log.html,
        text: log.text,
      });
      await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: result.success
          ? { status: 'SENT', sentAt: new Date(), error: null, attempt }
          : { status: 'FAILED', error: result.error ?? 'Send failed', attempt },
      });
    }
  }

  private async load(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        location: true,
        issueGroup: true,
        assignedDepartment: true,
        assignedUser: true,
      },
    });
    if (!ticket) return null;
    const route = await findIssueRoute(this.prisma, ticket.issueGroupId, ticket.locationId);
    const split = splitRecipients(route?.recipients ?? []);
    const assigneeEmail = ticket.assignedUser?.isActive
      ? ticket.assignedUser.email.trim().toLowerCase()
      : null;
    if (assigneeEmail && !split.to.includes(assigneeEmail) && !split.cc.includes(assigneeEmail)) {
      split.to.push(assigneeEmail);
    }
    const frontend = (this.config.get<string>('FRONTEND_URL') ?? 'https://app.aspirecoworks.in').replace(
      /\/$/,
      '',
    );
    const facts: TicketMailFacts = {
      ticketNumber: ticket.ticketNumber,
      customerName: ticket.customerName,
      companyName: ticket.companyName,
      customerPhone: ticket.customerPhone,
      locationName: ticket.location.name,
      issueGroup: ticket.issueGroup.name,
      issueDescription: ticket.issueDescription,
      createdAt: ticket.createdAt,
      departmentName: ticket.assignedDepartment?.name ?? route?.department.name ?? null,
      assigneeName: ticket.assignedUser
        ? `${ticket.assignedUser.firstName} ${ticket.assignedUser.lastName}`.trim()
        : null,
      resolutionNotes: ticket.resolutionNotes,
      closedAt: ticket.closedAt,
      staffUrl: `${frontend}/staff/tickets/${ticket.id}`,
      supportEmail: this.config.get<string>('SUPPORT_EMAIL') ?? 'support@aspirecoworks.in',
    };
    return {
      facts,
      to: split.to,
      cc: split.cc,
      customerEmail: ticket.customerEmail?.trim().toLowerCase() || null,
      assigneeEmail,
    };
  }

  private async sendAndLog(params: {
    ticketId: string;
    kind: string;
    subject: string;
    html: string;
    text: string;
    to: string[];
    cc: string[];
  }): Promise<void> {
    const to = uniqueEmails(params.to);
    const cc = uniqueEmails(params.cc).filter((email) => !to.includes(email));
    if (to.length === 0) {
      await this.prisma.ticketEvent.create({
        data: {
          ticketId: params.ticketId,
          type: 'EMAIL',
          details: { kind: params.kind, status: 'SKIPPED', reason: 'No recipients configured' },
        },
      });
      return;
    }
    try {
      const log = await this.prisma.notificationLog.create({
        data: {
          ticketId: params.ticketId,
          kind: params.kind,
          subject: params.subject,
          html: params.html,
          text: params.text,
          toEmails: to,
          ccEmails: cc,
          status: 'QUEUED',
          attempt: 1,
        },
      });
      const result = await this.email.sendEmail({
        to,
        cc,
        subject: params.subject,
        html: params.html,
        text: params.text,
      });
      await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: result.success
          ? { status: 'SENT', sentAt: new Date(), error: null }
          : { status: 'FAILED', error: result.error ?? 'Send failed' },
      });
      await this.prisma.ticketEvent.create({
        data: {
          ticketId: params.ticketId,
          type: 'EMAIL',
          details: {
            kind: params.kind,
            status: result.success ? 'SENT' : 'FAILED',
            to,
          },
        },
      });
    } catch (err) {
      this.logger.error(
        `Ticket email failed (${params.kind})`,
        err instanceof Error ? err.message : err,
      );
    }
  }
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
