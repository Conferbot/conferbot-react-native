/**
 * WebhookUtils.ts
 *
 * Utility functions for webhook handling in the Conferbot React Native SDK.
 * Provides variable interpolation, authentication header building, response parsing,
 * URL validation, and input sanitization.
 */

// ========================================
// TYPES AND INTERFACES
// ========================================

/**
 * HTTP methods supported by webhooks
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * Authentication types for webhooks
 */
export type AuthenticationType = 'none' | 'bearer' | 'basic' | 'apiKey' | 'oauth2' | 'custom';

/**
 * API Key location (header or query parameter)
 */
export type ApiKeyLocation = 'header' | 'query';

/**
 * Authentication configuration
 */
export interface AuthenticationConfig {
  type: AuthenticationType;

  // Bearer token
  token?: string;

  // Basic auth
  username?: string;
  password?: string;

  // API Key
  apiKeyName?: string;
  apiKeyValue?: string;
  apiKeyLocation?: ApiKeyLocation;

  // OAuth2 / Custom token
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  grantType?: string;

  // Custom token path (for extracting token from response)
  tokenPath?: string;
  expiresInPath?: string;
}

/**
 * Response extraction configuration
 */
export interface ResponseExtractConfig {
  /** Path to extract value from response (dot notation, e.g., "data.user.id") */
  path?: string;

  /** Variable name to store the extracted value */
  variableName?: string;

  /** Multiple extractions */
  extractions?: Array<{
    path: string;
    variableName: string;
    defaultValue?: any;
  }>;

  /** Store full response as variable */
  storeFullResponse?: boolean;
  fullResponseVariableName?: string;
}

/**
 * Cached token with expiration
 */
export interface CachedToken {
  token: string;
  expiresAt: number;
}

/**
 * Webhook response
 */
export interface WebhookResponse {
  success: boolean;
  statusCode: number;
  data: any;
  headers: Record<string, string>;
  error?: string;
  retryCount: number;
  duration: number;
}

/**
 * Rate limiter statistics
 */
export interface RateLimiterStats {
  totalRequests: number;
  windowStart: number;
  isLimitExceeded: boolean;
}

// ========================================
// TOKEN CACHE
// ========================================

/**
 * In-memory token cache for OAuth and custom authentication
 */
const tokenCache: Map<string, CachedToken> = new Map();

/**
 * Gets a cached token if valid
 */
export function getCachedToken(cacheKey: string): string | null {
  const cached = tokenCache.get(cacheKey);
  if (!cached) return null;

  // Check if expired (with 60 second buffer)
  if (Date.now() >= cached.expiresAt - 60000) {
    tokenCache.delete(cacheKey);
    return null;
  }

  return cached.token;
}

/**
 * Caches a token with expiration
 */
export function cacheToken(cacheKey: string, token: string, expiresInSeconds: number): void {
  const expiresAt = Date.now() + (expiresInSeconds * 1000);
  tokenCache.set(cacheKey, { token, expiresAt });
}

/**
 * Clears all cached tokens
 */
export function clearTokenCache(): void {
  tokenCache.clear();
}

/**
 * Clears a specific cached token
 */
export function clearCachedToken(cacheKey: string): void {
  tokenCache.delete(cacheKey);
}

// ========================================
// RATE LIMITER
// ========================================

/**
 * Simple sliding window rate limiter
 */
