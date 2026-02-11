import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import type { PrismaClient } from '.prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../storage/r2.service';
import { EmailService } from '../email/email.service';
import { documentApproved } from '../email/templates/document-approved';
import { documentRejected } from '../email/templates/document-rejected';
import { agreementDraftShared } from '../email/templates/agreement-draft-shared';
import { finalAgreementShared } from '../email/templates/final-agreement-shared';
import { signedAgreementReceived } from '../email/templates/signed-agreement-received';
import { GenerateUploadUrlDto } from './dto/generate-upload-url.dto';
import { AdminAgreementDraftUploadDto } from './dto/admin-agreement-draft-upload.dto';
import { ReviewDocumentDto } from './dto/review-document.dto';
import { DocumentStatus } from '../common/enums/document-status.enum';
import {
  DocumentType,
  CLIENT_UPLOAD_DOCUMENT_TYPES,
} from '../common/enums/document-type.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { OnboardingStage } from '../common/enums/onboarding-stage.enum';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ClientProfilesService } from '../client-profiles/client-profiles.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { randomUUID } from 'crypto';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private prisma: PrismaService,
    private r2Service: R2Service,
    private auditLogsService: AuditLogsService,
    private emailService: EmailService,
    private clientProfilesService: ClientProfilesService,
    private onboardingService: OnboardingService,
  ) {}

  /** Typed Prisma client delegate access (PrismaService extends PrismaClient) */
  private get db(): PrismaClient {
    return this.prisma as unknown as PrismaClient;
  }

  /**
   * POST /documents/upload-url
   * Generate presigned upload URL for COMPANY_ADMIN: KYC or AGREEMENT_SIGNED only.
   * Stage and type enforced: no KYC before payment, no signed agreement before draft shared.
   */
  async generateUploadUrl(
    dto: GenerateUploadUrlDto,
    user: { id: string; companyId?: string | null; role: UserRole },
  ) {
    if (user.role !== UserRole.CLIENT && user.role !== UserRole.COMPANY_ADMIN) {
      throw new ForbiddenException('Only CLIENT or COMPANY_ADMIN role can upload documents');
    }

    if (!user.companyId) {
      throw new ForbiddenException('No company associated with this user');
    }

    // CLIENT can only upload KYC or AGREEMENT_SIGNED
    const allowedTypes = CLIENT_UPLOAD_DOCUMENT_TYPES as unknown as DocumentType[];
    if (!allowedTypes.includes(dto.documentType)) {
      throw new BadRequestException(
        `Clients can only upload KYC or signed agreement documents. Requested type "${dto.documentType}" is not allowed.`,
      );
    }

    const company = await this.db.clientProfile.findUnique({
      where: { id: user.companyId },
      select: { id: true, onboardingStage: true },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    await this.onboardingService.assertNotActive(user.companyId);

    const isSignedAgreement = dto.documentType === DocumentType.AGREEMENT_SIGNED;

    if (isSignedAgreement) {
      await this.onboardingService.assertStage(
        user.companyId,
        [OnboardingStage.AGREEMENT_DRAFT_SHARED],
        'Signed agreement upload is only available after agreement draft has been shared.',
      );
    } else {
      // KYC: only after payment confirmed
      await this.onboardingService.assertStage(
        user.companyId,
        [
          OnboardingStage.PAYMENT_CONFIRMED,
          OnboardingStage.KYC_IN_PROGRESS,
          OnboardingStage.KYC_REVIEW,
        ],
        'Payment required before uploading KYC',
      );
    }

    // Re-uploads do not delete old documents: we create a new record with version+1 and replacesId (no overwrites).
    const uuid = randomUUID();
    let replacesId: string | null = null;
    let version = 1;
    if (dto.replacesDocumentId) {
      const previous = await this.db.document.findFirst({
        where: {
          id: dto.replacesDocumentId,
          clientProfileId: user.companyId,
          documentType: dto.documentType,
        },
      });
      if (previous) {
        replacesId = previous.id;
        version = previous.version + 1;
      }
    }

    // Additional server-side validation (defense in depth)
    const sanitizedFileName = dto.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 255);
    const ext = sanitizedFileName.toLowerCase().match(/\.[^.]+$/)?.[0];
    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png'];
    if (!ext || !allowedExts.includes(ext)) {
      throw new BadRequestException(
        `Invalid file extension. Allowed: ${allowedExts.join(', ')}`,
      );
    }

    if (dto.fileSize > 10 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds maximum of 10MB');
    }

    // Generate safe file key with sanitized filename
    const fileKey = this.r2Service.generateFileKey(
      user.companyId,
      dto.documentType,
      sanitizedFileName,
      uuid,
    );

    let document;
    try {
      document = await this.db.document.create({
        data: {
          clientProfileId: user.companyId,
          uploadedById: user.id,
          ownerId: user.id,
          fileName: dto.fileName,
          fileKey,
          documentType: dto.documentType,
          fileSize: dto.fileSize,
          mimeType: dto.mimeType,
          status: isSignedAgreement ? DocumentStatus.REVIEW_PENDING : DocumentStatus.REVIEW_PENDING,
          version,
          replacesId,
          reviewNotes: null,
        },
      });
    } catch (err: any) {
      this.logger.error(`Document create failed: ${err?.message}`, err?.stack);
      if (err?.code === '22P02' || err?.message?.includes('invalid input value for enum')) {
        throw new BadRequestException(
          'Document type not supported. Ensure database migrations have been applied (run: npx prisma migrate deploy).',
        );
      }
      throw err;
    }

    const uploadUrl = await this.r2Service.generateUploadUrl(
      fileKey,
      dto.mimeType || 'application/octet-stream',
      300,
    );

    await this.auditLogsService.create({
      userId: user.id,
      clientProfileId: user.companyId,
      documentId: document.id,
      action: isSignedAgreement ? 'GENERATE_SIGNED_AGREEMENT_UPLOAD_URL' : 'GENERATE_UPLOAD_URL',
      entityType: 'Document',
      entityId: document.id,
      changes: {
        fileName: dto.fileName,
        documentType: dto.documentType,
        fileSize: dto.fileSize,
        fileKey,
        version: document.version,
        replacesId: document.replacesId ?? undefined,
      },
    });

    if (!isSignedAgreement) {
      try {
        await this.onboardingService.onKycUploaded(user.companyId);
        await this.onboardingService.moveToKycReviewAfterUpload(user.companyId);
      } catch (err) {
        this.logger.warn(
          `KYC upload stage transition skipped companyId=${user.companyId}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    return {
      documentId: document.id,
      uploadUrl,
      fileKey,
      expiresIn: 300,
    };
  }

  /**
   * POST /documents/upload
   * Proxy upload: client sends file via multipart; backend uploads to R2. Avoids CORS issues with presigned URLs.
   */
  async uploadDocumentProxy(
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    documentType: DocumentType,
    user: { id: string; companyId?: string | null; role: UserRole },
  ): Promise<{ documentId: string }> {
    if (user.role !== UserRole.CLIENT && user.role !== UserRole.COMPANY_ADMIN) {
      throw new ForbiddenException('Only CLIENT or COMPANY_ADMIN role can upload documents');
    }
    if (!user.companyId) {
      throw new ForbiddenException('No company associated with this user');
    }

    const allowedTypes = CLIENT_UPLOAD_DOCUMENT_TYPES as unknown as DocumentType[];
    if (!allowedTypes.includes(documentType)) {
      throw new BadRequestException(
        `Clients can only upload KYC or signed agreement documents. Requested type "${documentType}" is not allowed.`,
      );
    }

    const company = await this.db.clientProfile.findUnique({
      where: { id: user.companyId },
      select: { id: true, onboardingStage: true },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    await this.onboardingService.assertNotActive(user.companyId);

    const isSignedAgreement = documentType === DocumentType.AGREEMENT_SIGNED;

    if (isSignedAgreement) {
      await this.onboardingService.assertStage(
        user.companyId,
        [OnboardingStage.AGREEMENT_DRAFT_SHARED],
        'Signed agreement upload is only available after agreement draft has been shared.',
      );
    } else {
      await this.onboardingService.assertStage(
        user.companyId,
        [
          OnboardingStage.PAYMENT_CONFIRMED,
          OnboardingStage.KYC_IN_PROGRESS,
          OnboardingStage.KYC_REVIEW,
        ],
        'Payment required before uploading KYC',
      );
    }

    const uuid = randomUUID();
    const sanitizedFileName = (file.originalname || 'document')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 255);
    const ext = sanitizedFileName.toLowerCase().match(/\.[^.]+$/)?.[0];
    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png'];
    if (!ext || !allowedExts.includes(ext)) {
      throw new BadRequestException(
        `Invalid file extension. Allowed: ${allowedExts.join(', ')}`,
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds maximum of 10MB');
    }

    const fileKey = this.r2Service.generateFileKey(
      user.companyId,
      documentType,
      sanitizedFileName,
      uuid,
    );

    await this.r2Service.uploadFile(
      fileKey,
      file.buffer,
      file.mimetype || 'application/octet-stream',
    );

    let document;
    try {
      document = await this.db.document.create({
        data: {
          clientProfileId: user.companyId,
          uploadedById: user.id,
          ownerId: user.id,
          fileName: file.originalname || 'document',
          fileKey,
          documentType,
          fileSize: file.size,
          mimeType: file.mimetype || null,
          status: DocumentStatus.REVIEW_PENDING,
          version: 1,
          replacesId: null,
          reviewNotes: null,
        },
      });
    } catch (err: any) {
      this.logger.error(`Document create failed: ${err?.message}`, err?.stack);
      if (err?.code === '22P02' || err?.message?.includes('invalid input value for enum')) {
        throw new BadRequestException(
          'Document type not supported. Ensure database migrations have been applied.',
        );
      }
      throw err;
    }

    await this.auditLogsService.create({
      userId: user.id,
      clientProfileId: user.companyId,
      documentId: document.id,
      action: isSignedAgreement ? 'UPLOAD_SIGNED_AGREEMENT' : 'UPLOAD_DOCUMENT',
      entityType: 'Document',
      entityId: document.id,
      changes: {
        fileName: file.originalname,
        documentType,
        fileSize: file.size,
        fileKey,
      },
    });

    if (!isSignedAgreement) {
      try {
        await this.onboardingService.onKycUploaded(user.companyId);
        await this.onboardingService.moveToKycReviewAfterUpload(user.companyId);
      } catch (err) {
        this.logger.warn(
          `KYC upload stage transition skipped companyId=${user.companyId}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    if (isSignedAgreement) {
      await this.confirmSignedAgreement(document.id, user);
    }

    return { documentId: document.id };
  }

  /**
   * POST /documents/:id/confirm-signed-agreement
   * CLIENT only. Call after uploading the signed agreement file. Updates company stage to SIGNED_AGREEMENT_RECEIVED.
   */
  async confirmSignedAgreement(
    documentId: string,
    user: { id: string; companyId?: string | null; role: UserRole },
  ) {
    if (user.role !== UserRole.CLIENT && user.role !== UserRole.COMPANY_ADMIN) {
      throw new ForbiddenException('Only CLIENT or COMPANY_ADMIN role can confirm signed agreement upload');
    }
    if (!user.companyId) {
      throw new ForbiddenException('No company associated with this user');
    }

    const document = await this.db.document.findUnique({
      where: { id: documentId },
      include: {
        clientProfile: {
          select: {
            id: true,
            onboardingStage: true,
            companyName: true,
            contactEmail: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }
    if (document.clientProfileId !== user.companyId) {
      throw new ForbiddenException('You do not have permission to confirm this document');
    }
    if (document.documentType !== DocumentType.AGREEMENT_SIGNED) {
      throw new BadRequestException(
        'Only AGREEMENT_SIGNED documents can be confirmed. This document is not a signed agreement.',
      );
    }

    const company = document.clientProfile;
    if (!company) {
      throw new NotFoundException('Company not found for this document');
    }

    await this.onboardingService.assertNotActive(company.id);
    await this.onboardingService.assertStage(
      company.id,
      [OnboardingStage.AGREEMENT_DRAFT_SHARED, OnboardingStage.SIGNED_AGREEMENT_RECEIVED],
      'Signed agreement upload is only available after agreement draft has been shared.',
    );

    const currentStage = company.onboardingStage as OnboardingStage;
    const wasAlreadyReceived =
      currentStage === OnboardingStage.SIGNED_AGREEMENT_RECEIVED;
    try {
      await this.onboardingService.onSignedAgreementReceived(company.id);
      if (!wasAlreadyReceived) {
        this.logger.log(
          `Company ${company.id} moved to SIGNED_AGREEMENT_RECEIVED after signed agreement upload`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Signed agreement stage transition skipped companyId=${company.id}: ${err instanceof Error ? err.message : err}`,
      );
    }
    const didTransition = !wasAlreadyReceived;

    const to = (company as { contactEmail?: string | null }).contactEmail?.trim();
    if (to && didTransition) {
      try {
        const { subject, html, text } = signedAgreementReceived({
          companyName: (company as { companyName: string }).companyName,
        });
        await this.emailService.sendEmail({ to, subject, html, text });
      } catch (emailErr) {
        this.logger.warn(
          `Signed agreement received email failed companyId=${company.id}: ${emailErr instanceof Error ? emailErr.message : emailErr}`,
        );
      }
    }

    await this.auditLogsService.create({
      userId: user.id,
      clientProfileId: company.id,
      documentId: document.id,
      action: 'CONFIRM_SIGNED_AGREEMENT',
      entityType: 'Document',
      entityId: document.id,
      changes: { stage: OnboardingStage.SIGNED_AGREEMENT_RECEIVED },
    });

    return {
      success: true,
      message: 'Signed agreement received; onboarding stage updated.',
    };
  }

  /**
   * GET /documents/my
   * Get current user's documents (COMPANY_ADMIN sees own company's documents).
   * AGREEMENT_DRAFT is only visible when company stage = AGREEMENT_DRAFT_SHARED.
   */
  async findMyDocuments(user: { id: string; companyId?: string | null; role: UserRole }) {
    const where: any = {};

    if (user.role === UserRole.CLIENT || user.role === UserRole.COMPANY_ADMIN) {
      if (!user.companyId) {
        throw new ForbiddenException('No company associated with this user');
      }
      where.clientProfileId = user.companyId;
      const company = await this.db.clientProfile.findUnique({
        where: { id: user.companyId },
        select: { onboardingStage: true },
      });
      if (company && (company.onboardingStage as OnboardingStage) !== OnboardingStage.AGREEMENT_DRAFT_SHARED) {
        where.documentType = { not: DocumentType.AGREEMENT_DRAFT };
      }
    } else if (user.role === UserRole.SUPER_ADMIN) {
      // SUPER_ADMIN sees all documents
      // No where clause needed
    } else {
      throw new ForbiddenException('Only CLIENT or SUPER_ADMIN can access documents');
    }

    const documents = await this.db.document.findMany({
      where,
      include: {
        clientProfile: {
          select: {
            id: true,
            companyName: true,
            contactEmail: true,
          },
        },
        uploadedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        replaces: {
          select: {
            id: true,
            fileName: true,
            version: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return documents;
  }

  /**
   * GET /documents/:id/download
   * Get presigned download URL for a specific document
   * Company scoping enforced via request.user.companyId
   * SUPER_ADMIN can download any document
   * COMPANY_ADMIN can only download documents of their company
   */
  async generateDownloadUrl(
    documentId: string,
    user: { id: string; companyId?: string | null; role: UserRole },
  ) {
    // Validate document exists
    const document = await this.db.document.findUnique({
      where: { id: documentId },
      include: {
        clientProfile: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      // No additional checks
    } else if (user.role === UserRole.CLIENT || user.role === UserRole.COMPANY_ADMIN) {
      if (!user.companyId) {
        throw new ForbiddenException('No company associated with this user');
      }
      if (document.clientProfileId !== user.companyId) {
        throw new ForbiddenException('You do not have permission to access this document');
      }
    } else {
      throw new ForbiddenException('Only CLIENT or SUPER_ADMIN can download documents');
    }

    // Generate GET presigned URL (5 min expiry)
    const downloadUrl = await this.r2Service.generateDownloadUrl(document.fileKey, 300);

    return {
      documentId: document.id,
      fileName: document.fileName,
      downloadUrl,
      expiresIn: 300, // 5 minutes
    };
  }

  /**
   * GET /documents/company/:companyId
   * Get documents for a specific company (SUPER_ADMIN, ADMIN, MANAGER)
   * Never accept companyId from client for COMPANY_ADMIN - this route is admin-only
   */
  async findByCompany(
    companyId: string,
    user: { id: string; role: UserRole },
  ) {
    // Allow SUPER_ADMIN, ADMIN, and MANAGER roles
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.MANAGER
    ) {
      throw new ForbiddenException(
        'Only SUPER_ADMIN, ADMIN, and MANAGER can access documents by company ID',
      );
    }

    // Verify company exists
    const company = await this.db.clientProfile.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const documents = await this.db.document.findMany({
      where: {
        clientProfileId: companyId,
      },
      include: {
        clientProfile: {
          select: {
            id: true,
            companyName: true,
            contactEmail: true,
          },
        },
        uploadedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        replaces: {
          select: {
            id: true,
            fileName: true,
            version: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return documents;
  }

  /**
   * PATCH /documents/:id/review
   * Admin KYC review: Approve (VERIFIED), Reject (REJECTED with reason), or Mark Pending with Client (PENDING_WITH_CLIENT).
   * Stores adminRemarks. When all latest KYC docs are VERIFIED and stage is KYC_REVIEW, transitions to AGREEMENT_DRAFT_SHARED.
   */
  async reviewDocument(
    id: string,
    dto: ReviewDocumentDto,
    user: { id: string; role: UserRole },
  ) {
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.MANAGER
    ) {
      throw new ForbiddenException('Only SUPER_ADMIN, ADMIN, or MANAGER can review documents');
    }

    const existing = await this.db.document.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }

    await this.onboardingService.assertNotActive(existing.clientProfileId);
    await this.onboardingService.assertStage(
      existing.clientProfileId,
      [OnboardingStage.KYC_IN_PROGRESS, OnboardingStage.KYC_REVIEW],
      'KYC review is only allowed when stage is KYC in progress or KYC review.',
    );

    if (dto.status === DocumentStatus.REJECTED && !dto.rejectionReason?.trim()) {
      throw new BadRequestException('Rejection reason is required when rejecting a document');
    }

    const updateData: Record<string, unknown> = {
      status: dto.status,
      verifiedById: user.id,
      verifiedAt: new Date(),
      adminRemarks: dto.adminRemarks?.trim() || null,
    };

    if (dto.status === DocumentStatus.REJECTED) {
      updateData.rejectionReason = dto.rejectionReason?.trim() ?? null;
    } else {
      updateData.rejectionReason = null;
    }

    const updated = await this.db.document.update({
      where: { id },
      data: updateData,
      include: {
        clientProfile: {
          select: {
            id: true,
            companyName: true,
            contactEmail: true,
            onboardingStage: true,
          },
        },
        uploadedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const kycDecisionAction =
      dto.status === DocumentStatus.VERIFIED
        ? 'KYC_DOCUMENT_APPROVED'
        : dto.status === DocumentStatus.REJECTED
          ? 'KYC_DOCUMENT_REJECTED'
          : 'KYC_DOCUMENT_PENDING_WITH_CLIENT';

    await this.auditLogsService.create({
      userId: user.id,
      clientProfileId: existing.clientProfileId,
      documentId: id,
      action: kycDecisionAction,
      entityType: 'Document',
      entityId: id,
      changes: {
        status: { before: existing.status, after: dto.status },
        rejectionReason: dto.rejectionReason ?? null,
        adminRemarks: dto.adminRemarks ?? null,
      },
    });

    const to = updated.clientProfile?.contactEmail?.trim();
    if (to) {
      try {
        if (dto.status === DocumentStatus.VERIFIED) {
          const { subject, html, text } = documentApproved({
            companyName: updated.clientProfile!.companyName,
            documentType: updated.documentType,
          });
          await this.emailService.sendEmail({ to, subject, html, text });
        } else if (dto.status === DocumentStatus.REJECTED && dto.rejectionReason) {
          const { subject, html, text } = documentRejected({
            companyName: updated.clientProfile!.companyName,
            documentType: updated.documentType,
            rejectionReason: dto.rejectionReason,
          });
          await this.emailService.sendEmail({ to, subject, html, text });
        }
      } catch (emailErr) {
        this.logger.warn(
          `Document review email failed documentId=${id}: ${emailErr instanceof Error ? emailErr.message : emailErr}`,
        );
      }
    }

    // When document is approved and company is in KYC_REVIEW, check if all KYC docs are verified → move to AGREEMENT_DRAFT_SHARED
    if (
      dto.status === DocumentStatus.VERIFIED &&
      (updated.clientProfile?.onboardingStage as OnboardingStage) === OnboardingStage.KYC_REVIEW
    ) {
      const allKycApproved = await this.areAllKycDocumentsApproved(updated.clientProfileId);
      if (allKycApproved) {
        try {
          await this.onboardingService.onKycApproved(updated.clientProfileId);
          this.logger.log(
            `Company ${updated.clientProfileId} moved to AGREEMENT_DRAFT_SHARED after all KYC documents verified`,
          );
        } catch (err) {
          this.logger.warn(
            `Failed to transition company ${updated.clientProfileId} to AGREEMENT_DRAFT_SHARED: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    }

    return updated;
  }

  /**
   * Validates document is KYC, owner is CLIENT, and company stage allows review.
   * Prevents approving non-KYC docs and reviewing admin-uploaded docs. Blocks when company is ACTIVE (locked).
   */
  private async assertKycDocumentForReview(documentId: string): Promise<{
    document: { id: string; clientProfileId: string; documentType: string; documentOwner: string };
  }> {
    const document = await this.db.document.findUnique({
      where: { id: documentId },
      select: { id: true, clientProfileId: true, documentType: true, documentOwner: true },
    });
    if (!document) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }
    if (document.documentType !== DocumentType.KYC) {
      throw new BadRequestException('Only KYC documents can be reviewed with this action.');
    }
    if (document.documentOwner !== 'CLIENT') {
      throw new BadRequestException('Only client-uploaded KYC documents can be reviewed.');
    }
    await this.onboardingService.assertNotActive(document.clientProfileId);
    await this.onboardingService.assertStage(
      document.clientProfileId,
      [OnboardingStage.KYC_IN_PROGRESS, OnboardingStage.KYC_REVIEW],
      'KYC review is only allowed when stage is KYC in progress or KYC review.',
    );
    return { document };
  }

  /**
   * PATCH /admin/kyc/:documentId/approve – Approve KYC document. If all KYC approved, move to AGREEMENT_DRAFT_SHARED.
   */
  async approveKycDocument(
    documentId: string,
    dto: { reviewNotes?: string | null },
    user: { id: string; role: UserRole },
  ) {
    if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
      throw new ForbiddenException('Only SUPER_ADMIN, ADMIN, or MANAGER can approve KYC documents');
    }
    const { document } = await this.assertKycDocumentForReview(documentId);

    const updated = await this.db.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.APPROVED,
        verifiedById: user.id,
        verifiedAt: new Date(),
        reviewNotes: dto.reviewNotes?.trim() || null,
        rejectionReason: null,
      },
      include: {
        clientProfile: { select: { id: true, onboardingStage: true } },
      },
    });

    await this.auditLogsService.create({
      userId: user.id,
      clientProfileId: document.clientProfileId,
      documentId: documentId,
      action: 'KYC_DOCUMENT_APPROVED',
      entityType: 'Document',
      entityId: documentId,
      changes: { status: DocumentStatus.APPROVED, reviewNotes: dto.reviewNotes ?? null },
    });

    const companyId = updated.clientProfile!.id;
    const allKycApproved = await this.areAllKycDocumentsApproved(companyId);
    if (allKycApproved && (updated.clientProfile!.onboardingStage as OnboardingStage) === OnboardingStage.KYC_REVIEW) {
      try {
        await this.onboardingService.onKycApproved(companyId);
        this.logger.log(`Company ${companyId} moved to AGREEMENT_DRAFT_SHARED after all KYC approved`);
      } catch (err) {
        this.logger.warn(`Failed to transition company ${companyId}: ${err instanceof Error ? err.message : err}`);
      }
    }

    return this.getDocumentForAdminUi(documentId);
  }

  /**
   * PATCH /admin/kyc/:documentId/reject – Reject KYC; reviewNotes required. Stage remains KYC_IN_PROGRESS; client re-uploads.
   */
  async rejectKycDocument(
    documentId: string,
    dto: { reviewNotes: string },
    user: { id: string; role: UserRole },
  ) {
    if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
      throw new ForbiddenException('Only SUPER_ADMIN, ADMIN, or MANAGER can reject KYC documents');
    }
    const reviewNotes = dto.reviewNotes?.trim();
    if (!reviewNotes) {
      throw new BadRequestException('Review notes (rejection reason) are required when rejecting.');
    }
    const { document } = await this.assertKycDocumentForReview(documentId);

    await this.db.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.REJECTED,
        verifiedById: user.id,
        verifiedAt: new Date(),
        reviewNotes,
        rejectionReason: reviewNotes,
      },
    });

    await this.onboardingService.updateStage(document.clientProfileId, OnboardingStage.KYC_IN_PROGRESS);

    await this.auditLogsService.create({
      userId: user.id,
      clientProfileId: document.clientProfileId,
      documentId: documentId,
      action: 'KYC_DOCUMENT_REJECTED',
      entityType: 'Document',
      entityId: documentId,
      changes: { status: DocumentStatus.REJECTED, reviewNotes },
    });

    return this.getDocumentForAdminUi(documentId);
  }

  /**
   * PATCH /admin/kyc/:documentId/pending-client – Document unclear; need better copy. Stage = KYC_IN_PROGRESS.
   */
  async pendingWithClientKycDocument(
    documentId: string,
    dto: { reviewNotes: string },
    user: { id: string; role: UserRole },
  ) {
    if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
      throw new ForbiddenException('Only SUPER_ADMIN, ADMIN, or MANAGER can set KYC pending with client');
    }
    const reviewNotes = dto.reviewNotes?.trim();
    if (!reviewNotes) {
      throw new BadRequestException('Review notes are required to explain what the client should provide.');
    }
    const { document } = await this.assertKycDocumentForReview(documentId);

    await this.db.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.PENDING_WITH_CLIENT,
        verifiedById: user.id,
        verifiedAt: new Date(),
        reviewNotes,
        rejectionReason: null,
      },
    });

    await this.onboardingService.updateStage(document.clientProfileId, OnboardingStage.KYC_IN_PROGRESS);

    await this.auditLogsService.create({
      userId: user.id,
      clientProfileId: document.clientProfileId,
      documentId: documentId,
      action: 'KYC_DOCUMENT_PENDING_WITH_CLIENT',
      entityType: 'Document',
      entityId: documentId,
      changes: { status: DocumentStatus.PENDING_WITH_CLIENT, reviewNotes },
    });

    return this.getDocumentForAdminUi(documentId);
  }

  /**
   * PATCH /admin/kyc/:documentId/pending-admin – Internal verification needed. Stage = KYC_REVIEW.
   */
  async pendingWithAdminKycDocument(
    documentId: string,
    dto: { reviewNotes?: string | null },
    user: { id: string; role: UserRole },
  ) {
    if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
      throw new ForbiddenException('Only SUPER_ADMIN, ADMIN, or MANAGER can set KYC pending with admin');
    }
    const { document } = await this.assertKycDocumentForReview(documentId);

    await this.db.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.PENDING_WITH_ADMIN,
        verifiedById: user.id,
        verifiedAt: new Date(),
        reviewNotes: dto.reviewNotes?.trim() || null,
        rejectionReason: null,
      },
    });

    await this.onboardingService.updateStage(document.clientProfileId, OnboardingStage.KYC_REVIEW);

    await this.auditLogsService.create({
      userId: user.id,
      clientProfileId: document.clientProfileId,
      documentId: documentId,
      action: 'KYC_DOCUMENT_PENDING_WITH_ADMIN',
      entityType: 'Document',
      entityId: documentId,
      changes: { status: DocumentStatus.PENDING_WITH_ADMIN, reviewNotes: dto.reviewNotes ?? null },
    });

    return this.getDocumentForAdminUi(documentId);
  }

  /**
   * Returns document with status, reviewNotes, version, createdAt, type, owner for Admin UI (timeline, badges, comments).
   */
  private async getDocumentForAdminUi(documentId: string) {
    const doc = await this.db.document.findUnique({
      where: { id: documentId },
      include: {
        clientProfile: { select: { id: true, companyName: true, onboardingStage: true } },
        uploadedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    if (!doc) throw new NotFoundException(`Document ${documentId} not found`);
    return doc;
  }

  /**
   * Returns true if, for each document type, the latest document (by version) for the company is VERIFIED.
   */
  private async areAllLatestDocumentsVerified(clientProfileId: string): Promise<boolean> {
    const docs = await this.db.document.findMany({
      where: { clientProfileId },
      select: { id: true, documentType: true, version: true, status: true },
      orderBy: { documentType: 'asc', version: 'desc' },
    });
    const latestByType = new Map<string, { status: string }>();
    for (const d of docs) {
      if (!latestByType.has(d.documentType)) {
        latestByType.set(d.documentType, { status: d.status });
      }
    }
    for (const [, { status }] of latestByType) {
      if (status !== DocumentStatus.VERIFIED) return false;
    }
    return latestByType.size > 0;
  }

  /**
   * Returns true if the company has at least one KYC document and the latest KYC document (by version) is APPROVED or VERIFIED.
   * Used to enforce "all KYC approved" before admin can upload agreement draft and for approve→stage transition.
   */
  private async areAllKycDocumentsApproved(clientProfileId: string): Promise<boolean> {
    const latestKyc = await this.db.document.findFirst({
      where: {
        clientProfileId,
        documentType: DocumentType.KYC,
        documentOwner: 'CLIENT',
      },
      orderBy: { version: 'desc' },
      select: { status: true },
    });
    return (
      latestKyc != null &&
      (latestKyc.status === DocumentStatus.APPROVED || latestKyc.status === DocumentStatus.VERIFIED)
    );
  }

  /**
   * POST /documents/admin/agreement-draft-upload-url
   * Admin uploads AGREEMENT_DRAFT. Agreement flow starts only when stage = AGREEMENT_DRAFT_SHARED (reached after all KYC approved).
   * type = AGREEMENT_DRAFT, owner = ADMIN, status = APPROVED. Version auto-increments; replacesId set when replacing previous draft.
   */
  async generateAdminAgreementDraftUploadUrl(
    dto: AdminAgreementDraftUploadDto,
    user: { id: string; role: UserRole },
  ) {
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.MANAGER
    ) {
      throw new ForbiddenException(
        'Only SUPER_ADMIN, ADMIN, or MANAGER can upload agreement drafts',
      );
    }

    const company = await this.db.clientProfile.findUnique({
      where: { id: dto.companyId },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    await this.onboardingService.assertNotActive(dto.companyId);
    await this.onboardingService.assertStage(
      dto.companyId,
      [OnboardingStage.AGREEMENT_DRAFT_SHARED],
      'Agreement draft can only be uploaded when stage is Agreement draft shared.',
    );

    const previousDraft = await this.db.document.findFirst({
      where: {
        clientProfileId: dto.companyId,
        documentType: DocumentType.AGREEMENT_DRAFT,
      },
      orderBy: { version: 'desc' },
      select: { id: true, version: true },
    });
    const version = previousDraft ? previousDraft.version + 1 : 1;
    const replacesId = previousDraft?.id ?? null;

    const uuid = randomUUID();
    const fileKey = this.r2Service.generateFileKey(
      dto.companyId,
      DocumentType.AGREEMENT_DRAFT,
      dto.fileName,
      uuid,
    );

    const document = await this.db.document.create({
      data: {
        clientProfileId: dto.companyId,
        uploadedById: user.id,
        ownerId: user.id,
        documentOwner: 'ADMIN',
        fileName: dto.fileName,
        fileKey,
        documentType: DocumentType.AGREEMENT_DRAFT,
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
        status: DocumentStatus.APPROVED,
        version,
        replacesId,
      },
    });

    const uploadUrl = await this.r2Service.generateUploadUrl(
      fileKey,
      dto.mimeType || 'application/octet-stream',
      300,
    );

    await this.auditLogsService.create({
      userId: user.id,
      clientProfileId: dto.companyId,
      documentId: document.id,
      action: 'ADMIN_AGREEMENT_DRAFT_UPLOAD_URL',
      entityType: 'Document',
      entityId: document.id,
      changes: {
        fileName: dto.fileName,
        fileKey,
      },
    });

    return {
      documentId: document.id,
      uploadUrl,
      fileKey,
      expiresIn: 300,
    };
  }

  /**
   * POST /documents/:id/notify-agreement-draft-shared
   * After admin has uploaded the agreement draft file, call this to notify the client by email and update company stage to AGREEMENT_DRAFT_SHARED.
   */
  async notifyAgreementDraftShared(
    documentId: string,
    user: { id: string; role: UserRole },
  ) {
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.MANAGER
    ) {
      throw new ForbiddenException(
        'Only SUPER_ADMIN, ADMIN, or MANAGER can notify agreement draft shared',
      );
    }

    const document = await this.db.document.findUnique({
      where: { id: documentId },
      include: {
        clientProfile: {
          select: {
            id: true,
            companyName: true,
            contactEmail: true,
            onboardingStage: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }

    if (document.documentType !== DocumentType.AGREEMENT_DRAFT) {
      throw new BadRequestException(
        'Document is not an agreement draft. Only AGREEMENT_DRAFT documents can be notified as shared.',
      );
    }

    const company = document.clientProfile;
    if (!company) {
      throw new NotFoundException('Company not found for this document');
    }

    await this.onboardingService.assertNotActive(company.id);

    const to = company.contactEmail?.trim();
    if (to) {
      try {
        const { subject, html, text } = agreementDraftShared({
          companyName: company.companyName,
        });
        await this.emailService.sendEmail({ to, subject, html, text });
      } catch (emailErr) {
        this.logger.warn(
          `Agreement draft shared email failed documentId=${documentId}: ${emailErr instanceof Error ? emailErr.message : emailErr}`,
        );
      }
    }

    try {
      await this.onboardingService.onAgreementDraftShared(company.id);
      if (company.onboardingStage !== OnboardingStage.AGREEMENT_DRAFT_SHARED) {
        this.logger.log(
          `Company ${company.id} moved to AGREEMENT_DRAFT_SHARED after agreement draft notify`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Failed to transition company ${company.id} to AGREEMENT_DRAFT_SHARED: ${err instanceof Error ? err.message : err}`,
      );
    }

    await this.auditLogsService.create({
      userId: user.id,
      clientProfileId: company.id,
      documentId: document.id,
      action: 'NOTIFY_AGREEMENT_DRAFT_SHARED',
      entityType: 'Document',
      entityId: document.id,
      changes: { notified: true, stage: OnboardingStage.AGREEMENT_DRAFT_SHARED },
    });

    return {
      success: true,
      message: 'Client notified and stage updated to AGREEMENT_DRAFT_SHARED',
    };
  }

  /**
   * POST /documents/admin/agreement-final-upload-url
   * Admin uploads AGREEMENT_FINAL after client has uploaded signed agreement.
   * Allowed only when stage is SIGNED_AGREEMENT_RECEIVED. type = AGREEMENT_FINAL, owner = ADMIN, status = APPROVED. Version auto-increments.
   */
  async generateAdminAgreementFinalUploadUrl(
    dto: AdminAgreementDraftUploadDto,
    user: { id: string; role: UserRole },
  ) {
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.MANAGER
    ) {
      throw new ForbiddenException(
        'Only SUPER_ADMIN, ADMIN, or MANAGER can upload final agreements',
      );
    }

    const company = await this.db.clientProfile.findUnique({
      where: { id: dto.companyId },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    await this.onboardingService.assertNotActive(dto.companyId);
    await this.onboardingService.assertStage(
      dto.companyId,
      [OnboardingStage.SIGNED_AGREEMENT_RECEIVED],
      'Signed agreement required before final document upload',
    );

    const previousFinal = await this.db.document.findFirst({
      where: {
        clientProfileId: dto.companyId,
        documentType: DocumentType.AGREEMENT_FINAL,
      },
      orderBy: { version: 'desc' },
      select: { id: true, version: true },
    });
    const version = previousFinal ? previousFinal.version + 1 : 1;
    const replacesId = previousFinal?.id ?? null;

    const uuid = randomUUID();
    const fileKey = this.r2Service.generateFileKey(
      dto.companyId,
      DocumentType.AGREEMENT_FINAL,
      dto.fileName,
      uuid,
    );

    const document = await this.db.document.create({
      data: {
        clientProfileId: dto.companyId,
        uploadedById: user.id,
        ownerId: user.id,
        documentOwner: 'ADMIN',
        fileName: dto.fileName,
        fileKey,
        documentType: DocumentType.AGREEMENT_FINAL,
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
        status: DocumentStatus.APPROVED,
        version,
        replacesId,
      },
    });

    const uploadUrl = await this.r2Service.generateUploadUrl(
      fileKey,
      dto.mimeType || 'application/octet-stream',
      300,
    );

    await this.auditLogsService.create({
      userId: user.id,
      clientProfileId: dto.companyId,
      documentId: document.id,
      action: 'ADMIN_AGREEMENT_FINAL_UPLOAD_URL',
      entityType: 'Document',
      entityId: document.id,
      changes: { fileName: dto.fileName, fileKey },
    });

    return {
      documentId: document.id,
      uploadUrl,
      fileKey,
      expiresIn: 300,
    };
  }

  /**
   * POST /documents/:id/notify-agreement-final-shared
   * After admin has uploaded the final agreement file, call this to notify the client by email and update company stage to FINAL_AGREEMENT_SHARED.
   */
  async notifyAgreementFinalShared(
    documentId: string,
    user: { id: string; role: UserRole },
  ) {
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.MANAGER
    ) {
      throw new ForbiddenException(
        'Only SUPER_ADMIN, ADMIN, or MANAGER can notify final agreement shared',
      );
    }

    const document = await this.db.document.findUnique({
      where: { id: documentId },
      include: {
        clientProfile: {
          select: {
            id: true,
            companyName: true,
            contactEmail: true,
            onboardingStage: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }

    if (document.documentType !== DocumentType.AGREEMENT_FINAL) {
      throw new BadRequestException(
        'Document is not a final agreement. Only AGREEMENT_FINAL documents can be notified as shared.',
      );
    }

    const company = document.clientProfile;
    if (!company) {
      throw new NotFoundException('Company not found for this document');
    }

    await this.onboardingService.assertNotActive(company.id);

    const to = company.contactEmail?.trim();
    if (to) {
      try {
        const { subject, html, text } = finalAgreementShared({
          companyName: company.companyName,
        });
        await this.emailService.sendEmail({ to, subject, html, text });
      } catch (emailErr) {
        this.logger.warn(
          `Final agreement shared email failed documentId=${documentId}: ${emailErr instanceof Error ? emailErr.message : emailErr}`,
        );
      }
    }

    try {
      await this.onboardingService.onFinalAgreementShared(company.id);
      if (company.onboardingStage !== OnboardingStage.FINAL_AGREEMENT_SHARED) {
        this.logger.log(
          `Company ${company.id} moved to FINAL_AGREEMENT_SHARED after final agreement notify`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Failed to transition company ${company.id} to FINAL_AGREEMENT_SHARED: ${err instanceof Error ? err.message : err}`,
      );
    }

    await this.auditLogsService.create({
      userId: user.id,
      clientProfileId: company.id,
      documentId: document.id,
      action: 'NOTIFY_AGREEMENT_FINAL_SHARED',
      entityType: 'Document',
      entityId: document.id,
      changes: { notified: true, stage: OnboardingStage.FINAL_AGREEMENT_SHARED },
    });

    return {
      success: true,
      message: 'Client notified and stage updated to FINAL_AGREEMENT_SHARED',
    };
  }

  /**
   * Get latest AGREEMENT_DRAFT for a company (by version). Used by Admin + Client UIs.
   */
  async getLatestAgreementDraft(companyId: string) {
    return this.db.document.findFirst({
      where: { clientProfileId: companyId, documentType: DocumentType.AGREEMENT_DRAFT },
      orderBy: { version: 'desc' },
      include: {
        uploadedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        clientProfile: { select: { id: true, companyName: true, onboardingStage: true } },
      },
    });
  }

  /**
   * Get latest AGREEMENT_SIGNED for a company (by version). Used by Admin + Client UIs.
   */
  async getLatestSignedAgreement(companyId: string) {
    return this.db.document.findFirst({
      where: { clientProfileId: companyId, documentType: DocumentType.AGREEMENT_SIGNED },
      orderBy: { version: 'desc' },
      include: {
        uploadedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        clientProfile: { select: { id: true, companyName: true, onboardingStage: true } },
      },
    });
  }

  /**
   * Get latest AGREEMENT_FINAL for a company (by version). Used by Admin + Client UIs.
   */
  async getLatestFinalAgreement(companyId: string) {
    return this.db.document.findFirst({
      where: { clientProfileId: companyId, documentType: DocumentType.AGREEMENT_FINAL },
      orderBy: { version: 'desc' },
      include: {
        uploadedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        clientProfile: { select: { id: true, companyName: true, onboardingStage: true } },
      },
    });
  }

  /**
   * Return true if company has at least one AGREEMENT_FINAL (eligible for activation).
   */
  async isAgreementProcessComplete(companyId: string): Promise<boolean> {
    const doc = await this.db.document.findFirst({
      where: { clientProfileId: companyId, documentType: DocumentType.AGREEMENT_FINAL },
      select: { id: true },
    });
    return doc != null;
  }

  /**
   * GET /documents/agreement-drafts – COMPANY_ADMIN lists AGREEMENT_DRAFT documents. Only when stage = AGREEMENT_DRAFT_SHARED.
   * Returns type, version, uploadedBy, createdAt, status for timeline (Draft v1 → Signed v1 → Final v1).
   */
  async listAgreementDraftsForClient(user: { id: string; companyId?: string | null; role: UserRole }) {
    if (user.role !== UserRole.CLIENT && user.role !== UserRole.COMPANY_ADMIN) {
      throw new ForbiddenException('Only CLIENT or COMPANY_ADMIN can list agreement drafts for their company');
    }
    if (!user.companyId) {
      throw new ForbiddenException('No company associated with this user');
    }
    await this.onboardingService.assertStage(
      user.companyId,
      [OnboardingStage.AGREEMENT_DRAFT_SHARED],
      'Agreement drafts are only visible when stage is Agreement draft shared.',
    );
    const documents = await this.db.document.findMany({
      where: {
        clientProfileId: user.companyId,
        documentType: DocumentType.AGREEMENT_DRAFT,
      },
      orderBy: { version: 'desc' },
      include: {
        uploadedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    return documents;
  }
}
