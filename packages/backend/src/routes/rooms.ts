import express, { Response } from 'express';
import { z } from 'zod';
import { Room, RoomMember, User, Message } from '../models';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { cryptoService } from '../services/crypto';
import { logger } from '../utils/logger';

const router = express.Router();

const createRoomSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(['public', 'private']).default('public'),
  maxMembers: z.number().int().positive().max(1000).optional(),
});

/**
 * GET /api/rooms
 * List all public rooms
 */
router.get('/', authenticateToken, async (_req: AuthRequest, res: Response) => {
  try {
    const rooms = await Room.findAll({
      where: { type: 'public' },
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'displayName', 'avatar'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const roomsData = rooms.map((room) => room.toPublicJSON());

    res.json({ rooms: roomsData });
  } catch (error) {
    logger.error('Get rooms error:', error);
    res.status(500).json({ error: 'Failed to get rooms' });
  }
});

/**
 * POST /api/rooms
 * Create a new room
 */
router.post('/', authenticateToken, validateBody(createRoomSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { name, description, type, maxMembers } = req.body;

    // Generate room encryption key
    const encryptionKey = await cryptoService.generateRoomKey();

    // Create room
    const room = await Room.create({
      name,
      description,
      type,
      encryptionKey,
      creatorId: req.userId,
      maxMembers,
    });

    // Add creator as admin
    await RoomMember.create({
      roomId: room.id,
      userId: req.userId,
      role: 'admin',
    });

    logger.info(`Room created: ${name} by user ${req.userId}`);

    res.status(201).json({
      message: 'Room created successfully',
      room: {
        ...room.toPublicJSON(),
        encryptionKey, // Send key to creator
      },
    });
  } catch (error) {
    logger.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

/**
 * GET /api/rooms/:id
 * Get room details
 */
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const room = await Room.findByPk(id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'displayName', 'avatar'],
        },
      ],
    });

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    // Check if user is a member
    let membership = await RoomMember.findOne({
      where: {
        roomId: id,
        userId: req.userId!,
      },
    });

    // Auto-join public rooms if not already a member
    if (!membership && room.type === 'public') {
      // Check room capacity
      const memberCount = await RoomMember.count({ where: { roomId: id } });
      if (!room.maxMembers || memberCount < room.maxMembers) {
        membership = await RoomMember.create({
          roomId: id,
          userId: req.userId!,
          role: 'member',
        });
        logger.info(`User ${req.userId} auto-joined public room ${id}`);
      }
    }

    // Deny access to private rooms without membership
    if (!membership && room.type === 'private') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({
      room: membership ? { ...room.toJSON() } : room.toPublicJSON(),
    });
  } catch (error) {
    logger.error('Get room error:', error);
    res.status(500).json({ error: 'Failed to get room' });
  }
});

/**
 * POST /api/rooms/:id/join
 * Join a room
 */
router.post('/:id/join', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const room = await Room.findByPk(id);

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    // Check if already a member
    const existingMember = await RoomMember.findOne({
      where: {
        roomId: id,
        userId: req.userId!,
      },
    });

    if (existingMember) {
      res.status(409).json({ error: 'Already a member of this room' });
      return;
    }

    // Check room capacity
    const memberCount = await RoomMember.count({ where: { roomId: id } });
    if (room.maxMembers && memberCount >= room.maxMembers) {
      res.status(403).json({ error: 'Room is full' });
      return;
    }

    // Add user to room
    await RoomMember.create({
      roomId: id,
      userId: req.userId!,
      role: 'member',
    });

    logger.info(`User ${req.userId} joined room ${id}`);

    res.json({
      message: 'Joined room successfully',
      room: { ...room.toJSON() },
    });
  } catch (error) {
    logger.error('Join room error:', error);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

/**
 * POST /api/rooms/:id/leave
 * Leave a room
 */
router.post('/:id/leave', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const membership = await RoomMember.findOne({
      where: {
        roomId: id,
        userId: req.userId!,
      },
    });

    if (!membership) {
      res.status(404).json({ error: 'Not a member of this room' });
      return;
    }

    await membership.destroy();

    logger.info(`User ${req.userId} left room ${id}`);

    res.json({ message: 'Left room successfully' });
  } catch (error) {
    logger.error('Leave room error:', error);
    res.status(500).json({ error: 'Failed to leave room' });
  }
});

