/**
 * WebhookHandler.ts
 *
 * Complete webhook handler for the Conferbot React Native SDK.
 * Supports all HTTP methods, authentication types, variable interpolation,
 * retry logic with exponential backoff, and response parsing.
 */

import {
  HttpMethod,
  AuthenticationConfig,
  AuthenticationType,
  ResponseExtractConfig,
  WebhookResponse,
  RateLimiter,
  WebhookError,
  interpolateVariables,
  interpolateObjectVariables,
  getNestedValue,
  buildAuthHeader,
  buildUrlWithApiKey,
  fetchOAuth2Token,
  fetchCustomToken,
  parseResponse,
  validateUrl,
  sanitizeForJson,
  sanitizeForUrl,
  isRetryableStatusCode,
  calculateBackoff,
  delay,
  getWebhookErrorMessage,
} from '../utils/WebhookUtils';

// ========================================
// TYPES AND INTERFACES
// ========================================

/**
 * Webhook request configuration
 */
export interface WebhookRequest {
  /** The URL to send the request to */
  url: string;

  /** HTTP method */
  method: HttpMethod;

  /** Request headers */
  headers?: Record<string, string>;

  /** Request body (will be JSON stringified if object) */
  body?: any;

  /** Authentication configuration */
  authentication?: AuthenticationConfig;

  /** Request timeout in milliseconds */
  timeoutMs?: number;

  /** Maximum retry attempts (excluding initial attempt) */
  maxRetries?: number;

  /** Response extraction configuration */
  responseExtract?: ResponseExtractConfig;

  /** Variable context for interpolation */
  variables?: Record<string, any>;

  /** Whether to include answer variables in body */
  includeAnswerVariables?: boolean;

  /** Answer variables to include */
  answerVariables?: Record<string, any>;

  /** Whether to proceed on error */
  proceedOnError?: boolean;

  /** Whether to allow localhost URLs (for development) */
  allowLocalhost?: boolean;
}

/**
 * Webhook execution result
 */
export interface WebhookResult {
  /** Whether the request was successful */
  success: boolean;

  /** Extracted variables from response */
  extractedVariables: Record<string, any>;

  /** Raw response data */
  response?: WebhookResponse;

  /** Error message if failed */
  error?: string;

  /** Whether to proceed to next node */
  shouldProceed: boolean;
}

/**
 * Webhook handler configuration
 */
export interface WebhookHandlerConfig {
  /** Default timeout in milliseconds */
  defaultTimeoutMs?: number;

  /** Default maximum retries */
  defaultMaxRetries?: number;

  /** Rate limiter configuration */
  rateLimiter?: RateLimiter;

  /** Whether to allow localhost URLs by default */
  allowLocalhost?: boolean;

  /** Base URL for relative URLs */
  baseUrl?: string;

  /** Default headers to include in all requests */
  defaultHeaders?: Record<string, string>;

  /** Enable debug logging */
  debug?: boolean;
}

// ========================================
// DEFAULT CONFIGURATION
// ========================================

const DEFAULT_CONFIG: Required<Omit<WebhookHandlerConfig, 'rateLimiter' | 'baseUrl'>> = {
  defaultTimeoutMs: 30000,
  defaultMaxRetries: 3,
  allowLocalhost: __DEV__ ?? false,
  defaultHeaders: {
    'Accept': 'application/json',
  },
  debug: __DEV__ ?? false,
};

// ========================================
// WEBHOOK HANDLER CLASS
// ========================================

/**
 * WebhookHandler - Complete webhook implementation for React Native SDK
 *
 * Features:
 * - All HTTP methods (GET, POST, PUT, DELETE, PATCH)
 * - Custom headers support
 * - Request body with variable interpolation
 * - Authentication (Bearer, Basic, API Key, OAuth2, Custom)
 * - Timeout configuration
 * - Retry logic with exponential backoff
 * - Response extraction into variables
 * - URL validation
 * - Rate limiting
 */
export class WebhookHandler {
  private config: Required<Omit<WebhookHandlerConfig, 'rateLimiter' | 'baseUrl'>> & {
    rateLimiter?: RateLimiter;
    baseUrl?: string;
  };

