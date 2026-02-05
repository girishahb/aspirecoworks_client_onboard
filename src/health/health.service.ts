import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../storage/r2.service';
import { ConfigService } from '@nestjs/config';
import { RazorpayService } from '../payments/razorpay.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private prisma: PrismaService,
    private r2Service: R2Service,
    private config: ConfigService,
    private razorpayService: RazorpayService,
  ) {}

  async check(): Promise<{
    status: string;
    timestamp: string;
    checks: {
      database: { status: string; message?: string };
      storage: { status: string; message?: string };
      email: { status: string; message?: string };
    };
    razorpayMode?: 'test' | 'live';
  }> {
    const checks = {
      database: await this.checkDatabase(),
      storage: await this.checkStorage(),
      email: await this.checkEmail(),
    };

    const allHealthy = Object.values(checks).every((c) => c.status === 'ok');
    const status = allHealthy ? 'ok' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      checks,
      razorpayMode: this.razorpayService.getMode(),
    };
  }

  private async checkDatabase(): Promise<{ status: string; message?: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Database connection failed',
      };
    }
  }

  private async checkStorage(): Promise<{ status: string; message?: string }> {
    try {
      // Try to generate a test presigned URL (doesn't actually create a file)
      const testKey = 'health-check/test.txt';
      await this.r2Service.generateUploadUrl(testKey, 'text/plain', 60);
      return { status: 'ok' };
    } catch (error) {
      this.logger.error('Storage health check failed', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Storage service unavailable',
      };
    }
  }

  private async checkEmail(): Promise<{ status: string; message?: string }> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      return {
        status: 'warning',
        message: 'RESEND_API_KEY not configured',
      };
    }
    // Email service is configured (we don't test actual sending in health check)
    return { status: 'ok' };
  }
}
