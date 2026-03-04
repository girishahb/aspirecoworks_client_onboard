import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user (password reset on every seed run so Admin123! always works)
  const adminPassword = await bcrypt.hash('Admin123!', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@aspirecoworks.com' },
    update: { passwordHash: adminPassword },
    create: {
      email: 'admin@aspirecoworks.com',
      passwordHash: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      isActive: true,
    },
  });

  // Create manager user
  const managerPassword = await bcrypt.hash('Manager123!', 10);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@aspirecoworks.com' },
    update: { passwordHash: managerPassword },
    create: {
      email: 'manager@aspirecoworks.com',
      passwordHash: managerPassword,
      firstName: 'Manager',
      lastName: 'User',
      role: 'MANAGER',
      isActive: true,
    },
  });

  // Create sample client profile (for Dashboard testing: COMPANY_ADMIN uses this)
  const clientProfile = await prisma.clientProfile.upsert({
    where: { taxId: 'TAX123456' },
    update: {},
    create: {
      companyName: 'Example Corp',
      contactEmail: 'contact@example.com',
      contactPhone: '+1234567890',
      taxId: 'TAX123456',
      address: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'USA',
      onboardingStage: 'ADMIN_CREATED',
      notes: 'Sample client profile for testing',
      createdById: admin.id,
    },
  });

  // Renewal date 30 days from now so Dashboard shows "upcoming" message
  const renewalDate = new Date();
  renewalDate.setDate(renewalDate.getDate() + 30);
  await prisma.clientProfile.update({
    where: { id: clientProfile.id },
    data: { renewalDate, renewalStatus: 'ACTIVE' },
  });

  // Company admin linked to Example Corp — use this to test Dashboard (activation, renewal, messages)
  const companyAdminPassword = await bcrypt.hash('Client123!', 10);
  const companyAdmin = await prisma.user.upsert({
    where: { email: 'company-admin@example.com' },
    update: {
      companyId: clientProfile.id,
      role: 'COMPANY_ADMIN',
      passwordHash: companyAdminPassword,
    },
    create: {
      email: 'company-admin@example.com',
      passwordHash: companyAdminPassword,
      firstName: 'Company',
      lastName: 'Admin',
      role: 'COMPANY_ADMIN',
      companyId: clientProfile.id,
      isActive: true,
    },
  });

  // Create CLIENT user linked to Example Corp
  const clientPassword = await bcrypt.hash('Client123!', 10);
  const client = await prisma.user.upsert({
    where: { email: 'client@example.com' },
    update: {
      companyId: clientProfile.id,
      role: 'CLIENT',
      passwordHash: clientPassword,
    },
    create: {
      email: 'client@example.com',
      passwordHash: clientPassword,
      firstName: 'Client',
      lastName: 'User',
      role: 'CLIENT',
      companyId: clientProfile.id,
      isActive: true,
    },
  });

  // KYC compliance requirements: Aadhaar and PAN only
  const docTypes = ['AADHAAR', 'PAN'] as const;
  for (const docType of docTypes) {
    await prisma.complianceRequirement.upsert({
      where: { documentType: docType },
      update: {},
      create: {
        documentType: docType,
        name: docType === 'AADHAAR' ? 'Aadhaar Card' : 'PAN Card',
        description: docType === 'AADHAAR' ? 'Aadhaar card for identity verification' : 'PAN card for tax identification',
      },
    });
  }

  // ============ Coworking Booking System ============

  // 1. Locations
  const loc1 = await prisma.location.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {
      name: 'Indiranagar – Aspire Coworks',
      address: '17, 7th Main Rd, Indira Nagar II Stage, Bengaluru',
    },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Indiranagar – Aspire Coworks',
      address: '17, 7th Main Rd, Indira Nagar II Stage, Bengaluru',
    },
  });
  const loc2 = await prisma.location.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {
      name: 'Indiranagar – Aspire Coworks Platinum',
      address: '39/7-1, 7th Main Rd, Indiranagar, Bengaluru',
    },
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Indiranagar – Aspire Coworks Platinum',
      address: '39/7-1, 7th Main Rd, Indiranagar, Bengaluru',
    },
  });
  const loc3 = await prisma.location.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {
      name: 'Koramangala – Aspire Coworks',
      address: 'Balaji Arcade, 20th L Cross Rd, Koramangala',
    },
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Koramangala – Aspire Coworks',
      address: 'Balaji Arcade, 20th L Cross Rd, Koramangala',
    },
  });

  // 2. Fixed time slots (hourly for rooms)
  const slotTimes = [
    { start: '09:00', end: '10:00' },
    { start: '10:00', end: '11:00' },
    { start: '11:00', end: '12:00' },
    { start: '12:00', end: '13:00' },
    { start: '14:00', end: '15:00' },
    { start: '15:00', end: '16:00' },
    { start: '16:00', end: '17:00' },
    { start: '17:00', end: '18:00' },
  ];

  for (let i = 0; i < slotTimes.length; i++) {
    const s = slotTimes[i];
    const id = `00000000-0000-0000-0001-${String(i + 1).padStart(12, '0')}`;
    await prisma.timeSlot.upsert({
      where: { id },
      update: { startTime: s.start, endTime: s.end },
      create: {
        id,
        startTime: s.start,
        endTime: s.end,
        isFullDay: false,
        isActive: true,
      },
    });
  }

  // Full-day slot for Day Pass Desks
  const fullDaySlotId = '00000000-0000-0000-0002-000000000001';
  await prisma.timeSlot.upsert({
    where: { id: fullDaySlotId },
    update: {},
    create: {
      id: fullDaySlotId,
      startTime: '09:00',
      endTime: '18:00',
      isFullDay: true,
      isActive: true,
    },
  });

  // 3. Resources per location
  // Indiranagar: Conference Room, Day Pass Desk
  // Platinum: Conference Room, Discussion Room, Day Pass Desk
  // Koramangala: Conference Room, Discussion Room, Day Pass Desk
  const resourceData = [
    { locId: loc1.id, type: 'CONFERENCE_ROOM' as const, capacity: 1 },
    { locId: loc1.id, type: 'DAY_PASS_DESK' as const, capacity: 10 },
    { locId: loc2.id, type: 'CONFERENCE_ROOM' as const, capacity: 1 },
    { locId: loc2.id, type: 'DISCUSSION_ROOM' as const, capacity: 1 },
    { locId: loc2.id, type: 'DAY_PASS_DESK' as const, capacity: 15 },
    { locId: loc3.id, type: 'CONFERENCE_ROOM' as const, capacity: 1 },
    { locId: loc3.id, type: 'DISCUSSION_ROOM' as const, capacity: 1 },
    { locId: loc3.id, type: 'DAY_PASS_DESK' as const, capacity: 10 },
  ];

  const pricingByType = {
    CONFERENCE_ROOM: { hourlyPrice: 1200, dayPrice: null },
    DISCUSSION_ROOM: { hourlyPrice: 800, dayPrice: null },
    DAY_PASS_DESK: { hourlyPrice: null, dayPrice: 699 },
  };

  for (let i = 0; i < resourceData.length; i++) {
    const r = resourceData[i];
    const id = `00000000-0000-0000-0003-${String(i + 1).padStart(12, '0')}`;
    const res = await prisma.resource.upsert({
      where: { id },
      update: { locationId: r.locId, type: r.type, capacity: r.capacity },
      create: {
        id,
        locationId: r.locId,
        type: r.type,
        capacity: r.capacity,
        isActive: true,
      },
    });

    const pricing = pricingByType[r.type];
    await prisma.pricing.upsert({
      where: { resourceId: res.id },
      update: { hourlyPrice: pricing.hourlyPrice, dayPrice: pricing.dayPrice },
      create: {
        resourceId: res.id,
        hourlyPrice: pricing.hourlyPrice,
        dayPrice: pricing.dayPrice,
      },
    });
  }

  console.log('Seed data created:');
  console.log('- Admin user:', admin.email);
  console.log('- Locations: Indiranagar, Indiranagar Platinum, Koramangala');
  console.log('- Time slots: 8 hourly + 1 full-day');
  console.log('- Manager user:', manager.email);
  console.log('- Company admin (Dashboard):', companyAdmin.email, '→', clientProfile.companyName);
  console.log('- Client user:', client.email, '→', clientProfile.companyName);
  console.log('- Client profile:', clientProfile.companyName);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