  private rateLimiter: RateLimiter;

  constructor(config?: WebhookHandlerConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    // Create rate limiter (100 requests per minute by default)
    this.rateLimiter = config?.rateLimiter || new RateLimiter(100, 60000);
  }

  /**
   * Executes a webhook request
   *
   * @param request - The webhook request configuration
   * @returns The execution result
   */
  async execute(request: WebhookRequest): Promise<WebhookResult> {
    const startTime = Date.now();

    try {
      // Build combined variables for interpolation
      const variables = this.buildVariableContext(request);

      // Validate and prepare URL
      const preparedUrl = this.prepareUrl(request, variables);

      // Validate URL
      const urlValidation = validateUrl(preparedUrl, {
        allowLocalhost: request.allowLocalhost ?? this.config.allowLocalhost,
      });

      if (!urlValidation.isValid) {
        return {
          success: false,
          extractedVariables: {},
          error: urlValidation.error,
          shouldProceed: request.proceedOnError !== false,
        };
      }

      // Prepare authentication
      const authConfig = await this.prepareAuthentication(request.authentication, variables);

      // Prepare headers
      const headers = this.prepareHeaders(request, authConfig, variables);

      // Prepare body
      const body = this.prepareBody(request, variables);

      // Apply rate limiting
      await this.rateLimiter.acquire();

      // Execute with retry logic
      const response = await this.executeWithRetry(
        preparedUrl,
        request.method,
        headers,
        body,
        request.timeoutMs ?? this.config.defaultTimeoutMs,
        request.maxRetries ?? this.config.defaultMaxRetries
      );

      // Parse response and extract variables
      const extractedVariables = parseResponse(response.data, request.responseExtract);

      // Add metadata
      extractedVariables._webhookStatusCode = response.statusCode;
      extractedVariables._webhookSuccess = response.success;
      extractedVariables._webhookDuration = Date.now() - startTime;

      if (response.success) {
        return {
          success: true,
          extractedVariables,
          response,
          shouldProceed: true,
        };
      } else {
        extractedVariables._webhookError = response.error;
        return {
          success: false,
          extractedVariables,
          response,
          error: response.error,
          shouldProceed: request.proceedOnError !== false,
        };
      }
    } catch (error) {
      const errorMessage = getWebhookErrorMessage(error);

      this.log('error', 'Webhook execution failed', { error: errorMessage });

      return {
        success: false,
        extractedVariables: {
          _webhookError: errorMessage,
          _webhookDuration: Date.now() - startTime,
        },
        error: errorMessage,
        shouldProceed: request.proceedOnError !== false,
      };
    }
  }

  /**
   * Builds the variable context for interpolation
   */
  private buildVariableContext(request: WebhookRequest): Record<string, any> {
    const variables: Record<string, any> = {};

    // Add request variables
    if (request.variables) {
      Object.assign(variables, request.variables);
    }

    // Add answer variables
    if (request.answerVariables) {
      Object.assign(variables, request.answerVariables);
    }

    return variables;
  }

