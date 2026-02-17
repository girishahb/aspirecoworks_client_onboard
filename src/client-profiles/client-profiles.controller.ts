import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ClientProfilesService } from './client-profiles.service';
import { UpdateClientProfileDto } from './dto/update-client-profile.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('Client Profiles')
@ApiBearerAuth()
@Controller('client-profiles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientProfilesController {
  constructor(private readonly clientProfilesService: ClientProfilesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a new client profile' })
  @ApiResponse({ status: 201, description: 'Client profile created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async create(@Body() body: any, @CurrentUser() user: any) {
    console.log('BODY RECEIVED:', body);

    const companyName = body?.companyName;
    const contactEmail = body?.contactEmail;

    if (!companyName || !contactEmail) {
      throw new BadRequestException({
        message: 'Missing fields',
        received: body,
      });
    }

    return this.clientProfilesService.create(
      {
        companyName,
        contactEmail,
        contactPhone: body?.contactPhone,
        taxId: body?.taxId,
        address: body?.address,
        city: body?.city,
        state: body?.state,
        zipCode: body?.zipCode,
        country: body?.country,
        notes: body?.notes,
      },
      user.id,
    );
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get all client profiles' })
  @ApiResponse({ status: 200, description: 'List of client profiles' })
  findAll(@CurrentUser() user: any) {
    return this.clientProfilesService.findAll(user.role, user.id);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get client profile by ID' })
  @ApiResponse({ status: 200, description: 'Client profile found' })
  @ApiResponse({ status: 404, description: 'Client profile not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.clientProfilesService.findOne(id, user.role, user.id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update client profile' })
  @ApiResponse({ status: 200, description: 'Client profile updated successfully' })
  @ApiResponse({ status: 404, description: 'Client profile not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  update(
    @Param('id') id: string,
    @Body() updateClientProfileDto: UpdateClientProfileDto,
    @CurrentUser() user: any,
  ) {
    return this.clientProfilesService.update(id, updateClientProfileDto, user.id, user.role);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update client profile onboarding stage (Super Admin/Admin/Manager)' })
  @ApiResponse({ status: 200, description: 'Stage updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid stage transition' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.clientProfilesService.updateStage(id, updateStatusDto.stage, user.id, user.role);
  }

  @Post(':id/confirm-payment')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Record payment success and move to KYC_IN_PROGRESS (Admin/Manager only)' })
  @ApiResponse({ status: 200, description: 'Payment confirmed; KYC uploads are now allowed' })
  @ApiResponse({ status: 400, description: 'Current stage is not PAYMENT_CONFIRMED' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  confirmPayment(@Param('id') id: string, @CurrentUser() user: any) {
    return this.clientProfilesService.confirmPayment(id, user.id, user.role);
  }

  @Post(':id/activate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Activate company (after agreement completion)',
    description:
      'Only allowed when onboarding stage is FINAL_AGREEMENT_SHARED. Sets activationDate, updates stage to ACTIVE, and sends activation email to company contact.',
  })
  @ApiResponse({ status: 200, description: 'Company activated' })
  @ApiResponse({ status: 400, description: 'Stage is not FINAL_AGREEMENT_SHARED' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  activateCompany(@Param('id') id: string, @CurrentUser() user: any) {
    return this.clientProfilesService.activateCompany(id, user.id, user.role);
  }

  @Post(':id/resend-invite')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Resend set-password invite to client' })
  @ApiResponse({ status: 200, description: 'Invite sent or already activated' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async resendInvite(@Param('id') id: string) {
    return this.clientProfilesService.resendInvite(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete client profile (Admin only)' })
  @ApiResponse({ status: 200, description: 'Client profile deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.clientProfilesService.remove(id, user.id, user.role);
  }
}
