import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  Headers,
  UnauthorizedException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PublicBookingsService } from './public-bookings.service';
import { CreateOrderDto } from './dto/create-order.dto';
import type { Request } from 'express';

@ApiTags('Public Bookings')
@Controller('public')
export class PublicBookingsController {
  private readonly logger = new Logger(PublicBookingsController.name);

  constructor(private readonly service: PublicBookingsService) {}

  @Get('razorpay-key')
  @Public()
  @ApiOperation({ summary: 'Get Razorpay Key ID for client checkout' })
  @ApiResponse({ status: 200, description: 'Key ID when configured; null otherwise' })
  getRazorpayKey() {
    return this.service.getRazorpayKeyId();
  }

  @Get('locations')
  @Public()
  @ApiOperation({ summary: 'List locations' })
  @ApiResponse({ status: 200, description: 'List of locations with resources' })
  getLocations() {
    return this.service.getLocations();
  }

  @Get('time-slots')
  @Public()
  @ApiOperation({ summary: 'List time slots' })
  @ApiResponse({ status: 200, description: 'List of active time slots' })
  getTimeSlots() {
    return this.service.getTimeSlots();
  }

  @Get('availability')
  @Public()
  @ApiOperation({ summary: 'Slot-level availability for a resource on a date' })
  @ApiResponse({ status: 200, description: 'Slots with capacity, booked, remaining, isFull' })
  @ApiResponse({ status: 404, description: 'Resource not found' })
  getAvailability(
    @Query('resourceId') resourceId: string,
    @Query('date') date: string,
  ) {
    return this.service.getSlotAvailability(resourceId, date);
  }

  @Get('pricing/:resourceId')
  @Public()
  @ApiOperation({ summary: 'Get pricing and available slots' })
  @ApiResponse({ status: 200, description: 'Resource, pricing, and available slots' })
  @ApiResponse({ status: 404, description: 'Resource not found' })
  getPricing(
    @Param('resourceId') resourceId: string,
    @Query('date') date?: string,
  ) {
    return this.service.getPricing(resourceId, date);
  }

  @Post('create-order')
  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: 'Create Razorpay order for booking' })
  @ApiResponse({ status: 201, description: 'Order created, returns orderId and amount' })
  @ApiResponse({ status: 400, description: 'Validation or availability error' })
  createOrder(@Body() dto: CreateOrderDto) {
    return this.service.createOrder({
      resourceId: dto.resourceId,
      date: dto.date,
      timeSlotId: dto.timeSlotId,
      timeSlotIds: dto.timeSlotIds,
      quantity: dto.quantity,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      couponCode: dto.couponCode,
    });
  }

  @Post('webhook')
  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: 'Razorpay webhook for booking payments' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 401, description: 'Invalid signature' })
  async webhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-razorpay-signature') signature?: string,
  ) {
    const rawBody = req.body;
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      this.logger.warn('Public booking webhook: raw body missing or not a buffer');
      throw new BadRequestException('Invalid request body');
    }

    const rawBodyStr = rawBody.toString('utf8');

    if (!signature) {
      throw new UnauthorizedException('Missing x-razorpay-signature');
    }

    try {
      const result = await this.service.handlePaymentSuccess(rawBodyStr, signature);
      return result; // Always 200 for non-signature paths
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err; // 401 for invalid signature
      }
      this.logger.error('Public booking webhook failed', err);
      return { status: 'acknowledged' }; // 200 so Razorpay doesn't retry
    }
  }
}
