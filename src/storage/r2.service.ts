import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class R2Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    const endpoint = this.configService.get<string>('R2_ENDPOINT');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY');
    const bucketName = this.configService.get<string>('R2_BUCKET_NAME');

    if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error('R2 configuration is missing. Please check your environment variables.');
    }

    this.bucketName = bucketName;

    // Cloudflare R2 uses S3-compatible API
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  /**
   * Generate a presigned URL for uploading a file
   * @param fileKey - The unique key for the file in R2
   * @param contentType - MIME type of the file
   * @param expiresIn - URL expiration time in seconds (default: 300 = 5 minutes)
   */
  async generateUploadUrl(
    fileKey: string,
    contentType: string,
    expiresIn: number = 300,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
      ContentType: contentType,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Generate a presigned URL for downloading a file
   * @param fileKey - The unique key for the file in R2
   * @param expiresIn - URL expiration time in seconds (default: 300 = 5 minutes)
   */
  async generateDownloadUrl(fileKey: string, expiresIn: number = 300): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Delete a file from R2
   * @param fileKey - The unique key for the file in R2
   */
  async deleteFile(fileKey: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
    });

    await this.s3Client.send(command);
  }

  /**
   * Generate a unique file key for storing in R2
   * Format: company/{companyId}/{type}/{uuid}.{ext}
   * @param companyId - Company ID from user.companyId (never from client)
   * @param documentType - Document type enum value
   * @param fileName - Original file name to extract extension
   * @param uuid - Server-generated UUID
   */
  generateFileKey(
    companyId: string,
    documentType: string,
    fileName: string,
    uuid: string,
  ): string {
    // Extract file extension from fileName (sanitized)
    const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() || '' : '';
    const extension = ext && ['.pdf', '.jpg', '.jpeg', '.png'].includes(`.${ext}`) ? `.${ext}` : '';
    
    // Organize by document type into folders
    let folder = 'kyc';
    if (documentType.includes('AGREEMENT_DRAFT')) {
      folder = 'agreements/draft';
    } else if (documentType.includes('AGREEMENT_SIGNED')) {
      folder = 'agreements/signed';
    } else if (documentType.includes('AGREEMENT_FINAL')) {
      folder = 'agreements/final';
    }
    
    // Format: company/{companyId}/{folder}/{uuid}.{ext}
    // UUID ensures uniqueness, original filename is NOT used in key for security
    return `company/${companyId}/${folder}/${uuid}${extension}`;
  }
}
