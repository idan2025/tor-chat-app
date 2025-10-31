export interface URLInfo {
  url: string;
  isYouTube: boolean;
  videoId?: string;
}

/**
 * Detects all URLs in a text string
 */
export const detectURLs = (text: string): URLInfo[] => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);

  if (!matches) return [];

  return matches.map(url => ({
    url,
    isYouTube: isYouTubeURL(url),
    videoId: extractYouTubeVideoId(url),
  }));
};

/**
 * Checks if a URL is a YouTube link
 */
export const isYouTubeURL = (url: string): boolean => {
  return (
    url.includes('youtube.com/watch') ||
    url.includes('youtu.be/') ||
    url.includes('youtube.com/shorts/') ||
    url.includes('youtube.com/embed/')
  );
};

/**
 * Extracts YouTube video ID from various YouTube URL formats
 * Supports:
 * - youtube.com/watch?v=VIDEO_ID
 * - youtu.be/VIDEO_ID
 * - youtube.com/shorts/VIDEO_ID
 * - youtube.com/embed/VIDEO_ID
 */
export const extractYouTubeVideoId = (url: string): string | undefined => {
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
 * Gets the maximum resolution thumbnail for a YouTube video
 */
export const getYouTubeThumbnail = (videoId: string): string => {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
};

/**
 * Gets the standard quality thumbnail for a YouTube video
 * Use this as a fallback if maxresdefault is not available
 */
export const getYouTubeStandardThumbnail = (videoId: string): string => {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
};

/**
 * Validates if a string is a valid URL
 */
export const isValidURL = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Extracts the first URL from a text string
 */
export const getFirstURL = (text: string): string | null => {
  const urls = detectURLs(text);
  return urls.length > 0 ? urls[0].url : null;
};

/**
 * Formats a URL for display (removes protocol and trailing slash)
 */
export const formatURLForDisplay = (url: string): string => {
  try {
    const urlObj = new URL(url);
    let formatted = urlObj.hostname + urlObj.pathname;
    if (formatted.endsWith('/')) {
      formatted = formatted.slice(0, -1);
    }
    return formatted;
  } catch (error) {
    return url;
  }
};
