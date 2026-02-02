import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('Admin123!', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@aspirecoworks.com' },
    update: {},
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
    update: {},
    create: {
      email: 'manager@aspirecoworks.com',
      passwordHash: managerPassword,
      firstName: 'Manager',
      lastName: 'User',
      role: 'MANAGER',
      isActive: true,
    },
  });

  // Create client user
  const clientPassword = await bcrypt.hash('Client123!', 10);
  const client = await prisma.user.upsert({
    where: { email: 'client@example.com' },
    update: {},
    create: {
      email: 'client@example.com',
      passwordHash: clientPassword,
      firstName: 'Client',
      lastName: 'User',
      role: 'CLIENT',
      isActive: true,
    },
  });

  // Create sample client profile
  const clientProfile = await prisma.clientProfile.create({
    data: {
      companyName: 'Example Corp',
      contactEmail: 'contact@example.com',
      contactPhone: '+1234567890',
      taxId: 'TAX123456',
      address: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'USA',
      onboardingStatus: 'PENDING',
      notes: 'Sample client profile for testing',
      createdById: admin.id,
    },
  });

  console.log('Seed data created:');
  console.log('- Admin user:', admin.email);
  console.log('- Manager user:', manager.email);
  console.log('- Client user:', client.email);
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
