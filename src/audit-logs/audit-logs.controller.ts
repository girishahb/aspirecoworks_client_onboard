import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get all audit logs (Admin/Manager only)' })
  @ApiResponse({ status: 200, description: 'List of audit logs' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  findAll(
    @Query('userId') userId?: string,
    @Query('clientProfileId') clientProfileId?: string,
    @Query('documentId') documentId?: string,
    @Query('entityType') entityType?: string,
    @CurrentUser() user?: any,
  ) {
    return this.auditLogsService.findAll(
      userId,
      clientProfileId,
      documentId,
      entityType,
      user?.role,
    );
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get audit log by ID (Admin/Manager only)' })
  @ApiResponse({ status: 200, description: 'Audit log found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.auditLogsService.findOne(id, user.role);
  }
}
