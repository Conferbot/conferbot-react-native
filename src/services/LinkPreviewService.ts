/**
 * LinkPreviewService - Service to fetch Open Graph metadata for URLs
 *
 * Features:
 * - Fetches Open Graph (og:*) and Twitter Card metadata
 * - In-memory caching with configurable TTL
 * - Handles timeouts and errors gracefully
 * - Supports image-only previews for direct image URLs
 * - Rate limiting to prevent excessive requests
 * - Supports server-side proxy for CORS handling
 */

import { isImageUrl, normalizeUrl, extractDomain } from '../utils/LinkDetector';
import { DEFAULT_API_BASE_URL } from '../config/constants';

/**
 * Link preview metadata structure
 */
export interface LinkPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  favicon: string | null;
  type: 'rich' | 'image' | 'minimal';
  fetchedAt: number;
}

/**
 * Cache entry with expiration
 */
interface CacheEntry {
  data: LinkPreviewData;
  expiresAt: number;
}

/**
 * Configuration options for the service
 */
export interface LinkPreviewServiceConfig {
  /** Cache TTL in milliseconds (default: 1 hour) */
  cacheTTL?: number;
  /** Request timeout in milliseconds (default: 5000) */
  timeout?: number;
  /** Maximum concurrent requests (default: 3) */
  maxConcurrent?: number;
  /** Use server proxy for CORS (default: true) */
  useServerProxy?: boolean;
  /** Server proxy URL (default: uses DEFAULT_API_BASE_URL) */
  proxyUrl?: string;
  /** Fallback API for client-side fetching */
  fallbackApiUrl?: string;
}

// Default configuration
const DEFAULT_CONFIG: Required<LinkPreviewServiceConfig> = {
  cacheTTL: 60 * 60 * 1000, // 1 hour
  timeout: 5000, // 5 seconds
  maxConcurrent: 3,
  useServerProxy: true,
  proxyUrl: `${DEFAULT_API_BASE_URL}/link-preview`,
  fallbackApiUrl: 'https://api.linkpreview.net',
};

/**
 * LinkPreviewService class
 *
 * Handles fetching and caching of link preview metadata
 */
class LinkPreviewService {
  private cache: Map<string, CacheEntry> = new Map();
  private pendingRequests: Map<string, Promise<LinkPreviewData>> = new Map();
  private activeRequests: number = 0;
  private requestQueue: Array<() => void> = [];
  private config: Required<LinkPreviewServiceConfig>;

  constructor(config: LinkPreviewServiceConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Updates service configuration
   */
  updateConfig(config: Partial<LinkPreviewServiceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Fetches link preview data for a URL
   *
   * @param url - The URL to fetch preview for
   * @returns Promise resolving to LinkPreviewData
   */
  async fetchPreview(url: string): Promise<LinkPreviewData> {
    const normalizedUrl = normalizeUrl(url);

    // Check cache first
    const cached = this.getFromCache(normalizedUrl);
    if (cached) {
      return cached;
    }

    // Check if request is already pending
    const pending = this.pendingRequests.get(normalizedUrl);
    if (pending) {
      return pending;
    }

    // Check if it's a direct image URL
    if (isImageUrl(normalizedUrl)) {
      const imagePreview = this.createImagePreview(normalizedUrl);
      this.addToCache(normalizedUrl, imagePreview);
      return imagePreview;
    }

    // Create new request with rate limiting
    const requestPromise = this.executeWithRateLimit(async () => {
      try {
        const preview = await this.fetchWithTimeout(normalizedUrl);
        this.addToCache(normalizedUrl, preview);
        return preview;
      } catch (error) {
        // Return minimal preview on error
        const minimalPreview = this.createMinimalPreview(normalizedUrl, error);
        // Cache error results for shorter time (5 minutes)
        this.addToCache(normalizedUrl, minimalPreview, 5 * 60 * 1000);
        return minimalPreview;
      } finally {
        this.pendingRequests.delete(normalizedUrl);
      }
    });

    this.pendingRequests.set(normalizedUrl, requestPromise);
    return requestPromise;
  }

  /**
   * Fetches previews for multiple URLs
   *
   * @param urls - Array of URLs to fetch
   * @returns Promise resolving to map of URL to preview data
   */
  async fetchPreviews(urls: string[]): Promise<Map<string, LinkPreviewData>> {
    const results = new Map<string, LinkPreviewData>();

    // Deduplicate and normalize URLs
    const uniqueUrls = [...new Set(urls.map(normalizeUrl))];

    // Fetch all previews concurrently
    const previews = await Promise.all(
      uniqueUrls.map(async (url) => {
        try {
          const preview = await this.fetchPreview(url);
          return { url, preview };
        } catch {
          return { url, preview: this.createMinimalPreview(url) };
        }
      })
    );

    // Build results map
    for (const { url, preview } of previews) {
      results.set(url, preview);
    }

    return results;
  }

  /**
   * Checks if a preview is cached for a URL
   */
  isCached(url: string): boolean {
    const normalizedUrl = normalizeUrl(url);
    const entry = this.cache.get(normalizedUrl);
    return !!entry && entry.expiresAt > Date.now();
  }

  /**
   * Gets cached preview without fetching
   */
  getCachedPreview(url: string): LinkPreviewData | null {
    return this.getFromCache(normalizeUrl(url));
  }

  /**
   * Clears the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Removes expired entries from cache
   */
  cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  // ========== Private Methods ========== //

  private getFromCache(url: string): LinkPreviewData | null {
    const entry = this.cache.get(url);
    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(url);
      return null;
    }

    return entry.data;
  }

  private addToCache(url: string, data: LinkPreviewData, ttl?: number): void {
    const entry: CacheEntry = {
      data,
      expiresAt: Date.now() + (ttl ?? this.config.cacheTTL),
    };
    this.cache.set(url, entry);
  }

  private async executeWithRateLimit<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeRequests >= this.config.maxConcurrent) {
      // Wait in queue
      await new Promise<void>((resolve) => {
        this.requestQueue.push(resolve);
      });
    }

