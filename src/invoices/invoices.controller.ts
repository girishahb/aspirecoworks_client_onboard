import { Controller, Get, Param, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('Client Invoices')
@ApiBearerAuth()
@Controller('client/invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT, UserRole.COMPANY_ADMIN)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get invoices for current user company',
    description: 'Returns paginated list of invoices for the authenticated client company.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of invoices' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getMyInvoices(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.invoicesService.findAll({
      companyId: user?.companyId || undefined,
      page,
      limit,
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
  async downloadInvoice(
    @Param('invoiceId') invoiceId: string,
    @CurrentUser() user: any,
  ) {
    // Verify invoice belongs to user's company
    const invoice = await this.invoicesService.findOne(invoiceId);
    if (invoice.companyId !== user.companyId) {
      throw new ForbiddenException('Invoice does not belong to your company');
    }
    return this.invoicesService.getDownloadUrl(invoiceId);
  }
}
