/**
 * LinkDetector - Utility to detect and extract URLs from text
 *
 * Features:
 * - Regex-based URL detection
 * - Support for http, https, and www prefixes
 * - Handles multiple URLs in a single message
 * - Validates URLs before returning
 * - Extracts URL positions for highlighting
 */

/**
 * Represents a detected URL with its position in the text
 */
export interface DetectedUrl {
  url: string;
  normalizedUrl: string; // URL with protocol (adds https:// if missing)
  startIndex: number;
  endIndex: number;
}

/**
 * Result of parsing text for URLs
 */
export interface ParsedTextResult {
  urls: DetectedUrl[];
  hasUrls: boolean;
  segments: TextSegment[];
}

/**
 * A segment of text - either plain text or a URL
 */
export interface TextSegment {
  type: 'text' | 'url';
  content: string;
  url?: string; // Normalized URL (only for type 'url')
}

// Comprehensive URL regex pattern
// Matches:
// - http:// or https:// URLs
// - www. URLs (without protocol)
// - URLs with paths, query strings, and fragments
// - International domain names
const URL_REGEX =
  /(?:(?:https?:\/\/)|(?:www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&//=]*)/gi;

// Simpler regex for validating a single URL
const URL_VALIDATION_REGEX =
  /^(?:(?:https?:\/\/)|(?:www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&//=]*)$/i;

// Common image extensions for detecting image URLs
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];

/**
 * Detects all URLs in a given text string
 *
 * @param text - The text to search for URLs
 * @returns Array of detected URLs with their positions
 *
 * @example
 * ```ts
 * const urls = detectUrls('Check out https://example.com and www.google.com');
 * // Returns: [
 * //   { url: 'https://example.com', normalizedUrl: 'https://example.com', startIndex: 10, endIndex: 29 },
 * //   { url: 'www.google.com', normalizedUrl: 'https://www.google.com', startIndex: 34, endIndex: 48 }
 * // ]
 * ```
 */
export function detectUrls(text: string): DetectedUrl[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const urls: DetectedUrl[] = [];
  let match: RegExpExecArray | null;

  // Reset regex lastIndex
  URL_REGEX.lastIndex = 0;

  while ((match = URL_REGEX.exec(text)) !== null) {
    const url = match[0];
    const normalizedUrl = normalizeUrl(url);

    urls.push({
      url,
      normalizedUrl,
      startIndex: match.index,
      endIndex: match.index + url.length,
    });
  }

  return urls;
}

/**
 * Normalizes a URL by adding https:// protocol if missing
 *
 * @param url - The URL to normalize
 * @returns Normalized URL with protocol
 */
export function normalizeUrl(url: string): string {
  if (!url) return url;

  // Already has protocol
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Add https:// to www. URLs
  if (url.startsWith('www.')) {
    return `https://${url}`;
  }

  // Default to https://
  return `https://${url}`;
}

/**
 * Validates if a string is a valid URL
 *
 * @param url - The string to validate
 * @returns True if valid URL, false otherwise
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  return URL_VALIDATION_REGEX.test(url);
}

/**
 * Checks if a URL points to an image
 *
 * @param url - The URL to check
 * @returns True if URL appears to be an image
 */
export function isImageUrl(url: string): boolean {
  if (!url) return false;

  const lowerUrl = url.toLowerCase();

  // Check for common image extensions
  for (const ext of IMAGE_EXTENSIONS) {
    if (lowerUrl.includes(ext)) {
      return true;
    }
  }

  // Check for common image hosting patterns
  const imageHostPatterns = [
    /imgur\.com/i,
    /i\.redd\.it/i,
    /giphy\.com/i,
    /gfycat\.com/i,
    /pbs\.twimg\.com/i,
    /images\.unsplash\.com/i,
  ];

  return imageHostPatterns.some((pattern) => pattern.test(url));
}

/**
 * Parses text and splits it into segments of plain text and URLs
 *
 * @param text - The text to parse
 * @returns Parsed result with URLs and text segments
 *
 * @example
 * ```ts
 * const result = parseTextForUrls('Hello https://example.com world');
 * // Returns: {
 * //   urls: [...],
 * //   hasUrls: true,
 * //   segments: [
 * //     { type: 'text', content: 'Hello ' },
 * //     { type: 'url', content: 'https://example.com', url: 'https://example.com' },
 * //     { type: 'text', content: ' world' }
 * //   ]
 * // }
 * ```
 */
export function parseTextForUrls(text: string): ParsedTextResult {
  if (!text || typeof text !== 'string') {
    return {
      urls: [],
      hasUrls: false,
      segments: [{ type: 'text', content: text || '' }],
    };
  }

  const urls = detectUrls(text);

  if (urls.length === 0) {
    return {
      urls: [],
      hasUrls: false,
      segments: [{ type: 'text', content: text }],
    };
  }

  const segments: TextSegment[] = [];
  let lastIndex = 0;

  for (const detectedUrl of urls) {
    // Add text before this URL
    if (detectedUrl.startIndex > lastIndex) {
      const textContent = text.substring(lastIndex, detectedUrl.startIndex);
      if (textContent) {
        segments.push({
          type: 'text',
          content: textContent,
        });
      }
    }

    // Add the URL segment
    segments.push({
      type: 'url',
      content: detectedUrl.url,
      url: detectedUrl.normalizedUrl,
    });

    lastIndex = detectedUrl.endIndex;
  }

  // Add remaining text after the last URL
  if (lastIndex < text.length) {
    const textContent = text.substring(lastIndex);
    if (textContent) {
      segments.push({
        type: 'text',
        content: textContent,
      });
    }
  }

  return {
    urls,
    hasUrls: true,
    segments,
  };
}

/**
 * Extracts the domain from a URL
 *
 * @param url - The URL to extract domain from
 * @returns Domain name or null if invalid
 *
 * @example
 * ```ts
 * extractDomain('https://www.example.com/path?query=1');
 * // Returns: 'example.com'
 * ```
 */
export function extractDomain(url: string): string | null {
  if (!url) return null;

  try {
    const normalizedUrl = normalizeUrl(url);
    const urlObj = new URL(normalizedUrl);
    let hostname = urlObj.hostname;

    // Remove www. prefix
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }

    return hostname;
  } catch {
    return null;
  }
}

/**
 * Gets a favicon URL for a given domain
 *
 * @param url - The URL to get favicon for
 * @returns Favicon URL using Google's favicon service
 */
export function getFaviconUrl(url: string): string {
  const domain = extractDomain(url);
  if (!domain) {
    return '';
  }

  // Use Google's favicon service
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

/**
 * Truncates a URL for display purposes
 *
 * @param url - The URL to truncate
 * @param maxLength - Maximum length (default: 50)
 * @returns Truncated URL string
 */
export function truncateUrl(url: string, maxLength: number = 50): string {
  if (!url || url.length <= maxLength) {
    return url;
  }

  // Try to keep the domain visible
  const domain = extractDomain(url);
  if (domain && domain.length < maxLength - 10) {
    const remaining = maxLength - domain.length - 3; // 3 for ...
    return `${domain}...${url.slice(-remaining)}`;
  }

  return `${url.substring(0, maxLength - 3)}...`;
}

export default {
  detectUrls,
  normalizeUrl,
  isValidUrl,
  isImageUrl,
  parseTextForUrls,
  extractDomain,
  getFaviconUrl,
  truncateUrl,
};
