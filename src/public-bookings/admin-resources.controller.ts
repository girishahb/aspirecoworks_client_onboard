import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
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
import { PrismaService } from '../prisma/prisma.service';
import { ResourceType } from '@prisma/client';

@ApiTags('Admin Resources')
@ApiBearerAuth()
@Controller('admin/resources')
@Throttle({ default: { limit: 500, ttl: 60000 } })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
export class AdminResourcesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List resources' })
  @ApiResponse({ status: 200, description: 'Resources list' })
  async findAll(@Query('locationId') locationId?: string) {
    const where = locationId ? { locationId } : {};
    return this.prisma.resource.findMany({
      where,
      include: { location: true, pricing: true },
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get resource by ID' })
  @ApiResponse({ status: 200, description: 'Resource details' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findOne(@Param('id') id: string) {
    const r = await this.prisma.resource.findUnique({
      where: { id },
      include: { location: true, pricing: true },
    });
    if (!r) throw new NotFoundException('Resource not found');
    return r;
  }

  @Post()
  @ApiOperation({ summary: 'Create resource' })
  @ApiResponse({ status: 201, description: 'Resource created' })
  async create(
    @Body()
    body: {
      locationId: string;
      type: ResourceType;
      capacity: number;
      isActive?: boolean;
    },
  ) {
    return this.prisma.resource.create({
      data: {
        locationId: body.locationId,
        type: body.type,
        capacity: body.capacity,
        isActive: body.isActive ?? true,
      },
    });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update resource' })
  @ApiResponse({ status: 200, description: 'Resource updated' })
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      locationId?: string;
      type?: ResourceType;
      capacity?: number;
      isActive?: boolean;
    },
  ) {
    return this.prisma.resource.update({
      where: { id },
      data: body,
    });
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate resource' })
  @ApiResponse({ status: 200, description: 'Resource activated' })
  async activate(@Param('id') id: string) {
    return this.prisma.resource.update({
      where: { id },
      data: { isActive: true },
    });
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate resource' })
  @ApiResponse({ status: 200, description: 'Resource deactivated' })
  async deactivate(@Param('id') id: string) {
    return this.prisma.resource.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
