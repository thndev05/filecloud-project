import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { NotificationsGateway } from './notifications.gateway';

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;

  const mockEmit = jest.fn();
  const mockServer = {
    to: jest.fn(() => ({ emit: mockEmit })),
  };

  const notification = {
    shareId: 'share-id',
    fileName: 'report.pdf',
    ownerName: 'Owner',
    ownerEmail: 'owner@email.com',
  };

  const socket = (id: string) => ({ id }) as Socket;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsGateway],
    }).compile();

    gateway = module.get<NotificationsGateway>(NotificationsGateway);
    gateway.server = mockServer as never;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('sendShareNotification', () => {
    it('happy path: should emit to socket registered via registerUser event', () => {
      gateway.handleRegisterUser(socket('socket-1'), 'user-id');

      gateway.sendShareNotification('user-id', notification);

      expect(mockServer.to).toHaveBeenCalledWith('socket-1');
      expect(mockEmit).toHaveBeenCalledWith('share-received', notification);
    });

    it('happy path: should emit to socket registered programmatically', () => {
      gateway.registerUser('user-id', 'socket-2');

      gateway.sendShareNotification('user-id', notification);

      expect(mockServer.to).toHaveBeenCalledWith('socket-2');
    });

    it('happy path: should emit to the latest socket when user reconnects', () => {
      gateway.registerUser('user-id', 'old-socket');
      gateway.registerUser('user-id', 'new-socket');

      gateway.sendShareNotification('user-id', notification);

      expect(mockServer.to).toHaveBeenCalledWith('new-socket');
    });

    it('edge case: should not emit if user is not connected', () => {
      gateway.sendShareNotification('offline-user', notification);

      expect(mockServer.to).not.toHaveBeenCalled();
      expect(Logger.prototype.warn).toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('happy path: should unregister only the disconnected user', () => {
      gateway.registerUser('user-a', 'socket-a');
      gateway.registerUser('user-b', 'socket-b');

      gateway.handleDisconnect(socket('socket-a'));
      gateway.sendShareNotification('user-a', notification);
      gateway.sendShareNotification('user-b', notification);

      expect(mockServer.to).toHaveBeenCalledTimes(1);
      expect(mockServer.to).toHaveBeenCalledWith('socket-b');
    });

    it('edge case: should do nothing for unknown socket', () => {
      gateway.registerUser('user-id', 'socket-1');

      gateway.handleDisconnect(socket('unknown-socket'));
      gateway.sendShareNotification('user-id', notification);

      expect(mockServer.to).toHaveBeenCalledWith('socket-1');
    });
  });
});
