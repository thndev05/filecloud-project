import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'JWT_ACCESS_SECRET') {
        return 'mockedAccessSecret';
      }
      if (key === 'JWT_REFRESH_SECRET') {
        return 'mockedRefreshSecret';
      }
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@email.com',
      password: 'Password123!',
      fullName: 'Test User',
    };

    const createdUser = {
      id: 'user-id',
      email: registerDto.email,
      fullName: registerDto.fullName,
      avatar: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    it('happy path: should create a new user with hashed password', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      (prismaService.user.create as jest.Mock).mockResolvedValue(createdUser);

      const result = await service.register(registerDto);

      expect(result).toEqual({ user: createdUser });
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: registerDto.email,
          password: 'hashed-password',
          fullName: registerDto.fullName,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          avatar: true,
          createdAt: true,
        },
      });
    });

    it('error path: should throw ConflictException if email already exists', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(
        createdUser,
      );

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );

      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(prismaService.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@email.com',
      password: 'Password123!',
    };

    const userFromDb = {
      id: 'user-id',
      email: loginDto.email,
      password: 'hashed-password',
      fullName: 'Test User',
      avatar: 'avatar.jpg',
      usedStorage: 2048,
    };

    it('happy path: should return user info and tokens', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(
        userFromDb,
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwtService.signAsync as jest.Mock)
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token');
      (prismaService.user.update as jest.Mock).mockResolvedValue(undefined);

      const result = await service.login(loginDto);

      expect(result).toEqual({
        user: {
          id: userFromDb.id,
          email: userFromDb.email,
          fullName: userFromDb.fullName,
          avatar: userFromDb.avatar,
          usedStorage: userFromDb.usedStorage,
        },
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      });
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: loginDto.email },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        userFromDb.password,
      );
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        1,
        { sub: userFromDb.id, email: userFromDb.email },
        {
          secret: 'mockedAccessSecret',
          expiresIn: '15m',
        },
      );
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        2,
        {
          sub: userFromDb.id,
          email: userFromDb.email,
          type: 'refresh',
        },
        {
          secret: 'mockedRefreshSecret',
          expiresIn: '7d',
        },
      );
      expect(bcrypt.hash).toHaveBeenCalledWith('refresh-token', 10);
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: userFromDb.id },
        data: {
          refreshToken: 'hashed-refresh-token',
        },
      });
    });

    it('error path: should throw UnauthorizedException if user is not found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(jwtService.signAsync).not.toHaveBeenCalled();
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('error path: should throw UnauthorizedException if password is invalid', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(
        userFromDb,
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(jwtService.signAsync).not.toHaveBeenCalled();
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });
  });

  describe('refreshTokens', () => {
    const refreshToken = 'valid-refresh-token';
    const refreshPayload = {
      sub: 'user-id',
      email: 'test@email.com',
      type: 'refresh',
    };

    const userWithRefreshToken = {
      id: 'user-id',
      email: 'test@email.com',
      refreshToken: 'hashed-refresh-token',
    };

    it('happy path: should verify refresh token and return a new token pair', async () => {
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(refreshPayload);
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(
        userWithRefreshToken,
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwtService.signAsync as jest.Mock)
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-refresh-token');
      (prismaService.user.update as jest.Mock).mockResolvedValue(undefined);

      const result = await service.refreshTokens(refreshToken);

      expect(result).toEqual({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      });
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(refreshToken, {
        secret: 'mockedRefreshSecret',
      });
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: refreshPayload.sub },
        select: {
          id: true,
          email: true,
          refreshToken: true,
        },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        refreshToken,
        userWithRefreshToken.refreshToken,
      );
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: userWithRefreshToken.id },
        data: {
          refreshToken: 'new-hashed-refresh-token',
        },
      });
    });

    it('error path: should throw UnauthorizedException if token verification fails', async () => {
      (jwtService.verifyAsync as jest.Mock).mockRejectedValue(
        new Error('invalid token'),
      );

      await expect(service.refreshTokens(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('error path: should throw UnauthorizedException if payload type is not refresh', async () => {
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
        ...refreshPayload,
        type: 'access',
      });

      await expect(service.refreshTokens(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('error path: should throw UnauthorizedException if stored refresh token is missing', async () => {
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(refreshPayload);
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        ...userWithRefreshToken,
        refreshToken: null,
      });

      await expect(service.refreshTokens(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('error path: should throw UnauthorizedException if stored refresh token does not match', async () => {
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(refreshPayload);
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(
        userWithRefreshToken,
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.refreshTokens(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(jwtService.signAsync).not.toHaveBeenCalled();
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should clear refresh token for the given user', async () => {
      (prismaService.user.update as jest.Mock).mockResolvedValue(undefined);

      await service.logout('user-id');

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: {
          refreshToken: null,
        },
      });
    });
  });
});
