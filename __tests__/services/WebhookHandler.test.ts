/**
 * WebhookHandler Tests
 *
 * Comprehensive tests for the WebhookHandler class.
 * Covers HTTP request building, response parsing, error handling,
 * retry logic, authentication, and variable interpolation.
 */

import {
  WebhookHandler,
  getWebhookHandler,
  createWebhookHandler,
  executeWebhook,
} from '../../src/services/WebhookHandler';
import {
  RateLimiter,
  interpolateVariables,
  interpolateObjectVariables,
  getNestedValue,
  setNestedValue,
  buildAuthHeader,
  buildUrlWithApiKey,
  validateUrl,
  sanitizeForJson,
  sanitizeForUrl,
  parseResponse,
  isRetryableStatusCode,
  calculateBackoff,
  WebhookError,
  getWebhookErrorMessage,
} from '../../src/utils/WebhookUtils';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock __DEV__
(global as any).__DEV__ = true;

// Helper function to create mock headers with proper get() method
const createMockHeaders = (headers: Record<string, string> = {}) => ({
  get: (name: string) => headers[name.toLowerCase()] || null,
  has: (name: string) => name.toLowerCase() in headers,
  forEach: (callback: (value: string, key: string) => void) => {
    Object.entries(headers).forEach(([key, value]) => callback(value, key.toLowerCase()));
  },
});

