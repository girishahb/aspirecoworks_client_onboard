import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

const SUPPORT_GROUPS: { name: string; department: string }[] = [
  { name: 'Internet / Wi-Fi', department: 'IT Support' },
  { name: 'Housekeeping', department: 'Operations' },
  { name: 'Electricity', department: 'Facilities' },
  { name: 'Air Conditioning', department: 'Facilities' },
  { name: 'Meeting Room', department: 'Operations' },
  { name: 'Access Card', department: 'Administration' },
  { name: 'Parking', department: 'Operations' },
  { name: 'Furniture / Infrastructure', department: 'Facilities' },
  { name: 'Washroom / Plumbing', department: 'Facilities' },
  { name: 'Other', department: 'Operations' },
];

async function main() {
  const departments = new Map<string, string>();
  for (const name of ['IT Support', 'Operations', 'Facilities', 'Administration', 'Finance']) {
    const department = await prisma.department.upsert({
      where: { name },
      update: { isActive: true },
      create: { name },
    });
    departments.set(name, department.id);
  }

  for (let i = 0; i < SUPPORT_GROUPS.length; i++) {
    const spec = SUPPORT_GROUPS[i];
    const existing = await prisma.issueGroup.findFirst({ where: { name: spec.name } });
    const group = existing
      ? await prisma.issueGroup.update({
          where: { id: existing.id },
          data: { sortOrder: i + 1, isActive: true },
        })
      : await prisma.issueGroup.create({ data: { name: spec.name, sortOrder: i + 1 } });
    await prisma.issueGroupRoute.upsert({
      where: { issueGroupId_locationKey: { issueGroupId: group.id, locationKey: 'GLOBAL' } },
      update: {},
      create: {
        issueGroupId: group.id,
        locationKey: 'GLOBAL',
        departmentId: departments.get(spec.department)!,
      },
    });
  }

  const locations = await prisma.location.findMany({ where: { isActive: true } });
  for (const location of locations) {
    const existing = await prisma.qrCode.findFirst({
      where: { locationId: location.id, label: 'Reception' },
    });
    if (!existing) {
      await prisma.qrCode.create({
        data: {
          locationId: location.id,
          label: 'Reception',
          publicToken: randomBytes(24).toString('base64url'),
        },
      });
    }
  }

  const counts = {
    departments: await prisma.department.count(),
    groups: await prisma.issueGroup.count(),
    qrCodes: await prisma.qrCode.count(),
    locations: locations.length,
  };
  console.log(counts);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
