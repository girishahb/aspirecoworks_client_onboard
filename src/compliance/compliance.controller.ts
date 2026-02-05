import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ComplianceService } from './compliance.service';
import { CreateComplianceRequirementDto } from './dto/create-compliance-requirement.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('Compliance')
@ApiBearerAuth()
@Controller('compliance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Get('status')
  @Roles(UserRole.CLIENT, UserRole.COMPANY_ADMIN)
  @ApiOperation({
    summary: 'Get compliance status (company-scoped)',
    description:
      'Returns compliance status for the authenticated company. CLIENT or COMPANY_ADMIN only; company is determined by request.user.companyId.',
  })
  @ApiResponse({ status: 200, description: 'Compliance status (computed, not stored in DB)' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  getStatus(@CurrentUser() user: any) {
    return this.complianceService.getStatusForCurrentUser(user);
  }

  @Get('company/:companyId')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get compliance status for a company (SUPER_ADMIN only)',
    description:
      'Returns compliance status for the given company. SUPER_ADMIN only.',
  })
  @ApiResponse({ status: 200, description: 'Compliance status for the company' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  getStatusByCompanyId(
    @Param('companyId') companyId: string,
    @CurrentUser() user: any,
  ) {
    return this.complianceService.getStatusByCompanyId(companyId, user);
  }

  @Post('requirements')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Create a compliance requirement (SUPER_ADMIN only)',
    description:
      'Add a required document type. No hardcoded document types; all requirements come from this table.',
  })
  @ApiResponse({ status: 201, description: 'Compliance requirement created' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Requirement for this document type already exists' })
  createRequirement(
    @Body() createComplianceRequirementDto: CreateComplianceRequirementDto,
    @CurrentUser() user: any,
  ) {
    return this.complianceService.createRequirement(createComplianceRequirementDto, user);
  }
}