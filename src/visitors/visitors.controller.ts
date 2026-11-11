import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { VISITOR_DESK_ROLES } from '../common/constants/roles';
import { VisitorsService } from './visitors.service';
import { CheckInVisitorDto } from './dto/check-in-visitor.dto';

@ApiTags('Visitors')
@ApiBearerAuth()
@Controller('visitors')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...VISITOR_DESK_ROLES)
export class VisitorsController {
  constructor(private readonly visitorsService: VisitorsService) {}

  @Get('consent-meta')
  @ApiOperation({ summary: 'Aadhaar consent text version + retention note' })
  consentMeta() {
    return this.visitorsService.getConsentMeta();
  }

  @Post('check-in')
  @ApiOperation({
    summary: 'Staff visitor check-in (details + face + signature + optional Aadhaar)',
  })
  @ApiResponse({ status: 201, description: 'Visitor checked in' })
  checkIn(
    @Body() dto: CheckInVisitorDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.visitorsService.checkIn(dto, user);
  }

  @Get('today')
  @ApiOperation({ summary: 'List today’s visitor visits' })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'date', required: false, description: 'YYYY-MM-DD (UTC day)' })
  listToday(
    @Query('locationId') locationId?: string,
    @Query('date') date?: string,
  ) {
    return this.visitorsService.listToday({ locationId, date });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Visitor visit detail' })
  findOne(@Param('id') id: string) {
    return this.visitorsService.findOne(id);
  }

  @Post(':id/checkout')
  @ApiOperation({ summary: 'Mark visitor checked out' })
  checkout(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.visitorsService.checkout(id, user);
  }

  @Get(':id/media/:kind')
  @ApiOperation({ summary: 'Private stream of face / signature / aadhaar photo' })
  async media(
    @Param('id') id: string,
    @Param('kind') kind: string,
  ): Promise<StreamableFile> {
    if (kind !== 'face' && kind !== 'signature' && kind !== 'aadhaar') {
      throw new BadRequestException('Invalid media kind');
    }
    const { buffer, contentType } = await this.visitorsService.getMediaBuffer(
      id,
      kind,
    );
    return new StreamableFile(buffer, {
      type: contentType,
      disposition: `inline; filename="${kind}-${id}"`,
    });
  }
}
