import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import type { PrismaClient } from '.prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../storage/r2.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { DocumentType } from '../common/enums/document-type.enum';
import { DocumentStatus } from '../common/enums/document-status.enum';
import { OnboardingStage } from '../common/enums/onboarding-stage.enum';
import { UserRole } from '../common/enums/user-role.enum';

/**
 * Service that renders packaged agreement .docx templates (GR/BR Leave & License,
 * Mailing Address Virtual Office, etc.) and persists the output as an AGREEMENT_DRAFT
 * Document for an aggregator-onboarded client. Aggregator-only. Does NOT notify the
 * client -- admin still clicks the existing "Notify draft shared" button after reviewing.
 */
@Injectable()
export class AgreementTemplateService {
  private readonly logger = new Logger(AgreementTemplateService.name);

  private static readonly DOCX_MIME =
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  /**
   * Map of supported aggregator plan types (uppercase `planType` after trim)
   * to their packaged .docx template. Add a new entry here (and ship the .docx
   * under `src/documents/templates/`) to enable template-based draft generation.
   * Templates should use the same placeholder set as GR/BR where possible
   * (see `buildTemplateContext` below).
   */
  private static readonly TEMPLATE_BY_PLAN: Record<string, { fileName: string; label: string }> = {
    GR: { fileName: 'leave-license-agreement-gr.docx', label: 'GR' },
    BR: { fileName: 'leave-license-agreement-br.docx', label: 'BR' },
    /** planType from booking is normalized with `.toUpperCase()` → "MAILING ADDRESS" */
    'MAILING ADDRESS': {
      fileName: 'virtual-office-mailing-address.docx',
      label: 'Mailing_Address',
    },
  };

  /**
   * Plan types for which template-based generation is supported. Used by the
   * frontend gate / tooltip indirectly via API errors, and for the 400 message
   * when the current booking's plan is not supported.
   */
  static getSupportedPlanTypes(): string[] {
    return Object.keys(AgreementTemplateService.TEMPLATE_BY_PLAN);
  }

  /**
   * Stages at which the agreement draft can be generated from a template.
   *
   * For aggregator-onboarded clients the draft is rendered purely from
   * registration data captured at client-create time (company details + the
   * booking's signatory fields), so generation must be possible right after
   * registration, well before KYC is complete. We only block generation once
   * the client has already signed a draft (SIGNED_AGREEMENT_RECEIVED or later)
   * or the lifecycle is terminal / rejected.
   *
   * Stage transitions for notifying the client (POST /documents/:id/notify-
   * agreement-draft-shared) remain unchanged -- admin still clicks that button
   * once KYC is approved to advance the stage + email the client.
   */
  private static readonly DRAFT_GENERATION_ALLOWED_STAGES: OnboardingStage[] = [
    OnboardingStage.ADMIN_CREATED,
    OnboardingStage.PAYMENT_PENDING,
    OnboardingStage.PENDING_DOCUMENTS,
    OnboardingStage.DOCUMENTS_SUBMITTED,
    OnboardingStage.UNDER_REVIEW,
    OnboardingStage.PAYMENT_CONFIRMED,
    OnboardingStage.KYC_IN_PROGRESS,
    OnboardingStage.KYC_REVIEW,
    OnboardingStage.AGREEMENT_DRAFT_SHARED,
  ];

  static getDraftGenerationAllowedStages(): OnboardingStage[] {
    return [...AgreementTemplateService.DRAFT_GENERATION_ALLOWED_STAGES];
  }

  constructor(
    private prisma: PrismaService,
    private r2Service: R2Service,
    private auditLogsService: AuditLogsService,
    private onboardingService: OnboardingService,
  ) {}

  private get db(): PrismaClient {
    return this.prisma as unknown as PrismaClient;
  }

  /**
   * Resolve the absolute path to the template, checking both compiled (`dist/`)
   * and source (`src/`) locations so it works in dev + prod.
   */
  /**
   * Calendar month arithmetic in the **server local** timezone.
   * Month-end edge cases (e.g. 31 Jan + 1 month) follow native `Date#setMonth` behaviour.
   */
  private static addMonths(base: Date, months: number): Date {
    const d = new Date(base.getTime());
    d.setMonth(d.getMonth() + months);
    return d;
  }

