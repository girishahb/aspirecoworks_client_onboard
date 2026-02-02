import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import type { PrismaClient } from '.prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../storage/r2.service';
import { GenerateUploadUrlDto } from './dto/generate-upload-url.dto';
import { ReviewDocumentDto } from './dto/review-document.dto';
import { DocumentStatus } from '../common/enums/document-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { randomUUID } from 'crypto';

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private r2Service: R2Service,
    private auditLogsService: AuditLogsService,
  ) {}

  /** Typed Prisma client delegate access (PrismaService extends PrismaClient) */
  private get db(): PrismaClient {
    return this.prisma as unknown as PrismaClient;
  }

  /**
   * POST /documents/upload-url
   * Generate presigned upload URL for COMPANY_ADMIN
   * Company scoping enforced via request.user.companyId (never accept from client)
   * FileKey format: company/{companyId}/{type}/{uuid}.{ext}
   */
  async generateUploadUrl(
    dto: GenerateUploadUrlDto,
    user: { id: string; companyId?: string | null; role: UserRole },
  ) {
    if (user.role !== UserRole.COMPANY_ADMIN) {
      throw new ForbiddenException('Only COMPANY_ADMIN can generate upload URLs');
    }

    if (!user.companyId) {
      throw new ForbiddenException('No company associated with this user');
    }

    // Verify company exists
    const company = await this.db.clientProfile.findUnique({
      where: { id: user.companyId },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // Generate server-side UUID for fileKey
    const uuid = randomUUID();

    // Generate fileKey: company/{companyId}/{type}/{uuid}.{ext}
    const fileKey = this.r2Service.generateFileKey(
      user.companyId, // Always use user.companyId, never from client
      dto.documentType,
      dto.fileName,
      uuid,
    );

    // Create document record with status=UPLOADED, uploadedBy=user.id (COMPANY_ADMIN)
    const document = await this.db.document.create({
      data: {
        clientProfileId: user.companyId, // Always use user.companyId, never from client
        uploadedById: user.id, // COMPANY_ADMIN user ID
        fileName: dto.fileName,
        fileKey, // Server-generated UUID-based fileKey
        documentType: dto.documentType,
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
        status: DocumentStatus.UPLOADED, // Set to UPLOADED as per requirements
      },
    });

    // Generate presigned upload URL (5 min expiry)
    const uploadUrl = await this.r2Service.generateUploadUrl(
      fileKey,
      dto.mimeType || 'application/octet-stream',
      300, // 5 minutes
    );

    await this.auditLogsService.create({
      userId: user.id,
      clientProfileId: user.companyId,
      documentId: document.id,
      action: 'GENERATE_UPLOAD_URL',
      entityType: 'Document',
      entityId: document.id,
      changes: {
        fileName: dto.fileName,
        documentType: dto.documentType,
        fileSize: dto.fileSize,
        fileKey,
      },
    });

    return {
      documentId: document.id,
      uploadUrl,
      fileKey,
      expiresIn: 300, // 5 minutes
    };
  }

  /**
   * GET /documents/my
   * Get current user's documents (COMPANY_ADMIN sees own company's documents)
   * Company scoping enforced via request.user.companyId
   */
  async findMyDocuments(user: { id: string; companyId?: string | null; role: UserRole }) {
    const where: any = {};

    if (user.role === UserRole.COMPANY_ADMIN) {
      if (!user.companyId) {
        throw new ForbiddenException('No company associated with this user');
      }
      // COMPANY_ADMIN sees documents from their company
      where.clientProfileId = user.companyId;
    } else if (user.role === UserRole.SUPER_ADMIN) {
      // SUPER_ADMIN sees all documents
      // No where clause needed
    } else {
      throw new ForbiddenException('You do not have permission to access documents');
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

    // SUPER_ADMIN can download any document
    if (user.role === UserRole.SUPER_ADMIN) {
      // No additional checks needed
    }
    // COMPANY_ADMIN can only download documents of their company
    else if (user.role === UserRole.COMPANY_ADMIN) {
      if (!user.companyId) {
        throw new ForbiddenException('No company associated with this user');
      }
      if (document.clientProfileId !== user.companyId) {
        throw new ForbiddenException('You do not have permission to access this document');
      }
    } else {
      throw new ForbiddenException('You do not have permission to download documents');
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
   * Get documents for a specific company (SUPER_ADMIN only)
   * Never accept companyId from client for COMPANY_ADMIN - this route is SUPER_ADMIN only
   */
  async findByCompany(
    companyId: string,
    user: { id: string; role: UserRole },
  ) {
    if (user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can access documents by company ID');
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
      },
      orderBy: { createdAt: 'desc' },
    });

    return documents;
  }

  /**
   * PATCH /documents/:id/review
   * Review document (SUPER_ADMIN only)
   */
  async reviewDocument(
    id: string,
    dto: ReviewDocumentDto,
    user: { id: string; role: UserRole },
  ) {
    if (user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can review documents');
    }

    const existing = await this.db.document.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }

    if (dto.status === DocumentStatus.REJECTED && !dto.rejectionReason) {
      throw new BadRequestException('Rejection reason is required when rejecting a document');
    }

    const updateData: any = {
      status: dto.status,
      verifiedById: user.id,
      verifiedAt: new Date(),
    };

    if (dto.status === DocumentStatus.REJECTED && dto.rejectionReason) {
      updateData.rejectionReason = dto.rejectionReason;
    } else if (dto.status === DocumentStatus.VERIFIED) {
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

    await this.auditLogsService.create({
      userId: user.id,
      clientProfileId: existing.clientProfileId,
      documentId: id,
      action: 'REVIEW_DOCUMENT',
      entityType: 'Document',
      entityId: id,
      changes: {
        status: {
          before: existing.status,
          after: dto.status,
        },
        rejectionReason: dto.rejectionReason || null,
      },
    });

    return updated;
  }
}
