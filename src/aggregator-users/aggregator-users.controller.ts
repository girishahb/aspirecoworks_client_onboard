import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AggregatorUsersService } from './aggregator-users.service';
import { CreateAggregatorUserDto } from './dto/create-aggregator-user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('Admin / Aggregator Users')
@ApiBearerAuth()
@Controller('admin/aggregator-users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class AggregatorUsersController {
  constructor(private readonly service: AggregatorUsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create an aggregator user and send set-password invite' })
  @ApiResponse({ status: 201, description: 'Aggregator user created' })
  create(@Body() dto: CreateAggregatorUserDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List aggregator users with onboarded client counts' })
  findAll() {
    return this.service.findAll();
  }

  @Post(':id/resend-invite')
  @ApiOperation({ summary: 'Resend set-password invite to an aggregator user' })
  resendInvite(@Param('id') id: string) {
    return this.service.resendInvite(id);
  }
}