export class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Attempts to acquire a permit
   * @returns true if request is allowed, false if rate limited
   */
  tryAcquire(): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Remove expired timestamps
    this.requests = this.requests.filter(ts => ts > windowStart);

    // Check if limit exceeded
    if (this.requests.length >= this.maxRequests) {
      return false;
    }

    // Add current request
    this.requests.push(now);
    return true;
  }

  /**
   * Gets time until next permit is available
   * @returns milliseconds until next permit, 0 if available now
   */
  getWaitTime(): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Remove expired timestamps
    this.requests = this.requests.filter(ts => ts > windowStart);

    if (this.requests.length < this.maxRequests) {
      return 0;
    }

    // Calculate wait time based on oldest request
    const oldestRequest = this.requests[0];
    return Math.max(0, (oldestRequest + this.windowMs) - now);
  }

  /**
   * Waits until a permit is available (async)
   */
  async acquire(): Promise<void> {
    while (!this.tryAcquire()) {
      const waitTime = this.getWaitTime();
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  /**
   * Gets current statistics
   */
  getStats(): RateLimiterStats {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    this.requests = this.requests.filter(ts => ts > windowStart);

    return {
      totalRequests: this.requests.length,
      windowStart,
      isLimitExceeded: this.requests.length >= this.maxRequests,
    };
  }

  /**
   * Resets the rate limiter
   */
  reset(): void {
    this.requests = [];
  }
}

// ========================================
// VARIABLE INTERPOLATION
// ========================================

/**
 * Interpolates variables in a template string
 * Supports {{variableName}} and {{object.nested.property}} syntax
 *
 * @param template - The template string with {{variable}} placeholders
 * @param variables - Object containing variable values
 * @returns The interpolated string
 */
export function interpolateVariables(
  template: string,
  variables: Record<string, any>
): string {
  if (!template || typeof template !== 'string') {
    return template;
  }

  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const trimmedPath = path.trim();
    const value = getNestedValue(variables, trimmedPath);

    if (value === undefined || value === null) {
      // Return original placeholder if variable not found
      return match;
    }

    // Convert value to string
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  });
}

/**
 * Interpolates variables in an object (recursively)
 *
 * @param obj - The object containing strings to interpolate
 * @param variables - Object containing variable values
 * @returns New object with interpolated values
 */
export function interpolateObjectVariables(
  obj: Record<string, any>,
  variables: Record<string, any>
): Record<string, any> {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = interpolateVariables(value, variables);
    } else if (Array.isArray(value)) {
      result[key] = value.map(item => {
        if (typeof item === 'string') {
          return interpolateVariables(item, variables);
        } else if (typeof item === 'object' && item !== null) {
          return interpolateObjectVariables(item, variables);
        }
        return item;
      });
    } else if (typeof value === 'object' && value !== null) {
      result[key] = interpolateObjectVariables(value, variables);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Gets a nested value from an object using dot notation
 *
 * @param obj - The source object
 * @param path - Dot-separated path (e.g., "user.profile.email")
 * @returns The value at the path, or undefined if not found
 */
export function getNestedValue(obj: Record<string, any>, path: string): any {
  if (!obj || !path) {
    return undefined;
  }

  const parts = path.split('.');
  let current: any = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    // Handle array index access (e.g., "items[0]")
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, arrayName, indexStr] = arrayMatch;
      const index = parseInt(indexStr, 10);
      current = current[arrayName];
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[index];
    } else {
      current = current[part];
    }
  }

  return current;
}

/**
 * Sets a nested value in an object using dot notation
 *
 * @param obj - The target object
 * @param path - Dot-separated path (e.g., "user.profile.email")
 * @param value - The value to set
 */
export function setNestedValue(obj: Record<string, any>, path: string, value: any): void {
  if (!obj || !path) {
    return;
  }

  const parts = path.split('.');
  let current: any = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];

    if (current[part] === undefined || current[part] === null) {
      // Create intermediate object or array based on next key
      const nextPart = parts[i + 1];
      current[part] = /^\d+$/.test(nextPart) ? [] : {};
    }

    current = current[part];
  }

  current[parts[parts.length - 1]] = value;
}

// ========================================
// AUTHENTICATION HEADER BUILDING
// ========================================

/**
 * Builds authentication headers based on configuration
 *
 * @param authConfig - Authentication configuration
 * @returns Headers object with authentication, or null if no auth needed
 */
export function buildAuthHeader(
  authConfig: AuthenticationConfig | null | undefined
): Record<string, string> | null {
  if (!authConfig || authConfig.type === 'none') {
    return null;
  }

  const headers: Record<string, string> = {};

  switch (authConfig.type) {
    case 'bearer':
      if (authConfig.token) {
        headers['Authorization'] = `Bearer ${authConfig.token}`;
      }
      break;

    case 'basic':
      if (authConfig.username) {
        const credentials = `${authConfig.username}:${authConfig.password || ''}`;
        // React Native supports btoa for base64 encoding
        const encoded = typeof btoa !== 'undefined'
          ? btoa(credentials)
          : Buffer.from(credentials).toString('base64');
        headers['Authorization'] = `Basic ${encoded}`;
      }
      break;

    case 'apiKey':
      if (authConfig.apiKeyName && authConfig.apiKeyValue) {
        // Only add header if location is 'header' (query handled separately)
        if (!authConfig.apiKeyLocation || authConfig.apiKeyLocation === 'header') {
          headers[authConfig.apiKeyName] = authConfig.apiKeyValue;
        }
      }
      break;

    case 'oauth2':
    case 'custom':
      // Token should be fetched and provided as 'token'
      if (authConfig.token) {
        headers['Authorization'] = `Bearer ${authConfig.token}`;
      }
      break;
  }

  return Object.keys(headers).length > 0 ? headers : null;
}

