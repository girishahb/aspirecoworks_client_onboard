/**
 * Test 3 real-world booking scenarios:
 *
 * 1. Book same slot twice (room) → second must fail
 * 2. Book last 2 desks → third must fail
 * 3. Try payment twice → no duplicate confirm
 *
 * Usage:
 *   Ensure backend is running: npm run start:dev
 *   npx ts-node scripts/test-booking-scenarios.ts
 *
 * Requires: RAZORPAY_WEBHOOK_SECRET in .env
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const WEBHOOK_URL = process.env.API_URL || 'http://localhost:3000/public/webhook';

function loadEnv(): void {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

function getSecret(): string {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('RAZORPAY_WEBHOOK_SECRET required in .env');
  }
  return secret;
}

function signPayload(rawBody: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

function buildWebhookPayload(orderId: string, paymentId: string): object {
  return {
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: paymentId,
          amount: 120000,
          currency: 'INR',
          status: 'captured',
          order_id: orderId,
        },
      },
      order: {
        entity: {
          id: orderId,
        },
      },
    },
  };
}

async function sendWebhook(orderId: string, paymentId: string): Promise<{ status: number; data: unknown }> {
  const payload = buildWebhookPayload(orderId, paymentId);
  const rawBody = JSON.stringify(payload);
  const secret = getSecret();
  const signature = signPayload(rawBody, secret);

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': signature,
    },
    body: rawBody,
  });

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = await res.text();
  }
  return { status: res.status, data };
}

async function main() {
  console.log('\n=== Booking Scenarios Test ===\n');
  console.log('Webhook URL:', WEBHOOK_URL);
  getSecret(); // validate early

  // Get test data from DB
  const confRoom = await prisma.resource.findFirst({
    where: { type: 'CONFERENCE_ROOM' },
    include: { location: true },
  });
  const hourlySlot = await prisma.timeSlot.findFirst({
    where: { isFullDay: false },
  });
  const fullDaySlot = await prisma.timeSlot.findFirst({
    where: { isFullDay: true },
  });

  if (!confRoom || !hourlySlot || !fullDaySlot) {
    console.error('Missing seed data. Run: npm run prisma:seed');
    process.exit(1);
  }

  const testDate = new Date();
  testDate.setDate(testDate.getDate() + 14);
  testDate.setHours(0, 0, 0, 0);

  let passed = 0;
  let failed = 0;

  // ========== Scenario 1: Book same slot twice (room) → second must fail ==========
  console.log('\n1️⃣  Scenario 1: Book same room slot twice');
  console.log('   Creating 2 PENDING bookings for same conference room + date + slot...');

  const roomBooking1 = await prisma.booking.create({
    data: {
      resourceId: confRoom.id,
      date: testDate,
      timeSlotId: hourlySlot.id,
      quantity: 1,
      name: 'User One',
      email: 'user1@test.com',
      phone: '+919999999991',
      amountPaid: 1200,
      razorpayOrderId: `order_test_room_1_${Date.now()}`,
      status: 'PENDING',
    },
  });
  const roomBooking2 = await prisma.booking.create({
    data: {
      resourceId: confRoom.id,
      date: testDate,
      timeSlotId: hourlySlot.id,
      quantity: 1,
      name: 'User Two',
      email: 'user2@test.com',
      phone: '+919999999992',
      amountPaid: 1200,
      razorpayOrderId: `order_test_room_2_${Date.now()}`,
      status: 'PENDING',
    },
  });

  const r1 = await sendWebhook(roomBooking1.razorpayOrderId!, `pay_test_room_1_${Date.now()}`);
  const r2 = await sendWebhook(roomBooking2.razorpayOrderId!, `pay_test_room_2_${Date.now() + 1}`);

  const s1ok = r1.status >= 200 && r1.status < 300 && (r1.data as any)?.status === 'processed';
  const s2fail = r2.status >= 200 && r2.status < 300 && (r2.data as any)?.status === 'acknowledged';

  if (s1ok && s2fail) {
    console.log('   ✅ PASS: First confirmed, second acknowledged without confirm (slot no longer available)');
    passed++;
  } else {
    console.log('   ❌ FAIL: Expected first=200 processed, second=200 acknowledged');
    console.log('   First:', r1.status, r1.data);
    console.log('   Second:', r2.status, r2.data);
    failed++;
  }

  // Cleanup scenario 1
  await prisma.booking.deleteMany({ where: { id: { in: [roomBooking1.id, roomBooking2.id] } } });

  // ========== Scenario 2: Book last 2 desks → third must fail ==========
  console.log('\n2️⃣  Scenario 2: Book last 2 desks, third must fail');

  // Create temp desk with capacity 2
  const testLoc = await prisma.location.findFirst();
  if (!testLoc) {
    console.error('No location found');
    process.exit(1);
  }

  const testDesk = await prisma.resource.create({
    data: {
      locationId: testLoc.id,
      type: 'DAY_PASS_DESK',
      capacity: 2,
      isActive: true,
    },
  });
  await prisma.pricing.create({
    data: {
      resourceId: testDesk.id,
      dayPrice: 699,
    },
  });

  const deskDate = new Date(testDate);
  deskDate.setDate(deskDate.getDate() + 1);

  const deskB1 = await prisma.booking.create({
    data: {
      resourceId: testDesk.id,
      date: deskDate,
      timeSlotId: fullDaySlot.id,
      quantity: 1,
      name: 'Desk User 1',
      email: 'desk1@test.com',
      phone: '+919999999993',
      amountPaid: 699,
      razorpayOrderId: `order_test_desk_1_${Date.now()}`,
      status: 'PENDING',
    },
  });
  const deskB2 = await prisma.booking.create({
    data: {
      resourceId: testDesk.id,
      date: deskDate,
      timeSlotId: fullDaySlot.id,
      quantity: 1,
      name: 'Desk User 2',
      email: 'desk2@test.com',
      phone: '+919999999994',
      amountPaid: 699,
      razorpayOrderId: `order_test_desk_2_${Date.now()}`,
      status: 'PENDING',
    },
  });
  const deskB3 = await prisma.booking.create({
    data: {
      resourceId: testDesk.id,
      date: deskDate,
      timeSlotId: fullDaySlot.id,
      quantity: 1,
      name: 'Desk User 3',
      email: 'desk3@test.com',
      phone: '+919999999995',
      amountPaid: 699,
      razorpayOrderId: `order_test_desk_3_${Date.now()}`,
      status: 'PENDING',
    },
  });

  const d1 = await sendWebhook(deskB1.razorpayOrderId!, `pay_test_desk_1_${Date.now()}`);
  const d2 = await sendWebhook(deskB2.razorpayOrderId!, `pay_test_desk_2_${Date.now()}`);
  const d3 = await sendWebhook(deskB3.razorpayOrderId!, `pay_test_desk_3_${Date.now()}`);

  const d1ok = d1.status >= 200 && d1.status < 300 && (d1.data as any)?.status === 'processed';
  const d2ok = d2.status >= 200 && d2.status < 300 && (d2.data as any)?.status === 'processed';
  const d3fail = d3.status >= 200 && d3.status < 300 && (d3.data as any)?.status === 'acknowledged';

  if (d1ok && d2ok && d3fail) {
    console.log('   ✅ PASS: First two confirmed, third acknowledged without confirm (capacity exceeded)');
    passed++;
  } else {
    console.log('   ❌ FAIL: Expected first two processed, third acknowledged');
    console.log('   First:', d1.status, d1.data);
    console.log('   Second:', d2.status, d2.data);
    console.log('   Third:', d3.status, d3.data);
    failed++;
  }

  // Cleanup scenario 2
  await prisma.booking.deleteMany({
    where: { id: { in: [deskB1.id, deskB2.id, deskB3.id] } },
  });
  await prisma.pricing.deleteMany({ where: { resourceId: testDesk.id } });
  await prisma.resource.delete({ where: { id: testDesk.id } });

  // ========== Scenario 3: Try payment twice → no duplicate confirm ==========
  console.log('\n3️⃣  Scenario 3: Payment webhook called twice → no duplicate');

  const dupBooking = await prisma.booking.create({
    data: {
      resourceId: confRoom.id,
      date: testDate,
      timeSlotId: hourlySlot.id,
      quantity: 1,
      name: 'Dup User',
      email: 'dup@test.com',
      phone: '+919999999996',
      amountPaid: 1200,
      razorpayOrderId: `order_test_dup_${Date.now()}`,
      status: 'PENDING',
    },
  });

  const dupPayId = `pay_test_dup_${Date.now()}`;
  const dup1 = await sendWebhook(dupBooking.razorpayOrderId!, dupPayId);
  const dup2 = await sendWebhook(dupBooking.razorpayOrderId!, dupPayId);

  const dup1ok = dup1.status >= 200 && dup1.status < 300 && (dup1.data as any)?.status === 'processed';
  const dup2ok = dup2.status >= 200 && dup2.status < 300; // Second call returns 200 "booking not found or already processed"
  const dupCount = await prisma.booking.count({
    where: { id: dupBooking.id, status: 'CONFIRMED' },
  });

  if (dup1ok && dup2ok && dupCount === 1) {
    console.log('   ✅ PASS: Both calls returned 2xx, booking confirmed exactly once');
    passed++;
  } else {
    console.log('   ❌ FAIL: Expected both 2xx, single confirmation');
    console.log('   First:', dup1.status, dup1.data);
    console.log('   Second:', dup2.status, dup2.data);
    console.log('   Confirmed count:', dupCount);
    failed++;
  }

  await prisma.booking.delete({ where: { id: dupBooking.id } });

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Passed: ${passed}/3`);
  console.log(`Failed: ${failed}/3`);
  if (failed > 0) process.exit(1);
  console.log('\nAll scenarios passed ✓\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
