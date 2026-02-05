import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import type { PrismaClient } from '.prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../common/enums/user-role.enum';
import { DocumentStatus } from '../common/enums/document-status.enum';
import { CreateComplianceRequirementDto } from './dto/create-compliance-requirement.dto';

export interface ComplianceStatusResult {
  companyId: string;
  requiredDocumentTypes: string[];
  approvedDocumentTypes: string[];
  missingDocumentTypes: string[];
  isCompliant: boolean;
}

@Injectable()
export class ComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Typed Prisma client delegate access (PrismaService extends PrismaClient) */
  private get db(): PrismaClient {
    return this.prisma as unknown as PrismaClient;
  }

  /**
   * Get compliance status for a company (computed on the fly, not stored in DB).
   * - Fetches required document types from ComplianceRequirement
   * - Fetches approved (VERIFIED) documents for the company
   * - Returns missing document types and isCompliant
   */
  async getComplianceStatus(companyId: string): Promise<ComplianceStatusResult> {
    // Verify company exists
    const company = await this.db.clientProfile.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // Fetch required document types (no hardcoded types)
    const requirements = await this.db.complianceRequirement.findMany({
      orderBy: { documentType: 'asc' },
    });

    const requiredDocumentTypes: string[] = requirements.map((r) => r.documentType);

    // Fetch approved (VERIFIED) documents for this company
    const approvedDocuments = await this.db.document.findMany({
      where: {
        clientProfileId: companyId,
        status: DocumentStatus.VERIFIED,
      },
      select: { documentType: true },
    });

    // Unique document types that have at least one VERIFIED document
    const approvedDocumentTypes: string[] = [
      ...new Set(approvedDocuments.map((d) => d.documentType)),
    ];

    // Missing = required types that don't have an approved document
    const missingDocumentTypes: string[] = requiredDocumentTypes.filter(
      (type: string) => !approvedDocumentTypes.includes(type),
    );

    const isCompliant = missingDocumentTypes.length === 0;

    return {
      companyId,
      requiredDocumentTypes,
      approvedDocumentTypes,
      missingDocumentTypes,
      isCompliant,
    };
  }

  /**
   * GET /compliance/status - company-scoped (uses request.user.companyId for CLIENT)
   */
  async getStatusForCurrentUser(user: {
    id: string;
    companyId?: string | null;
    role: UserRole;
  }): Promise<ComplianceStatusResult> {
    if (user.role === UserRole.CLIENT || user.role === UserRole.COMPANY_ADMIN) {
      if (!user.companyId) {
        throw new ForbiddenException('No company associated with this user');
      }
      return this.getComplianceStatus(user.companyId);
    }

    throw new ForbiddenException('You do not have permission to access compliance status');
  }

  /**
   * GET /compliance/company/:companyId - SUPER_ADMIN only
   */
  async getStatusByCompanyId(
    companyId: string,
    user: { role: UserRole },
  ): Promise<ComplianceStatusResult> {
    if (user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can access compliance by company ID');
    }

    return this.getComplianceStatus(companyId);
  }

  /**
   * POST /compliance/requirements - SUPER_ADMIN only
   * Create a new compliance requirement (required document type).
   */
  async createRequirement(
    dto: CreateComplianceRequirementDto,
    user: { id: string; role: UserRole },
  ) {
    if (user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can create compliance requirements');
    }

    const existing = await this.db.complianceRequirement.findUnique({
      where: { documentType: dto.documentType },
    });

    if (existing) {
      throw new ConflictException(
        `Compliance requirement for document type ${dto.documentType} already exists`,
      );
    }

    return this.db.complianceRequirement.create({
      data: {
        documentType: dto.documentType,
        name: dto.name,
        description: dto.description,
      },
    });
  }

  /**
   * List all compliance requirements (for SUPER_ADMIN or for reference).
   */
  async listRequirements() {
    return this.db.complianceRequirement.findMany({
      orderBy: { documentType: 'asc' },
    });
  }
}