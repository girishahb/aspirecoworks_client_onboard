import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(LocalStrategy.name);

  constructor(private authService: AuthService) {
    super({
      usernameField: 'email',
    });
  }

  async validate(email: string, password: string): Promise<any> {
    if (!email || !password) {
      this.logger.warn('LocalStrategy: Missing email or password in request body');
    }
    const user = await this.authService.validateUser(email, password);
    if (!user) {
      this.logger.warn(`LocalStrategy: Invalid credentials for email: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }
}
