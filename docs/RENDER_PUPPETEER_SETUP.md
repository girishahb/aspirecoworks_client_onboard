# Puppeteer (Invoice PDFs) on Render

Invoice PDFs that use GST split (CGST/SGST/IGST) are generated with Puppeteer and Chrome. On Render, Chrome must be installed during the build.

## Setup

### 1. Update the build command on Render

In **Render Dashboard** → your backend service → **Settings** → **Build & Deploy**:

Set **Build Command** to:

```bash
bash render-build.sh
```

### 2. Redeploy

Click **Manual Deploy** → **Deploy latest commit** (or push a new commit). The build will:

1. Install dependencies  
2. Generate Prisma client  
3. Build the NestJS app  
4. Download Chrome into `./puppeteer-cache` (included in deploy)

The `puppeteer.config.cjs` file tells Puppeteer to find Chrome in that directory at runtime.

### 3. Verify

After deploy, try downloading an invoice. The "Could not find Chrome" error should be resolved.

## Troubleshooting

- **Build fails at Chrome install**: Ensure network access and enough disk space (~300MB for Chrome).
- **Still "Could not find Chrome"**: Verify `puppeteer-cache` exists in your project after build (check build logs). The path is relative to the project root.
- **PDFs without GST split**: Simple invoices use PDFKit (no Chrome). Only invoices with CGST/SGST/IGST require Puppeteer.
