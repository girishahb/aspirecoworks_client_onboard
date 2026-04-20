import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { UserRole } from '../common/enums/user-role.enum';
import { aggregatorInviteCredentials } from '../email/templates/aggregator-invite-credentials';
import { CreateAggregatorUserDto } from './dto/create-aggregator-user.dto';

/** Default password set on newly-provisioned aggregator users. They are expected to change it after first login. */
const DEFAULT_AGGREGATOR_PASSWORD = 'Welcome2aspire';
const BCRYPT_ROUNDS = 10;

/**
 * Manages admin-provisioned AGGREGATOR user accounts. Each aggregator user is a
 * partner operator that logs into the /aggregator portal and onboards their own
 * clients with clientChannel forced to AGGREGATOR server-side.
 *
 * Aggregators are provisioned with a default password (DEFAULT_AGGREGATOR_PASSWORD)
 * which is emailed to them along with the login URL. They can change it from their
 * portal after first sign-in.
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

    const passwordHash = await bcrypt.hash(DEFAULT_AGGREGATOR_PASSWORD, BCRYPT_ROUNDS);
    const aggregatorName = dto.aggregatorName.trim();

    const user = await this.prisma.user.create({
      data: {
        email,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        passwordHash,
        role: UserRole.AGGREGATOR,
        aggregatorName,
        isActive: true,
        inviteToken: null,
        inviteTokenExpiry: null,
        isActivated: true,
      },
      select: this.publicSelect(),
    });

    await this.sendCredentialsEmail(email, aggregatorName, DEFAULT_AGGREGATOR_PASSWORD);
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

  /**
   * Resend the default credentials email to an aggregator user. Does not change
   * their password in the database. If the user has already changed their password,
   * they should continue using their new one and can ignore this email (stated in
   * the email body).
   */
  async resendInvite(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== UserRole.AGGREGATOR) {
      throw new NotFoundException('Aggregator user not found');
    }

    await this.sendCredentialsEmail(
      user.email,
      user.aggregatorName ?? '',
      DEFAULT_AGGREGATOR_PASSWORD,
    );
    return { sent: true, message: 'Credentials email sent.' };
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

  private async sendCredentialsEmail(
    email: string,
    aggregatorName: string,
    defaultPassword: string,
  ) {
    const frontendUrl = (
      this.config.get<string>('FRONTEND_URL') ?? 'https://app.aspirecoworks.in'
    ).replace(/\/$/, '');
    const loginUrl = `${frontendUrl}/admin/login`;

    const { subject, html, text } = aggregatorInviteCredentials({
      aggregatorName: aggregatorName || 'Aspire Coworks Partner',
      email,
      defaultPassword,
      loginUrl,
    });

    try {
      await this.emailService.sendEmail({ to: email, subject, html, text });
      this.logger.log(`Aggregator credentials email sent to ${email}`);
    } catch (err) {
      this.logger.warn(
        `Failed to send aggregator credentials email to ${email}: ${
          err instanceof Error ? err.message : err
        }`,
      );
      throw new BadRequestException('Failed to send credentials email');
    }
  }
}
