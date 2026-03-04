import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { AdminBookingsService } from './admin-bookings.service';

@ApiTags('Admin Booking Monitor')
@ApiBearerAuth()
@Controller('admin/bookings')
@Throttle({ default: { limit: 500, ttl: 60000 } })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminBookingsController {
  constructor(private readonly service: AdminBookingsService) {}

  @Get()
  @ApiOperation({ summary: 'List bookings with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Paginated bookings' })
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('locationId') locationId?: string,
    @Query('date') date?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.service.listBookings({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      locationId,
      date,
      status,
      search,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard stats' })
  @ApiResponse({ status: 200, description: 'todayRevenue, todayBookings, totalRevenue, occupancyPercent' })
  async getStats() {
    return this.service.getStats();
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Get revenue by date' })
  @ApiResponse({ status: 200, description: 'Array of { date, revenue }' })
  async getRevenue(@Query('range') range?: '7days' | '30days') {
    const validRange = range === '30days' ? '30days' : '7days';
    return this.service.getRevenueByDate(validRange);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get booking by ID' })
  @ApiResponse({ status: 200, description: 'Booking details' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getOne(@Param('id') id: string) {
    const booking = await this.service.getOne(id);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return booking;
  }
}
