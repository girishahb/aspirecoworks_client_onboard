import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ClientProfilesService } from './client-profiles.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('Admin Companies')
@ApiBearerAuth()
@Controller('admin/companies')
@Throttle({ default: { limit: 500, ttl: 60000 } })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
export class AdminCompaniesController {
  constructor(private readonly clientProfilesService: ClientProfilesService) {}

  @Post(':companyId/activate')
  @ApiOperation({
    summary: 'Activate company (Admin only)',
    description:
      'Validates full onboarding (payment PAID, all KYC approved, final agreement exists, stage FINAL_AGREEMENT_SHARED). Sets onboardingStage = ACTIVE, activationDate, sends activation email, and locks onboarding permanently.',
  })
  @ApiResponse({ status: 200, description: 'Company activated' })
  @ApiResponse({ status: 400, description: 'Activation requirements not met or already active' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  activateCompany(@Param('companyId') companyId: string, @CurrentUser() user: any) {
    return this.clientProfilesService.activateCompany(companyId, user.id, user.role);
  }
}
