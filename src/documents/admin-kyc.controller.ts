import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import {
  KycApproveDto,
  KycRejectDto,
  KycPendingClientDto,
  KycPendingAdminDto,
} from './dto/kyc-review-notes.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('Admin KYC Review')
@ApiBearerAuth()
@Controller('admin/kyc')
@Throttle({ default: { limit: 500, ttl: 60000 } })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
export class AdminKycController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Patch(':documentId/approve')
  @ApiOperation({
    summary: 'Approve KYC document',
    description:
      'Sets status to APPROVED. If all KYC documents are approved and stage is KYC_REVIEW, moves company to AGREEMENT_DRAFT_SHARED. Document must be type KYC and owner CLIENT; stage must be KYC_IN_PROGRESS or KYC_REVIEW.',
  })
  @ApiResponse({ status: 200, description: 'Document approved; returns document with status, reviewNotes, version, etc.' })
  @ApiResponse({ status: 400, description: 'Invalid document or stage' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  approve(
    @Param('documentId') documentId: string,
    @Body() dto: KycApproveDto,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.approveKycDocument(documentId, dto, user);
  }

  @Patch(':documentId/reject')
  @ApiOperation({
    summary: 'Reject KYC document',
    description:
      'Sets status to REJECTED; reviewNotes (reason) required. Stage is set to KYC_IN_PROGRESS; client must re-upload. Document must be type KYC and owner CLIENT.',
  })
  @ApiResponse({ status: 200, description: 'Document rejected' })
  @ApiResponse({ status: 400, description: 'Review notes required or invalid' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  reject(
    @Param('documentId') documentId: string,
    @Body() dto: KycRejectDto,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.rejectKycDocument(documentId, dto, user);
  }

  @Patch(':documentId/pending-client')
  @ApiOperation({
    summary: 'Mark KYC pending with client',
    description:
      'Use when document is unclear or better copy is needed. Sets status to PENDING_WITH_CLIENT; reviewNotes required. Stage set to KYC_IN_PROGRESS. Client sees "Action required".',
  })
  @ApiResponse({ status: 200, description: 'Document set to pending with client' })
  @ApiResponse({ status: 400, description: 'Review notes required' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  pendingClient(
    @Param('documentId') documentId: string,
    @Body() dto: KycPendingClientDto,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.pendingWithClientKycDocument(documentId, dto, user);
  }

  @Patch(':documentId/pending-admin')
  @ApiOperation({
    summary: 'Mark KYC pending with admin',
    description:
      'Use when internal verification is needed. Sets status to PENDING_WITH_ADMIN; optional reviewNotes. Stage set to KYC_REVIEW.',
  })
  @ApiResponse({ status: 200, description: 'Document set to pending with admin' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  pendingAdmin(
    @Param('documentId') documentId: string,
    @Body() dto: KycPendingAdminDto,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.pendingWithAdminKycDocument(documentId, dto, user);
  }
}
