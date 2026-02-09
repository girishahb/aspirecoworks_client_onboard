/**
 * List all users linked to a company by company name. Use to find which emails exist for a company.
 *
 * Run: npx ts-node scripts/list-users-for-company.ts
 * Or:  COMPANY_NAME="Test123" npx ts-node scripts/list-users-for-company.ts
 */

import { PrismaClient } from '@prisma/client';

const COMPANY_NAME = process.env.COMPANY_NAME ?? 'Test123';
const prisma = new PrismaClient();

async function main() {
  const company = await prisma.clientProfile.findFirst({
    where: { companyName: { equals: COMPANY_NAME, mode: 'insensitive' } },
    include: { users: { select: { id: true, email: true, firstName: true, lastName: true, role: true } } },
  });

  if (!company) {
    console.error(`No company found with name: "${COMPANY_NAME}"`);
    process.exit(1);
  }

  console.log(`Company: ${company.companyName} (id: ${company.id})`);
  console.log(`Contact email on profile: ${company.contactEmail ?? '—'}`);
  console.log('');
  if (company.users.length === 0) {
    console.log('No users linked to this company. Link a user via companyId or create one with scripts:create-user-for-company.');
  } else {
    console.log('Users linked to this company:');
    company.users.forEach((u) => {
      console.log(`  - ${u.email} (${u.firstName} ${u.lastName}, ${u.role})`);
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
