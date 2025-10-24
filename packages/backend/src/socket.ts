import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { User, Room, Message, RoomMember } from './models';
import { logger } from './utils/logger';

interface SocketData {
  userId: string;
  user: User;
}

interface AuthSocket extends Socket {
  data: SocketData;
}

export class SocketService {
  private io: SocketIOServer;
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set<socketId>

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: config.cors.origins,
        credentials: true,
      },
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  /**
   * Setup authentication middleware
   */
  private setupMiddleware(): void {
    this.io.use(async (socket: AuthSocket, next) => {
      try {
        const token = socket.handshake.auth.token;

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, config.jwt.secret) as { userId: string };
        const user = await User.findByPk(decoded.userId);

        if (!user) {
          return next(new Error('User not found'));
        }

        socket.data = { userId: user.id, user };
        next();
      } catch (error) {
        logger.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthSocket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Handle new socket connection
   */
  private async handleConnection(socket: AuthSocket): Promise<void> {
    const userId = socket.data.userId;
    const user = socket.data.user;

    logger.info(`User connected: ${user.username} (${socket.id})`);

    // Track user sockets
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socket.id);

    // Update user online status
    user.isOnline = true;
    await user.save();

    // Emit user online status to all clients
    this.io.emit('user_status', {
      userId,
      isOnline: true,
    });

    // Join user's rooms
    const memberships = await RoomMember.findAll({
      where: { userId },
      include: [{ model: Room, as: 'room' }],
    });

    for (const membership of memberships) {
      socket.join(`room:${membership.roomId}`);
    }

    // Handle join room
    socket.on('join_room', async (data: { roomId: string }) => {
      await this.handleJoinRoom(socket, data);
    });

    // Handle leave room
    socket.on('leave_room', async (data: { roomId: string }) => {
      await this.handleLeaveRoom(socket, data);
    });

    // Handle send message
    socket.on('send_message', async (data: { roomId: string; encryptedContent: string; messageType?: string }) => {
      await this.handleSendMessage(socket, data);
    });

    // Handle typing indicator
    socket.on('typing', (data: { roomId: string; isTyping: boolean }) => {
      socket.to(`room:${data.roomId}`).emit('user_typing', {
        userId,
        username: user.username,
        roomId: data.roomId,
        isTyping: data.isTyping,
      });
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      await this.handleDisconnect(socket);
    });
  }

  /**
   * Handle join room event
   */
  private async handleJoinRoom(socket: AuthSocket, data: { roomId: string }): Promise<void> {
    try {
      const userId = socket.data.userId;
      const { roomId } = data;

      // Verify membership
      const membership = await RoomMember.findOne({
        where: { roomId, userId },
      });

      if (!membership) {
        socket.emit('error', { message: 'Not a member of this room' });
        return;
      }

      // Join room
      socket.join(`room:${roomId}`);

      // Notify room members
      socket.to(`room:${roomId}`).emit('user_joined', {
        userId,
        username: socket.data.user.username,
        roomId,
      });

      logger.info(`User ${userId} joined room ${roomId}`);
    } catch (error) {
      logger.error('Join room error:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  }

  /**
   * Handle leave room event
   */
  private async handleLeaveRoom(socket: AuthSocket, data: { roomId: string }): Promise<void> {
    try {
      const userId = socket.data.userId;
      const { roomId } = data;

      // Leave room
      socket.leave(`room:${roomId}`);

      // Notify room members
      socket.to(`room:${roomId}`).emit('user_left', {
        userId,
        username: socket.data.user.username,
        roomId,
      });

      logger.info(`User ${userId} left room ${roomId}`);
    } catch (error) {
      logger.error('Leave room error:', error);
      socket.emit('error', { message: 'Failed to leave room' });
    }
  }

  /**
   * Handle send message event
   */
  private async handleSendMessage(
    socket: AuthSocket,
    data: { roomId: string; encryptedContent: string; messageType?: string }
  ): Promise<void> {
    try {
      const userId = socket.data.userId;
      const { roomId, encryptedContent, messageType = 'text' } = data;

      // Verify membership
      const membership = await RoomMember.findOne({
        where: { roomId, userId },
      });

      if (!membership) {
        socket.emit('error', { message: 'Not a member of this room' });
        return;
      }

      // Save message to database
      const message = await Message.create({
        roomId,
        senderId: userId,
        encryptedContent,
        messageType: messageType as 'text' | 'file' | 'image' | 'system',
      });

      // Load sender info
      await message.reload({
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'username', 'displayName', 'avatar'],
          },
        ],
      });

      // Broadcast message to room
      this.io.to(`room:${roomId}`).emit('message', {
        id: message.id,
        roomId: message.roomId,
        sender: message.get('sender'),
        encryptedContent: message.encryptedContent,
        messageType: message.messageType,
        createdAt: message.createdAt,
      });

      logger.info(`Message sent by user ${userId} in room ${roomId}`);
    } catch (error) {
      logger.error('Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  /**
   * Handle disconnect event
   */
  private async handleDisconnect(socket: AuthSocket): Promise<void> {
    try {
      const userId = socket.data.userId;
      const user = socket.data.user;

      logger.info(`User disconnected: ${user.username} (${socket.id})`);

      // Remove socket from user sockets
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);

        // If user has no more sockets, mark as offline
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
          user.isOnline = false;
          user.lastSeen = new Date();
          await user.save();

          // Emit user offline status
          this.io.emit('user_status', {
            userId,
            isOnline: false,
          });
        }
      }
    } catch (error) {
      logger.error('Disconnect error:', error);
    }
  }

  /**
   * Get Socket.IO server instance
   */
  public getIO(): SocketIOServer {
    return this.io;
  }
}
