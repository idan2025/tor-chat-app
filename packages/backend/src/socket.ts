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
    socket.on('send_message', async (data: { roomId: string; encryptedContent: string; messageType?: string; attachments?: string[] }) => {
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

    // Handle add reaction
    socket.on('add_reaction', async (data: { messageId: string; roomId: string; emoji: string }) => {
      await this.handleAddReaction(socket, data);
    });

    // Handle remove reaction
    socket.on('remove_reaction', async (data: { messageId: string; roomId: string; emoji: string }) => {
      await this.handleRemoveReaction(socket, data);
    });

    // Handle edit message
    socket.on('edit_message', async (data: { messageId: string; roomId: string; encryptedContent: string }) => {
      await this.handleEditMessage(socket, data);
    });

    // Handle delete message
    socket.on('delete_message', async (data: { messageId: string; roomId: string }) => {
      await this.handleDeleteMessage(socket, data);
    });

    // Handle mark read
    socket.on('mark_read', async (data: { roomId: string; messageId: string }) => {
      await this.handleMarkRead(socket, data);
    });

    // Handle forward message
    socket.on('forward_message', async (data: { messageId: string; targetRoomId: string }) => {
      await this.handleForwardMessage(socket, data);
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
    data: { roomId: string; encryptedContent: string; messageType?: string; attachments?: string[] }
  ): Promise<void> {
    try {
      const userId = socket.data.userId;
      const { roomId, encryptedContent, messageType = 'text', attachments } = data;

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
        messageType: messageType as 'text' | 'file' | 'image' | 'video' | 'system',
        attachments: attachments || [],
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
        attachments: message.attachments,
        createdAt: message.createdAt,
      });

      logger.info(`Message sent by user ${userId} in room ${roomId}`);
    } catch (error) {
      logger.error('Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  /**
   * Handle add reaction event
   */
  private async handleAddReaction(
    socket: AuthSocket,
    data: { messageId: string; roomId: string; emoji: string }
  ): Promise<void> {
    try {
      const userId = socket.data.userId;
      const { messageId, roomId, emoji } = data;

      // Verify membership
      const membership = await RoomMember.findOne({
        where: { roomId, userId },
      });

      if (!membership) {
        socket.emit('error', { message: 'Not a member of this room' });
        return;
      }

      // Find message
      const message = await Message.findOne({
        where: { id: messageId, roomId },
      });

      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      // Initialize metadata if it doesn't exist
      const metadata = message.metadata || {};
      const reactions = (metadata as any).reactions || {};

      // Add user to emoji reactions
      if (!reactions[emoji]) {
        reactions[emoji] = [];
      }

      // Check if user already reacted with this emoji
      if (!reactions[emoji].includes(userId)) {
        reactions[emoji].push(userId);
      }

      // Update message metadata
      message.metadata = { ...metadata, reactions };
      await message.save();

      // Broadcast reaction added
      this.io.to(`room:${roomId}`).emit('reaction_added', {
        messageId,
        userId,
        username: socket.data.user.username,
        emoji,
        roomId,
      });

      logger.info(`User ${userId} added reaction ${emoji} to message ${messageId}`);
    } catch (error) {
      logger.error('Add reaction error:', error);
      socket.emit('error', { message: 'Failed to add reaction' });
    }
  }

  /**
   * Handle remove reaction event
   */
  private async handleRemoveReaction(
    socket: AuthSocket,
    data: { messageId: string; roomId: string; emoji: string }
  ): Promise<void> {
    try {
      const userId = socket.data.userId;
      const { messageId, roomId, emoji } = data;

      // Verify membership
      const membership = await RoomMember.findOne({
        where: { roomId, userId },
      });

      if (!membership) {
        socket.emit('error', { message: 'Not a member of this room' });
        return;
      }

      // Find message
      const message = await Message.findOne({
        where: { id: messageId, roomId },
      });

      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      // Get metadata
      const metadata = message.metadata || {};
      const reactions = (metadata as any).reactions || {};

      // Remove user from emoji reactions
      if (reactions[emoji]) {
        reactions[emoji] = reactions[emoji].filter((id: string) => id !== userId);

        // Remove emoji key if no users left
        if (reactions[emoji].length === 0) {
          delete reactions[emoji];
        }
      }

      // Update message metadata
      message.metadata = { ...metadata, reactions };
      await message.save();

      // Broadcast reaction removed
      this.io.to(`room:${roomId}`).emit('reaction_removed', {
        messageId,
        userId,
        username: socket.data.user.username,
        emoji,
        roomId,
      });

      logger.info(`User ${userId} removed reaction ${emoji} from message ${messageId}`);
    } catch (error) {
      logger.error('Remove reaction error:', error);
      socket.emit('error', { message: 'Failed to remove reaction' });
    }
  }

  /**
   * Handle edit message event
   */
  private async handleEditMessage(
    socket: AuthSocket,
    data: { messageId: string; roomId: string; encryptedContent: string }
  ): Promise<void> {
    try {
      const userId = socket.data.userId;
      const { messageId, roomId, encryptedContent } = data;

      // Verify membership
      const membership = await RoomMember.findOne({
        where: { roomId, userId },
      });

      if (!membership) {
        socket.emit('error', { message: 'Not a member of this room' });
        return;
      }

      // Find message
      const message = await Message.findOne({
        where: { id: messageId, roomId },
      });

      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      // Check if user is the sender
      if (message.senderId !== userId) {
        socket.emit('error', { message: 'You can only edit your own messages' });
        return;
      }

      // Check if message is deleted
      if (message.isDeleted) {
        socket.emit('error', { message: 'Cannot edit deleted message' });
        return;
      }

      // Check if within 20 minute window
      const now = new Date();
      const messageAge = now.getTime() - message.createdAt.getTime();
      const twentyMinutes = 20 * 60 * 1000;

      if (messageAge > twentyMinutes) {
        socket.emit('error', { message: 'Cannot edit message after 20 minutes' });
        return;
      }

      // Update message
      message.encryptedContent = encryptedContent;
      message.isEdited = true;
      message.editedAt = now;
      await message.save();

      // Broadcast message edited
      this.io.to(`room:${roomId}`).emit('message_edited', {
        messageId,
        roomId,
        encryptedContent,
        editedAt: message.editedAt,
      });

      logger.info(`User ${userId} edited message ${messageId}`);
    } catch (error) {
      logger.error('Edit message error:', error);
      socket.emit('error', { message: 'Failed to edit message' });
    }
  }

  /**
   * Handle delete message event
   */
  private async handleDeleteMessage(
    socket: AuthSocket,
    data: { messageId: string; roomId: string }
  ): Promise<void> {
    try {
      const userId = socket.data.userId;
      const { messageId, roomId } = data;

      // Verify membership
      const membership = await RoomMember.findOne({
        where: { roomId, userId },
      });

      if (!membership) {
        socket.emit('error', { message: 'Not a member of this room' });
        return;
      }

      // Find message
      const message = await Message.findOne({
        where: { id: messageId, roomId },
      });

      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      // Check if user is the sender or room admin
      const canDelete = message.senderId === userId || membership.role === 'admin';

      if (!canDelete) {
        socket.emit('error', { message: 'You can only delete your own messages or be a room admin' });
        return;
      }

      // Check if already deleted
      if (message.isDeleted) {
        socket.emit('error', { message: 'Message already deleted' });
        return;
      }

      // Soft delete message
      message.isDeleted = true;
      message.deletedAt = new Date();
      await message.save();

      // Broadcast message deleted
      this.io.to(`room:${roomId}`).emit('message_deleted', {
        messageId,
        roomId,
      });

      logger.info(`User ${userId} deleted message ${messageId}`);
    } catch (error) {
      logger.error('Delete message error:', error);
      socket.emit('error', { message: 'Failed to delete message' });
    }
  }

  /**
   * Handle mark read event
   */
  private async handleMarkRead(
    socket: AuthSocket,
    data: { roomId: string; messageId: string }
  ): Promise<void> {
    try {
      const userId = socket.data.userId;
      const { roomId, messageId } = data;

      // Verify membership
      const membership = await RoomMember.findOne({
        where: { roomId, userId },
      });

      if (!membership) {
        socket.emit('error', { message: 'Not a member of this room' });
        return;
      }

      // Verify message exists in room
      const message = await Message.findOne({
        where: { id: messageId, roomId },
      });

      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      // Update last read information
      membership.lastReadMessageId = messageId;
      membership.lastReadAt = new Date();
      await membership.save();

      logger.info(`User ${userId} marked message ${messageId} as read in room ${roomId}`);
    } catch (error) {
      logger.error('Mark read error:', error);
      socket.emit('error', { message: 'Failed to mark message as read' });
    }
  }

  /**
   * Handle forward message event
   */
  private async handleForwardMessage(
    socket: AuthSocket,
    data: { messageId: string; targetRoomId: string }
  ): Promise<void> {
    try {
      const userId = socket.data.userId;
      const { messageId, targetRoomId } = data;

      // Find original message
      const originalMessage = await Message.findByPk(messageId);

      if (!originalMessage) {
        socket.emit('error', { message: 'Original message not found' });
        return;
      }

      // Verify user is member of source room
      const sourceMembership = await RoomMember.findOne({
        where: { roomId: originalMessage.roomId, userId },
      });

      if (!sourceMembership) {
        socket.emit('error', { message: 'Not a member of the source room' });
        return;
      }

      // Verify user is member of target room
      const targetMembership = await RoomMember.findOne({
        where: { roomId: targetRoomId, userId },
      });

      if (!targetMembership) {
        socket.emit('error', { message: 'Not a member of the target room' });
        return;
      }

      // Check if original message is deleted
      if (originalMessage.isDeleted) {
        socket.emit('error', { message: 'Cannot forward deleted message' });
        return;
      }

      // Create forwarded message in target room
      const forwardedMessage = await Message.create({
        roomId: targetRoomId,
        senderId: userId,
        encryptedContent: originalMessage.encryptedContent,
        messageType: originalMessage.messageType,
        attachments: originalMessage.attachments || [],
        parentMessageId: originalMessage.id,
      });

      // Load sender info
      await forwardedMessage.reload({
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'username', 'displayName', 'avatar'],
          },
        ],
      });

      // Broadcast forwarded message to target room
      this.io.to(`room:${targetRoomId}`).emit('message', {
        id: forwardedMessage.id,
        roomId: forwardedMessage.roomId,
        sender: forwardedMessage.get('sender'),
        encryptedContent: forwardedMessage.encryptedContent,
        messageType: forwardedMessage.messageType,
        attachments: forwardedMessage.attachments,
        parentMessageId: forwardedMessage.parentMessageId,
        createdAt: forwardedMessage.createdAt,
      });

      logger.info(`User ${userId} forwarded message ${messageId} to room ${targetRoomId}`);
    } catch (error) {
      logger.error('Forward message error:', error);
      socket.emit('error', { message: 'Failed to forward message' });
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
