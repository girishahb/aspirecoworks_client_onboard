import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Updating CLIENT users to COMPANY_ADMIN...');

  // First, check if there are any CLIENT users
  const clientUsers = await prisma.$queryRaw<Array<{ id: string; email: string }>>`
    SELECT id, email FROM users WHERE role = 'CLIENT'
  `;

  if (clientUsers.length === 0) {
    console.log('No CLIENT users found. Database is ready for migration.');
    return;
  }

  console.log(`Found ${clientUsers.length} CLIENT user(s) to update:`);
  clientUsers.forEach((user) => {
    console.log(`  - ${user.email} (${user.id})`);
  });

  // Update all CLIENT users to COMPANY_ADMIN
  const result = await prisma.$executeRaw`
    UPDATE users SET role = 'COMPANY_ADMIN' WHERE role = 'CLIENT'
  `;

  console.log(`\n✅ Updated ${result} user(s) from CLIENT to COMPANY_ADMIN.`);
  console.log('\nYou can now run the migration:');
  console.log('  npx prisma migrate dev --name remove_client_role');
}

main()
  .catch((e) => {
    console.error('Error updating users:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
