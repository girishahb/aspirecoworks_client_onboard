import { Body, Controller, Delete, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AggregatorProfileService } from './aggregator-profile.service';
import { UpsertAggregatorInvoiceProfileDto } from './dto/upsert-aggregator-invoice-profile.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('Aggregator / Profile')
@ApiBearerAuth()
@Controller('aggregator')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.AGGREGATOR)
export class AggregatorProfileController {
  constructor(private readonly service: AggregatorProfileService) {}

  @Get('invoice-profile')
  @ApiOperation({
    summary: 'Get my Invoice-To profile',
    description:
      'Returns the invoice-to entity the authenticated aggregator has saved. Returns null if not yet set.',
  })
  @ApiResponse({ status: 200, description: 'Invoice profile (or null)' })
  getMine(@CurrentUser() user: { id: string; role: UserRole }) {
    return this.service.getMyInvoiceProfile(user);
  }

  @Put('invoice-profile')
  @ApiOperation({
    summary: 'Create or update my Invoice-To profile',
    description:
      'Upserts the authenticated aggregator\'s Invoice-To profile. Fields are auto-filled on every new client registration.',
  })
  @ApiResponse({ status: 200, description: 'Profile saved' })
  upsertMine(
    @CurrentUser() user: { id: string; role: UserRole },
    @Body() dto: UpsertAggregatorInvoiceProfileDto,
  ) {
    return this.service.upsertMyInvoiceProfile(user, dto);
  }

  @Delete('invoice-profile')
  @ApiOperation({ summary: 'Delete my Invoice-To profile' })
  @ApiResponse({ status: 200, description: 'Profile deleted' })
  deleteMine(@CurrentUser() user: { id: string; role: UserRole }) {
    return this.service.deleteMyInvoiceProfile(user);
  }
}
