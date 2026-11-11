/** Versioned Aadhaar consent copy shown on the check-in form. Bump when legal text changes. */
export const AADHAAR_CONSENT_VERSION = 'v1-2026-03';

export const AADHAAR_CONSENT_TEXT =
  'I consent to Aspire Coworks recording the last 4 digits of my Aadhaar number ' +
  '(and optionally a photograph of my Aadhaar card) for visitor identity verification at this facility. ' +
  'The full Aadhaar number will not be collected or stored.';

/** Recommended retention window for visitor media + PII (manual purge later). */
export const VISITOR_RETENTION_DAYS = 90;

export const VISITOR_MEDIA_MAX_BYTES = 8 * 1024 * 1024;

export const VISITOR_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);
