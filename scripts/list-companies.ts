/**
 * List all company names in the database. Use to get the exact name for COMPANY_NAME in other scripts.
 *
 * Run: npx ts-node scripts/list-companies.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.clientProfile.findMany({
    select: { id: true, companyName: true, contactEmail: true },
    orderBy: { companyName: 'asc' },
  });

  if (companies.length === 0) {
    console.log('No companies in the database. Create one via Admin → Create Client.');
    return;
  }

  console.log('Companies in the database:');
  companies.forEach((c) => {
    console.log(`  "${c.companyName}"  (contact: ${c.contactEmail ?? '—'}, id: ${c.id})`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
