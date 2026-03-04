import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Admin Time Slots')
@ApiBearerAuth()
@Controller('admin/time-slots')
@Throttle({ default: { limit: 500, ttl: 60000 } })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
export class AdminTimeSlotsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List time slots' })
  @ApiResponse({ status: 200, description: 'All time slots' })
  async findAll() {
    return this.prisma.timeSlot.findMany({
      orderBy: [{ startTime: 'asc' }],
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create time slot' })
  @ApiResponse({ status: 201, description: 'Time slot created' })
  async create(
    @Body() body: { startTime: string; endTime: string; isFullDay?: boolean },
  ) {
    return this.prisma.timeSlot.create({
      data: {
        startTime: body.startTime,
        endTime: body.endTime,
        isFullDay: body.isFullDay ?? false,
      },
    });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update time slot' })
  @ApiResponse({ status: 200, description: 'Time slot updated' })
  async update(
    @Param('id') id: string,
    @Body() body: { startTime?: string; endTime?: string; isFullDay?: boolean; isActive?: boolean },
  ) {
    return this.prisma.timeSlot.update({
      where: { id },
      data: body,
    });
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate time slot' })
  async activate(@Param('id') id: string) {
    return this.prisma.timeSlot.update({
      where: { id },
      data: { isActive: true },
    });
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate time slot' })
  async deactivate(@Param('id') id: string) {
    return this.prisma.timeSlot.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
