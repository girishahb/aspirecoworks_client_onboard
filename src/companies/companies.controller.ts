import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateCompanyStatusDto } from './dto/update-status.dto';
import { UpdateCompanyRenewalDto } from './dto/update-renewal.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('Companies')
@ApiBearerAuth()
@Controller('companies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  // POST /companies (SUPER_ADMIN)
  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new company (SUPER_ADMIN only)' })
  @ApiResponse({ status: 201, description: 'Company created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  create(@Body() createCompanyDto: CreateCompanyDto, @CurrentUser() user: any) {
    return this.companiesService.create(createCompanyDto, user.id);
  }

  // GET /companies/me (CLIENT or COMPANY_ADMIN)
  @Get('me')
  @Roles(UserRole.CLIENT, UserRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Get current company for the logged-in CLIENT or COMPANY_ADMIN' })
  @ApiResponse({ status: 200, description: 'Company details' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  getMyCompany(@CurrentUser() user: any) {
    return this.companiesService.findMyCompany(user);
  }

  // PATCH /companies/me (CLIENT or COMPANY_ADMIN)
  @Patch('me')
  @Roles(UserRole.CLIENT, UserRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Update current company for the logged-in CLIENT or COMPANY_ADMIN' })
  @ApiResponse({ status: 200, description: 'Company updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  updateMyCompany(
    @Body() updateCompanyDto: UpdateCompanyDto,
    @CurrentUser() user: any,
  ) {
    return this.companiesService.updateMyCompany(user, updateCompanyDto);
  }

  // GET /companies (SUPER_ADMIN)
  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all companies (SUPER_ADMIN only)' })
  @ApiResponse({ status: 200, description: 'List of companies' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  findAll() {
    return this.companiesService.findAll();
  }

  // PATCH /companies/:id/status (SUPER_ADMIN)
  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update company onboarding status (SUPER_ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateCompanyStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.companiesService.updateStatus(id, updateStatusDto, user.id);
  }

  // PATCH /companies/:id/renewal (SUPER_ADMIN)
  @Patch(':id/renewal')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update company renewal information (SUPER_ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Renewal updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  updateRenewal(
    @Param('id') id: string,
    @Body() updateRenewalDto: UpdateCompanyRenewalDto,
    @CurrentUser() user: any,
  ) {
    return this.companiesService.updateRenewal(id, updateRenewalDto, user.id);
  }
}

