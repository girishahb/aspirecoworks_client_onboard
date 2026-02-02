import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Guard that blocks access in production.
 * Use on DEV-only endpoints (e.g. dev-login).
 */
@Injectable()
export class DevOnlyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const env = this.config.get<string>('NODE_ENV');
    if (env === 'production') {
      throw new ForbiddenException('This endpoint is not available in production');
    }
    return true;
  }
}
