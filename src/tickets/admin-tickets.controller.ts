import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
import { TICKET_ADMIN_ROLES, TICKET_SETTINGS_ROLES } from '../common/constants/roles';
import { TicketsService, TicketActor } from './tickets.service';

@ApiTags('Admin support')
@ApiBearerAuth()
@Controller('admin/support')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminTicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get('colleagues')
  @Roles(...TICKET_ADMIN_ROLES)
  colleagues(@CurrentUser() user: TicketActor) {
    return this.tickets.colleagues(user);
  }

  @Get('summary')
  @Roles(...TICKET_ADMIN_ROLES)
  summary() {
    return this.tickets.adminSummary();
  }

  @Get('tickets/export')
  @Roles(...TICKET_ADMIN_ROLES)
  async export(
    @Query() query: Record<string, string | undefined>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const buffer = await this.tickets.exportExcel(query);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="support-tickets.xlsx"',
    });
    return new StreamableFile(buffer);
  }

  @Get('tickets')
  @Roles(...TICKET_ADMIN_ROLES)
  list(@Query() query: Record<string, string | undefined>) {
    return this.tickets.adminList(query);
  }

  @Get('tickets/:id')
  @Roles(...TICKET_ADMIN_ROLES)
  detail(@CurrentUser() user: TicketActor, @Param('id') id: string) {
    return this.tickets.getTicket(user, id, true);
  }

  @Post('tickets/:id/comments')
  @Roles(...TICKET_ADMIN_ROLES)
  comment(@CurrentUser() user: TicketActor, @Param('id') id: string, @Body() body: unknown) {
    return this.tickets.comment(user, id, body, true);
  }

  @Post('tickets/:id/take')
  @Roles(...TICKET_ADMIN_ROLES)
  take(@CurrentUser() user: TicketActor, @Param('id') id: string) {
    return this.tickets.take(user, id, true);
  }

  @Post('tickets/:id/assign')
  @Roles(...TICKET_ADMIN_ROLES)
  assign(@CurrentUser() user: TicketActor, @Param('id') id: string, @Body() body: unknown) {
    return this.tickets.assign(user, id, body, true);
  }

  @Post('tickets/:id/close')
  @Roles(...TICKET_ADMIN_ROLES)
  close(@CurrentUser() user: TicketActor, @Param('id') id: string, @Body() body: unknown) {
    return this.tickets.close(user, id, body, true);
  }

  @Post('tickets/:id/reopen')
  @Roles(...TICKET_ADMIN_ROLES)
  reopen(@CurrentUser() user: TicketActor, @Param('id') id: string, @Body() body: unknown) {
    return this.tickets.reopen(user, id, body);
  }

  @Post('tickets/:id/attachments')
  @Roles(...TICKET_ADMIN_ROLES)
  addAttachment(@CurrentUser() user: TicketActor, @Param('id') id: string, @Body() body: unknown) {
    return this.tickets.addAttachment(user, id, body, true);
  }

  @Get('tickets/:id/attachments/:attachmentId')
  @Roles(...TICKET_ADMIN_ROLES)
  async download(
    @CurrentUser() user: TicketActor,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.tickets.attachmentFile(user, id, attachmentId, true);
    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(file.fileName)}"`,
    });
    return new StreamableFile(file.buffer);
  }

  @Get('settings')
  @Roles(...TICKET_SETTINGS_ROLES)
  settings() {
    return this.tickets.settings();
  }

  @Post('groups')
  @Roles(...TICKET_SETTINGS_ROLES)
  createGroup(@Body() body: unknown) {
    return this.tickets.createGroup(body);
  }

  @Patch('groups/:id')
  @Roles(...TICKET_SETTINGS_ROLES)
  updateGroup(@Param('id') id: string, @Body() body: unknown) {
    return this.tickets.updateGroup(id, body);
  }

  @Put('groups/:id/route')
  @Roles(...TICKET_SETTINGS_ROLES)
  saveRoute(@Param('id') id: string, @Body() body: unknown) {
    return this.tickets.saveRoute(id, body);
  }

  @Post('qr')
  @Roles(...TICKET_SETTINGS_ROLES)
  createQr(@CurrentUser() user: TicketActor, @Body() body: unknown) {
    return this.tickets.createQr(user, body);
  }

  @Patch('qr/:id')
  @Roles(...TICKET_SETTINGS_ROLES)
  updateQr(@Param('id') id: string, @Body() body: unknown) {
    return this.tickets.updateQr(id, body);
  }

  @Post('qr/:id/regenerate')
  @Roles(...TICKET_SETTINGS_ROLES)
  regenerate(@Param('id') id: string) {
    return this.tickets.regenerateQr(id);
  }

  @Get('qr/posters')
  @Roles(...TICKET_SETTINGS_ROLES)
  async allPosters(@Res({ passthrough: true }) res: Response) {
    const file = await this.tickets.allQrPosters();
    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.fileName}"`,
    });
    return new StreamableFile(file.buffer);
  }

  @Get('qr/:id/poster')
  @Roles(...TICKET_SETTINGS_ROLES)
  async poster(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const file = await this.tickets.qrPoster(id);
    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.fileName}"`,
    });
    return new StreamableFile(file.buffer);
  }

  @Get('qr/:id/image')
  @Roles(...TICKET_ADMIN_ROLES)
  async image(
    @Param('id') id: string,
    @Query('format') format: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.tickets.qrImage(id, format === 'svg' ? 'svg' : 'png');
    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.fileName}"`,
    });
    return new StreamableFile(file.buffer);
  }

  @Patch('reception/:userId/location')
  @Roles(...TICKET_SETTINGS_ROLES)
  setHome(@Param('userId') userId: string, @Body() body: unknown) {
    return this.tickets.setReceptionHome(userId, body);
  }
}
