# R2 CORS Setup for KYC Document Upload

The "Upload failed" error when uploading KYC documents (Aadhaar, PAN) is often caused by **missing CORS configuration** on the Cloudflare R2 bucket. The browser blocks the direct `PUT` request to the presigned R2 URL because the bucket must explicitly allow the frontend origin.

## Why CORS is Required

1. **Flow**: Frontend → `POST /documents/upload-url` (your backend) → presigned R2 URL → Frontend → `PUT` file directly to R2
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

## Related

- `ALLOWED_ORIGINS` controls CORS for your **backend API** (see [RENDER_ALLOWED_ORIGINS.md](./RENDER_ALLOWED_ORIGINS.md))
- R2 CORS controls access to the **R2 bucket** itself when the browser uploads directly via presigned URL
