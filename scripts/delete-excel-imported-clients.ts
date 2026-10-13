/**
 * Delete ClientProfiles that came from the Excel branch import (locationId set).
 * Keeps seed / manually created companies without a branch location.
 *
 * Usage:
 *   npx ts-node scripts/delete-excel-imported-clients.ts --dry-run
 *   npx ts-node scripts/delete-excel-imported-clients.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const ids = (
    await prisma.clientProfile.findMany({
      where: { locationId: { not: null } },
      select: { id: true },
    })
  ).map((r) => r.id);

  console.log(`Excel-imported clients (locationId set): ${ids.length}`);
  if (ids.length === 0) {
    console.log('Nothing to delete.');
    return;
  }

  if (dryRun) {
    console.log('[dry-run] Would delete these profiles and related rows.');
    return;
  }

  // Break non-cascading FKs first
  await prisma.auditLog.updateMany({
    where: { clientProfileId: { in: ids } },
    data: { clientProfileId: null },
  });

  // Company-linked invite users (not staff/admin)
  const companyUsers = await prisma.user.findMany({
    where: { companyId: { in: ids } },
    select: { id: true, email: true, role: true },
  });
  const deletableUserIds = companyUsers
    .filter((u) => u.role === 'CLIENT' || u.role === 'COMPANY_ADMIN' || u.role === 'USER')
    .map((u) => u.id);
  if (deletableUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: deletableUserIds } } });
    console.log(`Deleted ${deletableUserIds.length} company-linked users`);
  }
  await prisma.user.updateMany({
    where: { companyId: { in: ids } },
    data: { companyId: null },
  });

  const deleted = await prisma.clientProfile.deleteMany({
    where: { id: { in: ids } },
  });
  console.log(`Deleted ${deleted.count} client profiles`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
