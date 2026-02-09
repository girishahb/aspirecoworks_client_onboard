/**
 * Reset a user's password by email. Use when a user (e.g. client for company "Test123")
 * forgets their password or you need to set a known password for testing.
 *
 * Run: npx ts-node scripts/reset-user-password.ts
 * Or:  USER_EMAIL=ghb36206@gmail.com NEW_PASSWORD=YourNewPassword123! npm run scripts:reset-user-password
 *
 * Requires: USER_EMAIL and NEW_PASSWORD in environment, or edit the constants below.
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const USER_EMAIL = process.env.USER_EMAIL ?? 'ghb36206@gmail.com';
const NEW_PASSWORD = process.env.NEW_PASSWORD ?? 'TempPass123!';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: USER_EMAIL },
  });

  if (!user) {
    console.error(`No user found with email: ${USER_EMAIL}`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(NEW_PASSWORD, 10);
  await prisma.user.update({
    where: { email: USER_EMAIL },
    data: { passwordHash },
  });

  console.log(`Password reset for ${USER_EMAIL}`);
  console.log(`They can now log in with password: ${NEW_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