/**
 * Builds URL with API key query parameter if configured
 *
 * @param url - The base URL
 * @param authConfig - Authentication configuration
 * @returns URL with query parameter added if needed
 */
export function buildUrlWithApiKey(
  url: string,
  authConfig: AuthenticationConfig | null | undefined
): string {
  if (
    !authConfig ||
    authConfig.type !== 'apiKey' ||
    authConfig.apiKeyLocation !== 'query' ||
    !authConfig.apiKeyName ||
    !authConfig.apiKeyValue
  ) {
    return url;
  }

  const separator = url.includes('?') ? '&' : '?';
  const encodedName = encodeURIComponent(authConfig.apiKeyName);
  const encodedValue = encodeURIComponent(authConfig.apiKeyValue);

  return `${url}${separator}${encodedName}=${encodedValue}`;
}

/**
 * Fetches OAuth2 access token
 *
 * @param authConfig - OAuth2 configuration
 * @returns Access token
 * @throws Error if token fetch fails
 */
export async function fetchOAuth2Token(authConfig: AuthenticationConfig): Promise<string> {
  if (!authConfig.tokenUrl || !authConfig.clientId || !authConfig.clientSecret) {
    throw new Error('OAuth2 requires tokenUrl, clientId, and clientSecret');
  }

  const cacheKey = `oauth2:${authConfig.tokenUrl}:${authConfig.clientId}`;

  // Check cache first
  const cachedToken = getCachedToken(cacheKey);
  if (cachedToken) {
    return cachedToken;
  }

  // Build request body
  const body = new URLSearchParams();
  body.append('grant_type', authConfig.grantType || 'client_credentials');
  body.append('client_id', authConfig.clientId);
  body.append('client_secret', authConfig.clientSecret);
  if (authConfig.scope) {
    body.append('scope', authConfig.scope);
  }

  const response = await fetch(authConfig.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`OAuth2 token fetch failed: HTTP ${response.status}`);
  }

  const data = await response.json();
  const token = data.access_token;

  if (!token) {
    throw new Error('No access_token in OAuth2 response');
  }

  // Cache the token
  const expiresIn = data.expires_in || 3600;
  cacheToken(cacheKey, token, expiresIn);

  return token;
}

/**
 * Fetches custom token using username/password
 *
 * @param authConfig - Custom token configuration
 * @returns Access token
 * @throws Error if token fetch fails
 */
export async function fetchCustomToken(authConfig: AuthenticationConfig): Promise<string> {
  if (!authConfig.tokenUrl || !authConfig.username) {
    throw new Error('Custom token requires tokenUrl and username');
  }

  const cacheKey = `custom:${authConfig.tokenUrl}:${authConfig.username}`;

  // Check cache first
  const cachedToken = getCachedToken(cacheKey);
  if (cachedToken) {
    return cachedToken;
  }

  const response = await fetch(authConfig.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: authConfig.username,
      password: authConfig.password || '',
    }),
  });

  if (!response.ok) {
    throw new Error(`Custom token fetch failed: HTTP ${response.status}`);
  }

  const data = await response.json();

  // Extract token using configured path
  const tokenPath = authConfig.tokenPath || 'access_token';
  const token = getNestedValue(data, tokenPath);

  if (!token) {
    throw new Error(`No token found at path: ${tokenPath}`);
  }

  // Extract expiration if available
  const expiresInPath = authConfig.expiresInPath || 'expires_in';
  const expiresIn = getNestedValue(data, expiresInPath) || 3600;

  // Cache the token
  cacheToken(cacheKey, String(token), Number(expiresIn));

  return String(token);
}

// ========================================
// RESPONSE PARSING
// ========================================

/**
 * Parses and extracts values from webhook response
 *
 * @param response - The parsed response body
 * @param extractConfig - Extraction configuration
 * @returns Object with extracted variables
 */
