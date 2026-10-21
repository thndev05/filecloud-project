import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { FoldersService } from './folders.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

describe('FoldersService', () => {
  let service: FoldersService;
  let prismaService: PrismaService;

  const userId = 'user-id';
  const folderId = 'folder-id';
  const parentId = 'parent-id';

  const folderData = {
    id: folderId,
    name: 'Documents',
    userId,
    parentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    folder: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    file: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FoldersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<FoldersService>(FoldersService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('happy path: should create folder at root', async () => {
      (prismaService.folder.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.folder.create as jest.Mock).mockResolvedValue(folderData);

      const result = await service.create(userId, { name: 'Documents' });

      expect(result).toEqual(folderData);
      expect(prismaService.folder.findFirst).toHaveBeenCalledWith({
        where: { userId, name: 'Documents', parentId: null },
      });
      expect(prismaService.folder.create).toHaveBeenCalledWith({
        data: { name: 'Documents', userId, parentId: null },
      });
    });

    it('happy path: should create folder inside parent folder', async () => {
      (prismaService.folder.findFirst as jest.Mock)
        .mockResolvedValueOnce({ id: parentId })
        .mockResolvedValueOnce(null);
      (prismaService.folder.create as jest.Mock).mockResolvedValue({
        ...folderData,
        parentId,
      });

      await service.create(userId, { name: 'Documents', parentId });

      expect(prismaService.folder.findFirst).toHaveBeenNthCalledWith(1, {
        where: { id: parentId, userId },
      });
      expect(prismaService.folder.create).toHaveBeenCalledWith({
        data: { name: 'Documents', userId, parentId },
      });
    });

    it('error path: should throw NotFoundException if parent folder is not found', async () => {
      (prismaService.folder.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.create(userId, { name: 'Documents', parentId }),
      ).rejects.toThrow(NotFoundException);

      expect(prismaService.folder.create).not.toHaveBeenCalled();
    });

    it('error path: should throw ConflictException if name already exists in same parent', async () => {
      (prismaService.folder.findFirst as jest.Mock).mockResolvedValue(
        folderData,
      );

      await expect(
        service.create(userId, { name: 'Documents' }),
      ).rejects.toThrow(ConflictException);

      expect(prismaService.folder.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('happy path: should return root folders sorted by name', async () => {
      (prismaService.folder.findMany as jest.Mock).mockResolvedValue([
        folderData,
      ]);

      const result = await service.findAll(userId);

      expect(result).toEqual([folderData]);
      expect(prismaService.folder.findMany).toHaveBeenCalledWith({
        where: { userId, parentId: null },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('findOne', () => {
    it('happy path: should return folder owned by user', async () => {
      (prismaService.folder.findFirst as jest.Mock).mockResolvedValue(
        folderData,
      );

      const result = await service.findOne(userId, folderId);

      expect(result).toEqual(folderData);
      expect(prismaService.folder.findFirst).toHaveBeenCalledWith({
        where: { id: folderId, userId },
      });
    });

    it('error path: should throw NotFoundException if folder is not found', async () => {
      (prismaService.folder.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne(userId, folderId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getFolderWithContents', () => {
    it('happy path: should return folder with subfolders and active files', async () => {
      const subfolders = [{ id: 'sub-id', name: 'Sub' }];
      const files = [{ id: 'file-id', name: 'a.txt' }];
      (prismaService.folder.findFirst as jest.Mock).mockResolvedValue(
        folderData,
      );
      (prismaService.folder.findMany as jest.Mock).mockResolvedValue(
        subfolders,
      );
      (prismaService.file.findMany as jest.Mock).mockResolvedValue(files);

      const result = await service.getFolderWithContents(userId, folderId);

      expect(result).toEqual({ folder: folderData, subfolders, files });
      expect(prismaService.folder.findMany).toHaveBeenCalledWith({
        where: { userId, parentId: folderId },
        orderBy: { name: 'asc' },
      });
      expect(prismaService.file.findMany).toHaveBeenCalledWith({
        where: { userId, folderId, isDeleted: false },
        orderBy: { name: 'asc' },
      });
    });

    it('error path: should throw NotFoundException if folder is not found', async () => {
      (prismaService.folder.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getFolderWithContents(userId, folderId),
      ).rejects.toThrow(NotFoundException);

      expect(prismaService.folder.findMany).not.toHaveBeenCalled();
      expect(prismaService.file.findMany).not.toHaveBeenCalled();
    });
  });

  describe('rename', () => {
    it('happy path: should rename folder', async () => {
      (prismaService.folder.findFirst as jest.Mock)
        .mockResolvedValueOnce(folderData)
        .mockResolvedValueOnce(null);
      (prismaService.folder.update as jest.Mock).mockResolvedValue({
        ...folderData,
        name: 'Renamed',
      });

      const result = await service.rename(userId, folderId, 'Renamed');

      expect(result.name).toBe('Renamed');
      expect(prismaService.folder.findFirst).toHaveBeenNthCalledWith(2, {
        where: {
          userId,
          name: 'Renamed',
          parentId: folderData.parentId,
          id: { not: folderId },
        },
      });
      expect(prismaService.folder.update).toHaveBeenCalledWith({
        where: { id: folderId },
        data: { name: 'Renamed' },
      });
    });

    it('error path: should throw ConflictException if sibling has same name', async () => {
      (prismaService.folder.findFirst as jest.Mock)
        .mockResolvedValueOnce(folderData)
        .mockResolvedValueOnce({ id: 'other-id', name: 'Renamed' });

      await expect(service.rename(userId, folderId, 'Renamed')).rejects.toThrow(
        ConflictException,
      );

      expect(prismaService.folder.update).not.toHaveBeenCalled();
    });
  });

  describe('move', () => {
    it('happy path: should move folder to new parent', async () => {
      (prismaService.folder.findFirst as jest.Mock)
        .mockResolvedValueOnce(folderData)
        .mockResolvedValueOnce({ id: parentId })
        .mockResolvedValueOnce(null);
      // parent-id is a root folder, so no cycle
      (prismaService.folder.findUnique as jest.Mock).mockResolvedValue({
        parentId: null,
      });
      (prismaService.folder.update as jest.Mock).mockResolvedValue({
        ...folderData,
        parentId,
      });

      const result = await service.move(userId, folderId, parentId);

      expect(result.parentId).toBe(parentId);
      expect(prismaService.folder.update).toHaveBeenCalledWith({
        where: { id: folderId },
        data: { parentId },
      });
    });

    it('happy path: should move folder to root', async () => {
      (prismaService.folder.findFirst as jest.Mock)
        .mockResolvedValueOnce({ ...folderData, parentId })
        .mockResolvedValueOnce(null);
      (prismaService.folder.update as jest.Mock).mockResolvedValue(folderData);

      await service.move(userId, folderId);

      expect(prismaService.folder.findUnique).not.toHaveBeenCalled();
      expect(prismaService.folder.update).toHaveBeenCalledWith({
        where: { id: folderId },
        data: { parentId: null },
      });
    });

    it('error path: should throw NotFoundException if new parent is not found', async () => {
      (prismaService.folder.findFirst as jest.Mock)
        .mockResolvedValueOnce(folderData)
        .mockResolvedValueOnce(null);

      await expect(service.move(userId, folderId, parentId)).rejects.toThrow(
        NotFoundException,
      );

      expect(prismaService.folder.update).not.toHaveBeenCalled();
    });

    it('error path: should throw BadRequestException when moving folder into itself', async () => {
      (prismaService.folder.findFirst as jest.Mock)
        .mockResolvedValueOnce(folderData)
        .mockResolvedValueOnce(folderData);

      await expect(service.move(userId, folderId, folderId)).rejects.toThrow(
        BadRequestException,
      );

      expect(prismaService.folder.update).not.toHaveBeenCalled();
    });

    it('error path: should throw BadRequestException when moving folder into its descendant', async () => {
      // folder-id -> child-id -> grandchild-id; move folder-id into grandchild-id
      (prismaService.folder.findFirst as jest.Mock)
        .mockResolvedValueOnce(folderData)
        .mockResolvedValueOnce({ id: 'grandchild-id' });
      (prismaService.folder.findUnique as jest.Mock)
        .mockResolvedValueOnce({ parentId: 'child-id' })
        .mockResolvedValueOnce({ parentId: folderId });

      await expect(
        service.move(userId, folderId, 'grandchild-id'),
      ).rejects.toThrow(BadRequestException);

      expect(prismaService.folder.update).not.toHaveBeenCalled();
    });

    it('error path: should throw ConflictException if destination has same name', async () => {
      (prismaService.folder.findFirst as jest.Mock)
        .mockResolvedValueOnce(folderData)
        .mockResolvedValueOnce({ id: parentId })
        .mockResolvedValueOnce({ id: 'other-id', name: folderData.name });
      (prismaService.folder.findUnique as jest.Mock).mockResolvedValue({
        parentId: null,
      });

      await expect(service.move(userId, folderId, parentId)).rejects.toThrow(
        ConflictException,
      );

      expect(prismaService.folder.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('happy path: should delete folder tree and move its files to trash', async () => {
      // folder-id contains sub-id; each folder holds one file
      (prismaService.folder.findFirst as jest.Mock).mockResolvedValue(
        folderData,
      );
      (prismaService.folder.findMany as jest.Mock).mockImplementation(
        ({ where }) =>
          Promise.resolve(
            where.parentId === folderId ? [{ id: 'sub-id' }] : [],
          ),
      );
      (prismaService.file.findMany as jest.Mock).mockImplementation(
        ({ where }) => Promise.resolve([{ id: `file-in-${where.folderId}` }]),
      );

      const result = await service.delete(userId, folderId);

      expect(result).toEqual({ message: 'Folder deleted successfully' });
      expect(prismaService.file.update).toHaveBeenCalledTimes(2);
      expect(prismaService.file.update).toHaveBeenCalledWith({
        where: { id: 'file-in-sub-id' },
        data: { isDeleted: true, deletedAt: expect.any(Date), folderId: null },
      });
      expect(prismaService.file.update).toHaveBeenCalledWith({
        where: { id: `file-in-${folderId}` },
        data: { isDeleted: true, deletedAt: expect.any(Date), folderId: null },
      });
      // Children are deleted before their parent
      expect(prismaService.folder.delete).toHaveBeenNthCalledWith(1, {
        where: { id: 'sub-id' },
      });
      expect(prismaService.folder.delete).toHaveBeenNthCalledWith(2, {
        where: { id: folderId },
      });
    });

    it('error path: should throw NotFoundException if folder is not found', async () => {
      (prismaService.folder.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.delete(userId, folderId)).rejects.toThrow(
        NotFoundException,
      );

      expect(prismaService.folder.delete).not.toHaveBeenCalled();
      expect(prismaService.file.update).not.toHaveBeenCalled();
    });
  });

  describe('getBreadcrumb', () => {
    it('happy path: should return path from root to folder', async () => {
      const root = { id: 'root-id', name: 'Root', parentId: null };
      const child = { id: folderId, name: 'Documents', parentId: 'root-id' };
      (prismaService.folder.findFirst as jest.Mock)
        .mockResolvedValueOnce(child)
        .mockResolvedValueOnce(root);

      const result = await service.getBreadcrumb(userId, folderId);

      expect(result).toEqual([root, child]);
    });

    it('edge case: should return empty array if folder is not found', async () => {
      (prismaService.folder.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getBreadcrumb(userId, folderId);

      expect(result).toEqual([]);
    });
  });
});
