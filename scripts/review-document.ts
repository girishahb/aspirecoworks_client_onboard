/**
 * Local dev script: approve document via PATCH /documents/:id/review.
 * Run: npx ts-node scripts/review-document.ts <documentId>
 * Env: API_BASE_URL (default http://localhost:3000), JWT or TOKEN (SUPER_ADMIN)
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const JWT = process.env.JWT || process.env.TOKEN;

async function main() {
  const documentId = process.argv[2] || process.env.DOCUMENT_ID;
  if (!documentId) {
    console.error('Usage: npx ts-node scripts/review-document.ts <documentId>');
    console.error('Or set DOCUMENT_ID env var');
    process.exit(1);
  }

  if (!JWT) {
    console.error('Set JWT or TOKEN (SUPER_ADMIN required for review)');
    process.exit(1);
  }

  const res = await fetch(`${API_BASE_URL}/documents/${documentId}/review`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${JWT}`,
    },
    body: JSON.stringify({ status: 'VERIFIED' }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('review failed:', res.status, text);
    process.exit(1);
  }

  const data = await res.json();
  console.log('Document reviewed (approved):', JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
