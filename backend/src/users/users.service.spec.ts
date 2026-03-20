import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from '../minio/minio.service';
import { NotFoundException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: PrismaService;
  let minioService: MinioService;

  const userData = {
    id: 'user-id',
    email: 'test@email.com',
    fullName: 'Test User',
    avatar: 'url/avatar.jpg',
    usedStorage: 1024,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    file: {
      count: jest.fn(),
    },
    folder: {
      count: jest.fn(),
    },
  };

  const mockMinioService = {
    getPresignedUrl: jest.fn(),
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: MinioService,
          useValue: mockMinioService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get<PrismaService>(PrismaService);
    minioService = module.get<MinioService>(MinioService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    const userId = 'user-id';

    it('happy path: should return user data with enriched avatar URL', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(userData);
      (minioService.getPresignedUrl as jest.Mock).mockResolvedValueOnce(
        'url/avatar.jpg',
      );

      const user = await service.findOne(userId);

      expect(user).toBe(userData);
      expect(user).toEqual(userData);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
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
      expect(minioService.getPresignedUrl).toHaveBeenCalledWith(
        userData.avatar,
      );
    });

    it('error path: should throw NotFoundException if user is not found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('not-found-id')).rejects.toThrow(
        NotFoundException,
      );

      expect(minioService.getPresignedUrl).not.toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    const userId = 'user-id';
    const updateUserDto = {
      fullName: 'Updated User',
    };

    const updatedUserData = {
      ...userData,
      fullName: updateUserDto.fullName,
    };

    it('happy path: should update user profile and return updated data with enriched avatar URL', async () => {
      (prismaService.user.update as jest.Mock).mockResolvedValue(
        updatedUserData,
      );
      (minioService.getPresignedUrl as jest.Mock).mockResolvedValueOnce(
        'url/avatar.jpg',
      );

      const updatedUser = await service.updateProfile(userId, updateUserDto);

      expect(updatedUser).toBe(updatedUserData);
      expect(updatedUser).toEqual(updatedUserData);
      expect(prismaService.user.update).toHaveBeenCalledWith({
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
      expect(minioService.getPresignedUrl).toHaveBeenCalledWith(
        updatedUserData.avatar,
      );
    });

    it('error path: should throw NotFoundException if user is not found', async () => {
      const userId = 'failed-update-id';
      (prismaService.user.update as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateProfile(userId, updateUserDto),
      ).rejects.toThrow(NotFoundException);

      expect(minioService.getPresignedUrl).not.toHaveBeenCalled();
    });
  });

  describe('uploadAvatar', () => {
    const userId = 'user-id';
    const file = {
      originalname: 'avatar.jpg',
      buffer: Buffer.from('file content'),
      mimetype: 'image/jpeg',
    };
    const fixedNow = 1700000000000;
    const generatedFileName = `avatars/${userId}-${fixedNow}-${file.originalname}`;

    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(fixedNow);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('happy path: should upload avatar with enriched avatar URL', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        avatar: userData.avatar,
      });
      (minioService.uploadFile as jest.Mock).mockResolvedValue({
        fileName: generatedFileName,
      });

      const updatedUserFromDb = {
        ...userData,
        avatar: generatedFileName,
      };

      (prismaService.user.update as jest.Mock).mockResolvedValue(
        updatedUserFromDb,
      );

      (minioService.getPresignedUrl as jest.Mock).mockResolvedValueOnce(
        'url/' + generatedFileName,
      );

      const result = await service.uploadAvatar(userId, file);

      expect(result.avatar).toBe('url/' + generatedFileName);
      expect(result).toEqual(updatedUserFromDb);
      expect(minioService.uploadFile).toHaveBeenCalledWith(
        generatedFileName,
        file.buffer,
        { 'Content-Type': file.mimetype },
      );
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: { avatar: true },
      });
      expect(minioService.deleteFile).toHaveBeenCalledWith(userData.avatar);
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { avatar: generatedFileName },
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
      expect(minioService.getPresignedUrl).toHaveBeenCalledWith(
        generatedFileName,
      );
      expect(Date.now).toHaveBeenCalled();
    });

    it('error path: should throw NotFoundException if findUnique return null', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.uploadAvatar(userId, file)).rejects.toThrow(
        NotFoundException,
      );

      expect(minioService.deleteFile).not.toHaveBeenCalled();
      expect(minioService.uploadFile).not.toHaveBeenCalled();
      expect(prismaService.user.update).not.toHaveBeenCalled();
      expect(minioService.getPresignedUrl).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    const userId = 'user-id';

    it('happy path: should return stats successfully', async () => {
      (prismaService.file.count as jest.Mock).mockResolvedValue(5);
      (prismaService.folder.count as jest.Mock).mockResolvedValue(3);
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        usedStorage: 1024,
      });

      const stats = await service.getStats(userId);

      expect(stats).toEqual({
        totalFiles: 5,
        totalFolders: 3,
        usedStorage: 1024,
        maxStorage: 10 * 1024 * 1024 * 1024,
      });
      expect(prismaService.file.count).toHaveBeenCalledWith({
        where: { userId, isDeleted: false },
      });
      expect(prismaService.folder.count).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: { usedStorage: true },
      });
    });

    it('error path: should throw NotFoundException if findUnique is null', async () => {
      (prismaService.file.count as jest.Mock).mockResolvedValue(5);
      (prismaService.folder.count as jest.Mock).mockResolvedValue(3);
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getStats(userId)).rejects.toThrow(NotFoundException);

      expect(prismaService.file.count).toHaveBeenCalledWith({
        where: { userId, isDeleted: false },
      });
      expect(prismaService.folder.count).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: { usedStorage: true },
      });
    });
  });

  // describe('removeAvatar', () => {
  //   it('happy path: ', async () => {});
  //   it('error path: ', async () => {});
  // });
});
