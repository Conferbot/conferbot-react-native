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

  const handlers = () => require('../../src/core/nodes/handlers/IntegrationNodeHandlers');

  /** A stand-alone context: the socket, timers and the bot API for one step. */
  const withCtx = (node: any, extra: Record<string, any> = {}) => {
    const listeners = new Map<string, Set<(p: any) => void>>();
    const emits: Array<{ event: string; payload: any }> = [];
    const api = jest.fn(async (_path: string, _body: any) => ({ ok: true, status: 200, body: {} as any }));
    const ctx = {
      botId: 'test-bot',
      sessionId: 'test-session',
      api,
      upload: jest.fn(),
      emit: (event: string, payload: any) => {
        emits.push({ event, payload });
        return true;
      },
      on: (event: string, fn: (p: any) => void) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event)!.add(fn);
        return () => listeners.get(event)!.delete(fn);
      },
      typing: jest.fn(async () => undefined),
      delay: jest.fn(async () => undefined),
      edges: () => extra.edges || [],
      edgesOf: () => [],
      wired: (h: string) => (extra.edges || []).some((e: any) => e.sourceHandle === h),
      via: extra.via || 'edge',
      random: () => 0.5,
      now: () => new Date(),
      customizations: extra.customizations || {},
      visitorTimeZone: 'UTC',
      respond: jest.fn(),
      shown: jest.fn(),
      isStale: () => false,
      node: () => undefined,
    };
    const fire = (event: string, payload: any) => [...(listeners.get(event) || [])].forEach((fn) => fn(payload));
    return { node: { ...node, ctx }, ctx, emits, fire, api };
  };

  // ========================================
  // WEBHOOK
  // ========================================

  describe('WebhookHandler', () => {
    it('registers its answerVariable and moves on at once (the call runs in the background)', async () => {
      const { WebhookHandler } = handlers();
      mockWebhookService.execute.mockReturnValue(new Promise(() => undefined));
      const node = createNode('webhook-node', { url: 'https://api.example.com/hook', method: 'POST', answerVariable: 'webhookresponse' });
      const result = await new WebhookHandler().handle(node, chatState);
      expect(result).toEqual(NodeResult.next());
      expect(chatState.getAnswerVariables().map((v) => [v.variableName, v.value])).toEqual([['webhookresponse', null]]);
    });

    it('fills the variable with the reply once the call works', async () => {
      const { WebhookHandler } = handlers();
      mockWebhookService.execute.mockResolvedValue({ success: true, extractedVariables: {}, response: { statusCode: 200, data: { ok: 1 } }, shouldProceed: true });
      const node = createNode('webhook-node', { url: 'https://api.example.com/hook', answerVariable: 'webhookresponse' });
      await new WebhookHandler().handle(node, chatState);
      await Promise.resolve();
      await Promise.resolve();
      expect(chatState.getAnswer('webhookresponse')).toEqual({ ok: 1 });
    });
  });

  // ========================================
  // GPT (#33)
  // ========================================

  describe('GPTHandler', () => {
    it('asks the server (POST gpt {nodeId, transcript}), never OpenAI with a key from the node', async () => {
      const { GPTHandler } = handlers();
      chatState.addBotMessage('Hi', 'w', 'welcome-node');
      chatState.addUserMessage('What is Conferbot?', 'q');
      const { node, api } = withCtx(createNode('gpt-node', { context: 'x', apiKey: 'sk-should-not-be-used' }, { id: 'g' }));
      api.mockResolvedValue({ ok: true, status: 200, body: { reply: 'A chatbot builder.' } });
      const result = await new GPTHandler().handle(node, chatState);
      expect(api).toHaveBeenCalledWith('gpt', {
        nodeId: 'g',
        transcript: [
          { by: 'bot', message: 'Hi' },
          { by: 'user', message: 'What is Conferbot?' },
        ],
      });
      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.type).toBe('proceed');
      expect(chatState.getTranscript().pop()?.text).toBe('A chatbot builder.');
    });

    it('a failed call shows nothing and moves on', async () => {
      const { GPTHandler } = handlers();
      const { node, api } = withCtx(createNode('gpt-node', {}, { id: 'g' }));
      api.mockResolvedValue({ ok: false, status: 500, body: {} });
      const before = chatState.getTranscript().length;
      expect(await new GPTHandler().handle(node, chatState)).toEqual(NodeResult.next());
      expect(chatState.getTranscript()).toHaveLength(before);
    });
  });

  describe('HumanHandoverHandler', () => {
    let HumanHandoverHandler: any;

    beforeEach(() => {
      const handlers = require('../../src/core/nodes/handlers/IntegrationNodeHandlers');
      HumanHandoverHandler = handlers.HumanHandoverHandler;
    });

    it('should have correct node type', () => {
      const handler = new HumanHandoverHandler();
      expect(handler.nodeType).toBe('human-handover-node');
    });

    it('should display waiting UI state when initiating handover', async () => {
      const handler = new HumanHandoverHandler();
      const node = createNode('human-handover-node', {
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

    it('shows the builder rich text handover message as plain text, and waits there', async () => {
      const { requiresUserInteraction } = require('../../src/core/nodes/NodeTypes');
      const handler = new HumanHandoverHandler();
      const node = createNode('human-handover-node', {
        handoverMessage: '<p>Please wait while I connect you to the next available agent.</p>',
      });

      const result = await handler.handle(node, chatState);

      expect(result.type).toBe('displayUI');
      if (result.type === 'displayUI') {
        expect((result.uiState as any).waitMessage).toBe('Please wait while I connect you to the next available agent.');
      }
      // The flow pauses on it until a person joins or nobody can.
      expect(requiresUserInteraction('human-handover-node')).toBe(true);
    });

    it('carries the flow on once the handover is over', async () => {
      const handler = new HumanHandoverHandler();
      const node = createNode('human-handover-node', { handoverMessage: 'Wait' });
      const result = await handler.handleResponse({ action: 'continue' }, node, chatState);
      expect(result.type).toBe('proceed');
    });

    it('should show pre-chat form when configured', async () => {
      const handler = new HumanHandoverHandler();
      const node = createNode('human-handover-node', {
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
      const node = createNode('human-handover-node', {
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
      const node = createNode('human-handover-node', {});

      const response = { action: 'cancel' };
      const result = await handler.handleResponse(response, node, chatState);

      expect(result.type).toBe('proceed');
      expect(chatState.getVariable('_handoverCancelled')).toBe(true);
    });

    it('should handle end chat action', async () => {
      const handler = new HumanHandoverHandler();
      handler.setSocketClient(mockSocket);

      const node = createNode('human-handover-node', {
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

      const node = createNode('human-handover-node', {});

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

    describe('only events the server handles (#58)', () => {
      const emitted = () => (mockSocket.emit as jest.Mock).mock.calls.map((c) => c[0]);

      it('cancel leaves the queue with queue-self-resolve, unless the provider already did', async () => {
        const handler = new HumanHandoverHandler();
        handler.setSocketClient(mockSocket);
        mockSocket.connected = true;
        const node = createNode('human-handover-node', {});
        await handler.handleResponse({ action: 'cancel' }, node, chatState);
        expect(mockSocket.emit).toHaveBeenCalledWith('queue-self-resolve', { chatSessionId: 'test-session' });
        (mockSocket.emit as jest.Mock).mockClear();
        await handler.handleResponse({ action: 'cancel', queueLeft: true }, node, chatState);
        expect(emitted()).not.toContain('queue-self-resolve');
      });

      it('end chat sends queue-self-resolve, never handover:end', async () => {
        const handler = new HumanHandoverHandler();
        handler.setSocketClient(mockSocket);
        mockSocket.connected = true;
        await handler.handleResponse({ action: 'endChat' }, createNode('human-handover-node', {}), chatState);
        expect(emitted()).toEqual(['queue-self-resolve']);
      });

      it('the survey goes out as submit-chat-rating, never handover:survey', async () => {
        const handler = new HumanHandoverHandler();
        handler.setSocketClient(mockSocket);
        mockSocket.connected = true;
        await handler.handleResponse(
          { action: 'surveySubmit', surveyResponse: { rating: 4, feedback: 'Nice' } },
          createNode('human-handover-node', {}),
          chatState
        );
        expect(mockSocket.emit).toHaveBeenCalledWith('submit-chat-rating', {
          chatSessionId: 'test-session',
          source: 'post_chat_survey',
          csatScore: 4,
          feedback: 'Nice',
        });
        expect(emitted().some((e: string) => e.startsWith('handover:'))).toBe(false);
      });
    });

    it('should handle survey skip', async () => {
      const handler = new HumanHandoverHandler();
      const node = createNode('human-handover-node', {});

      const response = { action: 'surveySkip' };
      const result = await handler.handleResponse(response, node, chatState);

      expect(result.type).toBe('proceed');
      expect(chatState.getVariable('_surveySkipped')).toBe(true);
    });

    it('should handle connection status updates', async () => {
      const handler = new HumanHandoverHandler();
      const node = createNode('human-handover-node', {});

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
      const node = createNode('human-handover-node', {
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
      const node = createNode('human-handover-node', {
        timeoutMessage: 'Connection timed out.',
      });

      const response = { status: 'timeout' };
      const result = await handler.handleResponse(response, node, chatState);

      expect(chatState.getVariable('_handoverTimeout')).toBe(true);
    });
  });

  // ========================================
  // DELAY
  // ========================================

  describe('DelayHandler', () => {
    it('waits data.delay seconds, then the first edge', async () => {
      const { DelayHandler } = handlers();
      const result: any = await new DelayHandler().handle(createNode('delay-node', { delay: 3 }), chatState);
      expect(result).toMatchObject({ type: 'delayedProceed', nextNodeId: null, delayMs: 3000 });
    });

    it('no delay set: no wait', async () => {
      const { DelayHandler } = handlers();
      expect(await new DelayHandler().handle(createNode('delay-node', {}), chatState)).toEqual(NodeResult.next());
    });
  });

  // ========================================
  // EMAIL
  // ========================================

  describe('EmailHandler', () => {
    it('emits email-node-trigger with the node data and every answer, then moves on', async () => {
      const { EmailHandler } = handlers();
      chatState.saveVariableByName('topic', 'demo');
      const { node, emits } = withCtx(createNode('email-node', { to: 'team@example.com', subject: 'New lead {topic}' }));
      expect(await new EmailHandler().handle(node, chatState)).toEqual(NodeResult.next());
      expect(emits[0].event).toBe('email-node-trigger');
      expect(emits[0].payload.nodeData).toMatchObject({ to: 'team@example.com', subject: 'New lead {topic}' });
      expect(emits[0].payload.topic).toBe('demo');
    });

    it('reached by a jump it sends nothing (web index.ts)', async () => {
      const { EmailHandler } = handlers();
      const { node, emits } = withCtx(createNode('email-node', { to: 'a@b.co' }), { via: 'jump' });
      expect(await new EmailHandler().handle(node, chatState)).toEqual(NodeResult.next());
      expect(emits).toHaveLength(0);
    });
  });

  // ========================================
  // NATIVE INTEGRATIONS (#35: credentialId)
  // ========================================

  describe('server-run integrations', () => {
    const native = ['gmail-node', 'slack-node', 'discord-node', 'google-docs-node', 'google-drive-node', 'airtable-node', 'hubspot-node', 'notion-node', 'zohocrm-node'];

    it.each(native)('%s sends the step data as saved (credentialId included) and does not wait', async (type) => {
      const registry = new (require('../../src/core/nodes/NodeHandlerRegistry').NodeHandlerRegistry)();
      handlers().registerIntegrationHandlers(registry);
      const data = { credentialId: 'cred-1', operation: 'send', to: '{email}' };
      const { node, emits } = withCtx(createNode(type, data, { id: 'n1' }));
      expect(await registry.getHandler(type).handle(node, chatState)).toEqual(NodeResult.next());
      expect(emits[0].event).toBe('execute-integration');
      expect(emits[0].payload).toMatchObject({ nodeType: type, nodeId: 'n1', nodeData: data, chatSessionId: 'test-session', chatbotId: 'test-bot' });
    });

    it('a result that arrives later is saved by name', async () => {
      const { HubSpotHandler } = handlers();
      const { node, fire } = withCtx(createNode('hubspot-node', {}, { id: 'h' }));
      await new HubSpotHandler().handle(node, chatState);
      fire('integration-result', { nodeId: 'h', success: true, answerVariable: 'hubspot_data', answerValue: { id: '901' }, columnMappedValues: { plan: 'Pro' } });
      expect(chatState.getAnswer('hubspot_data')).toEqual({ id: '901' });
      expect(chatState.getAnswer('plan')).toBe('Pro');
    });

    it('google sheets runs as its read / write node', async () => {
      const { GoogleSheetsHandler } = handlers();
      const { node, emits } = withCtx(createNode('google-sheets-node', { operation: 'write' }));
      await new GoogleSheetsHandler().handle(node, chatState);
      expect(emits[0].payload.nodeType).toBe('google-sheets-write-node');
    });

    it('mailchimp / segment / salesforce wait, then success "source", failure "source-failure" (or the success edge)', async () => {
      const { SegmentHandler } = handlers();
      const edges = [
        { source: 'sg', target: 'ok', sourceHandle: 'source' },
        { source: 'sg', target: 'bad', sourceHandle: 'source-failure' },
      ];
      const a = withCtx(createNode('segment-node', {}, { id: 'sg' }), { edges });
      const run = new SegmentHandler().handle(a.node, chatState);
      a.fire('integration-result', { nodeId: 'sg', success: false });
      expect(await run).toEqual(NodeResult.port('source-failure'));

      const b = withCtx(createNode('segment-node', {}, { id: 'sg' }), { edges: [edges[0]] });
      const run2 = new SegmentHandler().handle(b.node, chatState);
      b.fire('integration-result', { nodeId: 'sg', success: false });
      expect(await run2).toEqual(NodeResult.port('source'));
    });
  });
});
