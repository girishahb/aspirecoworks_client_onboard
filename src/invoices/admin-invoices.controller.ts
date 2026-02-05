import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('Admin Invoices')
@ApiBearerAuth()
@Controller('admin/invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
export class AdminInvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @ApiOperation({
    summary: 'List all invoices',
    description: 'Returns paginated list of invoices with optional filters.',
  })
  @ApiQuery({ name: 'companyId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of invoices' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll(
    @Query('companyId') companyId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.invoicesService.findAll({
      companyId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':invoiceId/download')
  @ApiOperation({
    summary: 'Download invoice PDF',
    description: 'Returns a presigned download URL for the invoice PDF.',
  })
  @ApiResponse({ status: 200, description: 'Download URL generated' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async downloadInvoice(@Param('invoiceId') invoiceId: string) {
    return this.invoicesService.getDownloadUrl(invoiceId);
  }
}