  /**
   * Prepares the URL with interpolation and API key
   */
  private prepareUrl(request: WebhookRequest, variables: Record<string, any>): string {
    let url = request.url;

    // Interpolate variables in URL
    url = interpolateVariables(url, variables);

    // Handle relative URLs
    if (this.config.baseUrl && !url.startsWith('http://') && !url.startsWith('https://')) {
      url = `${this.config.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    }

    // Add API key to URL if configured for query location
    if (request.authentication?.type === 'apiKey' && request.authentication.apiKeyLocation === 'query') {
      url = buildUrlWithApiKey(url, request.authentication);
    }

    return url;
  }

  /**
   * Prepares authentication configuration
   */
  private async prepareAuthentication(
    authConfig: AuthenticationConfig | undefined,
    variables: Record<string, any>
  ): Promise<AuthenticationConfig | null> {
    if (!authConfig || authConfig.type === 'none') {
      return null;
    }

    // Clone config to avoid mutating original
    const config: AuthenticationConfig = { ...authConfig };

    // Interpolate variables in auth config
    if (config.token) {
      config.token = interpolateVariables(config.token, variables);
    }
    if (config.username) {
      config.username = interpolateVariables(config.username, variables);
    }
    if (config.password) {
      config.password = interpolateVariables(config.password, variables);
    }
    if (config.apiKeyValue) {
      config.apiKeyValue = interpolateVariables(config.apiKeyValue, variables);
    }
    if (config.tokenUrl) {
      config.tokenUrl = interpolateVariables(config.tokenUrl, variables);
    }
    if (config.clientId) {
      config.clientId = interpolateVariables(config.clientId, variables);
    }
    if (config.clientSecret) {
      config.clientSecret = interpolateVariables(config.clientSecret, variables);
    }

    // Fetch tokens for OAuth2 and custom authentication
    if (config.type === 'oauth2' && config.tokenUrl) {
      try {
        config.token = await fetchOAuth2Token(config);
      } catch (error) {
        this.log('error', 'OAuth2 token fetch failed', { error });
        throw new WebhookError('Failed to fetch OAuth2 token', { isRetryable: true });
      }
    } else if (config.type === 'custom' && config.tokenUrl) {
      try {
        config.token = await fetchCustomToken(config);
      } catch (error) {
        this.log('error', 'Custom token fetch failed', { error });
        throw new WebhookError('Failed to fetch custom token', { isRetryable: true });
      }
    }

    return config;
  }

  /**
   * Prepares request headers
   */
  private prepareHeaders(
    request: WebhookRequest,
    authConfig: AuthenticationConfig | null,
    variables: Record<string, any>
  ): Record<string, string> {
    const headers: Record<string, string> = {
      ...this.config.defaultHeaders,
    };

    // Add Content-Type for body requests
    if (request.body !== undefined && request.method !== 'GET') {
      headers['Content-Type'] = 'application/json';
    }

    // Add custom headers with interpolation
    if (request.headers) {
      const interpolatedHeaders = interpolateObjectVariables(request.headers, variables);
      Object.assign(headers, interpolatedHeaders);
    }

    // Add authentication headers
    const authHeaders = buildAuthHeader(authConfig);
    if (authHeaders) {
      Object.assign(headers, authHeaders);
    }

    return headers;
  }

  /**
   * Prepares request body
   */
  private prepareBody(
    request: WebhookRequest,
    variables: Record<string, any>
  ): string | undefined {
    if (request.method === 'GET' || request.body === undefined) {
      return undefined;
    }

    let body: any;

    if (typeof request.body === 'string') {
      // Try to parse as JSON for interpolation
      try {
        body = JSON.parse(request.body);
        body = interpolateObjectVariables(body, variables);
      } catch {
        // If not valid JSON, just interpolate as string
        body = interpolateVariables(request.body, variables);
        return body;
      }
    } else if (typeof request.body === 'object') {
      body = interpolateObjectVariables(request.body, variables);
    } else {
      return undefined;
    }

    // Add answer variables if requested
    if (request.includeAnswerVariables && request.answerVariables) {
      if (typeof body === 'object' && body !== null) {
        body.answerVariables = request.answerVariables;
      }
    }

    // Sanitize for JSON
    body = sanitizeForJson(body);

    return JSON.stringify(body);
  }

  /**
   * Executes the request with retry logic
   */
  private async executeWithRetry(
    url: string,
    method: HttpMethod,
    headers: Record<string, string>,
    body: string | undefined,
    timeoutMs: number,
    maxRetries: number
  ): Promise<WebhookResponse> {
    let lastError: Error | null = null;
    let lastResponse: WebhookResponse | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.executeOnce(url, method, headers, body, timeoutMs);

        // If successful, return immediately
        if (response.success) {
          return { ...response, retryCount: attempt };
        }

        // Check if error is retryable
        if (!isRetryableStatusCode(response.statusCode)) {
          return { ...response, retryCount: attempt };
        }

        lastResponse = { ...response, retryCount: attempt };
        lastError = new WebhookError(response.error || 'Request failed', {
          statusCode: response.statusCode,
          isRetryable: true,
        });

        // Calculate backoff and wait before retry
        if (attempt < maxRetries) {
          const backoffMs = calculateBackoff(attempt);
          this.log('debug', `Retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})`, {
            statusCode: response.statusCode,
          });
          await delay(backoffMs);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        const isNetworkError = lastError.name === 'TypeError' ||
          lastError.message.includes('network') ||
          lastError.message.includes('Network');

        if (!isNetworkError && attempt === 0) {
          throw lastError;
        }

        // Wait before retry
        if (attempt < maxRetries) {
          const backoffMs = calculateBackoff(attempt);
          this.log('debug', `Retrying after error in ${backoffMs}ms`, { error: lastError.message });
          await delay(backoffMs);
        }
      }
    }

    // All retries exhausted
    if (lastResponse) {
      return lastResponse;
    }

    return {
      success: false,
      statusCode: -1,
      data: null,
      headers: {},
      error: lastError?.message || 'All retry attempts exhausted',
      retryCount: maxRetries,
      duration: 0,
    };
  }

  /**
   * Executes a single request
   */
  private async executeOnce(
    url: string,
    method: HttpMethod,
    headers: Record<string, string>,
    body: string | undefined,
    timeoutMs: number
  ): Promise<WebhookResponse> {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      this.log('debug', `Executing ${method} ${url}`, { headers: this.sanitizeHeadersForLog(headers) });

      const fetchOptions: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };

      if (body !== undefined && method !== 'GET') {
        fetchOptions.body = body;
      }

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;

      // Parse response body
      let responseData: any;
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        try {
          responseData = await response.json();
        } catch {
          responseData = await response.text();
        }
      } else {
        responseData = await response.text();
      }

      // Extract response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value: string, key: string) => {
        responseHeaders[key] = value;
      });

      this.log('debug', `Response ${response.status} in ${duration}ms`);

      return {
        success: response.ok,
        statusCode: response.status,
        data: responseData,
        headers: responseHeaders,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
        retryCount: 0,
        duration,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          statusCode: 408,
          data: null,
          headers: {},
          error: 'Request timeout',
          retryCount: 0,
          duration,
        };
      }

      throw error;
    }
  }

  /**
   * Logs a message if debug is enabled
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    if (!this.config.debug) return;

    const prefix = '[WebhookHandler]';
    const logMessage = `${prefix} ${message}`;

    switch (level) {
      case 'debug':
        console.debug(logMessage, data);
        break;
      case 'info':
        console.info(logMessage, data);
        break;
      case 'warn':
        console.warn(logMessage, data);
        break;
      case 'error':
        console.error(logMessage, data);
        break;
    }
  }

  /**
   * Sanitizes headers for logging (removes sensitive values)
   */
  private sanitizeHeadersForLog(headers: Record<string, string>): Record<string, string> {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie', 'set-cookie'];

    for (const key of Object.keys(sanitized)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Gets the rate limiter statistics
   */
  getRateLimiterStats() {
    return this.rateLimiter.getStats();
  }

  /**
   * Resets the rate limiter
   */
  resetRateLimiter(): void {
    this.rateLimiter.reset();
  }

  /**
   * Updates handler configuration
   */
  updateConfig(config: Partial<WebhookHandlerConfig>): void {
    Object.assign(this.config, config);
  }
}

// ========================================
// SINGLETON INSTANCE
// ========================================

/**
 * Default webhook handler instance
 */
let defaultHandler: WebhookHandler | null = null;

/**
 * Gets the default webhook handler instance
 */
export function getWebhookHandler(): WebhookHandler {
  if (!defaultHandler) {
    defaultHandler = new WebhookHandler();
  }
  return defaultHandler;
}

/**
 * Creates a new webhook handler with custom configuration
 */
export function createWebhookHandler(config?: WebhookHandlerConfig): WebhookHandler {
  return new WebhookHandler(config);
}

/**
 * Executes a webhook request using the default handler
 */
export async function executeWebhook(request: WebhookRequest): Promise<WebhookResult> {
  return getWebhookHandler().execute(request);
}

// ========================================
// EXPORTS
// ========================================

export default WebhookHandler;
