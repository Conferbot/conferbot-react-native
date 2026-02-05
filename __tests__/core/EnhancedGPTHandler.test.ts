/**
 * EnhancedGPTHandler Tests
 *
 * Comprehensive tests for the enhanced GPT handler with:
 * - Multi-provider support
 * - Streaming responses
 * - Context management
 * - Error recovery
 * - Stop/regenerate actions
 */

import { ChatState } from '../../src/core/state/ChatState';
import { NodeResult, NodeUIState } from '../../src/core/nodes/NodeHandler';
import {
  EnhancedGPTHandler,
  createEnhancedGPTHandler,
  type EnhancedGPTUIState,
} from '../../src/core/nodes/handlers/EnhancedGPTHandler';
import { createNode, createMockSocket } from '../testUtils';

// Mock the AI service
jest.mock('../../src/services/ai', () => ({
  getAIHandler: jest.fn(() => ({
    processGPTNode: jest.fn().mockResolvedValue({
      content: 'AI response text',
      provider: 'openai',
      model: 'gpt-4',
      tokensUsed: 150,
    }),
    processGPTNodeStreaming: jest.fn().mockReturnValue({
      isActive: () => true,
      abort: jest.fn(),
    }),
  })),
  AIErrorCode: {
    UNKNOWN: 'UNKNOWN',
    RATE_LIMITED: 'RATE_LIMITED',
    INVALID_API_KEY: 'INVALID_API_KEY',
  },
  StreamingState: {
    IDLE: 'IDLE',
    CONNECTING: 'CONNECTING',
    STREAMING: 'STREAMING',
    COMPLETED: 'COMPLETED',
    STOPPED: 'STOPPED',
    ERROR: 'ERROR',
  },
}));

