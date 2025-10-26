import express, { Request, Response } from 'express';
import { z } from 'zod';
import { Op } from 'sequelize';
import { User } from '../models';
import { generateToken, AuthRequest, authenticateToken } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { cryptoService } from '../services/crypto';
import { logger } from '../utils/logger';

const router = express.Router();

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email().optional(),
  password: z.string().min(8).max(100),
  displayName: z.string().max(100).optional(),
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', validateBody(registerSchema), async (req: Request, res: Response) => {
  try {
    const { username, email, password, displayName } = req.body;

    // Check if user already exists
    const whereConditions: any[] = [{ username }];
    if (email) {
      whereConditions.push({ email });
    }

    const existingUser = await User.findOne({
      where: {
        [Op.or]: whereConditions,
      },
    });

    if (existingUser) {
      res.status(409).json({ error: 'Username or email already exists' });
      return;
    }

    // Check if this is the first user (make them admin)
    const userCount = await User.count();
    const isFirstUser = userCount === 0;

    // Generate encryption keypair
    const keyPair = await cryptoService.generateKeyPair();

    // Hash password
    const passwordHash = await User.hashPassword(password);

    // Create user
    const user = await User.create({
      username,
      email: email || undefined,
      passwordHash,
      publicKey: keyPair.publicKey,
      privateKeyEncrypted: keyPair.privateKey, // In production, encrypt this with user's password
      displayName: displayName || username,
      isOnline: false,
      lastSeen: new Date(),
      isAdmin: isFirstUser, // First user becomes admin
    });

    // Generate JWT token
    const token = generateToken(user.id);

    if (isFirstUser) {
      logger.info(`First user registered as ADMIN: ${username}`);
    } else {
      logger.info(`New user registered: ${username}`);
    }

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', validateBody(loginSchema), async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    // Find user
    const user = await User.findOne({ where: { username } });

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Verify password
    const isValid = await user.comparePassword(password);

    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Update last seen
    user.lastSeen = new Date();
    await user.save();

    // Generate JWT token
    const token = generateToken(user.id);

    logger.info(`User logged in: ${username}`);

    res.json({
      message: 'Login successful',
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    res.json({ user: req.user.toJSON() });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (client should delete token)
 */
router.post('/logout', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user) {
      req.user.isOnline = false;
      req.user.lastSeen = new Date();
      await req.user.save();
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

export default router;
