import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { RequestLoginDto } from './dto/request-login.dto';
import { DevLoginDto } from './dto/dev-login.dto';
import { Public } from '../common/decorators/public.decorator';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { DevOnlyGuard } from '../common/guards/dev-only.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 50, ttl: 60000 } }) // 50 requests per minute (lenient for dev)
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiOperation({ summary: 'Login user (password)' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async login(@Request() req: ExpressRequest & { user: any }) {
    return this.authService.login(req.user);
  }

  @Public()
  @Throttle({ default: { limit: 50, ttl: 60000 } }) // 50 requests per minute (lenient for dev)
  @Post('request-login')
  @ApiOperation({ summary: 'Request magic-link (passwordless) sign-in' })
  @ApiResponse({ status: 201, description: 'If account exists, sign-in link sent' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async requestLogin(@Body() dto: RequestLoginDto) {
    return this.authService.requestLogin(dto.email);
  }

  @Public()
  @Get('verify-login')
  @ApiOperation({ summary: 'Verify magic-link token and issue JWT' })
  @ApiResponse({ status: 200, description: 'JWT issued' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async verifyLogin(@Query('token') token: string) {
    return this.authService.verifyLogin(token ?? '');
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  // DEV ONLY – REMOVE BEFORE PRODUCTION
  @Public()
  @UseGuards(DevOnlyGuard)
  @Post('dev-login')
  @ApiOperation({ summary: '[DEV ONLY] Login by email only, create user if not exists' })
  @ApiResponse({ status: 201, description: 'JWT issued' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Not available in production' })
  async devLogin(@Body() dto: DevLoginDto) {
    return this.authService.devLogin(dto.email);
  }
}
