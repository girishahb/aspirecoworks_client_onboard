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

@ApiTags('Admin Pricing')
@ApiBearerAuth()
@Controller('admin/pricing')
@Throttle({ default: { limit: 500, ttl: 60000 } })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
export class AdminPricingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List all pricing' })
  @ApiResponse({ status: 200, description: 'Pricing list' })
  async findAll() {
    return this.prisma.pricing.findMany({
      include: { resource: { include: { location: true } } },
    });
  }

  @Get('resource/:resourceId')
  @ApiOperation({ summary: 'Get pricing for resource' })
  @ApiResponse({ status: 200, description: 'Pricing details' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findByResource(@Param('resourceId') resourceId: string) {
    const p = await this.prisma.pricing.findUnique({
      where: { resourceId },
      include: { resource: { include: { location: true } } },
    });
    if (!p) throw new NotFoundException('Pricing not found');
    return p;
  }

  @Post('campaign')
  @ApiOperation({ summary: 'Bulk update pricing by resource type' })
  @ApiResponse({ status: 200, description: 'Campaign pricing applied' })
  async applyCampaign(
    @Body()
    body: {
      conferenceHourly?: number;
      discussionHourly?: number;
      dayPassPrice?: number;
    },
  ) {
    let updated = 0;

    if (body.conferenceHourly != null && body.conferenceHourly >= 0) {
      const resources = await this.prisma.resource.findMany({
        where: { type: 'CONFERENCE_ROOM' },
      });
      for (const res of resources) {
        await this.prisma.pricing.upsert({
          where: { resourceId: res.id },
          create: {
            resourceId: res.id,
            hourlyPrice: body.conferenceHourly,
            dayPrice: null,
          },
          update: { hourlyPrice: body.conferenceHourly, dayPrice: null },
        });
        updated++;
      }
    }

    if (body.discussionHourly != null && body.discussionHourly >= 0) {
      const resources = await this.prisma.resource.findMany({
        where: { type: 'DISCUSSION_ROOM' },
      });
      for (const res of resources) {
        await this.prisma.pricing.upsert({
          where: { resourceId: res.id },
          create: {
            resourceId: res.id,
            hourlyPrice: body.discussionHourly,
            dayPrice: null,
          },
          update: { hourlyPrice: body.discussionHourly, dayPrice: null },
        });
        updated++;
      }
    }

    if (body.dayPassPrice != null && body.dayPassPrice >= 0) {
      const resources = await this.prisma.resource.findMany({
        where: { type: 'DAY_PASS_DESK' },
      });
      for (const res of resources) {
        await this.prisma.pricing.upsert({
          where: { resourceId: res.id },
          create: {
            resourceId: res.id,
            hourlyPrice: null,
            dayPrice: body.dayPassPrice,
          },
          update: { hourlyPrice: null, dayPrice: body.dayPassPrice },
        });
        updated++;
      }
    }

    return { updated };
  }

  @Post()
  @ApiOperation({ summary: 'Create pricing' })
  @ApiResponse({ status: 201, description: 'Pricing created' })
  async create(
    @Body()
    body: {
      resourceId: string;
      hourlyPrice?: number;
      dayPrice?: number;
    },
  ) {
    return this.prisma.pricing.upsert({
      where: { resourceId: body.resourceId },
      create: {
        resourceId: body.resourceId,
        hourlyPrice: body.hourlyPrice ?? null,
        dayPrice: body.dayPrice ?? null,
      },
      update: {
        hourlyPrice: body.hourlyPrice ?? undefined,
        dayPrice: body.dayPrice ?? undefined,
      },
    });
  }

  @Put('resource/:resourceId')
  @ApiOperation({ summary: 'Update pricing' })
  @ApiResponse({ status: 200, description: 'Pricing updated' })
  async update(
    @Param('resourceId') resourceId: string,
    @Body()
    body: {
      hourlyPrice?: number;
      dayPrice?: number;
    },
  ) {
    return this.prisma.pricing.upsert({
      where: { resourceId },
      create: {
        resourceId,
        hourlyPrice: body.hourlyPrice ?? null,
        dayPrice: body.dayPrice ?? null,
      },
      update: {
        hourlyPrice: body.hourlyPrice,
        dayPrice: body.dayPrice,
      },
    });
  }
}
