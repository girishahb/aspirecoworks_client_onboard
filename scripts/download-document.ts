/**
 * Local dev script: get presigned download URL via GET /documents/:id/download.
 * Run: npx ts-node scripts/download-document.ts <documentId>
 * Env: API_BASE_URL (default http://localhost:3000), JWT or TOKEN
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const JWT = process.env.JWT || process.env.TOKEN;

async function main() {
  const documentId = process.argv[2] || process.env.DOCUMENT_ID;
  if (!documentId) {
    console.error('Usage: npx ts-node scripts/download-document.ts <documentId>');
    console.error('Or set DOCUMENT_ID env var');
    process.exit(1);
  }

  if (!JWT) {
    console.error('Set JWT or TOKEN');
    process.exit(1);
  }

  const res = await fetch(`${API_BASE_URL}/documents/${documentId}/download`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${JWT}` },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('download failed:', res.status, text);
    process.exit(1);
  }

  const data = (await res.json()) as { documentId: string; fileName: string; downloadUrl: string; expiresIn: number };
  console.log('Signed URL:', data.downloadUrl);
  console.log('fileName:', data.fileName, 'expiresIn:', data.expiresIn, 's');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
