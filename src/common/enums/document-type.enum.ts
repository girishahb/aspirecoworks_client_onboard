export enum DocumentType {
  AADHAAR = 'AADHAAR',
  PAN = 'PAN',
  KYC = 'KYC',
  CONTRACT = 'CONTRACT',
  LICENSE = 'LICENSE',
  CERTIFICATE = 'CERTIFICATE',
  IDENTIFICATION = 'IDENTIFICATION',
  FINANCIAL = 'FINANCIAL',
  AGREEMENT_DRAFT = 'AGREEMENT_DRAFT',
  AGREEMENT_SIGNED = 'AGREEMENT_SIGNED',
  AGREEMENT_FINAL = 'AGREEMENT_FINAL',
  OTHER = 'OTHER',
}

/** Document types CLIENT is allowed to upload for KYC (Aadhaar, PAN, and Other). */
export const CLIENT_UPLOAD_DOCUMENT_TYPES = [
  DocumentType.AADHAAR,
  DocumentType.PAN,
  DocumentType.OTHER,
  DocumentType.AGREEMENT_SIGNED,
] as const;

/** Document types ADMIN is allowed to upload. */
export const ADMIN_UPLOAD_DOCUMENT_TYPES = [
  DocumentType.AGREEMENT_DRAFT,
  DocumentType.AGREEMENT_FINAL,
] as const;
