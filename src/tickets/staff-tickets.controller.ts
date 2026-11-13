import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TICKET_DESK_ROLES } from '../common/constants/roles';
import { TicketsService, TicketActor } from './tickets.service';

@ApiTags('Staff support')
@ApiBearerAuth()
@Controller('staff/support')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...TICKET_DESK_ROLES)
export class StaffTicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get('summary')
  summary(@CurrentUser() user: TicketActor) {
    return this.tickets.deskSummary(user);
  }

  @Get('colleagues')
  colleagues(@CurrentUser() user: TicketActor) {
    return this.tickets.colleagues(user);
  }

  @Get('tickets')
  list(
    @CurrentUser() user: TicketActor,
    @Query('view') view?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.tickets.deskList(user, { view, q, page, pageSize });
  }

  @Get('tickets/:id')
  detail(@CurrentUser() user: TicketActor, @Param('id') id: string) {
    return this.tickets.getTicket(user, id, false);
  }

  @Post('tickets/:id/comments')
  comment(@CurrentUser() user: TicketActor, @Param('id') id: string, @Body() body: unknown) {
    return this.tickets.comment(user, id, body, false);
  }

  @Post('tickets/:id/take')
  take(@CurrentUser() user: TicketActor, @Param('id') id: string) {
    return this.tickets.take(user, id, false);
  }

  @Post('tickets/:id/assign')
  assign(@CurrentUser() user: TicketActor, @Param('id') id: string, @Body() body: unknown) {
    return this.tickets.assign(user, id, body, false);
  }

  @Post('tickets/:id/close')
  close(@CurrentUser() user: TicketActor, @Param('id') id: string, @Body() body: unknown) {
    return this.tickets.close(user, id, body, false);
  }

  @Post('tickets/:id/attachments')
  addAttachment(@CurrentUser() user: TicketActor, @Param('id') id: string, @Body() body: unknown) {
    return this.tickets.addAttachment(user, id, body, false);
  }

  @Get('tickets/:id/attachments/:attachmentId')
  async download(
    @CurrentUser() user: TicketActor,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.tickets.attachmentFile(user, id, attachmentId, false);
    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(file.fileName)}"`,
    });
    return new StreamableFile(file.buffer);
  }
}
