/**
 * AnthropicProvider Tests
 *
 * Comprehensive tests for the Anthropic Claude provider implementation.
 * Covers configuration, non-streaming responses, streaming responses,
 * error handling, and Anthropic-specific features.
 */

import { AnthropicProvider } from '../../../src/services/ai/providers/AnthropicProvider';
import { AIErrorCode } from '../../../src/services/ai/types';
import type { AIConfig, AIMessage, AIStreamCallback } from '../../../src/services/ai/types';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;

  const defaultConfig: AIConfig = {
    apiKey: 'sk-ant-test-key-12345',
    model: 'claude-3-sonnet-20240229',
    temperature: 0.7,
    maxTokens: 1000,
  };

  const sampleContext: AIMessage[] = [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there! How can I help you?' },
  ];

  beforeEach(() => {
    provider = new AnthropicProvider();
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
      expect(provider.name).toBe('anthropic');
    });

    it('should have correct display name', () => {
      expect(provider.displayName).toBe('Anthropic Claude');
    });

    it('should have correct default model', () => {
      expect(provider.defaultModel).toBe('claude-3-sonnet-20240229');
    });

    it('should support multiple Claude models', () => {
      expect(provider.supportedModels).toContain('claude-3-opus-20240229');
      expect(provider.supportedModels).toContain('claude-3-sonnet-20240229');
      expect(provider.supportedModels).toContain('claude-3-haiku-20240307');
      expect(provider.supportedModels).toContain('claude-3-5-sonnet-20240620');
      expect(provider.supportedModels).toContain('claude-2.1');
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
      expect(provider.isConfigured({ model: 'claude-3-sonnet-20240229' })).toBe(false);
    });

    it('should return false when API key is empty', () => {
      expect(provider.isConfigured({ apiKey: '', model: 'claude-3-sonnet-20240229' })).toBe(false);
    });
  });

  // ========================================
  // NON-STREAMING RESPONSE TESTS
  // ========================================

  describe('Non-Streaming Response', () => {
    const mockSuccessResponse = {
      id: 'msg_01XFDUDYJgAACzvnptvVoYEL',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Hello! How can I assist you today?',
        },
      ],
      model: 'claude-3-sonnet-20240229',
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 10,
        output_tokens: 15,
      },
    };

    it('should generate response successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      const response = await provider.generateResponse('Hello', sampleContext, defaultConfig);

      expect(response.content).toBe('Hello! How can I assist you today?');
      expect(response.tokensUsed).toBe(25);
      expect(response.model).toBe('claude-3-sonnet-20240229');
      expect(response.provider).toBe('anthropic');
      expect(response.finishReason).toBe('end_turn');
      expect(response.inputTokens).toBe(10);
      expect(response.outputTokens).toBe(15);
    });

    it('should send correct request headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      await provider.generateResponse('Hello', [], defaultConfig);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-api-key': 'sk-ant-test-key-12345',
            'anthropic-version': '2023-06-01',
          }),
        })
      );
    });

    it('should send correct request body format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      await provider.generateResponse('Hello', sampleContext, defaultConfig);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.model).toBe('claude-3-sonnet-20240229');
      expect(body.max_tokens).toBe(1000);
      expect(body.stream).toBe(false);
      expect(body.messages).toHaveLength(3); // 2 context + 1 prompt
      expect(body.messages[body.messages.length - 1]).toEqual({
        role: 'user',
        content: 'Hello',
      });
    });

    it('should handle system prompt separately', async () => {
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

      expect(body.system).toBe('You are a pirate.');
      // System should not be in messages
      expect(body.messages.every((m: any) => m.role !== 'system')).toBe(true);
    });

    it('should extract system from context messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      const contextWithSystem: AIMessage[] = [
        { role: 'system', content: 'System prompt from context' },
        { role: 'user', content: 'Hello' },
      ];

      await provider.generateResponse('Hi', contextWithSystem, defaultConfig);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.system).toBe('System prompt from context');
      expect(body.messages.every((m: any) => m.role !== 'system')).toBe(true);
    });

    it('should use custom endpoint when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      await provider.generateResponse('Hello', [], {
        ...defaultConfig,
        customEndpoint: 'https://custom.anthropic.com/v1/messages',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.anthropic.com/v1/messages',
        expect.anything()
      );
    });

    it('should not include temperature when default', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      await provider.generateResponse('Hello', [], {
        ...defaultConfig,
        temperature: 0.7, // Default value
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      // Anthropic implementation only includes temperature if not default
      expect(body.temperature).toBeUndefined();
    });

    it('should include temperature when non-default', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      await provider.generateResponse('Hello', [], {
        ...defaultConfig,
        temperature: 0.5,
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.temperature).toBe(0.5);
    });

    it('should include top_p when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      await provider.generateResponse('Hello', [], {
        ...defaultConfig,
        topP: 0.9,
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.top_p).toBe(0.9);
    });

    it('should throw error when not configured', async () => {
      await expect(
        provider.generateResponse('Hello', [], { model: 'claude-3-sonnet-20240229' })
      ).rejects.toMatchObject({
        code: AIErrorCode.NOT_CONFIGURED,
        isRetryable: false,
      });
    });

    it('should handle empty content array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockSuccessResponse, content: [] }),
      });

      await expect(
        provider.generateResponse('Hello', [], defaultConfig)
      ).rejects.toMatchObject({
        code: AIErrorCode.SERVER_ERROR,
      });
    });

    it('should concatenate multiple text blocks', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          ...mockSuccessResponse,
          content: [
            { type: 'text', text: 'Hello ' },
            { type: 'text', text: 'world!' },
          ],
        }),
      });

      const response = await provider.generateResponse('Hello', [], defaultConfig);
      expect(response.content).toBe('Hello world!');
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

    it('should handle 529 overloaded error (Anthropic-specific)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 529,
        statusText: 'Overloaded',
        headers: createMockHeaders(),
        json: () => Promise.resolve({
          error: { message: 'API is overloaded' },
        }),
      });

      await expect(
        provider.generateResponse('Hello', [], defaultConfig)
      ).rejects.toMatchObject({
        code: AIErrorCode.RATE_LIMITED,
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

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network request failed'));

      await expect(
        provider.generateResponse('Hello', [], defaultConfig)
      ).rejects.toMatchObject({
        code: AIErrorCode.NETWORK_ERROR,
        isRetryable: true,
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
          getReader: () => createMockStreamReader(['data: {"type":"message_stop"}\n\n']),
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
        { model: 'claude-3-sonnet-20240229' },
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
      const chunks = ['data: {"type":"message_stop"}\n\n'];
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
          content: [{ type: 'text', text: 'response' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 5, output_tokens: 5 },
        }),
      });

      await provider.generateResponse('Hello', [], {
        ...defaultConfig,
        model: 'claude-3-opus-20240229',
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.model).toBe('claude-3-opus-20240229');
    });

    it('should use default model when not specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          content: [{ type: 'text', text: 'response' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 5, output_tokens: 5 },
        }),
      });

      await provider.generateResponse('Hello', [], {
        apiKey: 'test-key',
        model: '',
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.model).toBe('claude-3-sonnet-20240229');
    });
  });
});