    this.activeRequests++;

    try {
      return await fn();
    } finally {
      this.activeRequests--;

      // Process next in queue
      const next = this.requestQueue.shift();
      if (next) next();
    }
  }

  private async fetchWithTimeout(url: string): Promise<LinkPreviewData> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      let preview: LinkPreviewData;

      if (this.config.useServerProxy) {
        preview = await this.fetchViaProxy(url, controller.signal);
      } else {
        preview = await this.fetchDirectly(url, controller.signal);
      }

      return preview;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async fetchViaProxy(url: string, signal: AbortSignal): Promise<LinkPreviewData> {
    try {
      const response = await fetch(this.config.proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`Proxy request failed: ${response.status}`);
      }

      const data = await response.json();
      return this.transformProxyResponse(url, data);
    } catch (error) {
      // Fallback to direct fetch or minimal preview
      if (this.config.fallbackApiUrl) {
        return this.fetchViaFallbackApi(url, signal);
      }
      throw error;
    }
  }

  private async fetchViaFallbackApi(url: string, signal: AbortSignal): Promise<LinkPreviewData> {
    // Using a public link preview API as fallback
    // Note: In production, you should use your own API key
    const response = await fetch(`${this.config.fallbackApiUrl}/?q=${encodeURIComponent(url)}`, {
      signal,
    });

    if (!response.ok) {
      throw new Error(`Fallback API request failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      url,
      title: data.title || null,
      description: data.description || null,
      image: data.image || null,
      siteName: extractDomain(url),
      favicon: data.favicon || `https://www.google.com/s2/favicons?domain=${extractDomain(url)}&sz=32`,
      type: data.image ? 'rich' : 'minimal',
      fetchedAt: Date.now(),
    };
  }

  private async fetchDirectly(url: string, signal: AbortSignal): Promise<LinkPreviewData> {
    // Direct fetch - may fail due to CORS
    // This is a fallback method when proxy is not available
    try {
      const response = await fetch(url, {
        signal,
        headers: {
          Accept: 'text/html',
        },
      });

      if (!response.ok) {
        throw new Error(`Direct fetch failed: ${response.status}`);
      }

      const html = await response.text();
      return this.parseHtmlForMetadata(url, html);
    } catch (error) {
      // CORS or other error - return minimal preview
      return this.createMinimalPreview(url, error);
    }
  }

  private parseHtmlForMetadata(url: string, html: string): LinkPreviewData {
    const getMetaContent = (property: string): string | null => {
      // Try Open Graph
      const ogMatch = html.match(
        new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']+)["']`, 'i')
      );
      if (ogMatch) return ogMatch[1];

      // Try Twitter Card
      const twitterMatch = html.match(
        new RegExp(`<meta[^>]*name=["']twitter:${property}["'][^>]*content=["']([^"']+)["']`, 'i')
      );
      if (twitterMatch) return twitterMatch[1];

      // Try standard meta (for description)
      if (property === 'description') {
        const metaMatch = html.match(
          /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
        );
        if (metaMatch) return metaMatch[1];
      }

      return null;
    };

    // Get title
    let title = getMetaContent('title');
    if (!title) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      title = titleMatch ? titleMatch[1].trim() : null;
    }

    // Get other metadata
    const description = getMetaContent('description');
    const image = getMetaContent('image');
    const siteName = getMetaContent('site_name') || extractDomain(url);

    return {
      url,
      title,
      description,
      image,
      siteName,
      favicon: `https://www.google.com/s2/favicons?domain=${extractDomain(url)}&sz=32`,
      type: image ? 'rich' : title ? 'minimal' : 'minimal',
      fetchedAt: Date.now(),
    };
  }

  private transformProxyResponse(url: string, data: any): LinkPreviewData {
    return {
      url,
      title: data.title || data.ogTitle || null,
      description: data.description || data.ogDescription || null,
      image: data.image || data.ogImage || null,
      siteName: data.siteName || data.ogSiteName || extractDomain(url),
      favicon: data.favicon || `https://www.google.com/s2/favicons?domain=${extractDomain(url)}&sz=32`,
      type: data.image || data.ogImage ? 'rich' : 'minimal',
      fetchedAt: Date.now(),
    };
  }

  private createImagePreview(url: string): LinkPreviewData {
    const domain = extractDomain(url);
    return {
      url,
      title: null,
      description: null,
      image: url,
      siteName: domain,
      favicon: domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : null,
      type: 'image',
      fetchedAt: Date.now(),
    };
  }

  private createMinimalPreview(url: string, _error?: unknown): LinkPreviewData {
    const domain = extractDomain(url);
    return {
      url,
      title: domain,
      description: null,
      image: null,
      siteName: domain,
      favicon: domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : null,
      type: 'minimal',
      fetchedAt: Date.now(),
    };
  }
}

// Export singleton instance
export const linkPreviewService = new LinkPreviewService();

// Export class for custom instances
export { LinkPreviewService };

export default linkPreviewService;
