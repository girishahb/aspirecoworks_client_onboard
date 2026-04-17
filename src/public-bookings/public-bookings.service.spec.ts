import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublicBookingsService } from './public-bookings.service';

describe('PublicBookingsService', () => {
  const baseResource = {
    id: 'resource-1',
    type: 'DAY_PASS_DESK',
    capacity: 10,
    isActive: true,
    pricing: {
      dayPrice: 500,
      hourlyPrice: null,
    },
    location: {
      id: 'location-1',
      name: 'Indiranagar',
      address: 'Bengaluru',
    },
  };

  function createService(configValues: Record<string, string | undefined> = {}) {
    const bookingCreate = jest.fn().mockResolvedValue({ id: 'booking-1' });
    const tx = { booking: { create: bookingCreate } };
    const prisma = {
      resource: { findUnique: jest.fn().mockResolvedValue(baseResource) },
      booking: {
        create: bookingCreate,
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn().mockImplementation(async (cb: (arg: typeof tx) => unknown) => cb(tx)),
    };
    const razorpay = {
      getKeyId: jest.fn().mockReturnValue('rzp_key'),
      createOrder: jest.fn().mockResolvedValue({ id: 'order_1', amount: 500, currency: 'INR' }),
      isConfigured: jest.fn().mockReturnValue(true),
      verifyWebhookSignature: jest.fn(),
    };
    const emailService = { sendEmail: jest.fn() };
    const configService = {
      get: jest.fn((key: string) => configValues[key]),
    } as unknown as ConfigService;
    const service = new PublicBookingsService(
      prisma as any,
      razorpay as any,
      emailService as any,
      configService,
    );
    jest.spyOn(service, 'checkAvailability').mockResolvedValue(undefined);
    return { service, prisma, razorpay };
  }

  it('rejects invalid internal coupon code', async () => {
    const { service } = createService({
      INTERNAL_BOOKING_COUPON_CODE: 'INTERNAL123',
      INTERNAL_BOOKING_ZERO_PAYMENT_ENABLED: 'true',
    });

    await expect(
      service.createOrder({
        resourceId: 'resource-1',
        date: '2030-01-01',
        timeSlotId: 'slot-1',
        quantity: 1,
        name: 'User',
        email: 'user@example.com',
        phone: '9999999999',
        couponCode: 'WRONG',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('confirms booking directly when internal coupon is valid and zero-amount order fails', async () => {
    const { service, prisma, razorpay } = createService({
      INTERNAL_BOOKING_COUPON_CODE: 'INTERNAL123',
      INTERNAL_BOOKING_ZERO_PAYMENT_ENABLED: 'true',
    });
    (razorpay.createOrder as jest.Mock).mockRejectedValueOnce(new Error('Amount should be atleast 100'));

    const result = await service.createOrder({
      resourceId: 'resource-1',
      date: '2030-01-01',
      timeSlotId: 'slot-1',
      quantity: 2,
      name: 'Internal User',
      email: 'internal@example.com',
      phone: '9999999999',
      couponCode: 'internal123',
    });

    expect(result.requiresPayment).toBe(false);
    expect(result.orderId).toBeNull();
    expect(prisma.$transaction).toHaveBeenCalled();
    expect((prisma.booking.create as jest.Mock).mock.calls[0][0].data.status).toBe('CONFIRMED');
    expect((prisma.booking.create as jest.Mock).mock.calls[0][0].data.bookingSource).toBe('INTERNAL_COUPON');
  });

  it('keeps existing paid flow for non-coupon bookings', async () => {
    const { service, prisma } = createService({
      INTERNAL_BOOKING_COUPON_CODE: 'INTERNAL123',
      INTERNAL_BOOKING_ZERO_PAYMENT_ENABLED: 'true',
    });

    const result = await service.createOrder({
      resourceId: 'resource-1',
      date: '2030-01-01',
      timeSlotId: 'slot-1',
      quantity: 1,
      name: 'Public User',
      email: 'public@example.com',
      phone: '9999999999',
    });

    expect(result.requiresPayment).toBe(true);
    expect(result.orderId).toBe('order_1');
    expect((prisma.booking.create as jest.Mock).mock.calls[0][0].data.status).toBe('PENDING');
    expect((prisma.booking.create as jest.Mock).mock.calls[0][0].data.bookingSource).toBe('PUBLIC');
  });
});
