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
    const membership = await RoomMember.findOne({
      where: {
        roomId: id,
        userId: req.userId!,
      },
    });

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
    const { id } = req.params;

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

export default router;
