import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from '../minio/minio.service';
import { UpdateUserDto, UserResponseDto, UserStatsDto } from './dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private minioService: MinioService,
  ) {}

  private async enrichUserWithAvatarUrl(
    user: UserResponseDto,
  ): Promise<UserResponseDto> {
    if (user.avatar) {
      user.avatar = await this.minioService.getPresignedUrl(user.avatar);
    }
    return user;
  }

  async findOne(userId: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatar: true,
        usedStorage: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.enrichUserWithAvatarUrl(user);
  }

  async updateProfile(
    userId: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateUserDto,
      select: {
        id: true,
        email: true,
        fullName: true,
        avatar: true,
        usedStorage: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.enrichUserWithAvatarUrl(user);
  }

  async uploadAvatar(
    userId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    file: any,
  ): Promise<UserResponseDto> {
    // Get current avatar to delete old one
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });

    if (!currentUser) {
      throw new NotFoundException('User not found');
    }

    // Delete old avatar from MinIO if exists
    if (currentUser?.avatar) {
      await this.minioService.deleteFile(currentUser.avatar);
    }

    // Upload new avatar
    const fileName = `avatars/${userId}-${Date.now()}-${file.originalname}`;
    await this.minioService.uploadFile(fileName, file.buffer, {
      'Content-Type': file.mimetype,
    });

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: fileName },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatar: true,
        usedStorage: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return this.enrichUserWithAvatarUrl(user);
  }

  async getStats(userId: string): Promise<UserStatsDto> {
    const [totalFiles, totalFolders, user] = await Promise.all([
      this.prisma.file.count({
        where: { userId, isDeleted: false },
      }),
      this.prisma.folder.count({
        where: { userId },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { usedStorage: true },
      }),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      totalFiles,
      totalFolders,
      usedStorage: user.usedStorage,
      maxStorage: 10 * 1024 * 1024 * 1024, // 10 GB in bytes
    };
  }

  async removeAvatar(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user?.avatar) {
      await this.minioService.deleteFile(user.avatar);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: null },
    });

    return { message: 'Avatar removed successfully' };
  }
}
