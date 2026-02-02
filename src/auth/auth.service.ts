import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { MailerService } from '../mailer/mailer.service';
import { RegisterDto } from './dto/register.dto';
import { UserRole } from '../common/enums/user-role.enum';

const MAGIC_LINK_EXPIRY_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private mailer: MailerService,
    private config: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async validateUserById(id: string): Promise<any> {
    const user = await this.usersService.findOne(id);
    return user ?? null;
  }

  async login(user: any) {
    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    const payload = { email: user.email, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = await this.usersService.create({
      email: registerDto.email,
      passwordHash: hashedPassword,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      role: registerDto.role,
      isActive: true,
    });
    return user;
  }

  /**
   * POST /auth/request-login
   * Request magic-link login. Always returns same message; no info leaked if email not found.
   */
  async requestLogin(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return {
        message:
          'If an account exists with this email, we sent a sign-in link. Check your inbox.',
      };
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000);

    await this.prisma.authToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    const baseUrl = (this.config.get<string>('APP_BASE_URL') ?? 'https://app.aspirecoworks.com').replace(
      /\/$/,
      '',
    );
    const magicLink = `${baseUrl}/auth/verify?token=${encodeURIComponent(token)}`;

    await this.mailer.sendMagicLink(user.email, magicLink);

    return {
      message:
        'If an account exists with this email, we sent a sign-in link. Check your inbox.',
    };
  }

  /**
   * GET /auth/verify-login?token=...
   * Validate token, mark used, issue JWT. One-time use; token must not be expired or used.
   */
  async verifyLogin(token: string): Promise<{ access_token: string; user: any }> {
    if (!token?.trim()) {
      throw new UnauthorizedException('Invalid or expired sign-in link');
    }
    const authToken = await this.prisma.authToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!authToken) {
      throw new UnauthorizedException('Invalid or expired sign-in link');
    }
    if (authToken.usedAt) {
      throw new UnauthorizedException('This sign-in link has already been used');
    }
    if (authToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired sign-in link');
    }

    await this.prisma.authToken.update({
      where: { id: authToken.id },
      data: { usedAt: new Date() },
    });

    const user = await this.usersService.findOne(authToken.userId);
    return this.login(user);
  }

  // DEV ONLY – REMOVE BEFORE PRODUCTION. No password; find or create user by email; issue JWT.
  async devLogin(email: string): Promise<{ accessToken: string; user: { id: string; email: string; role: string } }> {
    const env = this.config.get<string>('NODE_ENV');
    if (env === 'production') {
      throw new NotFoundException('Not found');
    }

    const trimmed = email?.trim();
    if (!trimmed) {
      throw new UnauthorizedException('Email is required');
    }

    let user = await this.prisma.user.findUnique({
      where: { email: trimmed },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user) {
      const passwordHash = await bcrypt.hash('DEV-NO-PASSWORD', 10);
      user = await this.prisma.user.create({
        data: {
          email: trimmed,
          passwordHash,
          firstName: 'Dev',
          lastName: 'User',
          role: UserRole.ADMIN,
          isActive: true,
        },
        select: { id: true, email: true, role: true, isActive: true },
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    const payload = { email: user.email, sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }
}
