/**
 * Create a user and link them to a company by company name. Use when the company exists (e.g. "Test123")
 * but no user exists yet for that email, so they can log in to the client dashboard.
 *
 * Run: npx ts-node scripts/create-user-for-company.ts
 * Or:  COMPANY_NAME="Test123" USER_EMAIL="ghb36206@gmail.com" PASSWORD="YourPassword123!" npx ts-node scripts/create-user-for-company.ts
 *
 * Optional: FIRST_NAME="John" LAST_NAME="Doe" ROLE="COMPANY_ADMIN"
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const COMPANY_NAME = (process.env.COMPANY_NAME ?? 'Test123').trim();
const USER_EMAIL = process.env.USER_EMAIL ?? 'ghb36206@gmail.com';
const PASSWORD = process.env.PASSWORD ?? process.env.NEW_PASSWORD ?? 'TempPass123!';
const FIRST_NAME = process.env.FIRST_NAME ?? 'User';
const LAST_NAME = process.env.LAST_NAME ?? 'Account';
const ROLE = (process.env.ROLE ?? 'COMPANY_ADMIN') as 'COMPANY_ADMIN' | 'CLIENT';

const prisma = new PrismaClient();

async function main() {
  const existingUser = await prisma.user.findUnique({
    where: { email: USER_EMAIL },
  });

  if (existingUser) {
    console.log(`User already exists: ${USER_EMAIL}`);
    console.log('To reset their password, run: npm run scripts:reset-user-password');
    console.log(`  USER_EMAIL=${USER_EMAIL} NEW_PASSWORD=YourNewPassword npm run scripts:reset-user-password`);
    process.exit(0);
  }

  // Try exact match (case-insensitive) first, then partial match (contains)
  let company = await prisma.clientProfile.findFirst({
    where: { companyName: { equals: COMPANY_NAME, mode: 'insensitive' } },
  });
  if (!company && COMPANY_NAME.length > 0) {
    company = await prisma.clientProfile.findFirst({
      where: { companyName: { contains: COMPANY_NAME, mode: 'insensitive' } },
    });
  }

  if (!company) {
    const all = await prisma.clientProfile.findMany({
      select: { companyName: true },
      orderBy: { companyName: 'asc' },
    });
    console.error(`No company found with name: "${COMPANY_NAME}".`);
    if (all.length === 0) {
      console.error('There are no companies in the database. Create one via Admin → Create Client.');
    } else {
      console.error('Companies in the database (use the exact name with COMPANY_NAME=):');
      all.forEach((c) => console.error(`  - "${c.companyName}"`));
      console.error('Example: COMPANY_NAME="' + all[0].companyName + '" USER_EMAIL=' + USER_EMAIL + ' npm run scripts:create-user-for-company');
    }
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email: USER_EMAIL,
      passwordHash,
      firstName: FIRST_NAME,
      lastName: LAST_NAME,
      role: ROLE,
      companyId: company.id,
      isActive: true,
      isActivated: true,
    },
  });

  console.log(`Created user: ${user.email} (${user.role}) linked to company "${company.companyName}"`);
  console.log(`They can log in at http://localhost:5173/login with:`);
  console.log(`  Email: ${USER_EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
