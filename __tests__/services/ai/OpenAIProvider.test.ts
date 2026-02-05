/**
 * OpenAIProvider Tests
 *
 * Comprehensive tests for the OpenAI GPT provider implementation.
 * Covers configuration, non-streaming responses, streaming responses,
 * error handling, and request building.
 */

import { OpenAIProvider } from '../../../src/services/ai/providers/OpenAIProvider';
import { AIErrorCode } from '../../../src/services/ai/types';
import type { AIConfig, AIMessage, AIStreamCallback } from '../../../src/services/ai/types';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;

  const defaultConfig: AIConfig = {
    apiKey: 'test-api-key-12345',
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 1000,
  };

  const sampleContext: AIMessage[] = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there! How can I help you?' },
  ];

  beforeEach(() => {
    provider = new OpenAIProvider();
    mockFetch.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // PROVIDER PROPERTIES TESTS
  // ========================================

  describe('Provider Properties', () => {
    it('should have correct name', () => {
      expect(provider.name).toBe('openai');
    });

    it('should have correct display name', () => {
      expect(provider.displayName).toBe('OpenAI');
    });

    it('should have correct default model', () => {
      expect(provider.defaultModel).toBe('gpt-3.5-turbo');
    });

    it('should support multiple models', () => {
      expect(provider.supportedModels).toContain('gpt-3.5-turbo');
      expect(provider.supportedModels).toContain('gpt-4');
      expect(provider.supportedModels).toContain('gpt-4-turbo');
      expect(provider.supportedModels).toContain('gpt-4o');
    });

    it('should support streaming', () => {
      expect(provider.supportsStreaming).toBe(true);
    });
  });

  // ========================================
  // CONFIGURATION TESTS
  // ========================================

  describe('Configuration', () => {
    it('should return true when API key is configured', () => {
      expect(provider.isConfigured(defaultConfig)).toBe(true);
    });

    it('should return false when API key is missing', () => {
      expect(provider.isConfigured({ model: 'gpt-4' })).toBe(false);
    });

    it('should return false when API key is empty', () => {
      expect(provider.isConfigured({ apiKey: '', model: 'gpt-4' })).toBe(false);
    });
  });

  // ========================================
  // NON-STREAMING RESPONSE TESTS
  // ========================================

  describe('Non-Streaming Response', () => {
    const mockSuccessResponse = {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: 1677652288,
      model: 'gpt-3.5-turbo-0613',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello! How can I assist you today?',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 9,
        completion_tokens: 12,
        total_tokens: 21,
      },
    };

    it('should generate response successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      const response = await provider.generateResponse('Hello', sampleContext, defaultConfig);

      expect(response.content).toBe('Hello! How can I assist you today?');
      expect(response.tokensUsed).toBe(21);
      expect(response.model).toBe('gpt-3.5-turbo');
      expect(response.provider).toBe('openai');
      expect(response.finishReason).toBe('stop');
    });

    it('should send correct request headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      await provider.generateResponse('Hello', [], defaultConfig);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key-12345',
          }),
        })
      );
    });

    it('should send correct request body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      await provider.generateResponse('Hello', sampleContext, defaultConfig);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.model).toBe('gpt-3.5-turbo');
      expect(body.temperature).toBe(0.7);
      expect(body.max_tokens).toBe(1000);
      expect(body.stream).toBe(false);
      expect(body.messages).toHaveLength(4); // 3 context + 1 prompt
      expect(body.messages[body.messages.length - 1].content).toBe('Hello');
    });

    it('should use custom endpoint when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      await provider.generateResponse('Hello', [], {
        ...defaultConfig,
        customEndpoint: 'https://custom.openai.com/v1/chat/completions',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.openai.com/v1/chat/completions',
        expect.anything()
      );
    });

    it('should use default model when not specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      await provider.generateResponse('Hello', [], {
        apiKey: 'test-key',
        model: '',
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.model).toBe('gpt-3.5-turbo');
    });

    it('should include optional parameters when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      await provider.generateResponse('Hello', [], {
        ...defaultConfig,
        topP: 0.9,
        frequencyPenalty: 0.5,
        presencePenalty: 0.5,
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.top_p).toBe(0.9);
      expect(body.frequency_penalty).toBe(0.5);
      expect(body.presence_penalty).toBe(0.5);
    });

    it('should include system prompt as first message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      await provider.generateResponse('Hello', [], {
        ...defaultConfig,
        systemPrompt: 'You are a pirate.',
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.messages[0]).toEqual({
        role: 'system',
        content: 'You are a pirate.',
      });
    });

    it('should throw error when not configured', async () => {
      await expect(
        provider.generateResponse('Hello', [], { model: 'gpt-4' })
      ).rejects.toMatchObject({
        code: AIErrorCode.NOT_CONFIGURED,
        isRetryable: false,
      });
    });

    it('should handle empty response choices', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockSuccessResponse, choices: [] }),
      });

      await expect(
        provider.generateResponse('Hello', [], defaultConfig)
      ).rejects.toMatchObject({
        code: AIErrorCode.SERVER_ERROR,
      });
    });
  });

  // ========================================
  // ERROR HANDLING TESTS
  // ========================================

  describe('Error Handling', () => {
    const createMockHeaders = (headers: Record<string, string> = {}) => ({
      get: (name: string) => headers[name.toLowerCase()] || null,
    });

    it('should handle 401 unauthorized error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: createMockHeaders(),
        json: () => Promise.resolve({
          error: { message: 'Invalid API key' },
        }),
      });

      await expect(
        provider.generateResponse('Hello', [], defaultConfig)
      ).rejects.toMatchObject({
        code: AIErrorCode.INVALID_API_KEY,
        isRetryable: false,
      });
    });

    it('should handle 429 rate limit error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: createMockHeaders({ 'retry-after': '60' }),
        json: () => Promise.resolve({
          error: { message: 'Rate limit exceeded' },
        }),
      });

      await expect(
        provider.generateResponse('Hello', [], defaultConfig)
      ).rejects.toMatchObject({
        code: AIErrorCode.RATE_LIMITED,
        isRateLimited: true,
        isRetryable: true,
      });
    });

    it('should handle 500 server error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: createMockHeaders(),
        json: () => Promise.resolve({
          error: { message: 'Server error' },
        }),
      });

      await expect(
        provider.generateResponse('Hello', [], defaultConfig)
      ).rejects.toMatchObject({
        code: AIErrorCode.SERVER_ERROR,
        isRetryable: true,
      });
    });

    it('should handle 400 bad request error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: createMockHeaders(),
        json: () => Promise.resolve({
          error: { message: 'Invalid model' },
        }),
      });

      await expect(
        provider.generateResponse('Hello', [], defaultConfig)
      ).rejects.toMatchObject({
        code: AIErrorCode.INVALID_REQUEST,
      });
    });

    it('should handle network errors', async () => {
      const error = new Error('network request failed');
      mockFetch.mockRejectedValueOnce(error);

      await expect(
        provider.generateResponse('Hello', [], defaultConfig)
      ).rejects.toMatchObject({
        code: AIErrorCode.NETWORK_ERROR,
        isRetryable: true,
      });
    });

    it('should handle timeout errors', async () => {
      const error = new Error('Request timeout');
      error.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(error);

      await expect(
        provider.generateResponse('Hello', [], defaultConfig)
      ).rejects.toMatchObject({
        code: AIErrorCode.STREAM_INTERRUPTED,
        isRetryable: false,
      });
    });
  });

  // ========================================
  // STREAMING RESPONSE TESTS
  // ========================================

  describe('Streaming Response', () => {
    const createMockStreamReader = (chunks: string[]) => {
      let index = 0;
      return {
        read: jest.fn().mockImplementation(() => {
          if (index >= chunks.length) {
            return Promise.resolve({ done: true, value: undefined });
          }
          const encoder = new TextEncoder();
          const value = encoder.encode(chunks[index]);
          index++;
          return Promise.resolve({ done: false, value });
        }),
        cancel: jest.fn().mockResolvedValue(undefined),
      };
    };

    let streamCallback: AIStreamCallback;

    beforeEach(() => {
      streamCallback = {
        onToken: jest.fn(),
        onComplete: jest.fn(),
        onError: jest.fn(),
        onStart: jest.fn(),
        onStop: jest.fn(),
      };
    });

    it('should return stream controller', () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => createMockStreamReader(['data: [DONE]\n\n']),
        },
      });

      const controller = provider.generateResponseStreaming(
        'Hello',
        [],
        defaultConfig,
        streamCallback
      );

      expect(controller).toBeDefined();
      expect(typeof controller.abort).toBe('function');
      expect(typeof controller.isActive).toBe('function');
      expect(typeof controller.getState).toBe('function');
      expect(typeof controller.getContent).toBe('function');
    });

    it('should not start streaming when not configured', () => {
      const controller = provider.generateResponseStreaming(
        'Hello',
        [],
        { model: 'gpt-4' }, // No API key
        streamCallback
      );

      expect(streamCallback.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: AIErrorCode.NOT_CONFIGURED,
        })
      );
      expect(controller.getState()).toBe('ERROR');
    });

    it('should call onStart when connection begins', async () => {
      const chunks = ['data: [DONE]\n\n'];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => createMockStreamReader(chunks),
        },
      });

      provider.generateResponseStreaming('Hello', [], defaultConfig, streamCallback);

      // Use real timers for this test
      jest.useRealTimers();
      await new Promise((r) => setTimeout(r, 50));
      jest.useFakeTimers();

      expect(streamCallback.onStart).toHaveBeenCalled();
    });

    it('should handle stream abort before fetch completes', () => {
      // Create a fetch that never resolves
      mockFetch.mockImplementation(() => new Promise(() => {}));

      const controller = provider.generateResponseStreaming(
        'Hello',
        [],
        defaultConfig,
        streamCallback
      );

      controller.abort();

      expect(controller.getState()).toBe('STOPPED');
    });

    it('should call onError for failed response', async () => {
      const createMockHeaders = (headers: Record<string, string> = {}) => ({
        get: (name: string) => headers[name.toLowerCase()] || null,
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: createMockHeaders(),
        json: () => Promise.resolve({ error: { message: 'Invalid key' } }),
      });

      provider.generateResponseStreaming('Hello', [], defaultConfig, streamCallback);

      jest.useRealTimers();
      await new Promise((r) => setTimeout(r, 50));
      jest.useFakeTimers();

      expect(streamCallback.onError).toHaveBeenCalled();
    });

    it('should call onError for missing response body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: null,
      });

      provider.generateResponseStreaming('Hello', [], defaultConfig, streamCallback);

      jest.useRealTimers();
      await new Promise((r) => setTimeout(r, 50));
      jest.useFakeTimers();

      expect(streamCallback.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: AIErrorCode.SERVER_ERROR,
        })
      );
    });

    it('should build correct streaming request body', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {}));

      provider.generateResponseStreaming('Hello', [], defaultConfig, streamCallback);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
        })
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.stream).toBe(true);
      expect(body.stream_options).toEqual({ include_usage: true });
    });
  });

  // ========================================
  // MODEL VALIDATION TESTS
  // ========================================

  describe('Model Validation', () => {
    it('should accept supported models', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'response' }, finish_reason: 'stop' }],
          usage: { total_tokens: 10 },
        }),
      });

      await provider.generateResponse('Hello', [], {
        ...defaultConfig,
        model: 'gpt-4o',
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.model).toBe('gpt-4o');
    });

    it('should warn but allow unsupported models', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'response' }, finish_reason: 'stop' }],
          usage: { total_tokens: 10 },
        }),
      });

      await provider.generateResponse('Hello', [], {
        ...defaultConfig,
        model: 'custom-model',
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.model).toBe('custom-model');
    });
  });
});
