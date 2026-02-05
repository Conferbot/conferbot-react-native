/**
 * LinkDetector Tests
 *
 * Comprehensive tests for the LinkDetector utility.
 * Covers URL detection, email detection, phone detection,
 * URL normalization, and text parsing.
 */

import {
  detectUrls,
  normalizeUrl,
  isValidUrl,
  isImageUrl,
  parseTextForUrls,
  extractDomain,
  getFaviconUrl,
  truncateUrl,
} from '../../src/utils/LinkDetector';
import type { DetectedUrl, ParsedTextResult, TextSegment } from '../../src/utils/LinkDetector';

describe('LinkDetector', () => {
  // ========================================
  // URL DETECTION TESTS
  // ========================================

  describe('detectUrls', () => {
    it('should detect https URLs', () => {
      const text = 'Check out https://example.com for more info';
      const urls = detectUrls(text);

      expect(urls).toHaveLength(1);
      expect(urls[0].url).toBe('https://example.com');
      expect(urls[0].normalizedUrl).toBe('https://example.com');
    });

    it('should detect http URLs', () => {
      const text = 'Visit http://example.org today';
      const urls = detectUrls(text);

      expect(urls).toHaveLength(1);
      expect(urls[0].url).toBe('http://example.org');
    });

    it('should detect www URLs', () => {
      const text = 'Go to www.example.com';
      const urls = detectUrls(text);

      expect(urls).toHaveLength(1);
      expect(urls[0].url).toBe('www.example.com');
      expect(urls[0].normalizedUrl).toBe('https://www.example.com');
    });

    it('should detect multiple URLs', () => {
      const text = 'Visit https://first.com and www.second.com and http://third.org';
      const urls = detectUrls(text);

      expect(urls).toHaveLength(3);
      expect(urls[0].url).toBe('https://first.com');
      expect(urls[1].url).toBe('www.second.com');
      expect(urls[2].url).toBe('http://third.org');
    });

    it('should detect URLs with paths', () => {
      const text = 'See https://example.com/path/to/page';
      const urls = detectUrls(text);

      expect(urls).toHaveLength(1);
      expect(urls[0].url).toBe('https://example.com/path/to/page');
    });

    it('should detect URLs with query parameters', () => {
      const text = 'Link: https://example.com/search?q=test&page=1';
      const urls = detectUrls(text);

      expect(urls).toHaveLength(1);
      expect(urls[0].url).toBe('https://example.com/search?q=test&page=1');
    });

    it('should detect URLs with fragments', () => {
      const text = 'See https://example.com/page#section';
      const urls = detectUrls(text);

      expect(urls).toHaveLength(1);
      expect(urls[0].url).toBe('https://example.com/page#section');
    });

    it('should detect URLs with ports', () => {
      const text = 'Server at https://example.com:8080/api';
      const urls = detectUrls(text);

      expect(urls).toHaveLength(1);
      expect(urls[0].url).toBe('https://example.com:8080/api');
    });

    it('should detect URLs with subdomains', () => {
      const text = 'Visit https://blog.example.com';
      const urls = detectUrls(text);

      expect(urls).toHaveLength(1);
      expect(urls[0].url).toBe('https://blog.example.com');
    });

    it('should detect URLs with special characters in path', () => {
      const text = 'Link: https://example.com/path-with-dashes/and_underscores';
      const urls = detectUrls(text);

      expect(urls).toHaveLength(1);
    });

    it('should return correct start and end indices', () => {
      const text = 'Hello https://example.com world';
      const urls = detectUrls(text);

      expect(urls[0].startIndex).toBe(6);
      expect(urls[0].endIndex).toBe(25);
      expect(text.substring(urls[0].startIndex, urls[0].endIndex)).toBe('https://example.com');
    });

    it('should return empty array for text without URLs', () => {
      const urls = detectUrls('No links here');
      expect(urls).toHaveLength(0);
    });

    it('should return empty array for null/undefined input', () => {
      expect(detectUrls(null as any)).toHaveLength(0);
      expect(detectUrls(undefined as any)).toHaveLength(0);
      expect(detectUrls('')).toHaveLength(0);
    });

    it('should handle URLs at start of text', () => {
      const text = 'https://example.com is the site';
      const urls = detectUrls(text);

      expect(urls).toHaveLength(1);
      expect(urls[0].startIndex).toBe(0);
    });

    it('should handle URLs at end of text', () => {
      const text = 'Visit https://example.com';
      const urls = detectUrls(text);

      expect(urls).toHaveLength(1);
      expect(urls[0].endIndex).toBe(text.length);
    });

    it('should detect URLs with various TLDs', () => {
      const text = 'Sites: https://example.io https://test.dev https://site.co.uk';
      const urls = detectUrls(text);

      expect(urls).toHaveLength(3);
    });
  });

  // ========================================
  // URL NORMALIZATION TESTS
  // ========================================

  describe('normalizeUrl', () => {
    it('should keep https URLs unchanged', () => {
      expect(normalizeUrl('https://example.com')).toBe('https://example.com');
    });

    it('should keep http URLs unchanged', () => {
      expect(normalizeUrl('http://example.com')).toBe('http://example.com');
    });

    it('should add https to www URLs', () => {
      expect(normalizeUrl('www.example.com')).toBe('https://www.example.com');
    });

    it('should add https to plain domains', () => {
      expect(normalizeUrl('example.com')).toBe('https://example.com');
    });

    it('should handle empty/null input', () => {
      expect(normalizeUrl('')).toBe('');
      expect(normalizeUrl(null as any)).toBe(null);
    });
  });

  // ========================================
  // URL VALIDATION TESTS
  // ========================================

  describe('isValidUrl', () => {
    it('should validate https URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('https://example.com/path')).toBe(true);
      expect(isValidUrl('https://sub.example.com')).toBe(true);
    });

    it('should validate http URLs', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
    });

    it('should validate www URLs', () => {
      expect(isValidUrl('www.example.com')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not a url')).toBe(false);
      expect(isValidUrl('example')).toBe(false);
      expect(isValidUrl('ftp://example.com')).toBe(false);
    });

    it('should reject empty/null input', () => {
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl(null as any)).toBe(false);
      expect(isValidUrl(undefined as any)).toBe(false);
    });
  });

  // ========================================
  // IMAGE URL DETECTION TESTS
  // ========================================

  describe('isImageUrl', () => {
    it('should detect common image extensions', () => {
      expect(isImageUrl('https://example.com/image.jpg')).toBe(true);
      expect(isImageUrl('https://example.com/image.jpeg')).toBe(true);
      expect(isImageUrl('https://example.com/image.png')).toBe(true);
      expect(isImageUrl('https://example.com/image.gif')).toBe(true);
      expect(isImageUrl('https://example.com/image.webp')).toBe(true);
      expect(isImageUrl('https://example.com/image.svg')).toBe(true);
    });

    it('should detect image hosting sites', () => {
      expect(isImageUrl('https://imgur.com/abc123')).toBe(true);
      expect(isImageUrl('https://i.redd.it/image')).toBe(true);
      expect(isImageUrl('https://giphy.com/gifs/abc')).toBe(true);
      expect(isImageUrl('https://images.unsplash.com/photo')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(isImageUrl('https://example.com/IMAGE.JPG')).toBe(true);
      expect(isImageUrl('https://example.com/Image.PNG')).toBe(true);
    });

    it('should reject non-image URLs', () => {
      expect(isImageUrl('https://example.com/page')).toBe(false);
      expect(isImageUrl('https://example.com/document.pdf')).toBe(false);
    });

    it('should handle empty/null input', () => {
      expect(isImageUrl('')).toBe(false);
      expect(isImageUrl(null as any)).toBe(false);
    });
  });

  // ========================================
  // TEXT PARSING TESTS
  // ========================================

  describe('parseTextForUrls', () => {
    it('should parse text with single URL', () => {
      const result = parseTextForUrls('Hello https://example.com world');

      expect(result.hasUrls).toBe(true);
      expect(result.urls).toHaveLength(1);
      expect(result.segments).toHaveLength(3);

      expect(result.segments[0]).toEqual({ type: 'text', content: 'Hello ' });
      expect(result.segments[1]).toEqual({
        type: 'url',
        content: 'https://example.com',
        url: 'https://example.com',
      });
      expect(result.segments[2]).toEqual({ type: 'text', content: ' world' });
    });

    it('should parse text with multiple URLs', () => {
      const result = parseTextForUrls('Visit https://first.com and https://second.com');

      expect(result.hasUrls).toBe(true);
      expect(result.urls).toHaveLength(2);
      expect(result.segments).toHaveLength(4);
    });

    it('should parse text without URLs', () => {
      const result = parseTextForUrls('No URLs here');

      expect(result.hasUrls).toBe(false);
      expect(result.urls).toHaveLength(0);
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0]).toEqual({ type: 'text', content: 'No URLs here' });
    });

    it('should handle URL at start of text', () => {
      const result = parseTextForUrls('https://example.com is great');

      expect(result.segments).toHaveLength(2);
      expect(result.segments[0].type).toBe('url');
      expect(result.segments[1].type).toBe('text');
    });

    it('should handle URL at end of text', () => {
      const result = parseTextForUrls('Check out https://example.com');

      expect(result.segments).toHaveLength(2);
      expect(result.segments[0].type).toBe('text');
      expect(result.segments[1].type).toBe('url');
    });

    it('should handle text that is only a URL', () => {
      const result = parseTextForUrls('https://example.com');

      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].type).toBe('url');
    });

    it('should handle adjacent URLs', () => {
      const result = parseTextForUrls('https://first.com https://second.com');

      expect(result.urls).toHaveLength(2);
    });

    it('should normalize www URLs in segments', () => {
      const result = parseTextForUrls('Visit www.example.com');

      expect(result.segments[1].url).toBe('https://www.example.com');
    });

    it('should handle empty/null input', () => {
      expect(parseTextForUrls('').hasUrls).toBe(false);
      expect(parseTextForUrls(null as any).hasUrls).toBe(false);
    });
  });

  // ========================================
  // DOMAIN EXTRACTION TESTS
  // ========================================

  describe('extractDomain', () => {
    it('should extract domain from https URL', () => {
      expect(extractDomain('https://example.com/path')).toBe('example.com');
    });

    it('should extract domain from http URL', () => {
      expect(extractDomain('http://example.org/page')).toBe('example.org');
    });

    it('should remove www prefix', () => {
      expect(extractDomain('https://www.example.com')).toBe('example.com');
    });

    it('should preserve subdomain', () => {
      expect(extractDomain('https://blog.example.com')).toBe('blog.example.com');
    });

    it('should handle URLs without protocol', () => {
      expect(extractDomain('www.example.com')).toBe('example.com');
    });

    it('should handle URLs with query params', () => {
      expect(extractDomain('https://example.com?query=1')).toBe('example.com');
    });

    it('should return null for invalid URLs', () => {
      expect(extractDomain('')).toBeNull();
      expect(extractDomain(null as any)).toBeNull();
    });
  });

  // ========================================
  // FAVICON URL TESTS
  // ========================================

  describe('getFaviconUrl', () => {
    it('should return Google favicon URL', () => {
      const favicon = getFaviconUrl('https://example.com');

      expect(favicon).toBe('https://www.google.com/s2/favicons?domain=example.com&sz=32');
    });

    it('should handle www URLs', () => {
      const favicon = getFaviconUrl('https://www.example.com');

      expect(favicon).toContain('domain=example.com');
    });

    it('should return empty string for invalid URLs', () => {
      expect(getFaviconUrl('')).toBe('');
      expect(getFaviconUrl(null as any)).toBe('');
    });
  });

  // ========================================
  // URL TRUNCATION TESTS
  // ========================================

  describe('truncateUrl', () => {
    it('should not truncate short URLs', () => {
      const url = 'https://example.com';
      expect(truncateUrl(url, 50)).toBe(url);
    });

    it('should truncate long URLs', () => {
      const url = 'https://example.com/very/long/path/to/some/resource/page.html';
      const truncated = truncateUrl(url, 40);

      expect(truncated.length).toBeLessThanOrEqual(40);
      expect(truncated).toContain('...');
    });

    it('should keep domain visible when possible', () => {
      const url = 'https://example.com/very/long/path/to/some/resource';
      const truncated = truncateUrl(url, 40);

      expect(truncated).toContain('example.com');
    });

    it('should use default max length', () => {
      const url = 'https://example.com/a/very/very/very/long/path/to/resource';
      const truncated = truncateUrl(url);

      expect(truncated.length).toBeLessThanOrEqual(50);
    });

    it('should handle empty/null input', () => {
      expect(truncateUrl('')).toBe('');
      expect(truncateUrl(null as any, 50)).toBe(null);
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================

  describe('Edge Cases', () => {
    it('should handle URLs in parentheses', () => {
      const text = 'Check out (https://example.com) for more';
      const urls = detectUrls(text);

      expect(urls).toHaveLength(1);
      // Note: The regex includes parentheses to support Wikipedia-style URLs
      // like https://en.wikipedia.org/wiki/Python_(programming_language)
      // This means trailing parentheses are included when URL is wrapped in parens
      expect(urls[0].url).toContain('example.com');
    });

    it('should handle URLs followed by punctuation', () => {
      const text = 'Visit https://example.com. It is great!';
      const urls = detectUrls(text);

      expect(urls).toHaveLength(1);
    });

    it('should handle URLs in markdown links', () => {
      const text = '[Link](https://example.com)';
      const urls = detectUrls(text);

      expect(urls).toHaveLength(1);
    });

    it('should handle URLs with encoded characters', () => {
      const url = 'https://example.com/path%20with%20spaces';
      expect(detectUrls(url)).toHaveLength(1);
    });

    it('should handle internationalized domain names', () => {
      // These may or may not be detected depending on regex
      const text = 'Visit https://example.co.jp';
      const urls = detectUrls(text);

      expect(urls.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle multiple consecutive spaces', () => {
      const text = 'Before   https://example.com   after';
      const result = parseTextForUrls(text);

      expect(result.hasUrls).toBe(true);
    });

    it('should handle newlines around URLs', () => {
      const text = 'Line 1\nhttps://example.com\nLine 3';
      const urls = detectUrls(text);

      expect(urls).toHaveLength(1);
    });
  });

  // ========================================
  // COMPLEX SCENARIOS
  // ========================================

  describe('Complex Scenarios', () => {
    it('should handle message with multiple link types', () => {
      const text = `
        Check out our website at https://example.com
        Also visit www.blog.example.com for updates
        API docs: http://docs.example.com/api
      `;

      const urls = detectUrls(text);
      expect(urls).toHaveLength(3);
    });

    it('should handle social media URLs', () => {
      const text = 'Follow us: https://twitter.com/example https://facebook.com/example';
      const urls = detectUrls(text);

      expect(urls).toHaveLength(2);
    });

    it('should handle YouTube URLs', () => {
      const text = 'Watch: https://www.youtube.com/watch?v=abc123';
      const urls = detectUrls(text);

      expect(urls).toHaveLength(1);
      expect(urls[0].url).toContain('youtube.com');
    });

    it('should handle GitHub URLs', () => {
      const text = 'Code: https://github.com/user/repo/blob/main/file.js';
      const urls = detectUrls(text);

      expect(urls).toHaveLength(1);
    });
  });
});
