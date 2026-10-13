import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import {
  MOBILE_LOOKUP_ROLES,
  MOBILE_MAIL_NOTIFY_ROLES,
  MOBILE_WRITE_ROLES,
} from '../common/constants/roles';
import { MobileService } from './mobile.service';
import { CreateMobileClientDto, UpdateMobileClientDto } from './dto/mobile-client.dto';
import { MailNotifyDto } from './dto/mail-notify.dto';

@ApiTags('Mobile')
@ApiBearerAuth()
@Controller('mobile')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MobileController {
  constructor(private readonly mobileService: MobileService) {}

  @Get('meta/locations')
  @Roles(...MOBILE_LOOKUP_ROLES)
  @ApiOperation({ summary: 'List branch locations for mobile dropdowns' })
  listLocations() {
    return this.mobileService.listLocations();
  }

  @Get('meta/vendors')
  @Roles(...MOBILE_LOOKUP_ROLES)
  @ApiOperation({ summary: 'List vendors (optional locationId filter)' })
  listVendors(@Query('locationId') locationId?: string) {
    return this.mobileService.listVendors(locationId);
  }

  @Get('clients/lookup')
  @Roles(...MOBILE_LOOKUP_ROLES)
  @ApiOperation({ summary: 'Search clients (role-scoped DTO)' })
  lookup(
    @Query('q') q: string,
    @Query('limit') limit: string | undefined,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.mobileService.lookup(q, user.role, limit ? Number(limit) : 20);
  }

  @Get('clients/:id/status')
  @Roles(...MOBILE_LOOKUP_ROLES)
  @ApiOperation({ summary: 'Get client status card (role-scoped DTO)' })
  getStatus(@Param('id') id: string, @CurrentUser() user: { id: string; role: UserRole }) {
    return this.mobileService.getStatus(id, user.role);
  }

  @Post('clients')
  @Roles(...MOBILE_WRITE_ROLES)
  @ApiOperation({ summary: 'Create client from mobile (STAFF/FINANCE/ADMIN)' })
  create(@Body() dto: CreateMobileClientDto, @CurrentUser() user: { id: string; role: UserRole }) {
    return this.mobileService.create(dto, user);
  }

  @Patch('clients/:id')
  @Roles(...MOBILE_WRITE_ROLES)
  @ApiOperation({ summary: 'Update non-money client fields from mobile' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMobileClientDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.mobileService.update(id, dto, user);
  }

  @Post('clients/:id/mail-notify')
  @Roles(...MOBILE_MAIL_NOTIFY_ROLES)
  @ApiOperation({
    summary: 'Reception: notify client that physical mail was received (photo + email)',
  })
  notifyMail(
    @Param('id') id: string,
    @Body() dto: MailNotifyDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.mobileService.notifyMailReceivedFromBase64(id, dto, user);
  }
}
