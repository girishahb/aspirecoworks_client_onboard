import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  async create(createAuditLogDto: CreateAuditLogDto) {
    return this.prisma.auditLog.create({
      data: createAuditLogDto,
    });
  }

  async findAll(
    userId?: string,
    clientProfileId?: string,
    documentId?: string,
    entityType?: string,
    userRole?: UserRole,
  ) {
    // Only admins and managers can view all audit logs
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.MANAGER) {
      throw new ForbiddenException('You do not have permission to view audit logs');
    }

    const where: any = {};

    if (userId) {
      where.userId = userId;
    }

    if (clientProfileId) {
      where.clientProfileId = clientProfileId;
    }

    if (documentId) {
      where.documentId = documentId;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    return this.prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        clientProfile: {
          select: {
            id: true,
            companyName: true,
          },
        },
        document: {
          select: {
            id: true,
            fileName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000, // Limit to prevent performance issues
    });
  }

  async findOne(id: string, userRole?: UserRole) {
    // Only admins and managers can view audit logs
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.MANAGER) {
      throw new ForbiddenException('You do not have permission to view audit logs');
    }

    return this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        clientProfile: {
          select: {
            id: true,
            companyName: true,
          },
        },
        document: {
          select: {
            id: true,
            fileName: true,
          },
        },
      },
    });
  }
}
