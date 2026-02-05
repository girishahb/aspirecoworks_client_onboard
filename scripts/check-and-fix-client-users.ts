import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking CLIENT users and their companyId...\n');

  // Find all CLIENT users
  const clientUsers = await prisma.user.findMany({
    where: { role: 'CLIENT' },
    select: {
      id: true,
      email: true,
      companyId: true,
      role: true,
    },
  });

  if (clientUsers.length === 0) {
    console.log('No CLIENT users found. Running seed script might be needed.');
    return;
  }

  console.log(`Found ${clientUsers.length} CLIENT user(s):\n`);
  clientUsers.forEach((user) => {
    console.log(`  - ${user.email}`);
    console.log(`    ID: ${user.id}`);
    console.log(`    CompanyId: ${user.companyId || 'NULL (NOT SET!)'}`);
    console.log('');
  });

  // Check if there's a company to link to
  const exampleCompany = await prisma.clientProfile.findFirst({
    where: { taxId: 'TAX123456' },
    select: { id: true, companyName: true },
  });

  if (!exampleCompany) {
    console.log('⚠️  No Example Corp company found. You may need to run the seed script first.');
    return;
  }

  // Fix users without companyId
  const usersWithoutCompany = clientUsers.filter((u) => !u.companyId);
  if (usersWithoutCompany.length > 0) {
    console.log(`\nFixing ${usersWithoutCompany.length} user(s) without companyId...\n`);
    for (const user of usersWithoutCompany) {
      await prisma.user.update({
        where: { id: user.id },
        data: { companyId: exampleCompany.id },
      });
      console.log(`✅ Linked ${user.email} to ${exampleCompany.companyName}`);
    }
    console.log('\n✅ All CLIENT users now have companyId set.');
  } else {
    console.log('\n✅ All CLIENT users already have companyId set.');
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
