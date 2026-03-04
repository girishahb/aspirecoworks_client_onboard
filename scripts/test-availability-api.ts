/**
 * Test the Availability API (GET /public/pricing/:resourceId?date=).
 *
 * The pricing endpoint returns resource, pricing, and availableSlots.
 * When date is provided, availableSlots are filtered by availability.
 *
 * Usage:
 *   npx ts-node scripts/test-availability-api.ts
 *   npx ts-node scripts/test-availability-api.ts --resourceId=<id>
 *   npx ts-node scripts/test-availability-api.ts --date=2025-03-15
 *
 * Ensure backend is running (npm run start:dev).
 * Default URL: http://localhost:3000
 *
 * Set VITE_API_URL or API_URL to override (e.g. API_URL=https://api.example.com)
 */

import * as fs from 'fs';
import * as path from 'path';

const API_URL = process.env.API_URL || process.env.VITE_API_URL || 'http://localhost:3000';

function loadEnv(): void {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

function parseArgs(): { resourceId?: string; date?: string } {
  const args = process.argv.slice(2);
  let resourceId: string | undefined;
  let date: string | undefined;
  for (const arg of args) {
    if (arg.startsWith('--resourceId=')) resourceId = arg.slice(13);
    if (arg.startsWith('--date=')) date = arg.slice(7);
  }
  return { resourceId, date };
}

async function main() {
  const { resourceId: cliResourceId, date: cliDate } = parseArgs();

  console.log('=== Availability API Test ===\n');
  console.log('API base:', API_URL.replace(/\/$/, ''));

  // 1. Fetch locations to get resource IDs
  console.log('\n1. GET /public/locations');
  const locationsRes = await fetch(`${API_URL.replace(/\/$/, '')}/public/locations`);
  if (!locationsRes.ok) {
    console.error('Failed:', locationsRes.status, locationsRes.statusText);
    const text = await locationsRes.text();
    console.error(text || '(no body)');
    process.exit(1);
  }
  const locations = (await locationsRes.json()) as Array<{
    id: string;
    name: string;
    address: string;
    resources: Array<{ id: string; type: string; capacity: number }>;
  }>;
  console.log('Locations:', locations.length);
  locations.forEach((loc) => {
    console.log(`  - ${loc.name} (${loc.resources?.length ?? 0} resources)`);
    loc.resources?.forEach((r) => {
      console.log(`      ${r.type} id=${r.id} capacity=${r.capacity}`);
    });
  });

  // Pick first resource if not specified
  const resourceId =
    cliResourceId ??
    locations[0]?.resources?.[0]?.id ??
    '00000000-0000-0000-0003-000000000001';

  const date = cliDate ?? (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  })();

  console.log('\n2. GET /public/pricing/:resourceId (no date - all slots)');
  const pricingNoDateRes = await fetch(
    `${API_URL.replace(/\/$/, '')}/public/pricing/${resourceId}`,
  );
  if (!pricingNoDateRes.ok) {
    console.error('Failed:', pricingNoDateRes.status, await pricingNoDateRes.text());
    process.exit(1);
  }
  const pricingNoDate = (await pricingNoDateRes.json()) as {
    resource: { id: string; type: string; capacity: number };
    pricing: { hourlyPrice: number | null; dayPrice: number | null } | null;
    availableSlots: Array<{ id: string; startTime: string; endTime: string }>;
  };
  console.log('Resource:', pricingNoDate.resource.type, 'capacity', pricingNoDate.resource.capacity);
  console.log('Pricing:', pricingNoDate.pricing);
  console.log('Available slots (all):', pricingNoDate.availableSlots?.length ?? 0);
  pricingNoDate.availableSlots?.slice(0, 5).forEach((s) => {
    console.log(`  - ${s.startTime} – ${s.endTime}`);
  });
  if ((pricingNoDate.availableSlots?.length ?? 0) > 5) {
    console.log('  ...');
  }

  console.log('\n3. GET /public/pricing/:resourceId?date= (with date - availability filtered)');
  const pricingWithDateRes = await fetch(
    `${API_URL.replace(/\/$/, '')}/public/pricing/${resourceId}?date=${encodeURIComponent(date)}`,
  );
  if (!pricingWithDateRes.ok) {
    console.error('Failed:', pricingWithDateRes.status, await pricingWithDateRes.text());
    process.exit(1);
  }
  const pricingWithDate = (await pricingWithDateRes.json()) as {
    resource: { id: string; type: string; capacity: number };
    pricing: { hourlyPrice: number | null; dayPrice: number | null } | null;
    availableSlots: Array<{ id: string; startTime: string; endTime: string }>;
  };
  console.log('Date:', date);
  console.log('Available slots (availability checked):', pricingWithDate.availableSlots?.length ?? 0);
  pricingWithDate.availableSlots?.forEach((s) => {
    console.log(`  - ${s.startTime} – ${s.endTime}`);
  });

  console.log('\n=== Availability API Test Complete ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
