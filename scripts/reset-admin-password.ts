/**
 * Reset the admin user's password to Admin123! so you can log in at /admin/login.
 * Use this if you get "Invalid credentials" (e.g. after DB changes or wrong password).
 *
 * Run: npx ts-node scripts/reset-admin-password.ts
 * Or:  npm run scripts:reset-admin-password
 *
 * Updates: admin@aspirecoworks.com (seed admin). No Nest context required.
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const ADMIN_EMAIL = 'admin@aspirecoworks.com';
const NEW_PASSWORD = 'Admin123!';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  if (!user) {
    console.error(`No user found with email: ${ADMIN_EMAIL}`);
    console.error('Run: npm run prisma:seed');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(NEW_PASSWORD, 10);
  await prisma.user.update({
    where: { email: ADMIN_EMAIL },
    data: { passwordHash },
  });

  console.log(`Password reset for ${ADMIN_EMAIL}`);
  console.log(`You can now log in with password: ${NEW_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
