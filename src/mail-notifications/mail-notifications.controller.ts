import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import {
  MailNotificationsService,
  type MailNotifyStatusFilter,
} from './mail-notifications.service';

@ApiTags('Mail notifications')
@ApiBearerAuth()
@Controller('admin/mail-notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.FINANCE)
export class MailNotificationsController {
  constructor(private readonly mailNotificationsService: MailNotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List reception mail email notifications (audit report)',
    description:
      'Default: successful sends in the last 7 days. Filter status=failed|all and date range as needed.',
  })
  @ApiQuery({ name: 'status', required: false, enum: ['success', 'failed', 'all'] })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'receptionistId', required: false })
  @ApiQuery({ name: 'clientProfileId', required: false })
  @ApiResponse({ status: 200, description: 'Mail notification rows' })
  list(
    @CurrentUser() user: { role: UserRole },
    @Query('status') status?: MailNotifyStatusFilter,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('receptionistId') receptionistId?: string,
    @Query('clientProfileId') clientProfileId?: string,
  ) {
    return this.mailNotificationsService.list(
      { status, from, to, receptionistId, clientProfileId },
      user.role,
    );
  }

  @Get('export')
  @ApiOperation({ summary: 'Export mail notifications as Excel (.xlsx)' })
  @ApiQuery({ name: 'status', required: false, enum: ['success', 'failed', 'all'] })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async exportExcel(
    @CurrentUser() user: { role: UserRole },
    @Res() res: Response,
    @Query('status') status?: MailNotifyStatusFilter,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('receptionistId') receptionistId?: string,
    @Query('clientProfileId') clientProfileId?: string,
  ) {
    const { buffer, fileName } = await this.mailNotificationsService.exportExcel(
      { status, from, to, receptionistId, clientProfileId },
      user.role,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }
}
