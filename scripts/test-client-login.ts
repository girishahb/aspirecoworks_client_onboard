import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Testing CLIENT user login flow...\n');

  // Find CLIENT user
  const client = await prisma.user.findUnique({
    where: { email: 'client@example.com' },
    select: {
      id: true,
      email: true,
      role: true,
      companyId: true,
      isActive: true,
      passwordHash: true,
    },
  });

  if (!client) {
    console.log('❌ CLIENT user not found. Run seed script first.');
    return;
  }

  console.log('CLIENT user found:');
  console.log(`  Email: ${client.email}`);
  console.log(`  Role: ${client.role}`);
  console.log(`  CompanyId: ${client.companyId || 'NULL (NOT SET!)'}`);
  console.log(`  IsActive: ${client.isActive}`);
  console.log('');

  // Test password
  const testPassword = 'Client123!';
  const passwordMatch = await bcrypt.compare(testPassword, client.passwordHash);
  console.log(`Password '${testPassword}' matches: ${passwordMatch ? '✅ YES' : '❌ NO'}`);
  console.log('');

  if (!client.companyId) {
    console.log('⚠️  WARNING: CLIENT user has no companyId!');
    console.log('   This will cause "Forbidden resource" errors.');
    console.log('   Run the seed script to fix this.');
    return;
  }

  // Verify company exists
  const company = await prisma.clientProfile.findUnique({
    where: { id: client.companyId },
    select: {
      id: true,
      companyName: true,
    },
  });

  if (!company) {
    console.log(`❌ Company with ID ${client.companyId} not found!`);
    return;
  }

  console.log(`✅ Company linked: ${company.companyName}`);
  console.log('');
  console.log('✅ CLIENT user is properly configured for login.');
  console.log('');
  console.log('If you still get "Forbidden resource" error:');
  console.log('1. Log out completely (clear browser localStorage)');
  console.log('2. Log back in with: client@example.com / Client123!');
  console.log('3. This will issue a fresh JWT token with companyId');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
