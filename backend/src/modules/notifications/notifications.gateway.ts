import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger('NotificationsGateway');
  private userSockets = new Map<string, string>(); // userId -> socketId

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    // Remove user from map
    for (const [userId, socketId] of this.userSockets.entries()) {
      if (socketId === client.id) {
        this.userSockets.delete(userId);
        this.logger.log(`User ${userId} disconnected`);
        break;
      }
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Handle user registration via WebSocket event
  @SubscribeMessage('registerUser')
  handleRegisterUser(client: Socket, userId: string) {
    this.userSockets.set(userId, client.id);
    this.logger.log(`User ${userId} registered with socket ${client.id}`);
  }

  // Register user's socket connection (programmatic)
  registerUser(userId: string, socketId: string) {
    this.userSockets.set(userId, socketId);
    this.logger.log(`User ${userId} registered with socket ${socketId}`);
  }

  // Send share notification to specific user
  sendShareNotification(
    userId: string,
    data: {
      shareId: string;
      fileName: string;
      ownerName: string;
      ownerEmail: string;
    },
  ) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.server.to(socketId).emit('share-received', data);
      this.logger.log(`Share notification sent to user ${userId}`);
    } else {
      this.logger.warn(`User ${userId} is not connected`);
    }
  }
}
