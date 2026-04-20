import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { UserRole } from '../common/enums/user-role.enum';
import { clientInviteSetPassword } from '../email/templates/client-invite-set-password';
import { CreateAggregatorUserDto } from './dto/create-aggregator-user.dto';

const INVITE_TOKEN_EXPIRY_HOURS = 48;

/**
 * Manages admin-provisioned AGGREGATOR user accounts. Each aggregator user is a
 * partner operator that logs into the /aggregator portal and onboards their own
 * clients with clientChannel forced to AGGREGATOR server-side.
 */
@Injectable()
export class AggregatorUsersService {
  private readonly logger = new Logger(AggregatorUsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreateAggregatorUserDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const token = randomBytes(32).toString('hex');
    const inviteTokenExpiry = new Date(
      Date.now() + INVITE_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    const user = await this.prisma.user.create({
      data: {
        email,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        passwordHash: null,
        role: UserRole.AGGREGATOR,
        aggregatorName: dto.aggregatorName.trim(),
        isActive: true,
        inviteToken: token,
        inviteTokenExpiry,
        isActivated: false,
      },
      select: this.publicSelect(),
    });

    await this.sendInviteEmail(email, dto.aggregatorName.trim(), token);
    return user;
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      where: { role: UserRole.AGGREGATOR },
      select: this.publicSelect(),
      orderBy: { createdAt: 'desc' },
    });

    if (users.length === 0) return [];

    const counts = await this.prisma.clientProfile.groupBy({
      by: ['createdById'],
      where: { createdById: { in: users.map((u) => u.id) } },
      _count: { _all: true },
    });
    const countById = new Map<string, number>();
    for (const row of counts) {
      if (row.createdById) countById.set(row.createdById, row._count._all);
    }

    return users.map((u) => ({ ...u, clientsCount: countById.get(u.id) ?? 0 }));
  }

  async resendInvite(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== UserRole.AGGREGATOR) {
      throw new NotFoundException('Aggregator user not found');
    }
    if (user.isActivated) {
      return { sent: false, message: 'User has already set their password.' };
    }

    const token = randomBytes(32).toString('hex');
    const inviteTokenExpiry = new Date(
      Date.now() + INVITE_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
    );
    await this.prisma.user.update({
      where: { id: user.id },
      data: { inviteToken: token, inviteTokenExpiry },
    });

    await this.sendInviteEmail(user.email, user.aggregatorName ?? '', token);
    return { sent: true, message: 'Invite email sent.' };
  }

  private publicSelect() {
    return {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      aggregatorName: true,
      isActive: true,
      isActivated: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }

  private async sendInviteEmail(email: string, aggregatorName: string, token: string) {
    const frontendUrl = (
      this.config.get<string>('FRONTEND_URL') ?? 'https://app.aspirecoworks.in'
    ).replace(/\/$/, '');
    const setPasswordUrl = `${frontendUrl}/set-password?token=${encodeURIComponent(token)}`;

    const { subject, html, text } = clientInviteSetPassword({
      companyName: aggregatorName || 'Aspire Coworks Partner',
      setPasswordUrl,
      expiryHours: INVITE_TOKEN_EXPIRY_HOURS,
    });

    try {
      await this.emailService.sendEmail({ to: email, subject, html, text });
      this.logger.log(`Aggregator invite email sent to ${email}`);
    } catch (err) {
      this.logger.warn(
        `Failed to send aggregator invite to ${email}: ${
          err instanceof Error ? err.message : err
        }`,
      );
      throw new BadRequestException('Failed to send invite email');
    }
  }
}
