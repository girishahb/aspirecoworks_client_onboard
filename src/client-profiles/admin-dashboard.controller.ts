import { Controller, Get, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ClientProfilesService } from './client-profiles.service';
import { DashboardStatsDto } from './dto/dashboard-stats.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('Admin Dashboard')
@ApiBearerAuth()
@Controller('admin/dashboard')
@Throttle({ default: { limit: 500, ttl: 60000 } })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
export class AdminDashboardController {
  constructor(private readonly clientProfilesService: ClientProfilesService) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Get admin dashboard statistics',
    description:
      'Returns aggregated statistics including company counts by stage, payment metrics, and revenue data.',
  })
  @ApiResponse({ status: 200, description: 'Dashboard statistics', type: DashboardStatsDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getDashboardStats(): Promise<DashboardStatsDto> {
    return this.clientProfilesService.getDashboardStats();
  }
}
