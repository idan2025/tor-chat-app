import express, { Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB limit
  },
  fileFilter: (_req, file, cb) => {
    // Allow images, videos, and common document types
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm',
      'video/ogg',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

/**
 * POST /api/upload
 * Upload a file
 */
router.post('/', authenticateToken, (req: AuthRequest, res: Response, next: express.NextFunction) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({ error: 'File too large. Maximum size is 1GB.' });
          return;
        }
        res.status(400).json({ error: `Upload error: ${err.message}` });
        return;
      }
      if (err.message === 'Invalid file type') {
        res.status(400).json({ error: 'Invalid file type. Allowed: images, videos, PDFs, documents.' });
        return;
      }
      logger.error('File upload error:', err);
      res.status(500).json({ error: 'Failed to upload file' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    logger.info(`File uploaded by user ${req.userId}: ${req.file.filename}`);

    res.json({
      message: 'File uploaded successfully',
      file: {
        url: fileUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
    });
  });
});

export default router;
