import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from '../minio/minio.service';
import { NotFoundException } from '@nestjs/common';
import { min } from 'class-validator';

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
});
