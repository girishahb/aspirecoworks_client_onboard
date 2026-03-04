import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
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

@ApiTags('Admin Locations')
@ApiBearerAuth()
@Controller('admin/locations')
@Throttle({ default: { limit: 500, ttl: 60000 } })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
export class AdminLocationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List locations' })
  @ApiResponse({ status: 200, description: 'All locations' })
  async findAll() {
    return this.prisma.location.findMany({
      include: { resources: { include: { pricing: true } } },
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get location by ID' })
  @ApiResponse({ status: 200, description: 'Location with resources' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findOne(@Param('id') id: string) {
    const loc = await this.prisma.location.findUnique({
      where: { id },
      include: { resources: { include: { pricing: true } } },
    });
    if (!loc) throw new NotFoundException('Location not found');
    return loc;
  }

  @Post()
  @ApiOperation({ summary: 'Create location' })
  @ApiResponse({ status: 201, description: 'Location created' })
  async create(@Body() body: { name: string; address: string }) {
    return this.prisma.location.create({
      data: { name: body.name, address: body.address },
    });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update location' })
  @ApiResponse({ status: 200, description: 'Location updated' })
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; address?: string },
  ) {
    return this.prisma.location.update({
      where: { id },
      data: { name: body.name, address: body.address },
    });
  }
}