export function parseResponse(
  response: any,
  extractConfig: ResponseExtractConfig | null | undefined
): Record<string, any> {
  const result: Record<string, any> = {};

  if (!extractConfig || !response) {
    return result;
  }

  // Store full response if requested
  if (extractConfig.storeFullResponse) {
    const varName = extractConfig.fullResponseVariableName || '_webhookResponse';
    result[varName] = response;
  }

  // Single path extraction
  if (extractConfig.path && extractConfig.variableName) {
    const value = getNestedValue(response, extractConfig.path);
    if (value !== undefined) {
      result[extractConfig.variableName] = value;
    }
  }

  // Multiple extractions
  if (extractConfig.extractions && Array.isArray(extractConfig.extractions)) {
    for (const extraction of extractConfig.extractions) {
      if (extraction.path && extraction.variableName) {
        const value = getNestedValue(response, extraction.path);
        result[extraction.variableName] = value !== undefined
          ? value
          : extraction.defaultValue;
      }
    }
  }

  return result;
}

// ========================================
// URL VALIDATION
// ========================================

/**
 * Blocked hosts for production environment
 */
const BLOCKED_HOSTS_PRODUCTION = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  'metadata.google.internal',
  '169.254.169.254', // Cloud metadata endpoint
];

/**
 * Validates a webhook URL
 *
 * @param url - The URL to validate
 * @param options - Validation options
 * @returns Validation result with error message if invalid
 */
export function validateUrl(
  url: string,
  options: {
    allowLocalhost?: boolean;
    requireHttps?: boolean;
  } = {}
): { isValid: boolean; error?: string } {
  const { allowLocalhost = false, requireHttps = false } = options;

  if (!url || typeof url !== 'string') {
    return { isValid: false, error: 'URL is required' };
  }

  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return { isValid: false, error: 'URL is required' };
  }

  // Parse URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedUrl);
  } catch {
    return { isValid: false, error: 'Invalid URL format' };
  }

  // Check protocol
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return { isValid: false, error: 'URL must use http or https protocol' };
  }

  // Require HTTPS in production
  if (requireHttps && parsedUrl.protocol !== 'https:') {
    return { isValid: false, error: 'HTTPS is required for webhooks' };
  }

  // Check for localhost/private IPs in production
  if (!allowLocalhost) {
    const hostname = parsedUrl.hostname.toLowerCase();

    for (const blocked of BLOCKED_HOSTS_PRODUCTION) {
      if (blocked.includes('/')) {
        // CIDR range - skip for now (would need IP parsing)
        continue;
      }
      if (hostname === blocked) {
        return { isValid: false, error: 'Localhost URLs are not allowed in production' };
      }
    }

    // Check for private IP patterns
    if (isPrivateIP(hostname)) {
      return { isValid: false, error: 'Private IP addresses are not allowed in production' };
    }
  }

  return { isValid: true };
}

/**
 * Checks if a hostname is a private IP address
 */
function isPrivateIP(hostname: string): boolean {
  // Check 10.x.x.x
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }

  // Check 172.16.x.x - 172.31.x.x
  const match172 = hostname.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (match172) {
    const second = parseInt(match172[1], 10);
    if (second >= 16 && second <= 31) {
      return true;
    }
  }

  // Check 192.168.x.x
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }

  return false;
}

// ========================================
// INPUT SANITIZATION
// ========================================

/**
 * Characters to escape in user input for JSON
 */
const JSON_ESCAPE_MAP: Record<string, string> = {
  '"': '\\"',
  '\\': '\\\\',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
  '\b': '\\b',
  '\f': '\\f',
};

/**
 * Sanitizes user input for safe inclusion in JSON body
 *
 * @param input - The user input to sanitize
 * @returns Sanitized string safe for JSON
 */
export function sanitizeForJson(input: any): any {
  if (typeof input !== 'string') {
    if (input === null || input === undefined) {
      return input;
    }
    if (typeof input === 'object') {
      if (Array.isArray(input)) {
        return input.map(sanitizeForJson);
      }
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(input)) {
        result[sanitizeForJson(key) as string] = sanitizeForJson(value);
      }
      return result;
    }
    return input;
  }

  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');

  // Escape special JSON characters
  for (const [char, escape] of Object.entries(JSON_ESCAPE_MAP)) {
    sanitized = sanitized.split(char).join(escape);
  }

  return sanitized;
}