/**
 * GET /api/rooms/:id/messages
 * Get room messages
 */
router.get('/:id/messages', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Check if user is a member
    const membership = await RoomMember.findOne({
      where: {
        roomId: id,
        userId: req.userId!,
      },
    });

    if (!membership) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const messages = await Message.findAll({
      where: { roomId: id },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'username', 'displayName', 'avatar'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.json({ messages });
  } catch (error) {
    logger.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

/**
 * GET /api/rooms/:id/members
 * Get room members
 */
router.get('/:id/members', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id} = req.params;

    const members = await RoomMember.findAll({
      where: { roomId: id },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'displayName', 'avatar', 'isOnline', 'lastSeen'],
        },
      ],
    });

    res.json({ members });
  } catch (error) {
    logger.error('Get members error:', error);
    res.status(500).json({ error: 'Failed to get members' });
  }
});

/**
 * DELETE /api/rooms/:id
 * Delete a room (creator or admin only)
 */
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const room = await Room.findByPk(id);

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const user = await User.findByPk(req.userId!);

    // Check if user is creator or admin
    if (room.creatorId !== req.userId && !user?.isAdmin) {
      res.status(403).json({ error: 'Only room creator or admin can delete this room' });
      return;
    }

    // Delete all room members and messages
    await RoomMember.destroy({ where: { roomId: id } });
    await Message.destroy({ where: { roomId: id } });
    await room.destroy();

    logger.info(`Room ${id} deleted by user ${req.userId}`);

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    logger.error('Delete room error:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

/**
 * POST /api/rooms/:id/members
 * Add a member to a room (private rooms only, creator or admin)
 */
router.post('/:id/members', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const room = await Room.findByPk(id);

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    // Check if requester is creator or admin
    const requester = await User.findByPk(req.userId!);
    const isCreator = room.creatorId === req.userId;
    const membership = await RoomMember.findOne({
      where: { roomId: id, userId: req.userId! },
    });

    if (!isCreator && membership?.role !== 'admin' && !requester?.isAdmin) {
      res.status(403).json({ error: 'Only room creator or admin can add members' });
      return;
    }

    // Check if user exists
    const userToAdd = await User.findByPk(userId);
    if (!userToAdd) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check if already a member
    const existingMember = await RoomMember.findOne({
      where: { roomId: id, userId },
    });

    if (existingMember) {
      res.status(409).json({ error: 'User is already a member' });
      return;
    }

    // Add member
    await RoomMember.create({
      roomId: id,
      userId,
      role: 'member',
    });

    logger.info(`User ${userId} added to room ${id} by ${req.userId}`);

    res.json({ message: 'Member added successfully' });
  } catch (error) {
    logger.error('Add member error:', error);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

/**
 * DELETE /api/rooms/:id/members/:userId
 * Remove a member from a room (creator or admin only)
 */
router.delete('/:id/members/:userId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id, userId } = req.params;

    const room = await Room.findByPk(id);

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    // Check if requester is creator or admin
    const requester = await User.findByPk(req.userId!);
    const isCreator = room.creatorId === req.userId;
    const membership = await RoomMember.findOne({
      where: { roomId: id, userId: req.userId! },
    });

    if (!isCreator && membership?.role !== 'admin' && !requester?.isAdmin) {
      res.status(403).json({ error: 'Only room creator or admin can remove members' });
      return;
    }

    // Can't remove creator
    if (userId === room.creatorId) {
      res.status(403).json({ error: 'Cannot remove room creator' });
      return;
    }

    const memberToRemove = await RoomMember.findOne({
      where: { roomId: id, userId },
    });

    if (!memberToRemove) {
      res.status(404).json({ error: 'User is not a member of this room' });
      return;
    }

    await memberToRemove.destroy();

    logger.info(`User ${userId} removed from room ${id} by ${req.userId}`);

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    logger.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;
