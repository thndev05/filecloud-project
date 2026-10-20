import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from '../minio/minio.service';
import { FileResponseDto } from './dto';
import { randomUUID } from 'crypto';

@Injectable()
export class FilesService {
  constructor(
    private prisma: PrismaService,
    private minioService: MinioService,
  ) {}

  async uploadFile(
    userId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    file: any,
    folderId?: string,
  ): Promise<FileResponseDto> {
    // Validate folder if provided
    if (folderId) {
      const folder = await this.prisma.folder.findFirst({
        where: { id: folderId, userId },
      });
      if (!folder) {
        throw new NotFoundException('Folder not found');
      }
    }

    // Check storage quota (10 GB limit)
    const maxStorage = 10 * 1024 * 1024 * 1024; // 10 GB in bytes
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { usedStorage: true },
    });

    if (user.usedStorage + file.size > maxStorage) {
      const usedGb = (user.usedStorage / (1024 * 1024 * 1024)).toFixed(2);
      const remainingGb = (
        (maxStorage - user.usedStorage) /
        (1024 * 1024 * 1024)
      ).toFixed(2);
      throw new BadRequestException(
        `Storage quota exceeded. Used: ${usedGb}GB / 10GB. Remaining: ${remainingGb}GB`,
      );
    }

    // Generate unique storage path
    const fileExt = file.originalname.split('.').pop();
    const storagePath = `${userId}/${randomUUID()}.${fileExt}`;

    // Decode filename properly (fix Vietnamese/UTF-8 encoding issues)
    const decodedFileName = Buffer.from(file.originalname, 'latin1').toString(
      'utf8',
    );

    // Upload to MinIO
    await this.minioService.uploadFile(storagePath, file.buffer, {
      'Content-Type': file.mimetype,
    });

    // Save to database
    const uploadedFile = await this.prisma.file.create({
      data: {
        name: decodedFileName,
        size: file.size,
        mimeType: file.mimetype,
        storagePath,
        userId,
        folderId: folderId || null,
      },
    });

    // Update user storage
    await this.prisma.user.update({
      where: { id: userId },
      data: { usedStorage: { increment: file.size } },
    });

    return uploadedFile;
  }

  async findAll(
    userId: string,
    folderId?: string,
    isDeleted = false,
  ): Promise<FileResponseDto[]> {
    return this.prisma.file.findMany({
      where: {
        userId,
        folderId: folderId || null,
        isDeleted: isDeleted,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, fileId: string): Promise<FileResponseDto> {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, userId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return file;
  }

  async downloadFile(userId: string, fileId: string): Promise<Buffer> {
    const file = await this.findOne(userId, fileId);

    if (file.isDeleted) {
      throw new BadRequestException('File is in trash');
    }

    return this.minioService.downloadFile(file.storagePath);
  }

  async renameFile(
    userId: string,
    fileId: string,
    newName: string,
  ): Promise<FileResponseDto> {
    const file = await this.findOne(userId, fileId);

    if (file.isDeleted) {
      throw new BadRequestException('Cannot rename deleted file');
    }

    return this.prisma.file.update({
      where: { id: fileId },
      data: { name: newName },
    });
  }

  async moveFile(
    userId: string,
    fileId: string,
    folderId?: string,
  ): Promise<FileResponseDto> {
    const file = await this.findOne(userId, fileId);

    if (file.isDeleted) {
      throw new BadRequestException('Cannot move deleted file');
    }

    // Validate folder if provided
    if (folderId) {
      const folder = await this.prisma.folder.findFirst({
        where: { id: folderId, userId },
      });
      if (!folder) {
        throw new NotFoundException('Folder not found');
      }
    }

    return this.prisma.file.update({
      where: { id: fileId },
      data: { folderId: folderId || null },
    });
  }

  async moveToTrash(
    userId: string,
    fileId: string,
  ): Promise<{ message: string }> {
    await this.findOne(userId, fileId);

    await this.prisma.file.update({
      where: { id: fileId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    return { message: 'File moved to trash' };
  }

  async restoreFile(userId: string, fileId: string): Promise<FileResponseDto> {
    const file = await this.findOne(userId, fileId);

    if (!file.isDeleted) {
      throw new BadRequestException('File is not in trash');
    }

    return this.prisma.file.update({
      where: { id: fileId },
      data: {
        isDeleted: false,
        deletedAt: null,
      },
    });
  }

  async deleteFilePermanently(
    userId: string,
    fileId: string,
  ): Promise<{ message: string }> {
    const file = await this.findOne(userId, fileId);

    // Delete from MinIO
    await this.minioService.deleteFile(file.storagePath);

    // Delete from database
    await this.prisma.file.delete({
      where: { id: fileId },
    });

    // Update user storage
    await this.prisma.user.update({
      where: { id: userId },
      data: { usedStorage: { decrement: file.size } },
    });

    return { message: 'File deleted permanently' };
  }

  async getRecentFiles(userId: string, limit = 10): Promise<FileResponseDto[]> {
    return this.prisma.file.findMany({
      where: {
        userId,
        isDeleted: false,
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }
}
