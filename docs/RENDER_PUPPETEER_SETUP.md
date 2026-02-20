# Puppeteer (Invoice PDFs) on Render

Invoice PDFs that use GST split (CGST/SGST/IGST) are generated with Puppeteer and Chrome. On Render, Chrome must be installed during the build.

## Setup

### 1. Update the build command on Render

In **Render Dashboard** → your backend service → **Settings** → **Build & Deploy**:

Set **Build Command** to:

```bash
bash render-build.sh
```

**Important**: Replace any existing build command (e.g. `npm run build`). The `render-build.sh` script runs the full build and installs Chrome.

### 2. Redeploy

Click **Manual Deploy** → **Deploy latest commit** (or push a new commit). The build will:

1. Install dependencies  
2. Generate Prisma client  
3. Build the NestJS app  
4. Download Chrome into `./puppeteer-cache` (project-local; included in deploy)

At runtime, the app looks for Chrome in `./puppeteer-cache` (or `PUPPETEER_CACHE_DIR` if set).

### 3. Verify

After deploy, try downloading an invoice. The "Could not find Chrome" error should be resolved.

## Optional: Set PUPPETEER_CACHE_DIR

If the app still can't find Chrome, set this in Render → Environment:

| Key | Value |
|-----|-------|
| `PUPPETEER_CACHE_DIR` | `/opt/render/project/src/puppeteer-cache` |

This ensures the runtime looks in the same directory where the build installed Chrome.

## Troubleshooting

- **Build fails at Chrome install**: Ensure network access and enough disk space (~300MB for Chrome).
- **Still "Could not find Chrome"**: (1) Confirm the build command is `bash render-build.sh`. (2) Check build logs for "Chrome installed at". (3) Set `PUPPETEER_CACHE_DIR` as above.
- **PDFs without GST split**: Simple invoices use PDFKit (no Chrome). Only invoices with CGST/SGST/IGST require Puppeteer.
