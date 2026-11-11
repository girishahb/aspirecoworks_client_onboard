import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { VISITOR_ADMIN_ROLES } from '../common/constants/roles';
import { VisitorsService } from './visitors.service';

@ApiTags('Admin visitors')
@ApiBearerAuth()
@Controller('admin/visitors')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...VISITOR_ADMIN_ROLES)
export class AdminVisitorsController {
  constructor(private readonly visitorsService: VisitorsService) {}

  @Get()
  @ApiOperation({ summary: 'Search visitor visits (admin report)' })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['CHECKED_IN', 'CHECKED_OUT', 'all'] })
  list(
    @CurrentUser() user: { role: UserRole },
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('locationId') locationId?: string,
    @Query('q') q?: string,
    @Query('status') status?: 'CHECKED_IN' | 'CHECKED_OUT' | 'all',
  ) {
    return this.visitorsService.adminList(
      { from, to, locationId, q, status },
      user.role,
    );
  }

  @Get('export')
  @ApiOperation({ summary: 'Export visitor visits as Excel (.xlsx)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['CHECKED_IN', 'CHECKED_OUT', 'all'] })
  async exportExcel(
    @CurrentUser() user: { role: UserRole },
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('locationId') locationId?: string,
    @Query('q') q?: string,
    @Query('status') status?: 'CHECKED_IN' | 'CHECKED_OUT' | 'all',
  ) {
    const { buffer, fileName } = await this.visitorsService.exportExcel(
      { from, to, locationId, q, status },
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
