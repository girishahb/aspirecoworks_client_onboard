import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface BookingListItem {
  id: string;
  locationName: string;
  resourceType: string;
  timeSlot: string | null;
  quantity: number;
  amountPaid: number;
  status: string;
  createdAt: Date;
  date: Date;
  name: string;
  email: string;
  phone: string;
}

export interface ListBookingsResult {
  data: BookingListItem[];
  total: number;
  page: number;
  totalPages: number;
}

export interface StatsResult {
  todayRevenue: number;
  todayBookings: number;
  totalRevenue: number;
  occupancyPercent: number;
}

export interface RevenueByDate {
  date: string;
  revenue: number;
}

@Injectable()
export class AdminBookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async listBookings(params: {
    page?: number;
    limit?: number;
    locationId?: string;
    date?: string;
    status?: string;
    search?: string;
  }): Promise<ListBookingsResult> {
    const page = Math.max(1, +(params.page ?? 1));
    const limit = Math.min(100, Math.max(1, +(params.limit ?? 20)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (params.locationId) {
      where.resource = { locationId: params.locationId };
    }
    if (params.date) {
      const d = new Date(params.date);
      d.setHours(0, 0, 0, 0);
      where.date = d;
    }
    if (params.status) {
      where.status = params.status;
    }
    if (params.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          resource: { include: { location: true } },
          timeSlot: true,
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    const data: BookingListItem[] = bookings.map((b) => ({
      id: b.id,
      locationName: b.resource.location.name,
      resourceType: b.resource.type,
      timeSlot: b.timeSlot
        ? `${b.timeSlot.startTime} – ${b.timeSlot.endTime}`
        : null,
      quantity: b.quantity,
      amountPaid: b.amountPaid,
      status: b.status,
      createdAt: b.createdAt,
      date: b.date,
      name: b.name,
      email: b.email,
      phone: b.phone,
    }));

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getStats(): Promise<StatsResult> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayAgg, todayCount, totalAgg, todayBookings, resources] = await Promise.all([
      this.prisma.booking.aggregate({
        where: {
          status: 'CONFIRMED',
          date: today,
        },
        _sum: { amountPaid: true },
      }),
      this.prisma.booking.count({
        where: {
          status: 'CONFIRMED',
          date: today,
        },
      }),
      this.prisma.booking.aggregate({
        where: { status: 'CONFIRMED' },
        _sum: { amountPaid: true },
      }),
      this.prisma.booking.findMany({
        where: {
          status: 'CONFIRMED',
          date: today,
        },
        include: { resource: true },
      }),
      this.prisma.resource.findMany({
        where: { isActive: true },
        select: { capacity: true },
      }),
    ]);

    const todayRevenue = todayAgg._sum.amountPaid ?? 0;
    const totalRevenue = totalAgg._sum.amountPaid ?? 0;

    // Total booked capacity today: rooms = 1 per booking, desks = quantity
    let totalBookedToday = 0;
    for (const b of todayBookings) {
      if (b.resource.type === 'DAY_PASS_DESK') {
        totalBookedToday += b.quantity;
      } else {
        totalBookedToday += 1;
      }
    }

    // Total available capacity across all active resources
    const totalAvailableCapacity = resources.reduce((sum, r) => sum + r.capacity, 0);

    const occupancyPercent =
      totalAvailableCapacity > 0 ? (totalBookedToday / totalAvailableCapacity) * 100 : 0;

    return {
      todayRevenue,
      todayBookings: todayCount,
      totalRevenue,
      occupancyPercent: Math.round(occupancyPercent * 100) / 100,
    };
  }

  async getRevenueByDate(range: '7days' | '30days'): Promise<RevenueByDate[]> {
    const days = range === '7days' ? 7 : 30;
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - days + 1);
    start.setHours(0, 0, 0, 0);

    const bookings = await this.prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        date: { gte: start, lte: end },
      },
      select: { date: true, amountPaid: true },
    });

    const revenueByDate: Record<string, number> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      revenueByDate[dateStr] = 0;
    }

    for (const b of bookings) {
      const dateStr = b.date instanceof Date ? b.date.toISOString().slice(0, 10) : String(b.date).slice(0, 10);
      if (dateStr in revenueByDate) {
        revenueByDate[dateStr] += b.amountPaid;
      }
    }

    return Object.entries(revenueByDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({ date, revenue }));
  }

  async getOne(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        resource: { include: { location: true } },
        timeSlot: true,
      },
    });
    return booking;
  }
}
