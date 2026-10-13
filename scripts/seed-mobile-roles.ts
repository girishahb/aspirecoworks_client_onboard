import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function upsert(
  email: string,
  role: 'FINANCE' | 'STAFF' | 'RECEPTION',
  firstName: string,
  lastName: string,
  password: string,
) {
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role,
      isActive: true,
      isActivated: true,
      inviteToken: null,
      inviteTokenExpiry: null,
      firstName,
      lastName,
    },
    create: {
      email,
      passwordHash,
      role,
      isActive: true,
      isActivated: true,
      firstName,
      lastName,
    },
  });
  console.log(`OK ${role} ${email} / ${password}`);
}

async function main() {
  await upsert('finance@aspirecoworks.com', 'FINANCE', 'Finance', 'User', 'Finance123!');
  await upsert('staff@aspirecoworks.com', 'STAFF', 'Floor', 'Staff', 'Staff123!');
  await upsert('reception@aspirecoworks.com', 'RECEPTION', 'Front', 'Desk', 'Reception123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
