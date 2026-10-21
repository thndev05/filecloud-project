import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FilesService } from './files.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MinioService } from '../../infrastructure/minio/minio.service';

describe('FilesService', () => {
  let service: FilesService;
  let prismaService: PrismaService;
  let minioService: MinioService;

  const userId = 'user-id';
  const fileId = 'file-id';
  const folderId = 'folder-id';
  const GB = 1024 * 1024 * 1024;

  const fileData = {
    id: fileId,
    name: 'report.pdf',
    size: 2048,
    mimeType: 'application/pdf',
    storagePath: `${userId}/uuid.pdf`,
    userId,
    folderId: null,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const deletedFileData = {
    ...fileData,
    isDeleted: true,
    deletedAt: new Date(),
  };

  const mockPrismaService = {
    file: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    folder: {
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockMinioService = {
    uploadFile: jest.fn(),
    downloadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: MinioService, useValue: mockMinioService },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
    prismaService = module.get<PrismaService>(PrismaService);
    minioService = module.get<MinioService>(MinioService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadFile', () => {
    const file = {
      originalname: 'report.pdf',
      buffer: Buffer.from('file content'),
      mimetype: 'application/pdf',
      size: 2048,
    };

    it('happy path: should upload to MinIO, save metadata and increase used storage', async () => {
      (prismaService.folder.findFirst as jest.Mock).mockResolvedValue({
        id: folderId,
      });
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        usedStorage: 0,
      });
      (prismaService.file.create as jest.Mock).mockResolvedValue(fileData);

      const result = await service.uploadFile(userId, file, folderId);

      expect(result).toEqual(fileData);
      const [storagePath, buffer, meta] = (minioService.uploadFile as jest.Mock)
        .mock.calls[0];
      expect(storagePath).toMatch(
        new RegExp(`^${userId}/[0-9a-f-]{36}\\.pdf$`),
      );
      expect(buffer).toBe(file.buffer);
      expect(meta).toEqual({ 'Content-Type': file.mimetype });
      expect(prismaService.file.create).toHaveBeenCalledWith({
        data: {
          name: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          storagePath,
          userId,
          folderId,
        },
      });
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { usedStorage: { increment: file.size } },
      });
    });

    it('happy path: should save file at root and decode UTF-8 file name', async () => {
      const vietnameseName = 'báo cáo.pdf';
      const latin1Name = Buffer.from(vietnameseName, 'utf8').toString('latin1');
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        usedStorage: 0,
      });
      (prismaService.file.create as jest.Mock).mockResolvedValue(fileData);

      await service.uploadFile(userId, { ...file, originalname: latin1Name });

      expect(prismaService.folder.findFirst).not.toHaveBeenCalled();
      expect(prismaService.file.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: vietnameseName, folderId: null }),
      });
    });

    it('error path: should throw NotFoundException if folder does not belong to user', async () => {
      (prismaService.folder.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.uploadFile(userId, file, folderId)).rejects.toThrow(
        NotFoundException,
      );

      expect(prismaService.folder.findFirst).toHaveBeenCalledWith({
        where: { id: folderId, userId },
      });
      expect(minioService.uploadFile).not.toHaveBeenCalled();
      expect(prismaService.file.create).not.toHaveBeenCalled();
    });

    it('error path: should throw BadRequestException if storage quota is exceeded', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        usedStorage: 10 * GB - 1024,
      });

      await expect(service.uploadFile(userId, file)).rejects.toThrow(
        BadRequestException,
      );

      expect(minioService.uploadFile).not.toHaveBeenCalled();
      expect(prismaService.file.create).not.toHaveBeenCalled();
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('happy path: should return active files in root by default', async () => {
      (prismaService.file.findMany as jest.Mock).mockResolvedValue([fileData]);

      const result = await service.findAll(userId);

      expect(result).toEqual([fileData]);
      expect(prismaService.file.findMany).toHaveBeenCalledWith({
        where: { userId, folderId: null, isDeleted: false },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('happy path: should filter by folder and trash status', async () => {
      (prismaService.file.findMany as jest.Mock).mockResolvedValue([]);

      await service.findAll(userId, folderId, true);

      expect(prismaService.file.findMany).toHaveBeenCalledWith({
        where: { userId, folderId, isDeleted: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('happy path: should return file owned by user', async () => {
      (prismaService.file.findFirst as jest.Mock).mockResolvedValue(fileData);

      const result = await service.findOne(userId, fileId);

      expect(result).toEqual(fileData);
      expect(prismaService.file.findFirst).toHaveBeenCalledWith({
        where: { id: fileId, userId },
      });
    });

    it('error path: should throw NotFoundException if file is not found', async () => {
      (prismaService.file.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne(userId, fileId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('downloadFile', () => {
    it('happy path: should download file content from MinIO', async () => {
      const content = Buffer.from('file content');
      (prismaService.file.findFirst as jest.Mock).mockResolvedValue(fileData);
      (minioService.downloadFile as jest.Mock).mockResolvedValue(content);

      const result = await service.downloadFile(userId, fileId);

      expect(result).toBe(content);
      expect(minioService.downloadFile).toHaveBeenCalledWith(
        fileData.storagePath,
      );
    });

    it('error path: should throw BadRequestException if file is in trash', async () => {
      (prismaService.file.findFirst as jest.Mock).mockResolvedValue(
        deletedFileData,
      );

      await expect(service.downloadFile(userId, fileId)).rejects.toThrow(
        BadRequestException,
      );

      expect(minioService.downloadFile).not.toHaveBeenCalled();
    });
  });

  describe('renameFile', () => {
    it('happy path: should rename file', async () => {
      const renamed = { ...fileData, name: 'new.pdf' };
      (prismaService.file.findFirst as jest.Mock).mockResolvedValue(fileData);
      (prismaService.file.update as jest.Mock).mockResolvedValue(renamed);

      const result = await service.renameFile(userId, fileId, 'new.pdf');

      expect(result).toEqual(renamed);
      expect(prismaService.file.update).toHaveBeenCalledWith({
        where: { id: fileId },
        data: { name: 'new.pdf' },
      });
    });

    it('error path: should throw BadRequestException if file is in trash', async () => {
      (prismaService.file.findFirst as jest.Mock).mockResolvedValue(
        deletedFileData,
      );

      await expect(
        service.renameFile(userId, fileId, 'new.pdf'),
      ).rejects.toThrow(BadRequestException);

      expect(prismaService.file.update).not.toHaveBeenCalled();
    });
  });

  describe('moveFile', () => {
    it('happy path: should move file to target folder', async () => {
      (prismaService.file.findFirst as jest.Mock).mockResolvedValue(fileData);
      (prismaService.folder.findFirst as jest.Mock).mockResolvedValue({
        id: folderId,
      });
      (prismaService.file.update as jest.Mock).mockResolvedValue({
        ...fileData,
        folderId,
      });

      const result = await service.moveFile(userId, fileId, folderId);

      expect(result.folderId).toBe(folderId);
      expect(prismaService.file.update).toHaveBeenCalledWith({
        where: { id: fileId },
        data: { folderId },
      });
    });

    it('happy path: should move file to root when no folder is given', async () => {
      (prismaService.file.findFirst as jest.Mock).mockResolvedValue(fileData);
      (prismaService.file.update as jest.Mock).mockResolvedValue(fileData);

      await service.moveFile(userId, fileId);

      expect(prismaService.folder.findFirst).not.toHaveBeenCalled();
      expect(prismaService.file.update).toHaveBeenCalledWith({
        where: { id: fileId },
        data: { folderId: null },
      });
    });

    it('error path: should throw BadRequestException if file is in trash', async () => {
      (prismaService.file.findFirst as jest.Mock).mockResolvedValue(
        deletedFileData,
      );

      await expect(service.moveFile(userId, fileId, folderId)).rejects.toThrow(
        BadRequestException,
      );

      expect(prismaService.file.update).not.toHaveBeenCalled();
    });

    it('error path: should throw NotFoundException if target folder is not found', async () => {
      (prismaService.file.findFirst as jest.Mock).mockResolvedValue(fileData);
      (prismaService.folder.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.moveFile(userId, fileId, folderId)).rejects.toThrow(
        NotFoundException,
      );

      expect(prismaService.file.update).not.toHaveBeenCalled();
    });
  });

  describe('moveToTrash', () => {
    it('happy path: should soft delete file', async () => {
      (prismaService.file.findFirst as jest.Mock).mockResolvedValue(fileData);

      const result = await service.moveToTrash(userId, fileId);

      expect(result).toEqual({ message: 'File moved to trash' });
      expect(prismaService.file.update).toHaveBeenCalledWith({
        where: { id: fileId },
        data: { isDeleted: true, deletedAt: expect.any(Date) },
      });
    });

    it('error path: should throw NotFoundException if file is not found', async () => {
      (prismaService.file.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.moveToTrash(userId, fileId)).rejects.toThrow(
        NotFoundException,
      );

      expect(prismaService.file.update).not.toHaveBeenCalled();
    });
  });

  describe('restoreFile', () => {
    it('happy path: should restore file from trash', async () => {
      (prismaService.file.findFirst as jest.Mock).mockResolvedValue(
        deletedFileData,
      );
      (prismaService.file.update as jest.Mock).mockResolvedValue(fileData);

      const result = await service.restoreFile(userId, fileId);

      expect(result).toEqual(fileData);
      expect(prismaService.file.update).toHaveBeenCalledWith({
        where: { id: fileId },
        data: { isDeleted: false, deletedAt: null },
      });
    });

    it('error path: should throw BadRequestException if file is not in trash', async () => {
      (prismaService.file.findFirst as jest.Mock).mockResolvedValue(fileData);

      await expect(service.restoreFile(userId, fileId)).rejects.toThrow(
        BadRequestException,
      );

      expect(prismaService.file.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteFilePermanently', () => {
    it('happy path: should delete from MinIO and database and decrease used storage', async () => {
      (prismaService.file.findFirst as jest.Mock).mockResolvedValue(
        deletedFileData,
      );

      const result = await service.deleteFilePermanently(userId, fileId);

      expect(result).toEqual({ message: 'File deleted permanently' });
      expect(minioService.deleteFile).toHaveBeenCalledWith(
        fileData.storagePath,
      );
      expect(prismaService.file.delete).toHaveBeenCalledWith({
        where: { id: fileId },
      });
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { usedStorage: { decrement: fileData.size } },
      });
    });

    it('error path: should throw NotFoundException if file is not found', async () => {
      (prismaService.file.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.deleteFilePermanently(userId, fileId),
      ).rejects.toThrow(NotFoundException);

      expect(minioService.deleteFile).not.toHaveBeenCalled();
      expect(prismaService.file.delete).not.toHaveBeenCalled();
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });
  });

  describe('getRecentFiles', () => {
    it('happy path: should return recent active files with default limit', async () => {
      (prismaService.file.findMany as jest.Mock).mockResolvedValue([fileData]);

      const result = await service.getRecentFiles(userId);

      expect(result).toEqual([fileData]);
      expect(prismaService.file.findMany).toHaveBeenCalledWith({
        where: { userId, isDeleted: false },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      });
    });
  });
});
