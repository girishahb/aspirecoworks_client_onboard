/**
 * Update campaign pricing for all resource types.
 * Updates hourlyPrice for CONFERENCE_ROOM and DISCUSSION_ROOM, dayPrice for DAY_PASS_DESK.
 *
 * Usage:
 *   npm run scripts:update-campaign-pricing
 *
 * With custom prices (CLI args):
 *   npx ts-node scripts/update-campaign-pricing.ts --conference=1500 --discussion=900 --dayPass=799
 *
 * Or via env vars:
 *   CONFERENCE_HOURLY=1500 DISCUSSION_HOURLY=900 DAY_PASS_PRICE=799 npx ts-node scripts/update-campaign-pricing.ts
 *
 * Defaults (if not provided): Conference 1200, Discussion 800, Day Pass 699
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseArg(
  cliName: string,
  envName: string,
  def: number
): number {
  const env = process.env[envName];
  if (env != null) return parseFloat(env) || def;

  const arg = process.argv.find((a) => a.startsWith(`--${cliName}=`));
  if (arg) {
    const val = parseFloat(arg.split('=')[1]);
    if (!Number.isNaN(val) && val >= 0) return val;
  }
  return def;
}

async function main() {
  const conferenceHourly = parseArg('conference', 'CONFERENCE_HOURLY', 1);
  const discussionHourly = parseArg('discussion', 'DISCUSSION_HOURLY', 1);
  const dayPassPrice = parseArg('dayPass', 'DAY_PASS_PRICE', 1);

  console.log('Updating campaign pricing:');
  console.log(`  Conference Room: ₹${conferenceHourly}/hr`);
  console.log(`  Discussion Room: ₹${discussionHourly}/hr`);
  console.log(`  Day Pass Desk:   ₹${dayPassPrice}/day`);
  console.log('');

  // CONFERENCE_ROOM
  const confResources = await prisma.resource.findMany({
    where: { type: 'CONFERENCE_ROOM' },
    include: { pricing: true, location: true },
  });
  for (const res of confResources) {
    if (res.pricing) {
      await prisma.pricing.update({
        where: { resourceId: res.id },
        data: { hourlyPrice: conferenceHourly, dayPrice: null },
      });
      console.log(`  Updated ${res.location.name} - Conference Room: ₹${conferenceHourly}/hr`);
    } else {
      await prisma.pricing.create({
        data: {
          resourceId: res.id,
          hourlyPrice: conferenceHourly,
          dayPrice: null,
        },
      });
      console.log(`  Created pricing for ${res.location.name} - Conference Room: ₹${conferenceHourly}/hr`);
    }
  }

  // DISCUSSION_ROOM
  const discResources = await prisma.resource.findMany({
    where: { type: 'DISCUSSION_ROOM' },
    include: { pricing: true, location: true },
  });
  for (const res of discResources) {
    if (res.pricing) {
      await prisma.pricing.update({
        where: { resourceId: res.id },
        data: { hourlyPrice: discussionHourly, dayPrice: null },
      });
      console.log(`  Updated ${res.location.name} - Discussion Room: ₹${discussionHourly}/hr`);
    } else {
      await prisma.pricing.create({
        data: {
          resourceId: res.id,
          hourlyPrice: discussionHourly,
          dayPrice: null,
        },
      });
      console.log(`  Created pricing for ${res.location.name} - Discussion Room: ₹${discussionHourly}/hr`);
    }
  }

  // DAY_PASS_DESK
  const deskResources = await prisma.resource.findMany({
    where: { type: 'DAY_PASS_DESK' },
    include: { pricing: true, location: true },
  });
  for (const res of deskResources) {
    if (res.pricing) {
      await prisma.pricing.update({
        where: { resourceId: res.id },
        data: { hourlyPrice: null, dayPrice: dayPassPrice },
      });
      console.log(`  Updated ${res.location.name} - Day Pass Desk: ₹${dayPassPrice}/day`);
    } else {
      await prisma.pricing.create({
        data: {
          resourceId: res.id,
          hourlyPrice: null,
          dayPrice: dayPassPrice,
        },
      });
      console.log(`  Created pricing for ${res.location.name} - Day Pass Desk: ₹${dayPassPrice}/day`);
    }
  }

  const total = confResources.length + discResources.length + deskResources.length;
  console.log(`\nDone. Updated pricing for ${total} resources.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
