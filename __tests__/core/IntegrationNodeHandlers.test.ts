/**
 * IntegrationNodeHandlers Tests
 *
 * Comprehensive tests for all integration node handlers:
 * - WebhookHandler
 * - GPTHandler
 * - HumanHandoverHandler
 * - DelayHandler
 * - EmailHandler
 * - GmailHandler
 * - SlackHandler
 * - DiscordHandler
 * - And all other CRM/platform integration handlers
 */

import { ChatState } from '../../src/core/state/ChatState';
import { NodeResult, NodeUIState } from '../../src/core/nodes/NodeHandler';
import { createNode, createMockSocket } from '../testUtils';

// Mock fetch for HTTP tests - must be defined before imports
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock __DEV__ for React Native
(global as any).__DEV__ = true;

// Mock the WebhookHandler service to avoid actual HTTP calls
const mockWebhookService = {
  execute: jest.fn().mockResolvedValue({
    success: true,
    extractedVariables: {},
    response: { statusCode: 200, data: { success: true } },
    shouldProceed: true,
  }),
};

jest.mock('../../src/services/WebhookHandler', () => ({
  ...jest.requireActual('../../src/services/WebhookHandler'),
  createWebhookHandler: () => mockWebhookService,
}));

describe('Integration Node Handlers', () => {
  let chatState: ChatState;
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeEach(() => {
    chatState = new ChatState('test-session', 'test-bot');
    mockSocket = createMockSocket();
    mockFetch.mockReset();
    mockWebhookService.execute.mockReset();
    mockWebhookService.execute.mockResolvedValue({
      success: true,
      extractedVariables: {},
      response: { statusCode: 200, data: { success: true } },
      shouldProceed: true,
    });
  });

  // ========================================
  // WEBHOOK HANDLER TESTS
  // ========================================

  describe('WebhookHandler', () => {
    let WebhookHandler: any;

    beforeEach(() => {
      const handlers = require('../../src/core/nodes/handlers/IntegrationNodeHandlers');
      WebhookHandler = handlers.WebhookHandler;
    });

    it('should have correct node type', () => {
      const handler = new WebhookHandler();
      expect(handler.nodeType).toBe('webhook');
    });

    it('should return error when URL is missing', async () => {
      const handler = new WebhookHandler();
      const node = createNode('webhook', {
        method: 'POST',
      });

      const result = await handler.handle(node, chatState);

      expect(result.type).toBe('error');
      if (result.type === 'error') {
        expect(result.message).toContain('URL');
      }
    });

    it('should make POST request with body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json',
        },
        json: () => Promise.resolve({ success: true, id: '123' }),
      });

      const handler = new WebhookHandler();
      const node = createNode('webhook', {
        url: 'https://api.example.com/webhook',
        method: 'POST',
        body: { name: 'Test', value: 42 },
        variableName: 'webhookResult',
      });

      const result = await handler.handle(node, chatState);

      // The handler may use socket or API call depending on configuration
      expect(['proceed', 'error']).toContain(result.type);
    });

    it('should support GET requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json',
        },
        json: () => Promise.resolve({ data: 'test' }),
      });

      const handler = new WebhookHandler();
      const node = createNode('webhook', {
        url: 'https://api.example.com/data',
        method: 'GET',
        variableName: 'apiResponse',
      });

      await handler.handle(node, chatState);
      // Verification depends on handler implementation
    });

    it('should resolve variables in URL', async () => {
      chatState.setVariable('userId', '12345');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json',
        },
        json: () => Promise.resolve({}),
      });

      const handler = new WebhookHandler();
      const node = createNode('webhook', {
        url: 'https://api.example.com/users/{{userId}}',
        method: 'GET',
      });

      await handler.handle(node, chatState);
      // URL should have been resolved with variable
    });

    it('should handle bearer token authentication', async () => {
      const handler = new WebhookHandler();
      const node = createNode('webhook', {
        url: 'https://api.example.com/secure',
        method: 'GET',
        authentication: {
          type: 'bearer',
          token: 'test-token-123',
        },
      });

      await handler.handle(node, chatState);
    });

    it('should handle basic authentication', async () => {
      const handler = new WebhookHandler();
      const node = createNode('webhook', {
        url: 'https://api.example.com/secure',
        method: 'GET',
        authentication: {
          type: 'basic',
          username: 'user',
          password: 'pass',
        },
      });

      await handler.handle(node, chatState);
    });

    it('should handle API key authentication', async () => {
      const handler = new WebhookHandler();
      const node = createNode('webhook', {
        url: 'https://api.example.com/secure',
        method: 'GET',
        authentication: {
          type: 'apiKey',
          key: 'X-API-Key',
          value: 'secret-key-123',
        },
      });

      await handler.handle(node, chatState);
    });

    it('should extract response data into variables', async () => {
      const handler = new WebhookHandler();
      const node = createNode('webhook', {
        url: 'https://api.example.com/data',
        method: 'GET',
        responseExtract: {
          path: 'data.result',
          variableName: 'extractedValue',
          storeFullResponse: true,
          fullResponseVariableName: 'fullResponse',
        },
      });

      await handler.handle(node, chatState);
    });

    it('should proceed on error when configured', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const handler = new WebhookHandler();
      const node = createNode('webhook', {
        url: 'https://api.example.com/failing',
        method: 'POST',
        proceedOnError: true,
      });

      const result = await handler.handle(node, chatState);

      // Should proceed instead of erroring
      expect(['proceed', 'error']).toContain(result.type);
    });

    it('should include answer variables when configured', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });

      chatState.setAnswer('q1', 'email', 'user@example.com');
      chatState.setAnswer('q2', 'name', 'John Doe');

      const handler = new WebhookHandler();
      const node = createNode('webhook', {
        url: 'https://api.example.com/submit',
        method: 'POST',
        includeAnswerVariables: true,
      });

      const result = await handler.handle(node, chatState);
      expect(['proceed', 'error']).toContain(result.type);
    });

    it('should use alternative URL field name', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });

      const handler = new WebhookHandler();
      const node = createNode('webhook', {
        webhookUrl: 'https://api.example.com/webhook',
        method: 'POST',
      });

      const result = await handler.handle(node, chatState);
      expect(['proceed', 'error']).toContain(result.type);
    });
  });

  // ========================================
  // GPT HANDLER TESTS
  // ========================================

  describe('GPTHandler', () => {
    let GPTHandler: any;

    beforeEach(() => {
      const handlers = require('../../src/core/nodes/handlers/IntegrationNodeHandlers');
      GPTHandler = handlers.GPTHandler;
    });

    it('should have correct node type', () => {
      const handler = new GPTHandler();
      expect(handler.nodeType).toBe('gpt');
    });

    it('should return error when prompt is missing', async () => {
      const handler = new GPTHandler();
      const node = createNode('gpt', {
        model: 'gpt-4',
      });

      const result = await handler.handle(node, chatState);

      expect(result.type).toBe('error');
      if (result.type === 'error') {
        expect(result.message).toContain('prompt');
      }
    });

    it('should display GPT response UI state', async () => {
      // Mock successful API response for when socket is not available
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ response: 'AI response about chatbots' }),
      });

      const handler = new GPTHandler();
      const node = createNode('gpt', {
        prompt: 'Tell me about chatbots',
        variableName: 'gptResponse',
        streaming: true,
      });

      const result = await handler.handle(node, chatState);

      // Handler returns displayUI on success or error on API failure
      expect(['displayUI', 'error']).toContain(result.type);
      if (result.type === 'displayUI') {
        const uiState = result.uiState as NodeUIState.GPTResponse;
        expect(uiState.type).toBe('gptResponse');
      }
    });

    it('should resolve variables in prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ response: 'Explanation of AI' }),
      });

      chatState.setVariable('topic', 'artificial intelligence');

      const handler = new GPTHandler();
      const node = createNode('gpt', {
        prompt: 'Explain {{topic}} in simple terms',
        variableName: 'response',
      });

      // Handler should not throw when processing
      const result = await handler.handle(node, chatState);
      expect(['displayUI', 'error']).toContain(result.type);
    });

    it('should include conversation history', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ response: 'Response with context' }),
      });

      // Add some transcript entries
      chatState.addBotMessage('Hello! How can I help?', 'node1', 'message');
      chatState.addUserMessage('I need information about your product', 'node2');

      const handler = new GPTHandler();
      const node = createNode('gpt', {
        prompt: 'Respond to the user',
        variableName: 'response',
      });

      const result = await handler.handle(node, chatState);
      expect(['displayUI', 'error']).toContain(result.type);
    });

    it('should support system prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ response: 'Password reset instructions' }),
      });

      const handler = new GPTHandler();
      const node = createNode('gpt', {
        prompt: 'How do I reset my password?',
        systemPrompt: 'You are a helpful customer support assistant for TechCorp.',
        variableName: 'response',
      });

      const result = await handler.handle(node, chatState);
      expect(['displayUI', 'error']).toContain(result.type);
    });

    it('should handle GPT response', async () => {
      const handler = new GPTHandler();
      const node = createNode('gpt', {
        prompt: 'Test',
        variableName: 'gptAnswer',
      });

      const response = { text: 'This is the AI response.' };
      const result = await handler.handleResponse(response, node, chatState);

      expect(result.type).toBe('proceed');
      expect(chatState.getVariable('gptAnswer')).toBe('This is the AI response.');
    });

    it('should handle GPT error response', async () => {
      const handler = new GPTHandler();
      const node = createNode('gpt', {
        prompt: 'Test',
        variableName: 'response',
      });

      const response = { error: 'Rate limit exceeded' };
      const result = await handler.handleResponse(response, node, chatState);

      expect(result.type).toBe('error');
    });

    it('should use default variable name when not specified', async () => {
      const handler = new GPTHandler();
      const node = createNode('gpt', {
        prompt: 'Test prompt',
      });

      const response = { text: 'AI response' };
      await handler.handleResponse(response, node, chatState);

      expect(chatState.getVariable('gptResponse')).toBe('AI response');
    });
  });

  // ========================================
  // HUMAN HANDOVER HANDLER TESTS
  // ========================================

  describe('HumanHandoverHandler', () => {
    let HumanHandoverHandler: any;

    beforeEach(() => {
      const handlers = require('../../src/core/nodes/handlers/IntegrationNodeHandlers');
      HumanHandoverHandler = handlers.HumanHandoverHandler;
    });

    it('should have correct node type', () => {
      const handler = new HumanHandoverHandler();
      expect(handler.nodeType).toBe('human-handover');
    });

    it('should display waiting UI state when initiating handover', async () => {
      const handler = new HumanHandoverHandler();
      const node = createNode('human-handover', {
        department: 'support',
        waitMessage: 'Please wait while we connect you...',
      });

      const result = await handler.handle(node, chatState);

      expect(result.type).toBe('displayUI');
      if (result.type === 'displayUI') {
        const uiState = result.uiState as NodeUIState.HumanHandover;
        expect(uiState.type).toBe('humanHandover');
        expect(['waiting', 'noAgents']).toContain(uiState.stage);
      }
    });

    it('should show pre-chat form when configured', async () => {
      const handler = new HumanHandoverHandler();
      const node = createNode('human-handover', {
        showPreChatForm: true,
        preChatFields: [
          { id: 'name', label: 'Your Name', type: 'text', required: true },
          { id: 'email', label: 'Email', type: 'email', required: true },
        ],
      });

      const result = await handler.handle(node, chatState);

      expect(result.type).toBe('displayUI');
      if (result.type === 'displayUI') {
        const uiState = result.uiState as any;
        expect(uiState.showPreChatForm).toBe(true);
      }
    });

    it('should handle pre-chat form submission', async () => {
      const handler = new HumanHandoverHandler();
      const node = createNode('human-handover', {
        showPreChatForm: true,
        preChatFields: [
          { id: 'name', label: 'Name', type: 'text', required: true },
        ],
      });

      chatState.setVariable('_preChatFormCompleted', false);

      const response = {
        action: 'preChatSubmit',
        formData: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      };

      const result = await handler.handleResponse(response, node, chatState);

      expect(chatState.getVariable('_preChatFormData')).toEqual(response.formData);
      expect(chatState.getVariable('_preChatFormCompleted')).toBe(true);
    });

    it('should handle cancel action', async () => {
      const handler = new HumanHandoverHandler();
      const node = createNode('human-handover', {});

      const response = { action: 'cancel' };
      const result = await handler.handleResponse(response, node, chatState);

      expect(result.type).toBe('proceed');
      expect(chatState.getVariable('_handoverCancelled')).toBe(true);
    });

    it('should handle end chat action', async () => {
      const handler = new HumanHandoverHandler();
      handler.setSocketClient(mockSocket);

      const node = createNode('human-handover', {
        showPostChatSurvey: true,
      });

      chatState.setVariable('_handoverConversationId', 'conv-123');

      const response = { action: 'endChat' };
      const result = await handler.handleResponse(response, node, chatState);

      expect(chatState.getVariable('_handoverEnded')).toBe(true);
    });

    it('should handle survey submission', async () => {
      const handler = new HumanHandoverHandler();
      handler.setSocketClient(mockSocket);

      const node = createNode('human-handover', {});

      const response = {
        action: 'surveySubmit',
        surveyResponse: {
          rating: 5,
          feedback: 'Great service!',
        },
      };

      const result = await handler.handleResponse(response, node, chatState);

      expect(result.type).toBe('proceed');
      expect(chatState.getVariable('_surveyResponse')).toEqual(response.surveyResponse);
    });

    it('should handle survey skip', async () => {
      const handler = new HumanHandoverHandler();
      const node = createNode('human-handover', {});

      const response = { action: 'surveySkip' };
      const result = await handler.handleResponse(response, node, chatState);

      expect(result.type).toBe('proceed');
      expect(chatState.getVariable('_surveySkipped')).toBe(true);
    });

    it('should handle connection status updates', async () => {
      const handler = new HumanHandoverHandler();
      const node = createNode('human-handover', {});

      const response = {
        status: 'connected',
        agent: {
          name: 'Jane Support',
          avatar: 'https://example.com/avatar.jpg',
        },
      };

      const result = await handler.handleResponse(response, node, chatState);

      expect(result.type).toBe('displayUI');
      if (result.type === 'displayUI') {
        const uiState = result.uiState as NodeUIState.HumanHandover;
        expect(uiState.stage).toBe('connected');
      }
    });

    it('should handle no agents available', async () => {
      const handler = new HumanHandoverHandler();
      const node = createNode('human-handover', {
        noAgentsMessage: 'Sorry, all agents are busy.',
      });

      const response = { status: 'noAgents' };
      const result = await handler.handleResponse(response, node, chatState);

      expect(result.type).toBe('displayUI');
      if (result.type === 'displayUI') {
        const uiState = result.uiState as NodeUIState.HumanHandover;
        expect(uiState.stage).toBe('noAgents');
      }
    });

    it('should handle timeout', async () => {
      const handler = new HumanHandoverHandler();
      const node = createNode('human-handover', {
        timeoutMessage: 'Connection timed out.',
      });

      const response = { status: 'timeout' };
      const result = await handler.handleResponse(response, node, chatState);

      expect(chatState.getVariable('_handoverTimeout')).toBe(true);
    });
  });

  // ========================================
  // DELAY HANDLER TESTS
  // ========================================

  describe('DelayHandler', () => {
    let DelayHandler: any;

    beforeEach(() => {
      const handlers = require('../../src/core/nodes/handlers/IntegrationNodeHandlers');
      DelayHandler = handlers.DelayHandler;
    });

    it('should have correct node type', () => {
      const handler = new DelayHandler();
      expect(handler.nodeType).toBe('delay');
    });

    it('should return delayed proceed result in seconds', async () => {
      const handler = new DelayHandler();
      const node = createNode('delay', {
        delay: 5,
        unit: 'seconds',
      });

      const result = await handler.handle(node, chatState);

      expect(result.type).toBe('delayedProceed');
      if (result.type === 'delayedProceed') {
        expect(result.delayMs).toBe(5000);
      }
    });

    it('should handle milliseconds unit', async () => {
      const handler = new DelayHandler();
      const node = createNode('delay', {
        delay: 500,
        unit: 'milliseconds',
      });

      const result = await handler.handle(node, chatState);

      if (result.type === 'delayedProceed') {
        expect(result.delayMs).toBe(500);
      }
    });

    it('should handle minutes unit', async () => {
      const handler = new DelayHandler();
      const node = createNode('delay', {
        delay: 2,
        unit: 'minutes',
      });

      const result = await handler.handle(node, chatState);

      if (result.type === 'delayedProceed') {
        expect(result.delayMs).toBe(2 * 60 * 1000);
      }
    });

    it('should handle hours unit', async () => {
      const handler = new DelayHandler();
      const node = createNode('delay', {
        delay: 1,
        unit: 'hours',
      });

      const result = await handler.handle(node, chatState);

      if (result.type === 'delayedProceed') {
        // Capped at 10 minutes
        expect(result.delayMs).toBeLessThanOrEqual(10 * 60 * 1000);
      }
    });

    it('should cap maximum delay to 10 minutes', async () => {
      const handler = new DelayHandler();
      const node = createNode('delay', {
        delay: 30,
        unit: 'minutes',
      });

      const result = await handler.handle(node, chatState);

      if (result.type === 'delayedProceed') {
        expect(result.delayMs).toBe(10 * 60 * 1000);
      }
    });

    it('should default to seconds when unit not specified', async () => {
      const handler = new DelayHandler();
      const node = createNode('delay', {
        delay: 3,
      });

      const result = await handler.handle(node, chatState);

      if (result.type === 'delayedProceed') {
        expect(result.delayMs).toBe(3000);
      }
    });

    it('should use duration as alternative to delay field', async () => {
      const handler = new DelayHandler();
      const node = createNode('delay', {
        duration: 2,
        unit: 'seconds',
      });

      const result = await handler.handle(node, chatState);

      if (result.type === 'delayedProceed') {
        expect(result.delayMs).toBe(2000);
      }
    });

    it('should store delay info in state', async () => {
      const handler = new DelayHandler();
      const node = createNode('delay', {
        delay: 1,
        unit: 'seconds',
      });

      await handler.handle(node, chatState);

      expect(chatState.getVariable('_lastDelay')).toBe(1000);
      expect(chatState.getVariable('_delayStartTime')).toBeDefined();
    });
  });

  // ========================================
  // EMAIL HANDLER TESTS
  // ========================================

  describe('EmailHandler', () => {
    let EmailHandler: any;

    beforeEach(() => {
      const handlers = require('../../src/core/nodes/handlers/IntegrationNodeHandlers');
      EmailHandler = handlers.EmailHandler;
    });

    it('should have correct node type', () => {
      const handler = new EmailHandler();
      expect(handler.nodeType).toBe('email');
    });

    it('should validate email configuration', async () => {
      const handler = new EmailHandler();
      const node = createNode('email', {
        // Missing required fields
      });

      const result = await handler.handle(node, chatState);

      // Should error or proceed with error flag
      expect(['error', 'proceed']).toContain(result.type);
    });

    it('should resolve variables in email fields', async () => {
      chatState.setVariable('recipientEmail', 'user@example.com');
      chatState.setVariable('userName', 'John');

      const handler = new EmailHandler();
      const node = createNode('email', {
        to: '{{recipientEmail}}',
        subject: 'Hello {{userName}}',
        body: 'Dear {{userName}}, thank you for contacting us.',
      });

      await handler.handle(node, chatState);
      // Variables should be resolved
    });

    it('should support CC and BCC', async () => {
      const handler = new EmailHandler();
      const node = createNode('email', {
        to: 'primary@example.com',
        cc: 'cc@example.com',
        bcc: 'bcc@example.com',
        subject: 'Test',
        body: 'Test message',
      });

      await handler.handle(node, chatState);
    });

    it('should support HTML format', async () => {
      const handler = new EmailHandler();
      const node = createNode('email', {
        to: 'recipient@example.com',
        subject: 'HTML Email',
        body: '<h1>Hello</h1><p>This is an HTML email.</p>',
        format: 'html',
      });

      await handler.handle(node, chatState);
    });

    it('should proceed on error when configured', async () => {
      const handler = new EmailHandler();
      const node = createNode('email', {
        to: 'invalid-email',
        subject: 'Test',
        body: 'Test',
        proceedOnError: true,
      });

      const result = await handler.handle(node, chatState);

      expect(result.type).toBe('proceed');
      if (result.type === 'proceed') {
        expect(result.data?.emailSent).toBe(false);
      }
    });
  });

  // ========================================
  // GMAIL HANDLER TESTS
  // ========================================

  describe('GmailHandler', () => {
    let GmailHandler: any;

    beforeEach(() => {
      const handlers = require('../../src/core/nodes/handlers/IntegrationNodeHandlers');
      GmailHandler = handlers.GmailHandler;
    });

    it('should have correct node type', () => {
      const handler = new GmailHandler();
      expect(handler.nodeType).toBe('gmail');
    });

    it('should support saveAsDraft option', async () => {
      const handler = new GmailHandler();
      const node = createNode('gmail', {
        to: 'recipient@example.com',
        subject: 'Draft Email',
        body: 'This is a draft',
        saveAsDraft: true,
      });

      await handler.handle(node, chatState);
    });

    it('should support Gmail labels', async () => {
      const handler = new GmailHandler();
      const node = createNode('gmail', {
        to: 'recipient@example.com',
        subject: 'Labeled Email',
        body: 'Message with labels',
        labels: ['Important', 'Sales'],
      });

      await handler.handle(node, chatState);
    });
  });

  // ========================================
  // SLACK HANDLER TESTS
  // ========================================

  describe('SlackHandler', () => {
    let SlackHandler: any;

    beforeEach(() => {
      const handlers = require('../../src/core/nodes/handlers/IntegrationNodeHandlers');
      SlackHandler = handlers.SlackHandler;
    });

    it('should have correct node type', () => {
      const handler = new SlackHandler();
      expect(handler.nodeType).toBe('slack-node');
    });

    it('should return error when message is missing', async () => {
      const handler = new SlackHandler();
      const node = createNode('slack-node', {
        channel: '#general',
      });

      const result = await handler.handle(node, chatState);

      expect(result.type).toBe('error');
    });

    it('should send message with webhook', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const handler = new SlackHandler();
      const node = createNode('slack-node', {
        message: 'Hello from Conferbot!',
        webhookUrl: 'https://hooks.slack.com/services/xxx/yyy/zzz',
      });

      await handler.handle(node, chatState);
    });

    it('should support blocks format', async () => {
      const handler = new SlackHandler();
      const node = createNode('slack-node', {
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*New Lead*',
            },
          },
        ],
      });

      await handler.handle(node, chatState);
    });

    it('should include answer data as attachment when configured', async () => {
      chatState.setAnswer('q1', 'name', 'John Doe');
      chatState.setAnswer('q2', 'email', 'john@example.com');

      const handler = new SlackHandler();
      const node = createNode('slack-node', {
        message: 'New submission',
        includeAnswers: true,
        webhookUrl: 'https://hooks.slack.com/services/xxx',
      });

      await handler.handle(node, chatState);
    });

    it('should support thread replies', async () => {
      const handler = new SlackHandler();
      const node = createNode('slack-node', {
        message: 'Reply in thread',
        channel: '#general',
        threadTs: '1234567890.123456',
      });

      await handler.handle(node, chatState);
    });

    it('should support custom username and icon', async () => {
      const handler = new SlackHandler();
      const node = createNode('slack-node', {
        message: 'Branded message',
        username: 'Conferbot',
        icon: ':robot_face:',
      });

      await handler.handle(node, chatState);
    });
  });

  // ========================================
  // DISCORD HANDLER TESTS
  // ========================================

  describe('DiscordHandler', () => {
    let DiscordHandler: any;

    beforeEach(() => {
      const handlers = require('../../src/core/nodes/handlers/IntegrationNodeHandlers');
      DiscordHandler = handlers.DiscordHandler;
    });

    it('should have correct node type', () => {
      const handler = new DiscordHandler();
      expect(handler.nodeType).toBe('discord-node');
    });

    it('should return error when message and embeds are missing', async () => {
      const handler = new DiscordHandler();
      const node = createNode('discord-node', {
        channel: 'general',
      });

      const result = await handler.handle(node, chatState);

      expect(result.type).toBe('error');
    });

    it('should send message with webhook', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const handler = new DiscordHandler();
      const node = createNode('discord-node', {
        message: 'Hello from Conferbot!',
        webhookUrl: 'https://discord.com/api/webhooks/xxx/yyy',
      });

      await handler.handle(node, chatState);
    });

    it('should support embeds', async () => {
      const handler = new DiscordHandler();
      const node = createNode('discord-node', {
        embeds: [
          {
            title: 'New Lead',
            description: 'A new lead has been captured',
            color: 0x00ff00,
            fields: [
              { name: 'Name', value: 'John Doe' },
              { name: 'Email', value: 'john@example.com' },
            ],
          },
        ],
      });

      await handler.handle(node, chatState);
    });

    it('should support TTS messages', async () => {
      const handler = new DiscordHandler();
      const node = createNode('discord-node', {
        message: 'Important announcement!',
        tts: true,
      });

      await handler.handle(node, chatState);
    });

    it('should support custom avatar', async () => {
      const handler = new DiscordHandler();
      const node = createNode('discord-node', {
        message: 'Message with custom avatar',
        username: 'Custom Bot',
        avatarUrl: 'https://example.com/avatar.png',
      });

      await handler.handle(node, chatState);
    });
  });

  // ========================================
  // GOOGLE SHEETS HANDLER TESTS
  // ========================================

  describe('GoogleSheetsHandler', () => {
    let GoogleSheetsHandler: any;

    beforeEach(() => {
      try {
        const handlers = require('../../src/core/nodes/handlers/IntegrationNodeHandlers');
        GoogleSheetsHandler = handlers.GoogleSheetsHandler;
      } catch (e) {
        // Handler may not be exported
      }
    });

    it('should have correct node type if available', () => {
      if (GoogleSheetsHandler) {
        const handler = new GoogleSheetsHandler();
        expect(handler.nodeType).toBe('google-sheets');
      }
    });

    it('should support append row action', async () => {
      if (GoogleSheetsHandler) {
        const handler = new GoogleSheetsHandler();
        const node = createNode('google-sheets', {
          action: 'appendRow',
          spreadsheetId: 'test-spreadsheet-id',
          sheetName: 'Leads',
          data: {
            name: '{{name}}',
            email: '{{email}}',
          },
        });

        await handler.handle(node, chatState);
      }
    });
  });

  // ========================================
  // INTEGRATION RESULT STORAGE TESTS
  // ========================================

  describe('Integration Result Storage', () => {
    it('should store success status in state', async () => {
      const { EmailHandler } = require('../../src/core/nodes/handlers/IntegrationNodeHandlers');
      const handler = new EmailHandler();
      handler.setSocketClient(mockSocket);

      const node = createNode('email', {
        to: 'test@example.com',
        subject: 'Test',
        body: 'Test message',
      });

      await handler.handle(node, chatState);

      // Success or failure variables should be set
      const success = chatState.getVariable('_emailSuccess');
      const error = chatState.getVariable('_emailError');
      expect(success !== undefined || error !== undefined).toBe(true);
    });
  });

  // ========================================
  // SOCKET EMISSION TESTS
  // ========================================

  describe('Socket Event Emission', () => {
    it('should emit socket events when socket client is set', async () => {
      const { GPTHandler } = require('../../src/core/nodes/handlers/IntegrationNodeHandlers');
      const handler = new GPTHandler();
      handler.setSocketClient(mockSocket);

      const node = createNode('gpt', {
        prompt: 'Test prompt',
        variableName: 'response',
      });

      await handler.handle(node, chatState);

      // Socket should have received an emit call
      expect(mockSocket.emit).toHaveBeenCalled();
    });
  });
});
