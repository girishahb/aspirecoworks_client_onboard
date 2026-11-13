import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { TicketsService } from './tickets.service';

@ApiTags('Public support')
@Controller('public/support')
@Throttle({ default: { limit: 30, ttl: 60000 } })
export class PublicTicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get('form')
  @Public()
  @ApiOperation({ summary: 'Location and issue groups for an active QR token' })
  form(@Query('t') token?: string) {
    return this.tickets.formContext(token || '');
  }

  @Post('tickets')
  @Public()
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @ApiOperation({ summary: 'Raise a support ticket from a QR code' })
  create(@Body() body: unknown) {
    return this.tickets.createPublic(body);
  }
}
