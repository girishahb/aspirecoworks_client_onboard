import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RazorpayService } from '../payments/razorpay.service';
import { EmailService } from '../email/email.service';
import { ResourceType } from '@prisma/client';
import { bookingConfirmation } from '../email/templates/booking-confirmation';

@Injectable()
export class PublicBookingsService {
  private readonly logger = new Logger(PublicBookingsService.name);

  constructor(
    private prisma: PrismaService,
    private razorpayService: RazorpayService,
    private emailService: EmailService,
  ) {}

  /**
   * Get Razorpay Key ID for client-side checkout (public booking). Returns null when not configured.
   */
  getRazorpayKeyId(): { keyId: string | null } {
    return { keyId: this.razorpayService.getKeyId() };
  }

  /**
   * Get pricing and available slots for a resource.
   * Only returns slots where isActive = true.
   */
  async getPricing(resourceId: string, date?: string) {
    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
      include: {
        location: true,
        pricing: true,
      },
    });

    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    if (!resource.isActive) {
      throw new BadRequestException('Resource is not available for booking');
    }

    // For DAY_PASS_DESK: only full-day slots; for rooms: only hourly slots
    const allSlots = await this.prisma.timeSlot.findMany({
      where: { isActive: true },
      orderBy: [{ startTime: 'asc' }],
    });

    const isDesk = resource.type === 'DAY_PASS_DESK';
    const slots = isDesk
      ? allSlots.filter((s) => (s as any).isFullDay === true)
      : allSlots.filter((s) => (s as any).isFullDay !== true);

    let availableSlots = slots;
    let remainingCapacity: number | null = null;
    let slotAvailability: Array<{ slotId: string; startTime: string; endTime: string; capacity: number; booked: number; remaining: number; isFull: boolean }> | null = null;
    if (date) {
      const availability = await this.getAvailabilityForDate(resource, date);
      availableSlots = slots.filter((s) => availability[s.id] !== false);
      slotAvailability = await this.getSlotAvailability(resourceId, date);
      if (isDesk && availableSlots.length > 0) {
        const slot = availableSlots[0];
        const { total } = await this.getDeskCapacityUsed(resource.id, new Date(date), slot.id);
        remainingCapacity = Math.max(0, resource.capacity - total);
      }
    }

    return {
      resource: {
        id: resource.id,
        type: resource.type,
        capacity: resource.capacity,
        location: resource.location,
      },
      pricing: resource.pricing
        ? {
            hourlyPrice: resource.pricing.hourlyPrice,
            dayPrice: resource.pricing.dayPrice,
          }
        : null,
      availableSlots,
      remainingCapacity,
      slotAvailability,
    };
  }

  /**
   * Slot-level availability for a resource on a date.
   * Only CONFIRMED bookings count. Reusable for API and internal logic.
   */
  async getSlotAvailability(
    resourceId: string,
    dateStr: string,
  ): Promise<
    Array<{
      slotId: string;
      startTime: string;
      endTime: string;
      capacity: number;
      booked: number;
      remaining: number;
      isFull: boolean;
    }>
  > {
    if (!dateStr || !dateStr.trim()) {
      throw new BadRequestException('date query is required (YYYY-MM-DD)');
    }
    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
    });
    if (!resource || !resource.isActive) {
      throw new NotFoundException('Resource not found or inactive');
    }
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);

    const isDesk = resource.type === 'DAY_PASS_DESK';
    const slots = await this.prisma.timeSlot.findMany({
      where: { isActive: true },
      orderBy: [{ startTime: 'asc' }],
    });
    const relevantSlots = isDesk
      ? slots.filter((s) => (s as any).isFullDay === true)
      : slots.filter((s) => (s as any).isFullDay !== true);

    const result: Array<{
      slotId: string;
      startTime: string;
      endTime: string;
      capacity: number;
      booked: number;
      remaining: number;
      isFull: boolean;
    }> = [];

    for (const slot of relevantSlots) {
      let booked: number;
      if (isDesk) {
        const agg = await this.prisma.booking.aggregate({
          where: {
            resourceId,
            date,
            timeSlotId: slot.id,
            status: 'CONFIRMED',
          },
          _sum: { quantity: true },
        });
        booked = agg._sum.quantity ?? 0;
      } else {
        const count = await this.prisma.booking.count({
          where: {
            resourceId,
            date,
            timeSlotId: slot.id,
            status: 'CONFIRMED',
          },
        });
        booked = count;
      }
      const capacity = resource.capacity;
      const remaining = Math.max(0, capacity - booked);
      result.push({
        slotId: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        capacity,
        booked,
        remaining,
        isFull: remaining <= 0,
      });
    }
    return result;
  }

  /**
   * Check availability for a resource on a given date.
   * Returns map of timeSlotId -> true if available, false if not.
   * For DAY_PASS_DESK: checks capacity. For rooms: slot is unavailable if any CONFIRMED booking exists.
   */
  private async getAvailabilityForDate(
    resource: { id: string; type: ResourceType; capacity: number },
    dateStr: string,
  ): Promise<Record<string, boolean>> {
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);

    const allSlots = await this.prisma.timeSlot.findMany({
      where: { isActive: true },
      orderBy: [{ startTime: 'asc' }],
    });

    const isDesk = resource.type === 'DAY_PASS_DESK';
    const slots = isDesk
      ? allSlots.filter((s: any) => s.isFullDay === true)
      : allSlots.filter((s: any) => s.isFullDay !== true);

    const result: Record<string, boolean> = {};
    for (const slot of slots) {
      if (resource.type === 'DAY_PASS_DESK') {
        const { total } = await this.getDeskCapacityUsed(resource.id, date, slot.id);
        result[slot.id] = total < resource.capacity;
      } else {
        const exists = await this.prisma.booking.findFirst({
          where: {
            resourceId: resource.id,
            date,
            timeSlotId: slot.id,
            status: 'CONFIRMED',
          },
        });
        result[slot.id] = !exists;
      }
    }
    return result;
  }

  /**
   * For rooms: reject if any CONFIRMED booking exists for resourceId + date + timeSlotId.
   * For desks: SUM(quantity) where CONFIRMED; if existing + requested > capacity, throw.
   */
  async checkAvailability(
    resourceId: string,
    date: Date,
    timeSlotId: string | null,
    quantity: number,
  ): Promise<void> {
    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
    });

    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    if (!resource.isActive) {
      throw new BadRequestException('Resource is not available');
    }

    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);

    if (resource.type === 'DAY_PASS_DESK') {
      const { total } = await this.getDeskCapacityUsed(resourceId, dateOnly, timeSlotId);
      if (total + quantity > resource.capacity) {
        throw new BadRequestException('Not enough seats available');
      }
    } else {
      const existing = await this.prisma.booking.findFirst({
        where: {
          resourceId,
          date: dateOnly,
          timeSlotId: timeSlotId ?? undefined,
          status: 'CONFIRMED',
        },
      });
      if (existing) {
        throw new BadRequestException('This slot is already booked');
      }
    }
  }

  private async getDeskCapacityUsed(
    resourceId: string,
    date: Date,
    timeSlotId: string | null,
  ): Promise<{ total: number }> {
    const agg = await this.prisma.booking.aggregate({
      where: {
        resourceId,
        date,
        timeSlotId: timeSlotId ?? undefined,
        status: 'CONFIRMED',
      },
      _sum: { quantity: true },
    });
    return { total: agg._sum.quantity ?? 0 };
  }

  /**
   * Expire stale PENDING bookings (expiresAt in the past). Only CONFIRMED bookings block seats.
   */
  private async expireStalePendingBookings(): Promise<void> {
    const result = await this.prisma.booking.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'CANCELLED' },
    });
    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} stale PENDING booking(s)`);
    }
  }

  /**
   * Every 5 minutes: expire PENDING bookings that have passed their expiresAt (or are older than 15 min as safety).
   */
  @Cron('*/5 * * * *', { name: 'expire-pending-bookings' })
  async runExpirePendingBookings(): Promise<void> {
    await this.expireStalePendingBookings();
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const result = await this.prisma.booking.updateMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: fifteenMinAgo },
      },
      data: { status: 'CANCELLED' },
    });
    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} PENDING booking(s) older than 15 minutes`);
    }
  }

  /**
   * Create Razorpay order and save PENDING booking(s).
   * Supports multiple slots (timeSlotIds): one order, one booking per slot; all share same razorpayOrderId.
   */
  async createOrder(dto: {
    resourceId: string;
    date: string;
    timeSlotId?: string;
    timeSlotIds?: string[];
    quantity: number;
    name: string;
    email: string;
    phone: string;
  }) {
    const date = new Date(dto.date);
    date.setHours(0, 0, 0, 0);

    // Block past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) {
      throw new BadRequestException('Cannot book for past dates');
    }

    const resource = await this.prisma.resource.findUnique({
      where: { id: dto.resourceId },
      include: { pricing: true, location: true },
    });

    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    if (!resource.isActive) {
      throw new BadRequestException('Resource is not available');
    }

    if (!resource.pricing) {
      throw new BadRequestException('Pricing not configured for this resource');
    }

    const isDesk = resource.type === 'DAY_PASS_DESK';
    const slotIds: string[] =
      (dto.timeSlotIds?.length ?? 0) > 0
        ? dto.timeSlotIds!
        : dto.timeSlotId
          ? [dto.timeSlotId]
          : [];
    if (slotIds.length === 0) {
      throw new BadRequestException('At least one time slot is required');
    }
    // For desks, only one slot (full day) is used
    const effectiveSlotIds = isDesk ? [slotIds[0]] : slotIds;

    await this.expireStalePendingBookings();

    let totalAmount: number;
    const hourlyPrice = resource.pricing.hourlyPrice ?? 0;
    const dayPrice = resource.pricing.dayPrice ?? 0;

    if (isDesk) {
      if (dayPrice <= 0) {
        throw new BadRequestException('Day price not configured for this resource');
      }
      totalAmount = dayPrice * dto.quantity;
    } else {
      if (hourlyPrice <= 0) {
        throw new BadRequestException('Hourly price not configured for this resource');
      }
      totalAmount = hourlyPrice * effectiveSlotIds.length;
    }

    if (totalAmount <= 0) {
      throw new BadRequestException('Invalid amount');
    }

    for (const slotId of effectiveSlotIds) {
      await this.checkAvailability(dto.resourceId, date, slotId, dto.quantity);
    }

    const order = await this.razorpayService.createOrder({
      amount: totalAmount,
      currency: 'INR',
      receipt: `book_${Date.now()}`,
      notes: {},
    });

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const perSlotAmount = isDesk ? totalAmount : totalAmount / effectiveSlotIds.length;
    const first = await this.prisma.booking.create({
      data: {
        resourceId: dto.resourceId,
        date,
        timeSlotId: effectiveSlotIds[0],
        quantity: dto.quantity,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        amountPaid: isDesk ? totalAmount : perSlotAmount,
        razorpayOrderId: order.id,
        status: 'PENDING',
        expiresAt,
      },
    });

    for (let i = 1; i < effectiveSlotIds.length; i++) {
      await this.prisma.booking.create({
        data: {
          resourceId: dto.resourceId,
          date,
          timeSlotId: effectiveSlotIds[i],
          quantity: dto.quantity,
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          amountPaid: perSlotAmount,
          razorpayOrderId: order.id,
          status: 'PENDING',
          expiresAt,
        },
      });
    }

    return {
      orderId: order.id,
      amount: order.amount,
      bookingId: first.id,
    };
  }

  /**
   * Handle Razorpay webhook: verify signature, find PENDING booking, confirm within transaction, send email.
   * Transaction-safe and production-ready. Always returns 200 to Razorpay (except invalid signature).
   */
  async handlePaymentSuccess(
    rawBody: string,
    signature: string,
  ): Promise<{ status: string; bookingId?: string; reason?: string }> {
    // STEP 1 — Verify signature first (uses raw body; never JSON.stringify for verification)
    const isValid = this.razorpayService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      throw new UnauthorizedException('Invalid Razorpay signature');
    }

    let payload: {
      event?: string;
      payload?: {
        payment?: { entity?: { id?: string; order_id?: string } };
        order?: { entity?: { id?: string } };
      };
    };
    try {
      payload = JSON.parse(rawBody);
    } catch {
      this.logger.warn('Public booking webhook: invalid JSON body');
      return { status: 'ignored', reason: 'Invalid JSON' };
    }

    // STEP 2 — Handle only success events (payment.captured or order.paid for Standard Checkout)
    const event = payload?.event;
    if (event !== 'payment.captured' && event !== 'order.paid') {
      return { status: 'ignored' };
    }

    const paymentEntity = payload.payload?.payment?.entity;
    const orderEntity = payload.payload?.order?.entity;
    const orderId =
      paymentEntity?.order_id ?? orderEntity?.id;
    const paymentId = paymentEntity?.id;

    if (!orderId) {
      this.logger.warn('Public booking webhook: missing order id');
      return { status: 'ignored', reason: 'Missing order id' };
    }

    // STEP 3 — Find all PENDING bookings for this order (multi-slot creates one per slot)
    const bookings = await this.prisma.booking.findMany({
      where: {
        razorpayOrderId: orderId,
        status: 'PENDING',
      },
      include: { resource: { include: { location: true } }, timeSlot: true },
      orderBy: { timeSlotId: 'asc' },
    });

    if (bookings.length === 0) {
      this.logger.log(`Public booking webhook: no PENDING bookings for order ${orderId}`);
      return { status: 'booking not found or already processed' };
    }

    const firstBooking = bookings[0];

    // STEP 4 — In one transaction, confirm every booking for this order
    try {
      await this.prisma.$transaction(async (tx) => {
        for (const booking of bookings) {
          const current = await tx.booking.findUnique({
            where: { id: booking.id },
            include: { resource: true },
          });
          if (!current || current.status !== 'PENDING') continue;

          if (
            current.resource.type === 'CONFERENCE_ROOM' ||
            current.resource.type === 'DISCUSSION_ROOM'
          ) {
            const conflict = await tx.booking.findFirst({
              where: {
                resourceId: current.resourceId,
                date: current.date,
                timeSlotId: current.timeSlotId,
                status: 'CONFIRMED',
              },
            });
            if (conflict) throw new Error(`Time slot already booked: ${current.timeSlotId}`);
          }
          if (current.resource.type === 'DAY_PASS_DESK') {
            const existing = await tx.booking.aggregate({
              _sum: { quantity: true },
              where: {
                resourceId: current.resourceId,
                date: current.date,
                timeSlotId: current.timeSlotId,
                status: 'CONFIRMED',
              },
            });
            const totalBooked = existing._sum.quantity ?? 0;
            if (totalBooked + current.quantity > current.resource.capacity) {
              throw new Error('Capacity exceeded');
            }
          }
          await tx.booking.update({
            where: { id: current.id },
            data: { status: 'CONFIRMED', paymentId },
          });
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Public booking webhook: transaction failed for order ${orderId} - ${msg}. Some bookings may remain PENDING.`,
      );
      return { status: 'acknowledged', reason: msg };
    }

    // STEP 5 — One confirmation email with combined slots and total amount
    const timeSlotText =
      bookings.length === 1
        ? firstBooking.timeSlot
          ? `${firstBooking.timeSlot.startTime} – ${firstBooking.timeSlot.endTime}`
          : 'Full day'
        : bookings
            .map((b) =>
              b.timeSlot ? `${b.timeSlot.startTime}–${b.timeSlot.endTime}` : 'Full day',
            )
            .join(', ');
    const totalPaid = bookings.reduce((sum, b) => sum + b.amountPaid, 0);
    try {
      const { subject, html, text } = bookingConfirmation({
        name: firstBooking.name,
        locationName: firstBooking.resource.location.name,
        address: firstBooking.resource.location.address,
        date: firstBooking.date,
        timeSlot: timeSlotText,
        resourceType: firstBooking.resource.type,
        amountPaid: totalPaid,
      });
      await this.emailService.sendEmail({
        to: firstBooking.email,
        subject,
        html,
        text,
      });
    } catch (err) {
      this.logger.error(`Failed to send booking confirmation email: ${err}`);
    }

    return { status: 'processed', bookingId: firstBooking.id };
  }

  /**
   * List locations (for public selection).
   */
  async getLocations() {
    return this.prisma.location.findMany({
      include: {
        resources: {
          where: { isActive: true },
          include: { pricing: true },
        },
      },
    });
  }

  /**
   * Get time slots (active only).
   */
  async getTimeSlots() {
    return this.prisma.timeSlot.findMany({
      where: { isActive: true },
      orderBy: [{ startTime: 'asc' }],
    });
  }
}
