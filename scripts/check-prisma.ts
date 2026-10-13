import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRaw`SELECT 1::int as ok`;
  console.log('prisma_ok', rows);
}

main()
  .catch((e) => {
    console.error('prisma_fail', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