describe('WebhookHandler', () => {
  let webhookHandler: WebhookHandler;

  beforeEach(() => {
    webhookHandler = new WebhookHandler({
      defaultTimeoutMs: 5000,
      defaultMaxRetries: 2,
      allowLocalhost: true,
      debug: false,
    });
    mockFetch.mockReset();
    // Use real timers for webhook tests
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // BASIC EXECUTION TESTS
  // ========================================

  describe('Basic Execution', () => {
    it('should execute GET request successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: createMockHeaders({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ success: true, data: { id: 1 } }),
      });

      const result = await webhookHandler.execute({
        url: 'https://api.example.com/data',
        method: 'GET',
      });

      expect(result.success).toBe(true);
      expect(result.shouldProceed).toBe(true);
      expect(result.extractedVariables._webhookSuccess).toBe(true);
      expect(result.extractedVariables._webhookStatusCode).toBe(200);
    });

    it('should execute POST request with body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: createMockHeaders({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ id: 123 }),
      });

      const result = await webhookHandler.execute({
        url: 'https://api.example.com/users',
        method: 'POST',
        body: { name: 'John', email: 'john@example.com' },
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        })
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.name).toBe('John');
      expect(body.email).toBe('john@example.com');
    });

    it('should execute PUT request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ updated: true }),
      });

      const result = await webhookHandler.execute({
        url: 'https://api.example.com/users/1',
        method: 'PUT',
        body: { name: 'Updated Name' },
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('should execute DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: createMockHeaders(),
        text: () => Promise.resolve(''),
      });

      const result = await webhookHandler.execute({
        url: 'https://api.example.com/users/1',
        method: 'DELETE',
      });

      expect(result.success).toBe(true);
    });

    it('should execute PATCH request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ patched: true }),
      });

      const result = await webhookHandler.execute({
        url: 'https://api.example.com/users/1',
        method: 'PATCH',
        body: { status: 'active' },
      });

      expect(result.success).toBe(true);
    });
  });

  // ========================================
  // HEADER HANDLING TESTS
  // ========================================

  describe('Header Handling', () => {
    it('should include default headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      });

      await webhookHandler.execute({
        url: 'https://api.example.com/data',
        method: 'GET',
      });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers).toEqual(
        expect.objectContaining({
          'Accept': 'application/json',
        })
      );
    });

    it('should include custom headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      });

      await webhookHandler.execute({
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: {
          'X-Custom-Header': 'custom-value',
        },
      });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers).toEqual(
        expect.objectContaining({
          'X-Custom-Header': 'custom-value',
        })
      );
    });

    it('should add Content-Type for POST requests with body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      });

      await webhookHandler.execute({
        url: 'https://api.example.com/data',
        method: 'POST',
        body: { test: true },
      });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers).toEqual(
        expect.objectContaining({
          'Content-Type': 'application/json',
        })
      );
    });
  });

  // ========================================
  // AUTHENTICATION TESTS
  // ========================================

  describe('Authentication', () => {
    it('should add Bearer token authentication', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      });

      await webhookHandler.execute({
        url: 'https://api.example.com/data',
        method: 'GET',
        authentication: {
          type: 'bearer',
          token: 'my-bearer-token',
        },
      });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers).toEqual(
        expect.objectContaining({
          'Authorization': 'Bearer my-bearer-token',
        })
      );
    });

    it('should add Basic authentication', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      });

      await webhookHandler.execute({
        url: 'https://api.example.com/data',
        method: 'GET',
        authentication: {
          type: 'basic',
          username: 'user',
          password: 'pass',
        },
      });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers.Authorization).toMatch(/^Basic /);
    });

    it('should add API key in header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      });

      await webhookHandler.execute({
        url: 'https://api.example.com/data',
        method: 'GET',
        authentication: {
          type: 'apiKey',
          apiKeyName: 'X-API-Key',
          apiKeyValue: 'my-api-key',
          apiKeyLocation: 'header',
        },
      });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers).toEqual(
        expect.objectContaining({
          'X-API-Key': 'my-api-key',
        })
      );
    });

    it('should add API key in query parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      });

      await webhookHandler.execute({
        url: 'https://api.example.com/data',
        method: 'GET',
        authentication: {
          type: 'apiKey',
          apiKeyName: 'api_key',
          apiKeyValue: 'my-api-key',
          apiKeyLocation: 'query',
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/data?api_key=my-api-key',
        expect.anything()
      );
    });
  });

  // ========================================
  // VARIABLE INTERPOLATION TESTS
  // ========================================

  describe('Variable Interpolation', () => {
    it('should interpolate variables in URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      });

      await webhookHandler.execute({
        url: 'https://api.example.com/users/{{userId}}',
        method: 'GET',
        variables: { userId: '123' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/123',
        expect.anything()
      );
    });

    it('should interpolate variables in body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      });

      await webhookHandler.execute({
        url: 'https://api.example.com/users',
        method: 'POST',
        body: {
          name: '{{userName}}',
          email: '{{userEmail}}',
        },
        variables: {
          userName: 'John Doe',
          userEmail: 'john@example.com',
        },
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.name).toBe('John Doe');
      expect(body.email).toBe('john@example.com');
    });

    it('should interpolate variables in headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      });

      await webhookHandler.execute({
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: {
          'X-Session-ID': '{{sessionId}}',
        },
        variables: {
          sessionId: 'sess-12345',
        },
      });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers).toEqual(
        expect.objectContaining({
          'X-Session-ID': 'sess-12345',
        })
      );
    });

    it('should include answer variables in body when requested', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      });

      await webhookHandler.execute({
        url: 'https://api.example.com/submit',
        method: 'POST',
        body: { formId: 'form-1' },
        includeAnswerVariables: true,
        answerVariables: {
          name: 'John',
          email: 'john@example.com',
        },
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.answerVariables).toEqual({
        name: 'John',
        email: 'john@example.com',
      });
    });
  });

  // ========================================
  // RESPONSE EXTRACTION TESTS
  // ========================================

  describe('Response Extraction', () => {
    it('should extract single value from response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({
          data: { user: { id: 123, name: 'John' } },
        }),
      });

      const result = await webhookHandler.execute({
        url: 'https://api.example.com/data',
        method: 'GET',
        responseExtract: {
          path: 'data.user.id',
          variableName: 'userId',
        },
      });

      expect(result.extractedVariables.userId).toBe(123);
    });

    it('should extract multiple values from response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({
          user: { id: 123, name: 'John', email: 'john@example.com' },
        }),
      });

      const result = await webhookHandler.execute({
        url: 'https://api.example.com/data',
        method: 'GET',
        responseExtract: {
          extractions: [
            { path: 'user.id', variableName: 'userId' },
            { path: 'user.name', variableName: 'userName' },
            { path: 'user.email', variableName: 'userEmail' },
          ],
        },
      });

      expect(result.extractedVariables.userId).toBe(123);
      expect(result.extractedVariables.userName).toBe('John');
      expect(result.extractedVariables.userEmail).toBe('john@example.com');
    });

    it('should store full response when requested', async () => {
      const responseData = { users: [{ id: 1 }, { id: 2 }] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(responseData),
      });

      const result = await webhookHandler.execute({
        url: 'https://api.example.com/data',
        method: 'GET',
        responseExtract: {
          storeFullResponse: true,
          fullResponseVariableName: 'apiResponse',
        },
      });

      expect(result.extractedVariables.apiResponse).toEqual(responseData);
    });

    it('should use default value for missing extraction', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ data: {} }),
      });

      const result = await webhookHandler.execute({
        url: 'https://api.example.com/data',
        method: 'GET',
        responseExtract: {
          extractions: [
            { path: 'data.missing', variableName: 'missingValue', defaultValue: 'default' },
          ],
        },
      });

      expect(result.extractedVariables.missingValue).toBe('default');
    });
  });

  // ========================================
  // ERROR HANDLING TESTS
  // ========================================

  describe('Error Handling', () => {
    it('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: createMockHeaders({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ error: 'Resource not found' }),
      });

      const result = await webhookHandler.execute({
        url: 'https://api.example.com/missing',
        method: 'GET',
      });

      expect(result.success).toBe(false);
      expect(result.extractedVariables._webhookStatusCode).toBe(404);
      expect(result.extractedVariables._webhookError).toBeDefined();
    });

    it('should handle timeout', async () => {
      const error = new Error('Request timeout');
      error.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(error);

      const result = await webhookHandler.execute({
        url: 'https://api.example.com/slow',
        method: 'GET',
        timeoutMs: 100,
      });

      expect(result.success).toBe(false);
      expect(result.extractedVariables._webhookError).toBeDefined();
    });

    it('should proceed on error when configured', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: createMockHeaders({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      const result = await webhookHandler.execute({
        url: 'https://api.example.com/error',
        method: 'GET',
        proceedOnError: true,
      });

      expect(result.success).toBe(false);
      expect(result.shouldProceed).toBe(true);
    });

    it('should not proceed on error when configured', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: createMockHeaders({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      const result = await webhookHandler.execute({
        url: 'https://api.example.com/error',
        method: 'GET',
        proceedOnError: false,
      });

      expect(result.success).toBe(false);
      expect(result.shouldProceed).toBe(false);
    });
  });

  // ========================================
  // RETRY LOGIC TESTS
  // ========================================

  describe('Retry Logic', () => {
    it('should retry on 500 error', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: createMockHeaders({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ error: 'Server error' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: createMockHeaders({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ success: true }),
        });

      const result = await webhookHandler.execute({
        url: 'https://api.example.com/data',
        method: 'GET',
        maxRetries: 1,
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 503 error', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          headers: createMockHeaders({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ error: 'Unavailable' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: createMockHeaders({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ success: true }),
        });

      const result = await webhookHandler.execute({
        url: 'https://api.example.com/data',
        method: 'GET',
        maxRetries: 1,
      });

      expect(result.success).toBe(true);
    });

    it('should not retry on 400 error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: createMockHeaders({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ error: 'Bad request' }),
      });

      const result = await webhookHandler.execute({
        url: 'https://api.example.com/data',
        method: 'GET',
        maxRetries: 2,
      });

      expect(result.success).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should include retry count in response', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          headers: createMockHeaders({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ error: 'Error' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: createMockHeaders({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ success: true }),
        });

      const result = await webhookHandler.execute({
        url: 'https://api.example.com/data',
        method: 'GET',
        maxRetries: 2,
      });

      expect(result.response?.retryCount).toBe(1);
    });
  });

  // ========================================
  // URL VALIDATION TESTS
  // ========================================

  describe('URL Validation', () => {
    it('should reject invalid URL', async () => {
      const result = await webhookHandler.execute({
        url: 'not-a-valid-url',
        method: 'GET',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL');
    });

    it('should allow localhost in development', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      });

      const handler = new WebhookHandler({ allowLocalhost: true });
      const result = await handler.execute({
        url: 'http://localhost:3000/api',
        method: 'GET',
      });

      expect(result.success).toBe(true);
    });

    it('should reject localhost in production', async () => {
      const handler = new WebhookHandler({ allowLocalhost: false });
      const result = await handler.execute({
        url: 'http://localhost:3000/api',
        method: 'GET',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Localhost');
    });
  });

  // ========================================
  // RATE LIMITER TESTS
  // ========================================

  describe('Rate Limiter', () => {
    it('should get rate limiter stats', () => {
      const stats = webhookHandler.getRateLimiterStats();
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('windowStart');
      expect(stats).toHaveProperty('isLimitExceeded');
    });

    it('should reset rate limiter', () => {
      webhookHandler.resetRateLimiter();
      const stats = webhookHandler.getRateLimiterStats();
      expect(stats.totalRequests).toBe(0);
    });
  });

  // ========================================
  // SINGLETON TESTS
  // ========================================

  describe('Singleton & Factory', () => {
    it('should return singleton instance', () => {
      const handler1 = getWebhookHandler();
      const handler2 = getWebhookHandler();
      expect(handler1).toBe(handler2);
    });

    it('should create new instance with factory', () => {
      const handler1 = createWebhookHandler();
      const handler2 = createWebhookHandler();
      expect(handler1).not.toBe(handler2);
    });

    it('should execute webhook with helper function', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ success: true }),
      });

      const result = await executeWebhook({
        url: 'https://api.example.com/data',
        method: 'GET',
      });

      expect(result.success).toBe(true);
    });
  });
});

