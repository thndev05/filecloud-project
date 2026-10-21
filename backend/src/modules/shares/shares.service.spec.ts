import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SharesService } from './shares.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MinioService } from '../../infrastructure/minio/minio.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

describe('SharesService', () => {
  let service: SharesService;
  let prismaService: PrismaService;
  let minioService: MinioService;
  let notificationsGateway: NotificationsGateway;

  const ownerId = 'owner-id';
  const recipientId = 'recipient-id';
  const fileId = 'file-id';
  const shareId = 'share-id';
  const token = 'a'.repeat(64);
  const baseUrl = 'http://localhost:5173';

  const fileData = {
    id: fileId,
    name: 'report.pdf',
    size: 2048,
    mimeType: 'application/pdf',
    storagePath: `${ownerId}/uuid.pdf`,
    userId: ownerId,
  };

  const owner = { id: ownerId, email: 'owner@email.com', fullName: 'Owner' };
  const recipient = {
    id: recipientId,
    email: 'recipient@email.com',
    fullName: 'Recipient',
  };

  const publicShare = {
    id: shareId,
    fileId,
    ownerId,
    sharedWithId: null,
    token,
    isActive: true,
    status: 'accepted',
    createdAt: new Date(),
    file: fileData,
  };

  const pendingShare = {
    ...publicShare,
    sharedWithId: recipientId,
    status: 'pending',
    owner,
    sharedWith: recipient,
  };

  const mockPrismaService = {
    file: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    share: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockMinioService = {
    getPresignedUrl: jest.fn(),
  };

  const mockNotificationsGateway = {
    sendShareNotification: jest.fn(),
  };

  beforeEach(async () => {
    delete process.env.FRONTEND_URL;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SharesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: MinioService, useValue: mockMinioService },
        { provide: NotificationsGateway, useValue: mockNotificationsGateway },
      ],
    }).compile();

    service = module.get<SharesService>(SharesService);
    prismaService = module.get<PrismaService>(PrismaService);
    minioService = module.get<MinioService>(MinioService);
    notificationsGateway =
      module.get<NotificationsGateway>(NotificationsGateway);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createShare', () => {
    it('happy path: should create public share link with random token', async () => {
      (prismaService.file.findUnique as jest.Mock).mockResolvedValue(fileData);
      (prismaService.share.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.share.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({ ...publicShare, token: data.token }),
      );

      const result = await service.createShare(ownerId, { fileId });

      const createdToken = (prismaService.share.create as jest.Mock).mock
        .calls[0][0].data.token;
      expect(createdToken).toMatch(/^[0-9a-f]{64}$/);
      expect(result.token).toBe(createdToken);
      expect(result.shareUrl).toBe(`${baseUrl}/shares/${createdToken}`);
      expect(prismaService.share.findFirst).toHaveBeenCalledWith({
        where: { fileId, ownerId, isActive: true, sharedWithId: null },
      });
    });

    it('happy path: should return existing active link instead of creating new one', async () => {
      (prismaService.file.findUnique as jest.Mock).mockResolvedValue(fileData);
      (prismaService.share.findFirst as jest.Mock).mockResolvedValue(
        publicShare,
      );

      const result = await service.createShare(ownerId, { fileId });

      expect(result.id).toBe(shareId);
      expect(result.token).toBe(token);
      expect(prismaService.share.create).not.toHaveBeenCalled();
    });

    it('happy path: should use FRONTEND_URL for share link', async () => {
      process.env.FRONTEND_URL = 'https://filecloud.example.com';
      (prismaService.file.findUnique as jest.Mock).mockResolvedValue(fileData);
      (prismaService.share.findFirst as jest.Mock).mockResolvedValue(
        publicShare,
      );

      const result = await service.createShare(ownerId, { fileId });

      expect(result.shareUrl).toBe(
        `https://filecloud.example.com/shares/${token}`,
      );
    });

    it('error path: should throw NotFoundException if file is not found', async () => {
      (prismaService.file.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.createShare(ownerId, { fileId })).rejects.toThrow(
        NotFoundException,
      );

      expect(prismaService.share.create).not.toHaveBeenCalled();
    });

    it('error path: should throw ForbiddenException if user does not own file', async () => {
      (prismaService.file.findUnique as jest.Mock).mockResolvedValue(fileData);

      await expect(
        service.createShare('other-user', { fileId }),
      ).rejects.toThrow(ForbiddenException);

      expect(prismaService.share.create).not.toHaveBeenCalled();
    });
  });

  describe('getShareByToken', () => {
    it('happy path: should return active share', async () => {
      (prismaService.share.findUnique as jest.Mock).mockResolvedValue(
        publicShare,
      );

      const result = await service.getShareByToken(token);

      expect(result.id).toBe(shareId);
      expect(result.file).toEqual(fileData);
      expect(prismaService.share.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { token } }),
      );
    });

    it('error path: should throw NotFoundException if token does not exist', async () => {
      (prismaService.share.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getShareByToken(token)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('error path: should throw NotFoundException if share is inactive', async () => {
      (prismaService.share.findUnique as jest.Mock).mockResolvedValue({
        ...publicShare,
        isActive: false,
      });

      await expect(service.getShareByToken(token)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getMyShares', () => {
    it('happy path: should return only public links of owner', async () => {
      (prismaService.share.findMany as jest.Mock).mockResolvedValue([
        publicShare,
      ]);

      const result = await service.getMyShares(ownerId);

      expect(result).toHaveLength(1);
      expect(result[0].shareUrl).toBe(`${baseUrl}/shares/${token}`);
      expect(prismaService.share.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ownerId, sharedWithId: null },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('createDirectShare', () => {
    const dto = { fileId, email: recipient.email };

    it('happy path: should create pending share and notify recipient in real time', async () => {
      (prismaService.file.findUnique as jest.Mock).mockResolvedValue(fileData);
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(recipient);
      (prismaService.share.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.share.create as jest.Mock).mockResolvedValue(pendingShare);

      const result = await service.createDirectShare(ownerId, dto);

      expect(result.status).toBe('pending');
      expect(result.sharedWith).toEqual(recipient);
      expect(prismaService.share.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            fileId,
            ownerId,
            sharedWithId: recipientId,
            token: expect.stringMatching(/^[0-9a-f]{64}$/),
            status: 'pending',
          },
        }),
      );
      expect(notificationsGateway.sendShareNotification).toHaveBeenCalledWith(
        recipientId,
        {
          shareId,
          fileName: fileData.name,
          ownerName: owner.fullName,
          ownerEmail: owner.email,
        },
      );
    });

    it('error path: should throw NotFoundException if file is not found', async () => {
      (prismaService.file.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.createDirectShare(ownerId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('error path: should throw ForbiddenException if user does not own file', async () => {
      (prismaService.file.findUnique as jest.Mock).mockResolvedValue(fileData);

      await expect(
        service.createDirectShare('other-user', dto),
      ).rejects.toThrow(ForbiddenException);

      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('error path: should throw NotFoundException if recipient email does not exist', async () => {
      (prismaService.file.findUnique as jest.Mock).mockResolvedValue(fileData);
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.createDirectShare(ownerId, dto)).rejects.toThrow(
        NotFoundException,
      );

      expect(prismaService.share.create).not.toHaveBeenCalled();
    });

    it('error path: should throw BadRequestException when sharing with yourself', async () => {
      (prismaService.file.findUnique as jest.Mock).mockResolvedValue(fileData);
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(owner);

      await expect(
        service.createDirectShare(ownerId, { fileId, email: owner.email }),
      ).rejects.toThrow(BadRequestException);

      expect(prismaService.share.create).not.toHaveBeenCalled();
    });

    it('error path: should throw BadRequestException if already shared with recipient', async () => {
      (prismaService.file.findUnique as jest.Mock).mockResolvedValue(fileData);
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(recipient);
      (prismaService.share.findFirst as jest.Mock).mockResolvedValue(
        pendingShare,
      );

      await expect(service.createDirectShare(ownerId, dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(prismaService.share.create).not.toHaveBeenCalled();
      expect(notificationsGateway.sendShareNotification).not.toHaveBeenCalled();
    });
  });

  describe('getReceivedShares', () => {
    it('happy path: should return accepted shares of recipient', async () => {
      (prismaService.share.findMany as jest.Mock).mockResolvedValue([
        { ...pendingShare, status: 'accepted' },
      ]);

      const result = await service.getReceivedShares(recipientId);

      expect(result[0].status).toBe('accepted');
      expect(prismaService.share.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sharedWithId: recipientId, status: 'accepted' },
        }),
      );
    });
  });

  describe('getPendingShares', () => {
    it('happy path: should return pending shares of recipient', async () => {
      (prismaService.share.findMany as jest.Mock).mockResolvedValue([
        pendingShare,
      ]);

      const result = await service.getPendingShares(recipientId);

      expect(result[0].status).toBe('pending');
      expect(prismaService.share.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sharedWithId: recipientId, status: 'pending' },
        }),
      );
    });
  });

  describe('acceptShare', () => {
    it('happy path: should accept pending share', async () => {
      (prismaService.share.findUnique as jest.Mock).mockResolvedValue(
        pendingShare,
      );
      (prismaService.share.update as jest.Mock).mockResolvedValue({
        ...pendingShare,
        status: 'accepted',
      });

      const result = await service.acceptShare(recipientId, shareId);

      expect(result.status).toBe('accepted');
      expect(prismaService.share.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: shareId },
          data: { status: 'accepted' },
        }),
      );
    });

    it('error path: should throw NotFoundException if share is not found', async () => {
      (prismaService.share.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.acceptShare(recipientId, shareId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('error path: should throw ForbiddenException if user is not recipient', async () => {
      (prismaService.share.findUnique as jest.Mock).mockResolvedValue(
        pendingShare,
      );

      await expect(service.acceptShare(ownerId, shareId)).rejects.toThrow(
        ForbiddenException,
      );

      expect(prismaService.share.update).not.toHaveBeenCalled();
    });

    it('error path: should throw BadRequestException if share was already processed', async () => {
      (prismaService.share.findUnique as jest.Mock).mockResolvedValue({
        ...pendingShare,
        status: 'accepted',
      });

      await expect(service.acceptShare(recipientId, shareId)).rejects.toThrow(
        BadRequestException,
      );

      expect(prismaService.share.update).not.toHaveBeenCalled();
    });
  });

  describe('rejectShare', () => {
    it('happy path: should delete rejected share', async () => {
      (prismaService.share.findUnique as jest.Mock).mockResolvedValue(
        pendingShare,
      );

      await service.rejectShare(recipientId, shareId);

      expect(prismaService.share.delete).toHaveBeenCalledWith({
        where: { id: shareId },
      });
    });

    it('error path: should throw NotFoundException if share is not found', async () => {
      (prismaService.share.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.rejectShare(recipientId, shareId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('error path: should throw ForbiddenException if user is not recipient', async () => {
      (prismaService.share.findUnique as jest.Mock).mockResolvedValue(
        pendingShare,
      );

      await expect(service.rejectShare(ownerId, shareId)).rejects.toThrow(
        ForbiddenException,
      );

      expect(prismaService.share.delete).not.toHaveBeenCalled();
    });

    it('error path: should throw BadRequestException if share was already processed', async () => {
      (prismaService.share.findUnique as jest.Mock).mockResolvedValue({
        ...pendingShare,
        status: 'accepted',
      });

      await expect(service.rejectShare(recipientId, shareId)).rejects.toThrow(
        BadRequestException,
      );

      expect(prismaService.share.delete).not.toHaveBeenCalled();
    });
  });

  describe('deleteShare', () => {
    it('happy path: should delete share owned by user', async () => {
      (prismaService.share.findUnique as jest.Mock).mockResolvedValue(
        publicShare,
      );

      await service.deleteShare(ownerId, shareId);

      expect(prismaService.share.delete).toHaveBeenCalledWith({
        where: { id: shareId },
      });
    });

    it('error path: should throw NotFoundException if share is not found', async () => {
      (prismaService.share.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.deleteShare(ownerId, shareId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('error path: should throw ForbiddenException if user is not owner', async () => {
      (prismaService.share.findUnique as jest.Mock).mockResolvedValue(
        pendingShare,
      );

      await expect(service.deleteShare(recipientId, shareId)).rejects.toThrow(
        ForbiddenException,
      );

      expect(prismaService.share.delete).not.toHaveBeenCalled();
    });
  });

  describe('getFileDownloadUrl', () => {
    it('happy path: should return presigned URL for active public link', async () => {
      (prismaService.share.findUnique as jest.Mock).mockResolvedValue(
        publicShare,
      );
      (minioService.getPresignedUrl as jest.Mock).mockResolvedValue(
        'https://s3/presigned',
      );

      const result = await service.getFileDownloadUrl(token);

      expect(result).toBe('https://s3/presigned');
      expect(minioService.getPresignedUrl).toHaveBeenCalledWith(
        fileData.storagePath,
      );
    });

    it('error path: should throw NotFoundException if link is inactive', async () => {
      (prismaService.share.findUnique as jest.Mock).mockResolvedValue({
        ...publicShare,
        isActive: false,
      });

      await expect(service.getFileDownloadUrl(token)).rejects.toThrow(
        NotFoundException,
      );

      expect(minioService.getPresignedUrl).not.toHaveBeenCalled();
    });

    it('error path: should throw NotFoundException if token does not exist', async () => {
      (prismaService.share.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getFileDownloadUrl(token)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getSharedFileDownloadUrl', () => {
    const acceptedShare = { ...pendingShare, status: 'accepted' };

    it('happy path: should return presigned URL for accepted recipient', async () => {
      (prismaService.share.findUnique as jest.Mock).mockResolvedValue(
        acceptedShare,
      );
      (minioService.getPresignedUrl as jest.Mock).mockResolvedValue(
        'https://s3/presigned',
      );

      const result = await service.getSharedFileDownloadUrl(
        recipientId,
        shareId,
      );

      expect(result).toBe('https://s3/presigned');
      expect(minioService.getPresignedUrl).toHaveBeenCalledWith(
        fileData.storagePath,
      );
    });

    it('error path: should throw NotFoundException if share is not found', async () => {
      (prismaService.share.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getSharedFileDownloadUrl(recipientId, shareId),
      ).rejects.toThrow(NotFoundException);
    });

    it('error path: should throw ForbiddenException if user is not recipient', async () => {
      (prismaService.share.findUnique as jest.Mock).mockResolvedValue(
        acceptedShare,
      );

      await expect(
        service.getSharedFileDownloadUrl('other-user', shareId),
      ).rejects.toThrow(ForbiddenException);

      expect(minioService.getPresignedUrl).not.toHaveBeenCalled();
    });

    it('error path: should throw ForbiddenException if share is still pending', async () => {
      (prismaService.share.findUnique as jest.Mock).mockResolvedValue(
        pendingShare,
      );

      await expect(
        service.getSharedFileDownloadUrl(recipientId, shareId),
      ).rejects.toThrow(ForbiddenException);

      expect(minioService.getPresignedUrl).not.toHaveBeenCalled();
    });
  });
});
