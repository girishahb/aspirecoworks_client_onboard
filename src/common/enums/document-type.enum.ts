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
  NOC_ASPIRE_COWORKS = 'NOC_ASPIRE_COWORKS',
  NOC_LANDLORD = 'NOC_LANDLORD',
  ELECTRICITY_BILL = 'ELECTRICITY_BILL',
  WIFI_BILL = 'WIFI_BILL',
  OTHER = 'OTHER',
}

/** Document types admin can upload after signed agreement (stage SIGNED_AGREEMENT_RECEIVED). Only AGREEMENT_FINAL triggers notify + stage change. */
export const ADMIN_POST_AGREEMENT_DOC_TYPES = [
  DocumentType.AGREEMENT_FINAL,
  DocumentType.NOC_ASPIRE_COWORKS,
  DocumentType.NOC_LANDLORD,
  DocumentType.ELECTRICITY_BILL,
  DocumentType.WIFI_BILL,
] as const;

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
  DocumentType.NOC_ASPIRE_COWORKS,
  DocumentType.NOC_LANDLORD,
  DocumentType.ELECTRICITY_BILL,
  DocumentType.WIFI_BILL,
] as const;
