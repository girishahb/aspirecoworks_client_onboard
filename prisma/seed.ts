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
  for (const docType of ['AADHAAR', 'PAN']) {
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

  console.log('Seed data created:');
  console.log('- Admin user:', admin.email);
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
