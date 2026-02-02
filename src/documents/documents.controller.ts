import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { GenerateUploadUrlDto } from './dto/generate-upload-url.dto';
import { ReviewDocumentDto } from './dto/review-document.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('Documents')
@ApiBearerAuth()
@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload-url')
  @Roles(UserRole.COMPANY_ADMIN)
  @ApiOperation({
    summary: 'Generate presigned upload URL (COMPANY_ADMIN only)',
    description:
      'Generates a presigned URL for uploading a document to R2. Company ID is automatically taken from the authenticated user. FileKey is server-generated. The URL expires in 5 minutes.',
  })
  @ApiResponse({ status: 201, description: 'Upload URL generated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  generateUploadUrl(
    @Body() generateUploadUrlDto: GenerateUploadUrlDto,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.generateUploadUrl(generateUploadUrlDto, user);
  }

  @Get()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'List documents (company-scoped for COMPANY_ADMIN)',
    description:
      'Returns documents for the authenticated company. COMPANY_ADMIN sees only their company\'s documents.',
  })
  @ApiResponse({ status: 200, description: 'List of documents' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  list(@CurrentUser() user: any) {
    return this.documentsService.findMyDocuments(user);
  }

  @Get('company/:companyId')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'List documents for a company (SUPER_ADMIN only)',
    description: 'Returns documents for the given company. SUPER_ADMIN only.',
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

  @Get(':id/download')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get presigned download URL for a document',
    description:
      'Returns a presigned download URL. SUPER_ADMIN can download any document. COMPANY_ADMIN can only download documents of their company. Throws ForbiddenException on cross-tenant access. URL expires in 5 minutes.',
  })
  @ApiResponse({ status: 200, description: 'Download URL generated successfully' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - cross-tenant access denied' })
  generateDownloadUrl(@Param('id') id: string, @CurrentUser() user: any) {
    return this.documentsService.generateDownloadUrl(id, user);
  }

  @Patch(':id/review')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Review document (SUPER_ADMIN only)',
    description:
      'Approve (VERIFIED) or reject (REJECTED) a document. Rejection requires rejectionReason.',
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
}
