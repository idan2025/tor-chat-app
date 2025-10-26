import express, { Response } from 'express';
import { User, Room, RoomMember, Message } from '../models';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * Middleware to check if user is admin
 */
const requireAdmin = async (req: AuthRequest, res: Response, next: express.NextFunction) => {
  try {
    const user = await User.findByPk(req.userId!);

    if (!user || !user.isAdmin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify admin status' });
  }
};

/**
 * GET /api/admin/users
 * Get all users (admin only)
 */
router.get('/users', authenticateToken, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'email', 'displayName', 'avatar', 'isOnline', 'lastSeen', 'isAdmin', 'createdAt'],
      order: [['createdAt', 'DESC']],
    });

    res.json({ users });
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

/**
 * PATCH /api/admin/users/:id/admin
 * Toggle admin status of a user
 */
router.patch('/users/:id/admin', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isAdmin } = req.body;

    if (typeof isAdmin !== 'boolean') {
      res.status(400).json({ error: 'isAdmin must be a boolean' });
      return;
    }

    const user = await User.findByPk(id);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Can't demote yourself
    if (id === req.userId && !isAdmin) {
      res.status(403).json({ error: 'Cannot remove your own admin status' });
      return;
    }

    user.isAdmin = isAdmin;
    await user.save();

    logger.info(`User ${id} admin status set to ${isAdmin} by ${req.userId}`);

    res.json({
      message: `User ${isAdmin ? 'promoted to' : 'demoted from'} admin`,
      user: user.toJSON(),
    });
  } catch (error) {
    logger.error('Toggle admin error:', error);
    res.status(500).json({ error: 'Failed to toggle admin status' });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete a user (admin only)
 */
router.delete('/users/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Can't delete yourself
    if (id === req.userId) {
      res.status(403).json({ error: 'Cannot delete your own account' });
      return;
    }

    const user = await User.findByPk(id);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Delete user's memberships and messages
    await RoomMember.destroy({ where: { userId: id } });
    await Message.destroy({ where: { senderId: id } });

    // Delete rooms created by this user
    const createdRooms = await Room.findAll({ where: { creatorId: id } });
    for (const room of createdRooms) {
      await RoomMember.destroy({ where: { roomId: room.id } });
      await Message.destroy({ where: { roomId: room.id } });
      await room.destroy();
    }

    await user.destroy();

    logger.info(`User ${id} deleted by admin ${req.userId}`);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/**
 * GET /api/admin/rooms
 * Get all rooms (admin only)
 */
router.get('/rooms', authenticateToken, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const rooms = await Room.findAll({
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'displayName'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json({ rooms });
  } catch (error) {
    logger.error('Get rooms error:', error);
    res.status(500).json({ error: 'Failed to get rooms' });
  }
});

/**
 * DELETE /api/admin/rooms/:id
 * Delete any room (admin only)
 */
router.delete('/rooms/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const room = await Room.findByPk(id);

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    // Delete all room members and messages
    await RoomMember.destroy({ where: { roomId: id } });
    await Message.destroy({ where: { roomId: id } });
    await room.destroy();

    logger.info(`Room ${id} deleted by admin ${req.userId}`);

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    logger.error('Delete room error:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

/**
 * GET /api/admin/stats
 * Get server statistics (admin only)
 */
router.get('/stats', authenticateToken, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const userCount = await User.count();
    const roomCount = await Room.count();
    const messageCount = await Message.count();
    const onlineUserCount = await User.count({ where: { isOnline: true } });

    res.json({
      users: userCount,
      rooms: roomCount,
      messages: messageCount,
      onlineUsers: onlineUserCount,
    });
  } catch (error) {
    logger.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

export default router;