/**
 * Sanitizes user input for safe inclusion in URL
 *
 * @param input - The user input to sanitize
 * @returns URL-encoded string
 */
export function sanitizeForUrl(input: string): string {
  if (typeof input !== 'string') {
    return String(input);
  }

  return encodeURIComponent(input);
}

/**
 * Sanitizes user input for safe inclusion in headers
 *
 * @param input - The user input to sanitize
 * @returns Sanitized string safe for headers
 */
export function sanitizeForHeader(input: string): string {
  if (typeof input !== 'string') {
    return String(input);
  }

  // Remove line breaks and control characters
  return input
    .replace(/[\r\n]/g, ' ')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();
}

// ========================================
// RETRY UTILITIES
// ========================================

/**
 * HTTP status codes that are considered retryable
 */
export const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

/**
 * Checks if an HTTP status code is retryable
 */
export function isRetryableStatusCode(statusCode: number): boolean {
  return RETRYABLE_STATUS_CODES.includes(statusCode);
}

/**
 * Calculates exponential backoff delay with jitter
 *
 * @param attempt - Current attempt number (0-based)
 * @param baseDelay - Base delay in milliseconds
 * @param maxDelay - Maximum delay in milliseconds
 * @returns Delay in milliseconds
 */
export function calculateBackoff(
  attempt: number,
  baseDelay: number = 1000,
  maxDelay: number = 30000
): number {
  // Exponential: 2^attempt * baseDelay
  const exponentialDelay = Math.pow(2, attempt) * baseDelay;

  // Add jitter (10% randomness)
  const jitter = Math.random() * exponentialDelay * 0.1;

  // Cap at maxDelay
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Delays execution for specified milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// ERROR HANDLING
// ========================================

/**
 * Webhook error class
 */
export class WebhookError extends Error {
  public statusCode?: number;
  public isRetryable: boolean;
  public responseBody?: any;

  constructor(
    message: string,
    options?: {
      statusCode?: number;
      isRetryable?: boolean;
      responseBody?: any;
    }
  ) {
    super(message);
    this.name = 'WebhookError';
    this.statusCode = options?.statusCode;
    this.isRetryable = options?.isRetryable ?? false;
    this.responseBody = options?.responseBody;
  }
}

/**
 * Gets a user-friendly error message for webhook failures
 */
export function getWebhookErrorMessage(error: any): string {
  if (error instanceof WebhookError) {
    if (error.statusCode) {
      switch (error.statusCode) {
        case 400:
          return 'Invalid request sent to the server';
        case 401:
          return 'Authentication failed';
        case 403:
          return 'Access denied';
        case 404:
          return 'The requested resource was not found';
        case 408:
          return 'Request timed out';
        case 429:
          return 'Too many requests - please try again later';
        case 500:
          return 'Server error occurred';
        case 502:
          return 'Bad gateway - server is temporarily unavailable';
        case 503:
          return 'Service unavailable - please try again later';
        case 504:
          return 'Gateway timeout';
        default:
          return `Request failed with status ${error.statusCode}`;
      }
    }
    return error.message;
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return 'Request was cancelled or timed out';
    }
    if (error.message.includes('network') || error.message.includes('Network')) {
      return 'Network error - please check your connection';
    }
    return error.message;
  }

  return 'An unexpected error occurred';
}

// ========================================
// EXPORTS
// ========================================

export default {
  // Variable interpolation
  interpolateVariables,
  interpolateObjectVariables,
  getNestedValue,
  setNestedValue,

  // Authentication
  buildAuthHeader,
  buildUrlWithApiKey,
  fetchOAuth2Token,
  fetchCustomToken,

  // Token cache
  getCachedToken,
  cacheToken,
  clearTokenCache,
  clearCachedToken,

  // Response parsing
  parseResponse,

  // URL validation
  validateUrl,

  // Input sanitization
  sanitizeForJson,
  sanitizeForUrl,
  sanitizeForHeader,

  // Retry utilities
  isRetryableStatusCode,
  calculateBackoff,
  delay,

  // Rate limiting
  RateLimiter,

  // Error handling
  WebhookError,
  getWebhookErrorMessage,
};