// ========================================
// WEBHOOK UTILS TESTS
// ========================================

describe('WebhookUtils', () => {
  // ========================================
  // VARIABLE INTERPOLATION
  // ========================================

  describe('interpolateVariables', () => {
    it('should interpolate simple variables', () => {
      const result = interpolateVariables('Hello {{name}}!', { name: 'World' });
      expect(result).toBe('Hello World!');
    });

    it('should interpolate nested variables', () => {
      const result = interpolateVariables('User: {{user.name}}', {
        user: { name: 'John' },
      });
      expect(result).toBe('User: John');
    });

    it('should handle missing variables', () => {
      const result = interpolateVariables('Hello {{missing}}!', {});
      expect(result).toBe('Hello {{missing}}!');
    });

    it('should handle null/undefined input', () => {
      expect(interpolateVariables(null as any, {})).toBe(null);
      expect(interpolateVariables(undefined as any, {})).toBe(undefined);
    });

    it('should stringify objects', () => {
      const result = interpolateVariables('Data: {{obj}}', {
        obj: { a: 1, b: 2 },
      });
      expect(result).toBe('Data: {"a":1,"b":2}');
    });
  });

  describe('interpolateObjectVariables', () => {
    it('should interpolate object values', () => {
      const result = interpolateObjectVariables(
        { name: '{{userName}}', email: '{{userEmail}}' },
        { userName: 'John', userEmail: 'john@test.com' }
      );
      expect(result).toEqual({ name: 'John', email: 'john@test.com' });
    });

    it('should handle nested objects', () => {
      const result = interpolateObjectVariables(
        { user: { name: '{{name}}' } },
        { name: 'John' }
      );
      expect(result).toEqual({ user: { name: 'John' } });
    });

    it('should handle arrays', () => {
      const result = interpolateObjectVariables(
        { items: ['{{item1}}', '{{item2}}'] },
        { item1: 'a', item2: 'b' }
      );
      expect(result).toEqual({ items: ['a', 'b'] });
    });
  });

  describe('getNestedValue', () => {
    const obj = {
      user: {
        name: 'John',
        emails: ['john@a.com', 'john@b.com'],
      },
    };

    it('should get nested value', () => {
      expect(getNestedValue(obj, 'user.name')).toBe('John');
    });

    it('should handle array index', () => {
      expect(getNestedValue(obj, 'user.emails[0]')).toBe('john@a.com');
    });

    it('should return undefined for missing path', () => {
      expect(getNestedValue(obj, 'user.missing')).toBeUndefined();
    });

    it('should handle null/undefined', () => {
      expect(getNestedValue(null as any, 'path')).toBeUndefined();
      expect(getNestedValue({}, '')).toBeUndefined();
    });
  });

  describe('setNestedValue', () => {
    it('should set nested value', () => {
      const obj: any = {};
      setNestedValue(obj, 'user.name', 'John');
      expect(obj.user.name).toBe('John');
    });

    it('should create intermediate objects', () => {
      const obj: any = {};
      setNestedValue(obj, 'a.b.c', 'value');
      expect(obj.a.b.c).toBe('value');
    });
  });

  // ========================================
  // AUTHENTICATION
  // ========================================

  describe('buildAuthHeader', () => {
    it('should return null for no auth', () => {
      expect(buildAuthHeader(null)).toBeNull();
      expect(buildAuthHeader({ type: 'none' })).toBeNull();
    });

    it('should build bearer auth header', () => {
      const headers = buildAuthHeader({ type: 'bearer', token: 'my-token' });
      expect(headers).toEqual({ Authorization: 'Bearer my-token' });
    });

    it('should build basic auth header', () => {
      const headers = buildAuthHeader({
        type: 'basic',
        username: 'user',
        password: 'pass',
      });
      expect(headers?.Authorization).toMatch(/^Basic /);
    });

    it('should build API key header', () => {
      const headers = buildAuthHeader({
        type: 'apiKey',
        apiKeyName: 'X-API-Key',
        apiKeyValue: 'key123',
        apiKeyLocation: 'header',
      });
      expect(headers).toEqual({ 'X-API-Key': 'key123' });
    });
  });

  describe('buildUrlWithApiKey', () => {
    it('should add API key to URL', () => {
      const url = buildUrlWithApiKey('https://api.example.com/data', {
        type: 'apiKey',
        apiKeyName: 'key',
        apiKeyValue: 'value',
        apiKeyLocation: 'query',
      });
      expect(url).toBe('https://api.example.com/data?key=value');
    });

    it('should append to existing query', () => {
      const url = buildUrlWithApiKey('https://api.example.com/data?existing=1', {
        type: 'apiKey',
        apiKeyName: 'key',
        apiKeyValue: 'value',
        apiKeyLocation: 'query',
      });
      expect(url).toBe('https://api.example.com/data?existing=1&key=value');
    });

    it('should return original URL for header location', () => {
      const url = buildUrlWithApiKey('https://api.example.com/data', {
        type: 'apiKey',
        apiKeyName: 'key',
        apiKeyValue: 'value',
        apiKeyLocation: 'header',
      });
      expect(url).toBe('https://api.example.com/data');
    });
  });

  // ========================================
  // URL VALIDATION
  // ========================================

  describe('validateUrl', () => {
    it('should validate valid URLs', () => {
      expect(validateUrl('https://example.com').isValid).toBe(true);
      expect(validateUrl('http://example.com/path').isValid).toBe(true);
    });

    it('should reject empty URLs', () => {
      expect(validateUrl('').isValid).toBe(false);
      expect(validateUrl('   ').isValid).toBe(false);
    });

    it('should reject invalid protocols', () => {
      expect(validateUrl('ftp://example.com').isValid).toBe(false);
    });

    it('should reject localhost when not allowed', () => {
      expect(validateUrl('http://localhost:3000', { allowLocalhost: false }).isValid).toBe(false);
    });

    it('should allow localhost when allowed', () => {
      expect(validateUrl('http://localhost:3000', { allowLocalhost: true }).isValid).toBe(true);
    });

    it('should reject private IPs when localhost not allowed', () => {
      expect(validateUrl('http://192.168.1.1', { allowLocalhost: false }).isValid).toBe(false);
      expect(validateUrl('http://10.0.0.1', { allowLocalhost: false }).isValid).toBe(false);
    });
  });

  // ========================================
  // SANITIZATION
  // ========================================

  describe('sanitizeForJson', () => {
    it('should escape special characters', () => {
      const result = sanitizeForJson('Hello "World"\nNew line');
      // Note: Backslashes are escaped after quotes, so \" becomes \\\"
      expect(result).toBe('Hello \\\\"World\\\\"\\nNew line');
    });

    it('should remove null bytes', () => {
      const result = sanitizeForJson('Hello\0World');
      expect(result).toBe('HelloWorld');
    });

    it('should handle nested objects', () => {
      const result = sanitizeForJson({ name: 'Test "Name"' });
      // Backslashes from quote escaping are also escaped
      expect(result.name).toBe('Test \\\\"Name\\\\"');
    });

    it('should handle arrays', () => {
      const result = sanitizeForJson(['a\nb', 'c']);
      expect(result).toEqual(['a\\nb', 'c']);
    });
  });

  describe('sanitizeForUrl', () => {
    it('should encode special characters', () => {
      expect(sanitizeForUrl('hello world')).toBe('hello%20world');
      expect(sanitizeForUrl('a=b&c=d')).toBe('a%3Db%26c%3Dd');
    });
  });

  // ========================================
  // RESPONSE PARSING
  // ========================================

  describe('parseResponse', () => {
    it('should extract value at path', () => {
      const result = parseResponse(
        { data: { id: 123 } },
        { path: 'data.id', variableName: 'userId' }
      );
      expect(result.userId).toBe(123);
    });

    it('should handle multiple extractions', () => {
      const result = parseResponse(
        { user: { id: 1, name: 'John' } },
        {
          extractions: [
            { path: 'user.id', variableName: 'id' },
            { path: 'user.name', variableName: 'name' },
          ],
        }
      );
      expect(result).toEqual({ id: 1, name: 'John' });
    });

    it('should store full response', () => {
      const data = { users: [1, 2, 3] };
      const result = parseResponse(data, {
        storeFullResponse: true,
        fullResponseVariableName: 'response',
      });
      expect(result.response).toEqual(data);
    });

    it('should return empty object for null config', () => {
      expect(parseResponse({ data: 1 }, null)).toEqual({});
    });
  });

  // ========================================
  // RETRY UTILITIES
  // ========================================

  describe('isRetryableStatusCode', () => {
    it('should return true for retryable codes', () => {
      expect(isRetryableStatusCode(408)).toBe(true);
      expect(isRetryableStatusCode(429)).toBe(true);
      expect(isRetryableStatusCode(500)).toBe(true);
      expect(isRetryableStatusCode(502)).toBe(true);
      expect(isRetryableStatusCode(503)).toBe(true);
      expect(isRetryableStatusCode(504)).toBe(true);
    });

    it('should return false for non-retryable codes', () => {
      expect(isRetryableStatusCode(200)).toBe(false);
      expect(isRetryableStatusCode(400)).toBe(false);
      expect(isRetryableStatusCode(401)).toBe(false);
      expect(isRetryableStatusCode(404)).toBe(false);
    });
  });

  describe('calculateBackoff', () => {
    it('should calculate exponential backoff', () => {
      const delay0 = calculateBackoff(0, 1000);
      const delay1 = calculateBackoff(1, 1000);
      const delay2 = calculateBackoff(2, 1000);

      expect(delay0).toBeGreaterThanOrEqual(1000);
      expect(delay0).toBeLessThan(1200);
      expect(delay1).toBeGreaterThanOrEqual(2000);
      expect(delay2).toBeGreaterThanOrEqual(4000);
    });

    it('should cap at maxDelay', () => {
      const delay = calculateBackoff(10, 1000, 5000);
      expect(delay).toBeLessThanOrEqual(5000);
    });
  });

  // ========================================
  // RATE LIMITER
  // ========================================

  describe('RateLimiter', () => {
    it('should allow requests under limit', () => {
      const limiter = new RateLimiter(5, 60000);
      expect(limiter.tryAcquire()).toBe(true);
      expect(limiter.tryAcquire()).toBe(true);
    });

    it('should block requests over limit', () => {
      const limiter = new RateLimiter(2, 60000);
      limiter.tryAcquire();
      limiter.tryAcquire();
      expect(limiter.tryAcquire()).toBe(false);
    });

    it('should return wait time', () => {
      const limiter = new RateLimiter(1, 60000);
      limiter.tryAcquire();
      expect(limiter.getWaitTime()).toBeGreaterThan(0);
    });

    it('should reset limiter', () => {
      const limiter = new RateLimiter(1, 60000);
      limiter.tryAcquire();
      limiter.reset();
      expect(limiter.tryAcquire()).toBe(true);
    });

    it('should provide stats', () => {
      const limiter = new RateLimiter(5, 60000);
      limiter.tryAcquire();
      limiter.tryAcquire();

      const stats = limiter.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.isLimitExceeded).toBe(false);
    });
  });

  // ========================================
  // ERROR HANDLING
  // ========================================

  describe('WebhookError', () => {
    it('should create error with properties', () => {
      const error = new WebhookError('Test error', {
        statusCode: 500,
        isRetryable: true,
      });

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.isRetryable).toBe(true);
      expect(error.name).toBe('WebhookError');
    });
  });

  describe('getWebhookErrorMessage', () => {
    it('should return user-friendly message for status codes', () => {
      expect(getWebhookErrorMessage(new WebhookError('', { statusCode: 401 }))).toBe('Authentication failed');
      expect(getWebhookErrorMessage(new WebhookError('', { statusCode: 404 }))).toBe('The requested resource was not found');
      expect(getWebhookErrorMessage(new WebhookError('', { statusCode: 429 }))).toBe('Too many requests - please try again later');
      expect(getWebhookErrorMessage(new WebhookError('', { statusCode: 500 }))).toBe('Server error occurred');
    });

    it('should handle network errors', () => {
      const error = new Error('network error');
      expect(getWebhookErrorMessage(error)).toBe('Network error - please check your connection');
    });

    it('should handle abort errors', () => {
      const error = new Error('');
      error.name = 'AbortError';
      expect(getWebhookErrorMessage(error)).toBe('Request was cancelled or timed out');
    });
  });
});
