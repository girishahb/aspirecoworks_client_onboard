# Local API test scripts

Run these against a local backend (e.g. `npm run start:dev`). **Not for production.**

- **Node 18+** required (uses native `fetch`).
- **API_BASE_URL** env var optional (default `http://localhost:3000`).

## 1. Get JWT (dev-login)

```bash
npm run scripts:dev-login
# or: npx ts-node scripts/dev-login.ts
```

Prints JWT for `admin@aspirecoworks.com`. Copy the token for other scripts.

## 2. Upload document

Backend uses **POST /documents/upload-url** then **PUT** to presigned URL (no multipart).

Put a `sample.pdf` in project root or pass path:

```bash
export JWT=<paste-token-from-dev-login>
npm run scripts:upload-document
# or with file: npx ts-node scripts/upload-document.ts path/to/file.pdf
```

Requires a **COMPANY_ADMIN** JWT (dev-login returns ADMIN; use magic-link or seed for COMPANY_ADMIN if upload fails with 403).

Prints `documentId`.

## 3. Download document (signed URL)

```bash
export JWT=<token>
npx ts-node scripts/download-document.ts <documentId>
# or: DOCUMENT_ID=<id> npx ts-node scripts/download-document.ts
```

Prints presigned download URL.

## 4. Review document (approve)

Requires **SUPER_ADMIN** JWT.

```bash
export JWT=<super-admin-token>
npx ts-node scripts/review-document.ts <documentId>
```

Approves document (status VERIFIED).
