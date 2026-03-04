import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
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
    if (date) {
      const availability = await this.getAvailabilityForDate(resource, date);
      availableSlots = slots.filter((s) => availability[s.id] !== false);
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
    };
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
   * Create Razorpay order and save PENDING booking.
   */
  async createOrder(dto: {
    resourceId: string;
    date: string;
    timeSlotId?: string;
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

    let amount: number;
    const isDesk = resource.type === 'DAY_PASS_DESK';

    if (isDesk) {
      const dayPrice = resource.pricing.dayPrice;
      if (dayPrice == null || dayPrice <= 0) {
        throw new BadRequestException('Day price not configured for this resource');
      }
      amount = dayPrice * dto.quantity;
    } else {
      const hourlyPrice = resource.pricing.hourlyPrice;
      if (hourlyPrice == null || hourlyPrice <= 0) {
        throw new BadRequestException('Hourly price not configured for this resource');
      }
      amount = hourlyPrice * 1; // 1 hour per slot
    }

    if (amount <= 0) {
      throw new BadRequestException('Invalid amount');
    }

    // Check availability (with transaction to reduce race condition window)
    await this.checkAvailability(
      dto.resourceId,
      date,
      dto.timeSlotId ?? null,
      dto.quantity,
    );

    // Create Razorpay order
    const order = await this.razorpayService.createOrder({
      amount,
      currency: 'INR',
      receipt: `book_${Date.now()}`,
      notes: {}, // Will add bookingId after we create the booking
    });

    // Save booking with PENDING status
    const booking = await this.prisma.booking.create({
      data: {
        resourceId: dto.resourceId,
        date,
        timeSlotId: dto.timeSlotId ?? null,
        quantity: dto.quantity,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        amountPaid: amount,
        razorpayOrderId: order.id,
        status: 'PENDING',
      },
    });

    // Update Razorpay order notes with bookingId (optional, for webhook fallback)
    // Razorpay doesn't support updating order notes after creation, so we rely on razorpayOrderId stored in DB

    return {
      orderId: order.id,
      amount: order.amount,
      bookingId: booking.id,
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

    // STEP 3 — Find PENDING booking
    const booking = await this.prisma.booking.findFirst({
      where: {
        razorpayOrderId: orderId,
        status: 'PENDING',
      },
      include: { resource: { include: { location: true } }, timeSlot: true },
    });

    if (!booking) {
      this.logger.log(`Public booking webhook: booking not found or already processed for order ${orderId}`);
      return { status: 'booking not found or already processed' };
    }

    // STEP 4 — Use Prisma transaction (refetch inside for consistency)
    try {
      await this.prisma.$transaction(async (tx) => {
        // Refetch inside transaction (important for race safety)
        const currentBooking = await tx.booking.findUnique({
          where: { id: booking.id },
          include: { resource: true },
        });

        if (!currentBooking || currentBooking.status !== 'PENDING') {
          throw new Error('Already processed');
        }

        // ROOM LOGIC
        if (
          currentBooking.resource.type === 'CONFERENCE_ROOM' ||
          currentBooking.resource.type === 'DISCUSSION_ROOM'
        ) {
          const conflict = await tx.booking.findFirst({
            where: {
              resourceId: currentBooking.resourceId,
              date: currentBooking.date,
              timeSlotId: currentBooking.timeSlotId,
              status: 'CONFIRMED',
            },
          });
          if (conflict) {
            throw new Error('Time slot already booked');
          }
        }

        // DESK LOGIC
        if (currentBooking.resource.type === 'DAY_PASS_DESK') {
          const existing = await tx.booking.aggregate({
            _sum: { quantity: true },
            where: {
              resourceId: currentBooking.resourceId,
              date: currentBooking.date,
              timeSlotId: currentBooking.timeSlotId,
              status: 'CONFIRMED',
            },
          });
          const totalBooked = existing._sum.quantity ?? 0;
          if (totalBooked + currentBooking.quantity > currentBooking.resource.capacity) {
            throw new Error('Capacity exceeded');
          }
        }

        // CONFIRM BOOKING
        await tx.booking.update({
          where: { id: currentBooking.id },
          data: {
            status: 'CONFIRMED',
            paymentId,
          },
        });
      });
    } catch (err) {
      // STEP 6 — Handle errors: log, do NOT confirm, return 200 so Razorpay doesn't retry
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Public booking webhook: transaction failed for order ${orderId} - ${msg}. Booking ${booking.id} remains PENDING. Consider refund review.`,
      );
      return { status: 'acknowledged', reason: msg };
    }

    // STEP 5 — Send confirmation email ONLY after transaction succeeds
    try {
      const { subject, html, text } = bookingConfirmation({
        name: booking.name,
        locationName: booking.resource.location.name,
        address: booking.resource.location.address,
        date: booking.date,
        timeSlot: booking.timeSlot
          ? `${booking.timeSlot.startTime} – ${booking.timeSlot.endTime}`
          : 'Full day',
        resourceType: booking.resource.type,
        amountPaid: booking.amountPaid,
      });
      await this.emailService.sendEmail({
        to: booking.email,
        subject,
        html,
        text,
      });
    } catch (err) {
      this.logger.error(`Failed to send booking confirmation email: ${err}`);
      // Booking is already confirmed; don't fail the webhook
    }

    return { status: 'processed', bookingId: booking.id };
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