  /** One display format for all agreement date placeholders (en-IN style). */
  private static formatAgreementDate(d: Date): string {
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private resolveTemplatePath(fileName: string): string {
    const candidates = [
      path.join(__dirname, 'templates', fileName),
      path.join(process.cwd(), 'src', 'documents', 'templates', fileName),
      path.join(process.cwd(), 'dist', 'documents', 'templates', fileName),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    throw new Error(
      `Agreement template not found. Looked in: ${candidates.join(', ')}`,
    );
  }

  /**
   * Build the context object passed to docxtemplater. Keys match the EXACT
   * placeholders in the shipped templates (including spaces and the
   * misspelling of "AAdhar"). Pro forma dates: `current date` and
   * `contract start date` use `referenceAt`; `contract end date` is
   * `referenceAt` + 11 calendar months. Missing non-date values fall back to
   * empty string so rendering never throws.
   */
  private buildTemplateContext(input: {
    client: {
      companyName: string | null;
      address: string | null;
      city: string | null;
      state: string | null;
      zipCode: string | null;
      country: string | null;
      contactEmail: string | null;
      contactPhone: string | null;
    };
    booking: {
      clientContactName: string | null;
      clientFatherOrSpouseName: string | null;
      clientPan: string | null;
      clientAadhaar: string | null;
      venueName: string | null;
      venueAddress: string | null;
    };
    /** Single instant for pro forma contract term + "current date" in the Word template. */
    referenceAt: Date;
  }): Record<string, string> {
    const { client, booking, referenceAt } = input;
    const addressParts = [
      client.address,
      client.city,
      client.state,
      client.zipCode,
      client.country,
    ]
      .map((p) => (p ?? '').trim())
      .filter((p) => p.length > 0);
    const composedAddress = addressParts.join(', ');

    const venueParts = [booking.venueName, booking.venueAddress]
      .map((p) => (p ?? '').trim())
      .filter((p) => p.length > 0);
    const composedVenue = venueParts.join(', ');

    const currentFormatted = AgreementTemplateService.formatAgreementDate(referenceAt);
    const contractEnd = AgreementTemplateService.addMonths(referenceAt, 11);

    return {
      'client company name': client.companyName ?? '',
      'client name': booking.clientContactName ?? '',
      'father or Spouse name': booking.clientFatherOrSpouseName ?? '',
      'client address': composedAddress,
      'contact number': client.contactPhone ?? '',
      email: client.contactEmail ?? '',
      PAN: (booking.clientPan ?? '').toUpperCase(),
      AAdhar: booking.clientAadhaar ?? '',
      'venue & venue address': composedVenue,
      'current date': currentFormatted,
      'contract start date': currentFormatted,
      'contract end date': AgreementTemplateService.formatAgreementDate(contractEnd),
    };
  }

  /**
   * Render the plan-specific agreement template for the given aggregator-onboarded
   * company and persist the output as a new AGREEMENT_DRAFT Document row (versioned).
   */
  async generateAgreementDraftFromTemplate(
    companyId: string,
    user: { id: string; role: UserRole },
  ): Promise<{ documentId: string; fileName: string; version: number }> {
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.MANAGER
    ) {
      throw new ForbiddenException(
        'Only SUPER_ADMIN, ADMIN, or MANAGER can generate agreement drafts from templates',
      );
    }

    const company = await this.db.clientProfile.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    if ((company as unknown as { clientChannel?: string }).clientChannel !== 'AGGREGATOR') {
      throw new BadRequestException(
        'Template generation is available for aggregator-onboarded clients only',
      );
    }

    await this.onboardingService.assertNotActive(companyId);
    await this.onboardingService.assertStage(
      companyId,
      AgreementTemplateService.DRAFT_GENERATION_ALLOWED_STAGES,
      'Agreement draft can no longer be generated from the template: the client has already received, signed, or completed the agreement.',
    );

    const booking = await this.db.aggregatorBooking.findFirst({
      where: { clientProfileId: companyId },
      orderBy: { createdAt: 'desc' },
    });
    if (!booking) {
      throw new BadRequestException(
        'No aggregator booking found for this client; cannot render agreement template',
      );
    }
    const planKey = (booking.planType ?? '').toUpperCase();
    const templateEntry = AgreementTemplateService.TEMPLATE_BY_PLAN[planKey];
    if (!templateEntry) {
      const supported = AgreementTemplateService.getSupportedPlanTypes().join(', ');
      throw new BadRequestException(
        `Template only available for plan types: ${supported}. Current plan: ${booking.planType ?? 'not set'}.`,
      );
    }

    const referenceAt = new Date();

    const templatePath = this.resolveTemplatePath(templateEntry.fileName);
    const templateBytes = fs.readFileSync(templatePath);
    const zip = new PizZip(templateBytes);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{{', end: '}}' },
    });

