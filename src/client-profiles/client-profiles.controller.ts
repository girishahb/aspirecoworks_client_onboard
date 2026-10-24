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
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ClientProfilesService } from './client-profiles.service';
import { UpdateClientProfileDto } from './dto/update-client-profile.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { ActivateCompanyDto } from './dto/activate-company.dto';
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
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.AGGREGATOR)
  @ApiOperation({ summary: 'Create a new client profile' })
  @ApiResponse({ status: 201, description: 'Client profile created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async create(@Body() body: any, @CurrentUser() user: any) {
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
        clientChannel: body?.clientChannel,
        aggregatorName: body?.aggregatorName,
        locationId: body?.locationId,
        vendorId: body?.vendorId,
        membershipType: body?.membershipType,
        officeType: body?.officeType,
        leadSource: body?.leadSource,
        contractMonths: body?.contractMonths,
        contactPersonName: body?.contactPersonName,
        contractStartDate: body?.contractStartDate,
        contractEndDate: body?.contractEndDate,
        booking: body?.booking,
        invoiceTo: body?.invoiceTo,
        saveInvoiceToProfile: body?.saveInvoiceToProfile,
      } as any,
      user.id,
      { role: user.role, aggregatorName: user.aggregatorName },
    );
  }

  @Get(':id/bookings')
  @Roles(
    UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.FINANCE,
    UserRole.AGGREGATOR,
  )
  @ApiOperation({
    summary: 'List aggregator bookings attached to a client profile',
    description:
      'Returns the AggregatorBooking rows for the given client. AGGREGATORs can only read bookings for clients they onboarded; admins can read any.',
  })
  @ApiResponse({ status: 200, description: 'List of bookings (may be empty)' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Client profile not found' })
  listBookings(@Param('id') id: string, @CurrentUser() user: any) {
    return this.clientProfilesService.listBookings(id, { id: user.id, role: user.role });
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.FINANCE, UserRole.AGGREGATOR)
  @ApiOperation({
    summary: 'Get client profiles',
    description:
      'Omit page for full list. Pass page (1-based) for paginated desk list (default pageSize=10).',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'clientChannel', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200, description: 'List of client profiles (or paginated page)' })
  findAll(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('q') q?: string,
    @Query('locationId') locationId?: string,
    @Query('clientChannel') clientChannel?: string,
    @Query('status') status?: string,
  ) {
    const pageNum = page != null && page !== '' ? Number(page) : undefined;
    const sizeNum = pageSize != null && pageSize !== '' ? Number(pageSize) : undefined;
    const statusFilter =
      status === 'active' ||
      status === 'inactive' ||
      status === 'pending' ||
      status === 'expired'
        ? status
        : undefined;
    return this.clientProfilesService.findAll(user.role, user.id, {
      page: Number.isFinite(pageNum) ? pageNum : undefined,
      pageSize: Number.isFinite(sizeNum) ? sizeNum : undefined,
      q,
      locationId,
      clientChannel,
      status: statusFilter,
    });
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.FINANCE, UserRole.AGGREGATOR)
  @ApiOperation({ summary: 'Get client profile by ID' })
  @ApiResponse({ status: 200, description: 'Client profile found' })
  @ApiResponse({ status: 404, description: 'Client profile not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.clientProfilesService.findOne(id, user.role, user.id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.AGGREGATOR)
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
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.FINANCE)
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
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.FINANCE)
  @ApiOperation({
    summary: 'Activate company (after agreement completion)',
    description:
      'Only allowed when onboarding stage is FINAL_AGREEMENT_SHARED. Sets activationDate, updates stage to ACTIVE, and sends activation email to company contact.',
  })
  @ApiResponse({ status: 200, description: 'Company activated' })
  @ApiResponse({ status: 400, description: 'Stage is not FINAL_AGREEMENT_SHARED' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  activateCompany(
    @Param('id') id: string,
    @Body() dto: ActivateCompanyDto,
    @CurrentUser() user: any,
  ) {
    return this.clientProfilesService.activateCompany(id, user.id, user.role, {
      contractStartDate: dto.contractStartDate,
      contractEndDate: dto.contractEndDate,
    });
  }

  @Post(':id/resend-invite')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.FINANCE, UserRole.AGGREGATOR)
  @ApiOperation({ summary: 'Resend set-password invite to client' })
  @ApiResponse({ status: 200, description: 'Invite sent or already activated' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async resendInvite(@Param('id') id: string, @CurrentUser() user: any) {
    if (user?.role === UserRole.AGGREGATOR) {
      // ownership check via findOne throws Forbidden when mismatch
      await this.clientProfilesService.findOne(id, user.role, user.id);
    }
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
