import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from '../minio/minio.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { CreateShareDto, CreateDirectShareDto, ShareResponseDto } from './dto';
import { randomBytes } from 'crypto';

@Injectable()
export class SharesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  async createShare(
    userId: string,
    createShareDto: CreateShareDto,
  ): Promise<ShareResponseDto> {
    const { fileId } = createShareDto;

    // Check if file exists and user owns it
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to share this file',
      );
    }

    // Check if share already exists for this file
    const existingShare = await this.prisma.share.findFirst({
      where: {
        fileId,
        ownerId: userId,
        isActive: true,
        sharedWithId: null, // Only for public links
      },
    });

    if (existingShare) {
      return this.mapToResponseDto(existingShare);
    }

    // Create new share
    const token = this.generateToken();
    const share = await this.prisma.share.create({
      data: {
        fileId,
        ownerId: userId,
        token,
      },
      include: {
        file: {
          select: {
            id: true,
            name: true,
            size: true,
            mimeType: true,
          },
        },
      },
    });

    return this.mapToResponseDto(share);
  }

  async getShareByToken(token: string): Promise<ShareResponseDto> {
    const share = await this.prisma.share.findUnique({
      where: { token },
      include: {
        file: {
          select: {
            id: true,
            name: true,
            size: true,
            mimeType: true,
            storagePath: true,
          },
        },
      },
    });

    if (!share || !share.isActive) {
      throw new NotFoundException('Share link not found or has been deleted');
    }

    return this.mapToResponseDto(share);
  }

  async getMyShares(userId: string): Promise<ShareResponseDto[]> {
    const shares = await this.prisma.share.findMany({
      where: {
        ownerId: userId,
        sharedWithId: null, // Only public links
      },
      include: {
        file: {
          select: {
            id: true,
            name: true,
            size: true,
            mimeType: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return shares.map((share) => this.mapToResponseDto(share));
  }

  async createDirectShare(
    userId: string,
    createDirectShareDto: CreateDirectShareDto,
  ): Promise<ShareResponseDto> {
    const { fileId, email } = createDirectShareDto;

    // Check if file exists and user owns it
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to share this file',
      );
    }

    // Find user by email
    const targetUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!targetUser) {
      throw new NotFoundException('User with this email not found');
    }

    if (targetUser.id === userId) {
      throw new BadRequestException('You cannot share a file with yourself');
    }

    // Check if already shared with this user
    const existingShare = await this.prisma.share.findFirst({
      where: {
        fileId,
        ownerId: userId,
        sharedWithId: targetUser.id,
      },
    });

    if (existingShare) {
      throw new BadRequestException('File already shared with this user');
    }

    // Create direct share with pending status
    const token = this.generateToken();
    const share = await this.prisma.share.create({
      data: {
        fileId,
        ownerId: userId,
        sharedWithId: targetUser.id,
        token,
        status: 'pending',
      },
      include: {
        file: {
          select: {
            id: true,
            name: true,
            size: true,
            mimeType: true,
          },
        },
        owner: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        sharedWith: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    // Send real-time notification to target user
    this.notificationsGateway.sendShareNotification(targetUser.id, {
      shareId: share.id,
      fileName: share.file.name,
      ownerName: share.owner.fullName,
      ownerEmail: share.owner.email,
    });

    return this.mapToResponseDto(share);
  }

  async getReceivedShares(userId: string): Promise<ShareResponseDto[]> {
    const shares = await this.prisma.share.findMany({
      where: {
        sharedWithId: userId,
        status: 'accepted',
      },
      include: {
        file: {
          select: {
            id: true,
            name: true,
            size: true,
            mimeType: true,
          },
        },
        owner: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return shares.map((share) => this.mapToResponseDto(share));
  }

  async getPendingShares(userId: string): Promise<ShareResponseDto[]> {
    const shares = await this.prisma.share.findMany({
      where: {
        sharedWithId: userId,
        status: 'pending',
      },
      include: {
        file: {
          select: {
            id: true,
            name: true,
            size: true,
            mimeType: true,
          },
        },
        owner: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return shares.map((share) => this.mapToResponseDto(share));
  }

  async acceptShare(
    userId: string,
    shareId: string,
  ): Promise<ShareResponseDto> {
    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
      include: {
        file: {
          select: {
            id: true,
            name: true,
            size: true,
            mimeType: true,
          },
        },
        owner: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    if (!share) {
      throw new NotFoundException('Share not found');
    }

    if (share.sharedWithId !== userId) {
      throw new ForbiddenException('This share is not for you');
    }

    if (share.status !== 'pending') {
      throw new BadRequestException('This share has already been processed');
    }

    const updatedShare = await this.prisma.share.update({
      where: { id: shareId },
      data: { status: 'accepted' },
      include: {
        file: {
          select: {
            id: true,
            name: true,
            size: true,
            mimeType: true,
          },
        },
        owner: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    return this.mapToResponseDto(updatedShare);
  }

  async rejectShare(userId: string, shareId: string): Promise<void> {
    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
    });

    if (!share) {
      throw new NotFoundException('Share not found');
    }

    if (share.sharedWithId !== userId) {
      throw new ForbiddenException('This share is not for you');
    }

    if (share.status !== 'pending') {
      throw new BadRequestException('This share has already been processed');
    }

    // Delete rejected shares
    await this.prisma.share.delete({
      where: { id: shareId },
    });
  }

  async deleteShare(userId: string, shareId: string): Promise<void> {
    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
    });

    if (!share) {
      throw new NotFoundException('Share not found');
    }

    if (share.ownerId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this share',
      );
    }

    await this.prisma.share.delete({
      where: { id: shareId },
    });
  }

  async getFileDownloadUrl(token: string): Promise<string> {
    const share = await this.prisma.share.findUnique({
      where: { token },
      include: {
        file: true,
      },
    });

    if (!share || !share.isActive) {
      throw new NotFoundException(
        'Share link not found or has been deactivated',
      );
    }

    // Generate presigned URL for download
    const url = await this.minio.getPresignedUrl(share.file.storagePath);
    return url;
  }

  async getSharedFileDownloadUrl(
    userId: string,
    shareId: string,
  ): Promise<string> {
    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
      include: {
        file: true,
      },
    });

    if (!share) {
      throw new NotFoundException('Share not found');
    }

    // Check if user is the recipient and share is accepted
    if (share.sharedWithId !== userId || share.status !== 'accepted') {
      throw new ForbiddenException('You do not have access to this file');
    }

    // Generate presigned URL for download
    const url = await this.minio.getPresignedUrl(share.file.storagePath);
    return url;
  }

  private mapToResponseDto(share: {
    id: string;
    fileId: string;
    ownerId: string;
    sharedWithId?: string | null;
    token: string;
    isActive: boolean;
    status?: string;
    createdAt: Date;
    file?: {
      id: string;
      name: string;
      size: number;
      mimeType: string;
      storagePath?: string;
    };
    owner?: {
      id: string;
      email: string;
      fullName: string | null;
    };
    sharedWith?: {
      id: string;
      email: string;
      fullName: string | null;
    };
  }): ShareResponseDto {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return {
      id: share.id,
      fileId: share.fileId,
      ownerId: share.ownerId,
      sharedWithId: share.sharedWithId,
      token: share.token,
      isActive: share.isActive,
      status: share.status,
      createdAt: share.createdAt,
      shareUrl: `${baseUrl}/shares/${share.token}`,
      file: share.file,
      owner: share.owner,
      sharedWith: share.sharedWith,
    };
  }
}
