import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientProfileDto } from './dto/create-client-profile.dto';
import { UpdateClientProfileDto } from './dto/update-client-profile.dto';
import { OnboardingStatus } from '../common/enums/onboarding-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class ClientProfilesService {
  constructor(
    private prisma: PrismaService,
    private auditLogsService: AuditLogsService,
  ) {}

  async create(createClientProfileDto: CreateClientProfileDto, userId: string) {
    if (createClientProfileDto.taxId) {
      const existing = await this.prisma.clientProfile.findUnique({
        where: { taxId: createClientProfileDto.taxId },
      });

      if (existing) {
        throw new ConflictException('Client profile with this tax ID already exists');
      }
    }

    const clientProfile = await this.prisma.clientProfile.create({
      data: {
        ...createClientProfileDto,
        createdById: userId,
      },
      include: {
        createdBy: {
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
      userId,
      clientProfileId: clientProfile.id,
      action: 'CREATE',
      entityType: 'ClientProfile',
      entityId: clientProfile.id,
      changes: createClientProfileDto,
    });

    return clientProfile;
  }

  async findAll(userRole: UserRole, userId?: string) {
    const where: any = {};

    // Clients can only see their own profiles
    if (userRole === UserRole.CLIENT) {
      // This assumes clients are linked via User relation - adjust based on your schema
      where.createdById = userId;
    }

    return this.prisma.clientProfile.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            documents: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userRole: UserRole, userId?: string) {
    const clientProfile = await this.prisma.clientProfile.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        documents: {
          select: {
            id: true,
            fileName: true,
            documentType: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!clientProfile) {
      throw new NotFoundException(`Client profile with ID ${id} not found`);
    }

    // Authorization check: Clients can only access their own profiles
    if (userRole === UserRole.CLIENT && clientProfile.createdById !== userId) {
      throw new ForbiddenException('You do not have permission to access this client profile');
    }

    return clientProfile;
  }

  async update(
    id: string,
    updateClientProfileDto: UpdateClientProfileDto,
    userId: string,
    userRole: UserRole,
  ) {
    const existing = await this.findOne(id, userRole, userId);

    if (updateClientProfileDto.taxId && updateClientProfileDto.taxId !== existing.taxId) {
      const duplicate = await this.prisma.clientProfile.findUnique({
        where: { taxId: updateClientProfileDto.taxId },
      });

      if (duplicate) {
        throw new ConflictException('Client profile with this tax ID already exists');
      }
    }

    // Authorization check: Only admins/managers can update, or the creator
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.MANAGER && existing.createdById !== userId) {
      throw new ForbiddenException('You do not have permission to update this client profile');
    }

    const updated = await this.prisma.clientProfile.update({
      where: { id },
      data: updateClientProfileDto,
      include: {
        createdBy: {
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
      userId,
      clientProfileId: id,
      action: 'UPDATE',
      entityType: 'ClientProfile',
      entityId: id,
      changes: {
        before: existing,
        after: updated,
      },
    });

    return updated;
  }

  async updateStatus(
    id: string,
    status: OnboardingStatus,
    userId: string,
    userRole: UserRole,
  ) {
    // Only admins and managers can update status
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.MANAGER) {
      throw new ForbiddenException('You do not have permission to update onboarding status');
    }

    const existing = await this.findOne(id, userRole, userId);

    const updated = await this.prisma.clientProfile.update({
      where: { id },
      data: { onboardingStatus: status },
      include: {
        createdBy: {
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
      userId,
      clientProfileId: id,
      action: 'UPDATE_STATUS',
      entityType: 'ClientProfile',
      entityId: id,
      changes: {
        status: {
          before: existing.onboardingStatus,
          after: status,
        },
      },
    });

    return updated;
  }

  async remove(id: string, userId: string, userRole: UserRole) {
    const existing = await this.findOne(id, userRole, userId);

    // Only admins can delete
    if (userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not have permission to delete client profiles');
    }

    await this.prisma.clientProfile.delete({
      where: { id },
    });

    await this.auditLogsService.create({
      userId,
      clientProfileId: id,
      action: 'DELETE',
      entityType: 'ClientProfile',
      entityId: id,
      changes: existing,
    });

    return { message: 'Client profile deleted successfully' };
  }
}
