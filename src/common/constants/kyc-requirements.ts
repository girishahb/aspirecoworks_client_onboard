import { DocumentStatus, DocumentType } from '@prisma/client';

/** Required identity docs for KYC review / activation. */
export const REQUIRED_KYC_TYPES: DocumentType[] = [
  DocumentType.AADHAAR,
  DocumentType.PAN,
];

/** Types treated as client KYC for upload/review queues. */
export const CLIENT_KYC_TYPES: DocumentType[] = [
  DocumentType.AADHAAR,
  DocumentType.PAN,
  DocumentType.OTHER,
  DocumentType.KYC, // legacy imports
];

export function isClientKycType(type: string): boolean {
  return (CLIENT_KYC_TYPES as string[]).includes(type);
}

export function isApprovedStatus(status: string): boolean {
  return status === DocumentStatus.APPROVED || status === DocumentStatus.VERIFIED;
}

/**
 * Latest document per type from a list ordered by version desc (or unsorted).
 */
export function latestByType<T extends { documentType: string; version: number; status: string }>(
  docs: T[],
): Map<string, T> {
  const sorted = [...docs].sort((a, b) => b.version - a.version);
  const map = new Map<string, T>();
  for (const d of sorted) {
    if (!map.has(d.documentType)) map.set(d.documentType, d);
  }
  return map;
}

/**
 * True when every required KYC type has a latest CLIENT doc that is approved/verified.
 * Legacy-only KYC type alone does NOT satisfy Aadhaar+PAN requirements.
 */
export function areRequiredKycTypesApproved(
  docs: Array<{ documentType: string; version: number; status: string; documentOwner?: string | null }>,
): boolean {
  const clientDocs = docs.filter(
    (d) =>
      isClientKycType(d.documentType) &&
      (d.documentOwner == null || d.documentOwner === 'CLIENT'),
  );
  const latest = latestByType(clientDocs);
  for (const type of REQUIRED_KYC_TYPES) {
    const doc = latest.get(type);
    if (!doc || !isApprovedStatus(doc.status)) return false;
  }
  return true;
}

/**
 * True when at least one Aadhaar and one PAN have been uploaded (any status).
 */
export function hasRequiredKycUploads(
  docs: Array<{ documentType: string; documentOwner?: string | null }>,
): boolean {
  const types = new Set(
    docs
      .filter((d) => d.documentOwner == null || d.documentOwner === 'CLIENT')
      .map((d) => d.documentType),
  );
  return (
    types.has(DocumentType.AADHAAR) &&
    types.has(DocumentType.PAN)
  );
}
