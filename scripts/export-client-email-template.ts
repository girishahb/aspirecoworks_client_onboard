/**
 * Export a team fill-in template for client emails + agreement dates.
 *
 * Usage:
 *   npx ts-node scripts/export-client-email-template.ts
 *   npx ts-node scripts/export-client-email-template.ts --all
 *
 * Default: only rows that look like missing/placeholder emails.
 * --all: every client (for bulk correction).
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const OUT_DIR = path.join(__dirname, 'templates');

const HEADERS = [
  'Client ID (do not change)',
  'Company Name',
  'Location',
  'Vendor / Aggregator',
  'PAN',
  'Phone',
  'Booking ID',
  'Current Email',
  'Correct Email (fill this)',
  'Contact Person Name',
  'Agreement Start Date (YYYY-MM-DD)',
  'Agreement End Date (YYYY-MM-DD)',
  'Notes / Comments',
] as const;

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function ymd(d: Date | null | undefined): string {
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

function isPlaceholderEmail(email: string | null | undefined): boolean {
  const e = (email || '').trim().toLowerCase();
  if (!e) return true;
  if (e.startsWith('unknown+')) return true;
  if (e.endsWith('@aspire.import')) return true;
  if (e.includes('noreply') && e.includes('aspire')) return false;
  return false;
}

async function main() {
  const all = process.argv.includes('--all');
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const clients = await prisma.clientProfile.findMany({
    select: {
      id: true,
      companyName: true,
      contactEmail: true,
      contactPhone: true,
      contactPersonName: true,
      taxId: true,
      externalBookingId: true,
      contractStartDate: true,
      contractEndDate: true,
      location: { select: { name: true, code: true } },
      vendor: { select: { name: true, code: true } },
    },
    orderBy: [{ companyName: 'asc' }],
  });

  const rows = all ? clients : clients.filter((c) => isPlaceholderEmail(c.contactEmail));

  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = all
    ? `client-email-agreement-template-ALL-${stamp}.csv`
    : `client-email-agreement-template-MISSING-${stamp}.csv`;
  const blankName = 'client-email-agreement-template-BLANK.csv';

  const blankPath = path.join(OUT_DIR, blankName);
  fs.writeFileSync(
    blankPath,
    HEADERS.join(',') +
      '\n' +
      [
        '',
        'EXAMPLE PVT LTD',
        'Indiranagar',
        'Insta',
        'ABCDE1234F',
        '9876543210',
        'ISX123',
        'unknown+old@aspire.import',
        'accounts@example.com',
        'Priya Sharma',
        '2025-04-01',
        '2026-03-31',
        'Verified with client WhatsApp',
      ]
        .map(csvEscape)
        .join(',') +
      '\n',
    'utf8',
  );

  const lines = [
    HEADERS.join(','),
    ...rows.map((c) =>
      [
        c.id,
        c.companyName,
        c.location?.name || c.location?.code || '',
        c.vendor?.name || '',
        c.taxId || '',
        c.contactPhone || '',
        c.externalBookingId || '',
        c.contactEmail || '',
        '', // Correct Email — team fills
        c.contactPersonName || '',
        ymd(c.contractStartDate),
        ymd(c.contractEndDate),
        '',
      ]
        .map(csvEscape)
        .join(','),
    ),
  ];

  const outPath = path.join(OUT_DIR, fileName);
  fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');

  const readme = path.join(OUT_DIR, 'README-email-agreement-template.md');
  fs.writeFileSync(
    readme,
    `# Client email + agreement date template

## Files
- \`${blankName}\` — empty template with one example row (for sharing format)
- \`${fileName}\` — pre-filled from DB (${rows.length} rows)${all ? ' — ALL clients' : ' — missing/placeholder emails only'}

## How team should fill
1. Open the CSV in Excel / Google Sheets.
2. **Do not change** \`Client ID (do not change)\` — we use it to update the right record.
3. Fill **Correct Email (fill this)** with a real mailbox (lowercase preferred).
4. Confirm / correct:
   - \`Agreement Start Date (YYYY-MM-DD)\`
   - \`Agreement End Date (YYYY-MM-DD)\`
5. Optional: Contact Person Name, Notes.
6. Save as CSV (UTF-8) and send back for upload.

## Date rules
- Always use \`YYYY-MM-DD\` (example: \`2025-04-01\`).
- Leave blank only if truly unknown.

## Matching priority on upload (later)
1. Client ID  
2. Else PAN  
3. Else Booking ID + Company Name  
4. Else Company Name + Phone + Location  

## Re-export
\`\`\`bash
npx ts-node scripts/export-client-email-template.ts          # missing emails only
npx ts-node scripts/export-client-email-template.ts --all    # every client
\`\`\`
`,
    'utf8',
  );

  console.log(`Wrote ${rows.length} data rows → ${outPath}`);
  console.log(`Blank template → ${blankPath}`);
  console.log(`Instructions → ${readme}`);
  console.log(`Total clients in DB: ${clients.length}; placeholders/missing: ${clients.filter((c) => isPlaceholderEmail(c.contactEmail)).length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