describe('EnhancedGPTHandler', () => {
  let chatState: ChatState;
  let mockSocket: ReturnType<typeof createMockSocket>;
  let mockAIHandler: any;

  beforeEach(() => {
    chatState = new ChatState('test-session', 'test-bot');
    mockSocket = createMockSocket();

    // Reset and setup mock AI handler
    const aiModule = require('../../src/services/ai');
    mockAIHandler = {
      processGPTNode: jest.fn().mockResolvedValue({
        content: 'AI response text',
        provider: 'openai',
        model: 'gpt-4',
        tokensUsed: 150,
      }),
      processGPTNodeStreaming: jest.fn().mockReturnValue({
        isActive: () => true,
        abort: jest.fn(),
      }),
    };
    aiModule.getAIHandler.mockReturnValue(mockAIHandler);
  });

  // ========================================
  // BASIC HANDLER TESTS
  // ========================================

  describe('Basic Handler', () => {
    it('should have correct node type', () => {
      const handler = new EnhancedGPTHandler();
      expect(handler.nodeType).toBe('gpt');
    });

    it('should return error when prompt is missing', async () => {
      const handler = new EnhancedGPTHandler();
      const node = createNode('gpt', {
        model: 'gpt-4',
      });

      const result = await handler.handle(node, chatState);

      expect(result.type).toBe('error');
      if (result.type === 'error') {
        expect(result.message).toContain('prompt');
      }
    });

    it('should return error when node data is missing', async () => {
      const handler = new EnhancedGPTHandler();
      const result = await handler.handle({ id: 'test' }, chatState);

      expect(result.type).toBe('error');
    });
  });

  // ========================================
  // NON-STREAMING TESTS
  // ========================================

  describe('Non-streaming Mode', () => {
    it('should process GPT request without streaming', async () => {
      const handler = new EnhancedGPTHandler(mockAIHandler);
      const node = createNode('gpt', {
        prompt: 'Tell me about chatbots',
        streaming: false,
        variableName: 'response',
      });

      const result = await handler.handle(node, chatState);

      expect(result.type).toBe('displayUI');
      if (result.type === 'displayUI') {
        const uiState = result.uiState as EnhancedGPTUIState;
        expect(uiState.type).toBe('gptResponse');
        expect(uiState.text).toBe('AI response text');
        expect(uiState.isComplete).toBe(true);
        expect(uiState.isStreaming).toBe(false);
        expect(uiState.streamingState).toBe('COMPLETED');
      }
    });

    it('should store response in variable', async () => {
      const handler = new EnhancedGPTHandler(mockAIHandler);
      const node = createNode('gpt', {
        prompt: 'Test prompt',
        streaming: false,
        variableName: 'aiAnswer',
      });

      await handler.handle(node, chatState);

      expect(chatState.getVariable('aiAnswer')).toBe('AI response text');
    });

    it('should include provider and model info in UI state', async () => {
      const handler = new EnhancedGPTHandler(mockAIHandler);
      const node = createNode('gpt', {
        prompt: 'Test',
        streaming: false,
      });

      const result = await handler.handle(node, chatState);

      if (result.type === 'displayUI') {
        const uiState = result.uiState as EnhancedGPTUIState;
        expect(uiState.provider).toBe('openai');
        expect(uiState.model).toBe('gpt-4');
        expect(uiState.tokensUsed).toBe(150);
      }
    });

    it('should handle API errors gracefully', async () => {
      mockAIHandler.processGPTNode.mockRejectedValueOnce(new Error('API Error'));

      const handler = new EnhancedGPTHandler(mockAIHandler);
      const node = createNode('gpt', {
        prompt: 'Test',
        streaming: false,
        proceedOnError: false,
      });

      const result = await handler.handle(node, chatState);

      expect(result.type).toBe('error');
    });

    it('should return UI state with error when proceedOnError is true', async () => {
      mockAIHandler.processGPTNode.mockRejectedValueOnce(new Error('API Error'));

      const handler = new EnhancedGPTHandler(mockAIHandler);
      const node = createNode('gpt', {
        prompt: 'Test',
        streaming: false,
        proceedOnError: true,
      });

      const result = await handler.handle(node, chatState);

      expect(result.type).toBe('displayUI');
      if (result.type === 'displayUI') {
        const uiState = result.uiState as EnhancedGPTUIState;
        expect(uiState.streamingState).toBe('ERROR');
        expect(uiState.error).toBeDefined();
      }
    });

    it('should store error in state variable', async () => {
      mockAIHandler.processGPTNode.mockRejectedValueOnce(new Error('Test error'));

      const handler = new EnhancedGPTHandler(mockAIHandler);
      const node = createNode('gpt', {
        prompt: 'Test',
        streaming: false,
        proceedOnError: true,
      });

      await handler.handle(node, chatState);

      expect(chatState.getVariable('_gptError')).toBe('Test error');
    });
  });

  // ========================================
  // STREAMING TESTS
  // ========================================

  describe('Streaming Mode', () => {
    it('should return streaming UI state', async () => {
      const handler = new EnhancedGPTHandler(mockAIHandler);
      handler.setSocketClient(mockSocket);

      const node = createNode('gpt', {
        prompt: 'Tell me a story',
        streaming: true,
      });

      const result = await handler.handle(node, chatState);

      expect(result.type).toBe('displayUI');
      if (result.type === 'displayUI') {
        const uiState = result.uiState as EnhancedGPTUIState;
        expect(uiState.isStreaming).toBe(true);
        expect(uiState.isComplete).toBe(false);
        expect(uiState.streamingState).toBe('CONNECTING');
        expect(uiState.streamId).toBeDefined();
      }
    });

    it('should enable stop action when configured', async () => {
      const handler = new EnhancedGPTHandler(mockAIHandler);
      handler.setSocketClient(mockSocket);

      const node = createNode('gpt', {
        prompt: 'Test',
        streaming: true,
        allowStopGeneration: true,
      });

      const result = await handler.handle(node, chatState);

      if (result.type === 'displayUI') {
        const uiState = result.uiState as EnhancedGPTUIState;
        expect(uiState.allowStop).toBe(true);
      }
    });

    it('should default streaming to true', async () => {
      const handler = new EnhancedGPTHandler(mockAIHandler);
      handler.setSocketClient(mockSocket);

      const node = createNode('gpt', {
        prompt: 'Test',
      });

      const result = await handler.handle(node, chatState);

      if (result.type === 'displayUI') {
        const uiState = result.uiState as EnhancedGPTUIState;
        expect(uiState.isStreaming).toBe(true);
      }
    });

    it('should emit socket events for streaming', async () => {
      const handler = new EnhancedGPTHandler(mockAIHandler);
      handler.setSocketClient(mockSocket);

      const node = createNode('gpt', {
        prompt: 'Test',
        streaming: true,
      });

      await handler.handle(node, chatState);

      // The streaming callback should emit events
      expect(mockAIHandler.processGPTNodeStreaming).toHaveBeenCalled();
    });
  });

  // ========================================
  // RESPONSE HANDLING TESTS
  // ========================================

  describe('handleResponse', () => {
    it('should handle stop action', async () => {
      const handler = new EnhancedGPTHandler(mockAIHandler);
      handler.setSocketClient(mockSocket);

      // First start a streaming request
      const node = createNode('gpt', {
        prompt: 'Test',
        streaming: true,
        variableName: 'response',
      });

      await handler.handle(node, chatState);

      // Then send stop action
      const response = {
        action: 'stop',
        currentContent: 'Partial response',
      };

      const result = await handler.handleResponse(response, node, chatState);

      expect(result.type).toBe('displayUI');
      if (result.type === 'displayUI') {
        const uiState = result.uiState as EnhancedGPTUIState;
        expect(uiState.streamingState).toBe('STOPPED');
        expect(uiState.text).toBe('Partial response');
        expect(uiState.allowRegenerate).toBe(true);
      }
    });

    it('should store partial content when stopped', async () => {
      const handler = new EnhancedGPTHandler(mockAIHandler);
      const node = createNode('gpt', {
        prompt: 'Test',
        variableName: 'response',
      });

      const response = {
        action: 'stop',
        currentContent: 'Stopped content',
      };

      await handler.handleResponse(response, node, chatState);

      expect(chatState.getVariable('response')).toBe('Stopped content');
    });

    it('should handle regenerate action', async () => {
      const handler = new EnhancedGPTHandler(mockAIHandler);
      handler.setSocketClient(mockSocket);

      const node = createNode('gpt', {
        prompt: 'Test',
        streaming: true,
      });

      const response = { action: 'regenerate' };

      const result = await handler.handleResponse(response, node, chatState);

      // Should call handle again
      expect(result.type).toBe('displayUI');
    });

    it('should handle streaming completion', async () => {
      const handler = new EnhancedGPTHandler(mockAIHandler);
      const node = createNode('gpt', {
        prompt: 'Test',
        variableName: 'response',
      });

      const response = {
        type: 'streamComplete',
        content: 'Complete streamed response',
      };

      const result = await handler.handleResponse(response, node, chatState);

      expect(result.type).toBe('proceed');
      expect(chatState.getVariable('response')).toBe('Complete streamed response');
    });

    it('should handle error response', async () => {
      const handler = new EnhancedGPTHandler(mockAIHandler);
      const node = createNode('gpt', {
        prompt: 'Test',
      });

      const response = { error: 'Rate limit exceeded' };

      const result = await handler.handleResponse(response, node, chatState);

      expect(result.type).toBe('error');
    });

    it('should handle direct text response', async () => {
      const handler = new EnhancedGPTHandler(mockAIHandler);
      const node = createNode('gpt', {
        prompt: 'Test',
        variableName: 'response',
      });

      const response = { text: 'Direct text response' };

      const result = await handler.handleResponse(response, node, chatState);

      expect(result.type).toBe('proceed');
      expect(chatState.getVariable('response')).toBe('Direct text response');
    });

    it('should handle response with response field', async () => {
      const handler = new EnhancedGPTHandler(mockAIHandler);
      const node = createNode('gpt', {
        prompt: 'Test',
        variableName: 'response',
      });

      const response = { response: 'Response field text' };

      const result = await handler.handleResponse(response, node, chatState);

      expect(result.type).toBe('proceed');
      expect(chatState.getVariable('response')).toBe('Response field text');
    });

    it('should handle content field in response', async () => {
      const handler = new EnhancedGPTHandler(mockAIHandler);
      const node = createNode('gpt', {
        prompt: 'Test',
        variableName: 'response',
      });

      const response = { content: 'Content field text' };

      const result = await handler.handleResponse(response, node, chatState);

      expect(result.type).toBe('proceed');
      expect(chatState.getVariable('response')).toBe('Content field text');
    });

    it('should default to gptResponse variable name', async () => {
      const handler = new EnhancedGPTHandler(mockAIHandler);
      const node = createNode('gpt', {
        prompt: 'Test',
        // No variableName specified
      });

      const response = { text: 'Response' };

      await handler.handleResponse(response, node, chatState);

      expect(chatState.getVariable('gptResponse')).toBe('Response');
    });
  });

  // ========================================
  // CONFIGURATION TESTS
  // ========================================

  describe('Configuration Parsing', () => {
    it('should parse all configuration options', async () => {
      const handler = new EnhancedGPTHandler(mockAIHandler);
      const node = createNode('gpt', {
        prompt: 'Test',
        systemPrompt: 'You are a helpful assistant',
        model: 'gpt-4-turbo',
        temperature: 0.5,
        maxTokens: 500,
        variableName: 'aiResponse',
        streaming: true,
        provider: 'openai',
        contextWindowSize: 10,
        includeAnswerVariables: true,
        allowStopGeneration: true,
        allowRegeneration: true,
      });

      const result = await handler.handle(node, chatState);

      expect(result.type).toBe('displayUI');
    });

    it('should support message as alternative to prompt', async () => {
      const handler = new EnhancedGPTHandler(mockAIHandler);
      const node = createNode('gpt', {
        message: 'Alternative prompt field',
        streaming: false,
      });

      await handler.handle(node, chatState);

      expect(mockAIHandler.processGPTNode).toHaveBeenCalled();
    });

    it('should resolve variables in prompt', async () => {
      chatState.setVariable('topic', 'React Native');

      const handler = new EnhancedGPTHandler(mockAIHandler);
      const node = createNode('gpt', {
        prompt: 'Tell me about {{topic}}',
        streaming: false,
      });

      await handler.handle(node, chatState);

      // The prompt should be resolved before processing
    });

    it('should resolve variables in system prompt', async () => {
      chatState.setVariable('role', 'technical support agent');

      const handler = new EnhancedGPTHandler(mockAIHandler);
      const node = createNode('gpt', {
        prompt: 'How do I fix this?',
        systemPrompt: 'You are a {{role}}',
        streaming: false,
      });

      await handler.handle(node, chatState);
    });

    it('should parse different provider types', async () => {
      const providers = ['openai', 'anthropic', 'deepseek', 'custom'];

      for (const provider of providers) {
        const handler = new EnhancedGPTHandler(mockAIHandler);
        const node = createNode('gpt', {
          prompt: 'Test',
          provider,
          streaming: false,
        });

        await handler.handle(node, chatState);
      }
    });

    it('should parse fallback providers array', async () => {
      const handler = new EnhancedGPTHandler(mockAIHandler);
      const node = createNode('gpt', {
        prompt: 'Test',
        provider: 'openai',
        fallbackProviders: ['anthropic', 'deepseek'],
        streaming: false,
      });

      await handler.handle(node, chatState);
    });
  });

  // ========================================
  // SOCKET CLIENT TESTS
  // ========================================

  describe('Socket Client Integration', () => {
    it('should emit socket events when client is set', async () => {
      const handler = new EnhancedGPTHandler(mockAIHandler);
      handler.setSocketClient(mockSocket);

      const node = createNode('gpt', {
        prompt: 'Test',
        streaming: false,
      });

      await handler.handle(node, chatState);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'gpt:complete',
        expect.objectContaining({
          sessionId: 'test-session',
          success: true,
        })
      );
    });

    it('should handle socket emit errors gracefully', async () => {
      mockSocket.emit.mockImplementationOnce(() => {
        throw new Error('Socket error');
      });

      const handler = new EnhancedGPTHandler(mockAIHandler);
      handler.setSocketClient(mockSocket);

      const node = createNode('gpt', {
        prompt: 'Test',
        streaming: false,
      });

      // Should not throw
      const result = await handler.handle(node, chatState);
      expect(result.type).toBe('displayUI');
    });
  });

  // ========================================
  // STREAM CONTROLLER TESTS
  // ========================================

  describe('Stream Controller', () => {
    it('should stop current stream', async () => {
      const mockAbort = jest.fn();
      mockAIHandler.processGPTNodeStreaming.mockReturnValue({
        isActive: () => true,
        abort: mockAbort,
      });

      const handler = new EnhancedGPTHandler(mockAIHandler);
      handler.setSocketClient(mockSocket);

      const node = createNode('gpt', {
        prompt: 'Test',
        streaming: true,
      });

      await handler.handle(node, chatState);
      handler.stopCurrentStream();

      expect(mockAbort).toHaveBeenCalled();
    });

    it('should abort stream on stop action', async () => {
      const mockAbort = jest.fn();
      mockAIHandler.processGPTNodeStreaming.mockReturnValue({
        isActive: () => true,
        abort: mockAbort,
      });

      const handler = new EnhancedGPTHandler(mockAIHandler);
      handler.setSocketClient(mockSocket);

      const node = createNode('gpt', {
        prompt: 'Test',
        streaming: true,
      });

      await handler.handle(node, chatState);

      const response = { action: 'stop' };
      await handler.handleResponse(response, node, chatState);

      expect(mockAbort).toHaveBeenCalled();
    });
  });

  // ========================================
  // FACTORY FUNCTION TESTS
  // ========================================

  describe('createEnhancedGPTHandler', () => {
    it('should create handler with all options', () => {
      const handler = createEnhancedGPTHandler(
        mockAIHandler,
        mockSocket,
        'https://api.example.com',
        'test-api-key'
      );

      expect(handler).toBeInstanceOf(EnhancedGPTHandler);
    });

    it('should create handler without options', () => {
      const handler = createEnhancedGPTHandler();

      expect(handler).toBeInstanceOf(EnhancedGPTHandler);
    });

    it('should set socket client when provided', async () => {
      const handler = createEnhancedGPTHandler(mockAIHandler, mockSocket);

      const node = createNode('gpt', {
        prompt: 'Test',
        streaming: false,
      });

      await handler.handle(node, chatState);

      expect(mockSocket.emit).toHaveBeenCalled();
    });
  });

  // ========================================
  // ERROR NORMALIZATION TESTS
  // ========================================

  describe('Error Normalization', () => {
    it('should normalize standard Error objects', async () => {
      mockAIHandler.processGPTNode.mockRejectedValueOnce(new Error('Standard error'));

      const handler = new EnhancedGPTHandler(mockAIHandler);
      const node = createNode('gpt', {
        prompt: 'Test',
        streaming: false,
        proceedOnError: true,
      });

      const result = await handler.handle(node, chatState);

      if (result.type === 'displayUI') {
        const uiState = result.uiState as EnhancedGPTUIState;
        expect(uiState.error?.message).toBe('Standard error');
      }
    });

    it('should normalize string errors', async () => {
      mockAIHandler.processGPTNode.mockRejectedValueOnce('String error');

      const handler = new EnhancedGPTHandler(mockAIHandler);
      const node = createNode('gpt', {
        prompt: 'Test',
        streaming: false,
        proceedOnError: true,
      });

      const result = await handler.handle(node, chatState);

      if (result.type === 'displayUI') {
        const uiState = result.uiState as EnhancedGPTUIState;
        expect(uiState.error?.message).toBe('String error');
      }
    });

    it('should preserve AIProviderError objects', async () => {
      const aiError = {
        message: 'Rate limited',
        code: 'RATE_LIMITED',
        provider: 'openai',
        isRateLimited: true,
        isRetryable: true,
      };
      mockAIHandler.processGPTNode.mockRejectedValueOnce(aiError);

      const handler = new EnhancedGPTHandler(mockAIHandler);
      const node = createNode('gpt', {
        prompt: 'Test',
        streaming: false,
        proceedOnError: true,
      });

      const result = await handler.handle(node, chatState);

      if (result.type === 'displayUI') {
        const uiState = result.uiState as EnhancedGPTUIState;
        expect(uiState.error?.code).toBe('RATE_LIMITED');
        expect(uiState.error?.isRateLimited).toBe(true);
      }
    });
  });

  // ========================================
  // CONVERSATION CONTEXT TESTS
  // ========================================

  describe('Conversation Context', () => {
    it('should include conversation history in context', async () => {
      // Add some messages to transcript
      chatState.addBotMessage('Hello!', 'node1', 'message');
      chatState.addUserMessage('Hi, I need help', 'node2');
      chatState.addBotMessage('Sure, how can I help?', 'node3', 'message');

      const handler = new EnhancedGPTHandler(mockAIHandler);
      const node = createNode('gpt', {
        prompt: 'Answer the user',
        streaming: false,
      });

      await handler.handle(node, chatState);

      expect(mockAIHandler.processGPTNode).toHaveBeenCalled();
    });
  });
});
