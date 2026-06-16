import * as fs from 'fs';
import * as path from 'path';
import { LOGO_URL } from '../common/email/email-template';

const BUNDLED_LOGO_FILENAME = 'aspire-logo.png';
const FETCH_TIMEOUT_MS = 8000;

export interface ResolvedInvoiceLogo {
  buffer: Buffer;
  mimeType: string;
}

function bundledLogoCandidates(): string[] {
  const projectRoot = process.cwd();
  return [
    path.join(projectRoot, 'assets', BUNDLED_LOGO_FILENAME),
    path.resolve(projectRoot, 'assets', BUNDLED_LOGO_FILENAME),
    path.resolve(__dirname, '..', '..', 'assets', BUNDLED_LOGO_FILENAME),
    path.resolve(__dirname, '..', '..', '..', 'assets', BUNDLED_LOGO_FILENAME),
    '/opt/render/project/src/assets/aspire-logo.png',
  ];
}

function readBundledLogo(): ResolvedInvoiceLogo | null {
  for (const candidate of bundledLogoCandidates()) {
    try {
      if (!fs.existsSync(candidate)) continue;
      return {
        buffer: fs.readFileSync(candidate),
        mimeType: 'image/png',
      };
    } catch {
      /* try next path */
    }
  }
  return null;
}

async function fetchLogoFromUrl(url: string): Promise<ResolvedInvoiceLogo | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? 'image/png';
    const mimeType = contentType.split(';')[0].trim() || 'image/png';
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0) return null;
    return { buffer, mimeType };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function toLogoDataUrl(logo: ResolvedInvoiceLogo): string {
  return `data:${logo.mimeType};base64,${logo.buffer.toString('base64')}`;
}

/**
 * Resolve invoice logo with priority:
 * 1. Bundled assets/aspire-logo.png
 * 2. COMPANY_LOGO_URL env override
 * 3. Default Aspire website logo (same as emails)
 */
export async function resolveInvoiceLogo(companyLogoUrl?: string | null): Promise<ResolvedInvoiceLogo | null> {
  const bundled = readBundledLogo();
  if (bundled) return bundled;

  const overrideUrl = companyLogoUrl?.trim();
  if (overrideUrl) {
    const fromOverride = await fetchLogoFromUrl(overrideUrl);
    if (fromOverride) return fromOverride;
  }

  return fetchLogoFromUrl(LOGO_URL);
}
