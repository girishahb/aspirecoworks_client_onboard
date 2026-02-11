import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { GenerateUploadUrlDto } from './dto/generate-upload-url.dto';
import { AdminAgreementDraftUploadDto } from './dto/admin-agreement-draft-upload.dto';
import { ReviewDocumentDto } from './dto/review-document.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { DocumentType } from '../common/enums/document-type.enum';

@ApiTags('Documents')
@ApiBearerAuth()
@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 uploads per minute
  @Post('upload')
  @Roles(UserRole.CLIENT, UserRole.COMPANY_ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  @ApiOperation({
    summary: 'Upload document directly (proxy upload)',
    description:
      'Uploads a file via the backend to R2. Avoids CORS issues with presigned URLs. Use for KYC (Aadhaar, PAN, Other) or signed agreement. Multipart form: file, documentType.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        documentType: { type: 'string', enum: ['AADHAAR', 'PAN', 'OTHER', 'AGREEMENT_SIGNED'] },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file or document type' })
  async uploadDocument(
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    @Body('documentType') documentType: string,
    @CurrentUser() user: any,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (!documentType || !['AADHAAR', 'PAN', 'OTHER', 'AGREEMENT_SIGNED'].includes(documentType)) {
      throw new BadRequestException('documentType must be one of: AADHAAR, PAN, OTHER, AGREEMENT_SIGNED');
    }
    return this.documentsService.uploadDocumentProxy(
      file,
      documentType as DocumentType,
      user,
    );
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 uploads per minute
  @Post('upload-url')
  @Roles(UserRole.CLIENT, UserRole.COMPANY_ADMIN)
  @ApiOperation({
    summary: 'Generate presigned upload URL (CLIENT/COMPANY_ADMIN only – KYC upload)',
    description:
      'Generates a presigned URL for uploading a KYC document. CLIENT or COMPANY_ADMIN role. Company from authenticated user. Multiple uploads per type allowed; use replacesDocumentId for re-upload (version increment). New documents are created with status REVIEW_PENDING. URL expires in 5 minutes.',
  })
  @ApiResponse({ status: 201, description: 'Upload URL generated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  generateUploadUrl(
    @Body() generateUploadUrlDto: GenerateUploadUrlDto,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.generateUploadUrl(generateUploadUrlDto, user);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 uploads per minute
  @Post('admin/agreement-draft-upload-url')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get upload URL for agreement draft (Admin/Manager)',
    description:
      'Generates a presigned URL to upload an AGREEMENT_DRAFT for a company. After uploading the file, call POST /documents/:id/notify-agreement-draft-shared to notify the client and update stage to AGREEMENT_DRAFT_SHARED.',
  })
  @ApiResponse({ status: 201, description: 'Upload URL generated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  generateAdminAgreementDraftUploadUrl(
    @Body() dto: AdminAgreementDraftUploadDto,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.generateAdminAgreementDraftUploadUrl(dto, user);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('admin/agreement-draft-upload')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  @ApiOperation({
    summary: 'Upload agreement draft via proxy (no CORS)',
    description:
      'Uploads agreement draft file through backend to R2. Automatically notifies client. Multipart: file, companyId. Supports .pdf, .doc, .docx.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        companyId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Agreement draft uploaded and client notified' })
  @ApiResponse({ status: 400, description: 'Invalid file or company' })
  async uploadAdminAgreementDraft(
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    @Body('companyId') companyId: string,
    @CurrentUser() user: any,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.documentsService.uploadAdminAgreementDraftProxy(file, companyId, user);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 uploads per minute
  @Post('admin/agreement-final-upload-url')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get upload URL for final agreement (Admin/Manager)',
    description:
      'Generates a presigned URL to upload an AGREEMENT_FINAL for a company. After uploading the file, call POST /documents/:id/notify-agreement-final-shared to notify the client and update stage to FINAL_AGREEMENT_SHARED.',
  })
  @ApiResponse({ status: 201, description: 'Upload URL generated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  generateAdminAgreementFinalUploadUrl(
    @Body() dto: AdminAgreementDraftUploadDto,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.generateAdminAgreementFinalUploadUrl(dto, user);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('admin/agreement-final-upload')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary: 'Upload final agreement via proxy (no CORS)',
    description:
      'Uploads final agreement file through backend to R2. Automatically notifies client. Multipart: file, companyId.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        companyId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Final agreement uploaded and client notified' })
  @ApiResponse({ status: 400, description: 'Invalid file or company' })
  async uploadAdminAgreementFinal(
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    @Body('companyId') companyId: string,
    @CurrentUser() user: any,
  ) {
    if (!file) throw new BadRequestException('File is required');
    if (!companyId) throw new BadRequestException('companyId is required');
    return this.documentsService.uploadAdminAgreementFinalProxy(file, companyId, user);
  }

  @Get()
  @Roles(UserRole.CLIENT, UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'List documents (company-scoped for CLIENT/COMPANY_ADMIN)',
    description:
      'Returns documents for the authenticated user\'s company. CLIENT and COMPANY_ADMIN see only their company\'s documents.',
  })
  @ApiResponse({ status: 200, description: 'List of documents' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  list(@CurrentUser() user: any) {
    return this.documentsService.findMyDocuments(user);
  }

  @Get('agreement-drafts')
  @Roles(UserRole.CLIENT, UserRole.COMPANY_ADMIN)
  @ApiOperation({
    summary: 'List agreement drafts (CLIENT/COMPANY_ADMIN)',
    description:
      'Returns AGREEMENT_DRAFT documents for the authenticated user\'s company. Only available when stage = AGREEMENT_DRAFT_SHARED. Use for view + download latest.',
  })
  @ApiResponse({ status: 200, description: 'List of agreement drafts (newest first)' })
  @ApiResponse({ status: 403, description: 'Forbidden or wrong stage' })
  listAgreementDrafts(@CurrentUser() user: any) {
    return this.documentsService.listAgreementDraftsForClient(user);
  }

  @Get('agreement-complete')
  @Roles(UserRole.CLIENT, UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Check if agreement process is complete (AGREEMENT_FINAL exists)',
    description:
      'Returns { complete: true } if company has at least one AGREEMENT_FINAL (eligible for activation). CLIENT use own company; admins can pass ?companyId=.',
  })
  @ApiResponse({ status: 200, description: 'Agreement complete status' })
  async agreementComplete(
    @CurrentUser() user: any,
    @Query('companyId') companyIdQuery?: string,
  ) {
    const isAdmin = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER].includes(user.role);
    const companyId = user.companyId ?? (isAdmin ? companyIdQuery : null);
    if (!companyId) {
      throw new ForbiddenException('No company associated; or pass companyId for admin.');
    }
    const complete = await this.documentsService.isAgreementProcessComplete(companyId);
    return { complete };
  }

  @Get('company/:companyId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'List documents for a company (SUPER_ADMIN, ADMIN, MANAGER)',
    description: 'Returns documents for the given company. SUPER_ADMIN, ADMIN, and MANAGER roles can access.',
  })
  @ApiResponse({ status: 200, description: 'List of documents' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  listByCompany(
    @Param('companyId') companyId: string,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.findByCompany(companyId, user);
  }

  @Get(':id/file')
  @Roles(UserRole.CLIENT, UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Stream document file for download (proxy)',
    description:
      'Streams the document file from storage. Triggers browser download with correct filename. Use instead of presigned URL to avoid CORS and handle missing files gracefully.',
  })
  @ApiResponse({ status: 200, description: 'File stream', content: { 'application/octet-stream': {} } })
  @ApiResponse({ status: 404, description: 'Document or file not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async streamDocumentFile(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<StreamableFile> {
    const { buffer, fileName, contentType } =
      await this.documentsService.streamDocumentFile(id, user);
    const disposition = `attachment; filename="${fileName.replace(/"/g, '\\"')}"`;
    return new StreamableFile(buffer, {
      type: contentType,
      disposition,
    });
  }

  @Get(':id/download')
  @Roles(UserRole.CLIENT, UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get presigned download URL for a document',
    description:
      'Returns a presigned download URL. SUPER_ADMIN, ADMIN, MANAGER can download any document. CLIENT/COMPANY_ADMIN can only download documents of their company. URL expires in 5 minutes. Prefer GET :id/file for proxy download.',
  })
  @ApiResponse({ status: 200, description: 'Download URL generated successfully' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - cross-tenant access denied' })
  generateDownloadUrl(@Param('id') id: string, @CurrentUser() user: any) {
    return this.documentsService.generateDownloadUrl(id, user);
  }

  @Patch(':id/review')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'KYC review document (SUPER_ADMIN, ADMIN, MANAGER)',
    description:
      'Approve (VERIFIED), reject (REJECTED with required rejectionReason), or mark Pending with Client (PENDING_WITH_CLIENT). Optional adminRemarks stored for all actions. When all latest KYC docs are verified and company is in KYC_REVIEW, stage moves to AGREEMENT_DRAFT_SHARED.',
  })
  @ApiResponse({ status: 200, description: 'Document updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  reviewDocument(
    @Param('id') id: string,
    @Body() reviewDocumentDto: ReviewDocumentDto,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.reviewDocument(id, reviewDocumentDto, user);
  }

  @Post(':id/notify-agreement-draft-shared')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Notify client and set stage after agreement draft upload',
    description:
      'Call after uploading the agreement draft file. Sends email to company contact and updates onboarding stage to AGREEMENT_DRAFT_SHARED.',
  })
  @ApiResponse({ status: 200, description: 'Client notified, stage updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  notifyAgreementDraftShared(@Param('id') id: string, @CurrentUser() user: any) {
    return this.documentsService.notifyAgreementDraftShared(id, user);
  }

  @Post(':id/confirm-signed-agreement')
  @Roles(UserRole.CLIENT, UserRole.COMPANY_ADMIN)
  @ApiOperation({
    summary: 'Confirm signed agreement upload (CLIENT/COMPANY_ADMIN only)',
    description:
      'Call after uploading the signed agreement file. Updates company onboarding stage to SIGNED_AGREEMENT_RECEIVED.',
  })
  @ApiResponse({ status: 200, description: 'Stage updated to SIGNED_AGREEMENT_RECEIVED' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  confirmSignedAgreement(@Param('id') id: string, @CurrentUser() user: any) {
    return this.documentsService.confirmSignedAgreement(id, user);
  }

  @Post(':id/notify-agreement-final-shared')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Notify client and set stage after final agreement upload',
    description:
      'Call after uploading the final agreement file. Sends email to company contact and updates onboarding stage to FINAL_AGREEMENT_SHARED.',
  })
  @ApiResponse({ status: 200, description: 'Client notified, stage updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  notifyAgreementFinalShared(@Param('id') id: string, @CurrentUser() user: any) {
    return this.documentsService.notifyAgreementFinalShared(id, user);
  }
}