    const context = this.buildTemplateContext({
      client: {
        companyName: company.companyName ?? null,
        address: (company as unknown as { address?: string | null }).address ?? null,
        city: (company as unknown as { city?: string | null }).city ?? null,
        state: (company as unknown as { state?: string | null }).state ?? null,
        zipCode: (company as unknown as { zipCode?: string | null }).zipCode ?? null,
        country: (company as unknown as { country?: string | null }).country ?? null,
        contactEmail:
          (company as unknown as { contactEmail?: string | null }).contactEmail ?? null,
        contactPhone:
          (company as unknown as { contactPhone?: string | null }).contactPhone ?? null,
      },
      booking: {
        clientContactName: booking.clientContactName ?? null,
        clientFatherOrSpouseName:
          (booking as unknown as { clientFatherOrSpouseName?: string | null })
            .clientFatherOrSpouseName ?? null,
        clientPan:
          (booking as unknown as { clientPan?: string | null }).clientPan ?? null,
        clientAadhaar:
          (booking as unknown as { clientAadhaar?: string | null }).clientAadhaar ?? null,
        venueName: booking.venueName ?? null,
        venueAddress: booking.venueAddress ?? null,
      },
      referenceAt,
    });

    try {
      doc.render(context);
    } catch (err) {
      this.logger.error(
        `docxtemplater render failed for company=${companyId}: ${err instanceof Error ? err.message : err}`,
      );
      throw new BadRequestException(
        'Failed to render agreement template. Please verify placeholders in the template file.',
      );
    }

    const buffer: Buffer = doc.getZip().generate({ type: 'nodebuffer' });

    const previousDraft = await this.db.document.findFirst({
      where: {
        clientProfileId: companyId,
        documentType: DocumentType.AGREEMENT_DRAFT,
      },
      orderBy: { version: 'desc' },
      select: { id: true, version: true },
    });
    const version = previousDraft ? previousDraft.version + 1 : 1;
    const replacesId = previousDraft?.id ?? null;

    const safeCompanyName = (company.companyName ?? 'company')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || 'company';
    const originalFileName = `Leave_License_Agreement_${templateEntry.label}_${safeCompanyName}_v${version}.docx`;

    const uuid = randomUUID();
    const fileKey = this.r2Service.generateFileKey(
      companyId,
      DocumentType.AGREEMENT_DRAFT,
      originalFileName,
      uuid,
    );

    await this.r2Service.uploadFile(fileKey, buffer, AgreementTemplateService.DOCX_MIME);

    const document = await this.db.document.create({
      data: {
        clientProfileId: companyId,
        uploadedById: user.id,
        ownerId: user.id,
        documentOwner: 'ADMIN',
        fileName: originalFileName,
        fileKey,
        documentType: DocumentType.AGREEMENT_DRAFT,
        fileSize: buffer.byteLength,
        mimeType: AgreementTemplateService.DOCX_MIME,
        status: DocumentStatus.APPROVED,
        version,
        replacesId,
      },
    });

    await this.auditLogsService.create({
      userId: user.id,
      clientProfileId: companyId,
      documentId: document.id,
      action: 'AGREEMENT_DRAFT_GENERATED_FROM_TEMPLATE',
      entityType: 'Document',
      entityId: document.id,
      changes: {
        template: templateEntry.fileName,
        planType: booking.planType,
        bookingId: booking.id,
        fileName: originalFileName,
        fileKey,
        version,
        proFormaContractStart: AgreementTemplateService.formatAgreementDate(referenceAt),
        proFormaContractEnd: AgreementTemplateService.formatAgreementDate(
          AgreementTemplateService.addMonths(referenceAt, 11),
        ),
      },
    });

    this.logger.log(
      `Generated agreement draft v${version} from ${templateEntry.label} template for company=${companyId} documentId=${document.id} (pro forma term ${AgreementTemplateService.formatAgreementDate(referenceAt)}..${AgreementTemplateService.formatAgreementDate(AgreementTemplateService.addMonths(referenceAt, 11))})`,
    );

    return { documentId: document.id, fileName: originalFileName, version };
  }
}
