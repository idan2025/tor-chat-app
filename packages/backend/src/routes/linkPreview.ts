import express, { Request, Response } from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

/**
 * Helper function to check if URL is YouTube
 */
const isYouTubeURL = (url: string): boolean => {
  return (
    url.includes('youtube.com/watch') ||
    url.includes('youtu.be/') ||
    url.includes('youtube.com/shorts/') ||
    url.includes('youtube.com/embed/')
  );
};

/**
 * Helper function to extract YouTube video ID
 */
const extractYouTubeVideoId = (url: string): string | undefined => {
  // youtube.com/watch?v=VIDEO_ID
  const match1 = url.match(/[?&]v=([^&]+)/);
  if (match1) return match1[1];

  // youtu.be/VIDEO_ID
  const match2 = url.match(/youtu\.be\/([^?]+)/);
  if (match2) return match2[1];

  // youtube.com/shorts/VIDEO_ID
  const match3 = url.match(/\/shorts\/([^?]+)/);
  if (match3) return match3[1];

  // youtube.com/embed/VIDEO_ID
  const match4 = url.match(/\/embed\/([^?]+)/);
  if (match4) return match4[1];

  return undefined;
};

/**
 * POST /api/link-preview
 * Fetch link preview metadata for a given URL
 *
 * Privacy Note: This endpoint should be configured to route requests through TOR
 * to maintain user privacy when fetching external content.
 */
router.post('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { url } = req.body;

    if (!url) {
      res.status(400).json({ error: 'URL is required' });
      return;
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      res.status(400).json({ error: 'Invalid URL format' });
      return;
    }

    // Only allow HTTP and HTTPS protocols
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      res.status(400).json({ error: 'Only HTTP and HTTPS URLs are allowed' });
      return;
    }

    // Special handling for YouTube
    if (isYouTubeURL(url)) {
      const videoId = extractYouTubeVideoId(url);
      if (videoId) {
        res.json({
          url,
          title: `YouTube Video`,
          image: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          siteName: 'YouTube',
          videoId,
        });
        return;
      }
    }

    // Fetch page HTML with timeout
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TORChatBot/1.0; +https://torchat.example.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 10000,
      maxRedirects: 5,
      maxContentLength: 5 * 1024 * 1024, // 5MB max
    });

    const $ = cheerio.load(response.data);

    // Extract Open Graph metadata
    const preview = {
      url,
      title:
        $('meta[property="og:title"]').attr('content') ||
        $('meta[name="twitter:title"]').attr('content') ||
        $('title').text() ||
        undefined,
      description:
        $('meta[property="og:description"]').attr('content') ||
        $('meta[name="twitter:description"]').attr('content') ||
        $('meta[name="description"]').attr('content') ||
        undefined,
      image:
        $('meta[property="og:image"]').attr('content') ||
        $('meta[name="twitter:image"]').attr('content') ||
        undefined,
      siteName:
        $('meta[property="og:site_name"]').attr('content') ||
        parsedUrl.hostname ||
        undefined,
    };

    // Ensure image URL is absolute
    if (preview.image && !preview.image.startsWith('http')) {
      if (preview.image.startsWith('//')) {
        preview.image = `${parsedUrl.protocol}${preview.image}`;
      } else if (preview.image.startsWith('/')) {
        preview.image = `${parsedUrl.protocol}//${parsedUrl.hostname}${preview.image}`;
      } else {
        preview.image = `${parsedUrl.protocol}//${parsedUrl.hostname}/${preview.image}`;
      }
    }

    res.json(preview);
  } catch (error) {
    console.error('Link preview error:', error);

    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        res.status(408).json({ error: 'Request timeout' });
        return;
      }
      if (error.response) {
        res.status(error.response.status).json({
          error: `Failed to fetch URL: ${error.response.statusText}`,
        });
        return;
      }
    }

    res.status(500).json({ error: 'Failed to fetch link preview' });
  }
});

export default router;
