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
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { RequestLoginDto } from './dto/request-login.dto';
import { Public } from '../common/decorators/public.decorator';
import { LocalAuthGuard } from './guards/local-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiOperation({ summary: 'Login user (password)' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async login(@Request() req: ExpressRequest & { user: any }) {
    return this.authService.login(req.user);
  }

  @Public()
  @Post('request-login')
  @ApiOperation({ summary: 'Request magic-link (passwordless) sign-in' })
  @ApiResponse({ status: 201, description: 'If account exists, sign-in link sent' })
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
}
