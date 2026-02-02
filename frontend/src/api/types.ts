/** GET /compliance/status */
export interface ComplianceStatus {
  companyId: string;
  requiredDocumentTypes: string[];
  approvedDocumentTypes: string[];
  missingDocumentTypes: string[];
  isCompliant: boolean;
}

/** GET /companies/me – ClientProfile subset */
export interface CompanyMe {
  id: string;
  companyName: string;
  contactEmail: string;
  contactPhone: string | null;
  renewalDate: string | null;
  onboardingStatus: string;
  createdAt: string;
  updatedAt: string;
}

/** GET /companies – list item (SUPER_ADMIN) */
export interface AdminCompany {
  id: string;
  companyName: string;
  contactEmail: string;
  onboardingStatus: string;
  renewalDate: string | null;
  createdAt: string;
  updatedAt: string;
}

/** GET /documents – list item */
export interface DocumentListItem {
  id: string;
  documentType: string;
  status: string;
  fileName: string;
  createdAt: string;
  rejectionReason?: string | null;
  clientProfileId?: string;
}

/** POST /documents/upload-url – request */
export interface GenerateUploadUrlRequest {
  documentType: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
}

/** POST /documents/upload-url – response */
export interface GenerateUploadUrlResponse {
  documentId: string;
  uploadUrl: string;
  fileKey: string;
  expiresIn: number;
}

/** PATCH /documents/:id/review – request */
export interface ReviewDocumentRequest {
  status: 'VERIFIED' | 'REJECTED';
  rejectionReason?: string;
}
