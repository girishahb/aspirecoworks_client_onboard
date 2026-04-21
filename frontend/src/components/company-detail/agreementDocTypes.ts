import type { AdminPostAgreementDocumentType } from '../../services/admin';

export const POST_AGREEMENT_DOC_TYPES: { value: AdminPostAgreementDocumentType; label: string }[] = [
  { value: 'AGREEMENT_FINAL', label: 'Final Agreement' },
  { value: 'NOC_ASPIRE_COWORKS', label: 'NOC from Aspire Coworks' },
  { value: 'NOC_LANDLORD', label: 'NOC from Landlord' },
  { value: 'ELECTRICITY_BILL', label: 'Electricity Bill' },
  { value: 'WIFI_BILL', label: 'Wifi Bill' },
];
