/**
 * Local dev script: upload a file using POST /documents/upload-url then PUT to presigned URL.
 * Backend does not have multipart POST; it uses upload-url + direct PUT.
 * Run: npx ts-node scripts/upload-document.ts
 * Env: API_BASE_URL (default http://localhost:3000), JWT or TOKEN (Bearer token from dev-login)
 * Requires: sample.pdf in project root or scripts/ (or pass path as first arg)
 */

import * as fs from 'fs';
import * as path from 'path';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const JWT = process.env.JWT || process.env.TOKEN;

async function main() {
  if (!JWT) {
    console.error('Set JWT or TOKEN (e.g. from scripts/dev-login.ts output)');
    process.exit(1);
  }

  const filePath =
    process.argv[2] ||
    path.join(process.cwd(), 'sample.pdf') ||
    path.join(__dirname, 'sample.pdf');

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error('File not found:', resolved);
    console.error('Create sample.pdf or pass path: npx ts-node scripts/upload-document.ts path/to/file.pdf');
    process.exit(1);
  }

  const buf = fs.readFileSync(resolved);
  const fileName = path.basename(resolved);
  const mimeType = 'application/pdf';

  const uploadUrlRes = await fetch(`${API_BASE_URL}/documents/upload-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${JWT}`,
    },
    body: JSON.stringify({
      documentType: 'OTHER',
      fileName,
      fileSize: buf.length,
      mimeType,
    }),
  });

  if (!uploadUrlRes.ok) {
    const text = await uploadUrlRes.text();
    console.error('upload-url failed:', uploadUrlRes.status, text);
    process.exit(1);
  }

  const { documentId, uploadUrl } = (await uploadUrlRes.json()) as {
    documentId: string;
    uploadUrl: string;
  };

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: buf,
  });

  if (!putRes.ok) {
    console.error('PUT to presigned URL failed:', putRes.status);
    process.exit(1);
  }

  console.log('documentId:', documentId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
