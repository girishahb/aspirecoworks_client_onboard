# R2 CORS Setup (Optional – Proxy Upload Default)

**Update:** The app now uses **proxy upload** by default: files are sent to the backend via `POST /documents/upload`, and the backend uploads to R2. This avoids CORS entirely. You **do not need** R2 CORS if using proxy upload.

If you prefer **presigned URLs** (direct browser → R2 upload) for lower server bandwidth, configure R2 CORS as below.

## Why CORS Was Needed (Presigned URLs)

1. **Flow**: Frontend → `POST /documents/upload-url` (backend) → presigned R2 URL → Frontend → `PUT` file directly to R2
2. The `PUT` goes from the browser to a different origin (R2), so the browser enforces CORS
3. Without CORS, the request fails even if the presigned URL is valid

## Configure R2 CORS

### Via Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2** → your bucket
2. Open **Settings** → **CORS policy**
3. Add a rule with:
   - **Allowed origins**: your frontend URL(s), e.g. `https://app.aspirecoworks.com` or `http://localhost:5173` for local dev  
     - Use `*` only for quick testing; prefer specific origins in production
   - **Allowed methods**: `PUT`, `GET`, `HEAD`
   - **Allowed headers**: `Content-Type`, `Content-Disposition`, `x-amz-*` (or `*` for testing)
   - **Expose headers** (optional): `ETag`
4. Save

### Via Cloudflare API / Wrangler

Example CORS policy JSON (use in API or Wrangler):

```json
[
  {
    "AllowedOrigins": [
      "https://app.aspirecoworks.com",
      "http://localhost:5173"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type", "Content-Disposition", "x-amz-*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Replace origins with your actual frontend URL(s).

## Verify

1. Deploy the CORS config to your R2 bucket
2. Retry the KYC upload from the frontend
3. If it still fails, open DevTools → **Network**:
   - Check for OPTIONS (preflight) or PUT requests that fail
   - If you see CORS errors in the console, confirm the origin in your CORS rule matches exactly (no trailing slash)

## Troubleshooting: "Document file not found in storage"

If downloads fail with this error:

1. **Check R2 configuration** – Verify `R2_BUCKET_NAME` and `R2_ENDPOINT` in your environment. The endpoint should be `https://<account_id>.r2.cloudflarestorage.com`.
2. **Check the bucket** – In Cloudflare Dashboard → R2 → your bucket, browse objects. Keys follow `company/{companyId}/kyc/` or `company/{companyId}/agreements/draft/`, etc.
3. **Legacy keys** – The app tries both `agreements/draft` and `agreement_draft` (and similar) formats. If your bucket uses different folder names, the error message shows the key attempted.
4. **Documents never uploaded** – If uploads used presigned URLs and CORS was not configured, the browser `PUT` may have failed. The document record exists but the file was never stored. Those documents must be re-uploaded (use the proxy upload flow).

## Related

- `ALLOWED_ORIGINS` controls CORS for your **backend API** (see [RENDER_ALLOWED_ORIGINS.md](./RENDER_ALLOWED_ORIGINS.md))
- R2 CORS controls access to the **R2 bucket** when the browser uploads directly via presigned URL
- **Proxy upload** (`POST /documents/upload`) bypasses R2 CORS by sending files through your backend
