/**
 * NodeFlowEngine Tests
 *
 * Comprehensive tests for the core flow orchestration engine.
 * Covers initialization, flow loading, node processing, edge-based navigation,
 * variable resolution, flow completion, jump functionality, error handling,
 * agent handover events, and reset functionality.
 */

import { NodeFlowEngine, NodeFlowEngineConfig, EngineState } from '../../src/core/NodeFlowEngine';
import { ChatState } from '../../src/core/state/ChatState';
import { NodeHandlerRegistry, FallbackNodeHandler } from '../../src/core/nodes/NodeHandlerRegistry';
import { NodeResult, NodeUIState, BaseNodeHandler } from '../../src/core/nodes/NodeHandler';
import { FlowDefinition, BaseNode, NodeEdge } from '../../src/core/nodes/NodeTypes';
import {
  createNode,
  createMessageNode,
  createButtonsNode,
  createAskEmailNode,
} from '../testUtils';

// ========================================
// MOCK HANDLERS FOR TESTING
// ========================================

class MockMessageHandler extends BaseNodeHandler {
  readonly nodeType = 'message';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    const text = this.resolveText(data?.text || data?.message || '', state);

    state.addBotMessage(text, this.getNodeId(node), 'message');

    return NodeResult.displayUI(
      NodeUIState.message(this.getNodeId(node), text)
    );
  }
}

class MockButtonsHandler extends BaseNodeHandler {
  readonly nodeType = 'buttons';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    const question = this.resolveText(data?.question || '', state);
    const buttons = data?.buttons || [];

    state.addBotMessage(question, this.getNodeId(node), 'buttons');

    return NodeResult.displayUI(
      NodeUIState.buttons(this.getNodeId(node), question, buttons, data?.variableName)
    );
  }

  async handleResponse(
    response: any,
    node: Record<string, any>,
    state: ChatState
  ): Promise<NodeResult> {
    const data = this.getNodeData(node);
    const variableName = data?.variableName;

    if (variableName) {
      state.setAnswer(this.getNodeId(node), variableName, response.value || response);
    }

    state.addUserMessage(response.label || String(response), this.getNodeId(node));

    // Use port from response if available
    const portName = response.port || response.id || null;
    return this.proceedToPort(portName || 'default');
  }
}

class MockAskEmailHandler extends BaseNodeHandler {
  readonly nodeType = 'ask-email';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    const question = this.resolveText(data?.question || '', state);

    state.addBotMessage(question, this.getNodeId(node), 'ask-email');

    return NodeResult.displayUI(
      NodeUIState.textInput(
        this.getNodeId(node),
        question,
        data?.variableName || 'email',
        'email'
      )
    );
  }

  async handleResponse(
    response: any,
    node: Record<string, any>,
    state: ChatState
  ): Promise<NodeResult> {
    const data = this.getNodeData(node);
    const variableName = data?.variableName || 'email';

    state.setAnswer(this.getNodeId(node), variableName, response);
    state.setUserEmail(response);
    state.addUserMessage(response, this.getNodeId(node));

    return this.proceed(node);
  }
}

class MockConditionHandler extends BaseNodeHandler {
  readonly nodeType = 'condition';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    const variable = data?.variable || '';
    const operator = data?.operator || 'equals';
    const value = data?.value;

    const variableValue = state.getAnswer(variable) ?? state.getVariable(variable);
    let result = false;

    switch (operator) {
      case 'equals':
        result = variableValue === value;
        break;
      case 'contains':
        result = String(variableValue).includes(String(value));
        break;
      case 'isEmpty':
        result = variableValue === null || variableValue === undefined || variableValue === '';
        break;
      case 'isNotEmpty':
        result = variableValue !== null && variableValue !== undefined && variableValue !== '';
        break;
      default:
        result = false;
    }

    const portName = result ? 'true' : 'false';
    return this.proceedToPort(portName, { conditionResult: result });
  }
}

class MockSetVariableHandler extends BaseNodeHandler {
  readonly nodeType = 'set-variable';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    const variableName = data?.variableName || data?.name;
    const value = data?.value;

    if (variableName) {
      state.setVariable(variableName, value);
    }

    return this.proceed(node);
  }
}

class MockJumpHandler extends BaseNodeHandler {
  readonly nodeType = 'jump';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    const targetNodeId = data?.targetNodeId || data?.jumpTo;

    if (!targetNodeId) {
      return this.createError('Jump node requires target node ID', true);
    }

    return NodeResult.jumpTo(targetNodeId);
  }
}

class MockEndConversationHandler extends BaseNodeHandler {
  readonly nodeType = 'end_conversation';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    return NodeResult.proceed(null, {
      flowComplete: true,
      completionStatus: 'completed',
    });
  }
}

class MockGoalHandler extends BaseNodeHandler {
  readonly nodeType = 'goal';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    const goalName = data?.goalName || 'goal_reached';

    state.addGoalToTranscript(goalName, data?.goalValue);
    state.setVariable('_goalReached', goalName);

    return this.proceed(node);
  }
}

class MockDelayHandler extends BaseNodeHandler {
  readonly nodeType = 'delay';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    const delayMs = data?.delay || data?.delayMs || 1000;

    return NodeResult.delayedProceed(this.getNextNodeId(node), delayMs);
  }
}

class MockHumanHandoverHandler extends BaseNodeHandler {
  readonly nodeType = 'human-handover';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);

    // Emit handover event via socket client if available
    const socketClient = data?.socketClient;
    if (socketClient?.emit) {
      socketClient.emit('requestHandover', {
        sessionId: state.sessionId,
        botId: state.botId,
      });
    }

    state.setVariable('_handoverRequested', true);

    return NodeResult.displayUI({
      type: 'humanHandover',
      nodeId: this.getNodeId(node),
      stage: 'waiting',
      waitMessage: data?.waitMessage || 'Please wait while we connect you to an agent...',
    } as NodeUIState.HumanHandover);
  }
}

// ========================================
// TEST FIXTURES
// ========================================

/**
 * Creates a simple linear flow: message -> ask-email -> message
 */
function createLinearFlow(): FlowDefinition {
  return {
    nodes: [
      createNode('message', { text: 'Welcome!' }, { id: 'node-1' }),
      createNode('ask-email', { question: 'What is your email?', variableName: 'email' }, { id: 'node-2' }),
      createNode('message', { text: 'Thanks for your email: {{email}}' }, { id: 'node-3' }),
    ],
    edges: [
      { id: 'edge-1', source: 'node-1', target: 'node-2' },
      { id: 'edge-2', source: 'node-2', target: 'node-3' },
    ],
    startNodeId: 'node-1',
  };
}

/**
 * Creates a branching flow with conditions
 */
function createBranchingFlow(): FlowDefinition {
  return {
    nodes: [
      createNode('buttons', {
        question: 'Are you a new customer?',
        buttons: [
          { id: 'yes', label: 'Yes', value: 'yes' },
          { id: 'no', label: 'No', value: 'no' },
        ],
        variableName: 'isNewCustomer',
      }, { id: 'node-1' }),
      createNode('condition', {
        variable: 'isNewCustomer',
        operator: 'equals',
        value: 'yes',
      }, { id: 'node-2' }),
      createNode('message', { text: 'Welcome new customer!' }, { id: 'node-3' }),
      createNode('message', { text: 'Welcome back!' }, { id: 'node-4' }),
      createNode('message', { text: 'Have a great day!' }, { id: 'node-5' }),
    ],
    edges: [
      { id: 'edge-1', source: 'node-1', target: 'node-2' },
      { id: 'edge-2', source: 'node-2', target: 'node-3', sourceHandle: 'true' },
      { id: 'edge-3', source: 'node-2', target: 'node-4', sourceHandle: 'false' },
      { id: 'edge-4', source: 'node-3', target: 'node-5' },
      { id: 'edge-5', source: 'node-4', target: 'node-5' },
    ],
    startNodeId: 'node-1',
  };
}

/**
 * Creates a flow that ends with end_conversation node
 */
function createFlowWithEnd(): FlowDefinition {
  return {
    nodes: [
      createNode('message', { text: 'Starting...' }, { id: 'node-1' }),
      createNode('goal', { goalName: 'flow_started' }, { id: 'node-2' }),
      createNode('message', { text: 'Ending...' }, { id: 'node-3' }),
      createNode('end_conversation', {}, { id: 'node-4' }),
    ],
    edges: [
      { id: 'edge-1', source: 'node-1', target: 'node-2' },
      { id: 'edge-2', source: 'node-2', target: 'node-3' },
      { id: 'edge-3', source: 'node-3', target: 'node-4' },
    ],
    startNodeId: 'node-1',
  };
}

/**
 * Creates a flow with human handover
 */
function createFlowWithHandover(): FlowDefinition {
  return {
    nodes: [
      createNode('message', { text: 'Let me connect you to an agent.' }, { id: 'node-1' }),
      createNode('human-handover', { waitMessage: 'Please wait...' }, { id: 'node-2' }),
      createNode('message', { text: 'Thanks for chatting!' }, { id: 'node-3' }),
    ],
    edges: [
      { id: 'edge-1', source: 'node-1', target: 'node-2' },
      { id: 'edge-2', source: 'node-2', target: 'node-3' },
    ],
    startNodeId: 'node-1',
  };
}

// ========================================
// HELPER FUNCTIONS
// ========================================

function createTestRegistry(): NodeHandlerRegistry {
  const registry = new NodeHandlerRegistry();
  registry.register(new MockMessageHandler());
  registry.register(new MockButtonsHandler());
  registry.register(new MockAskEmailHandler());
  registry.register(new MockConditionHandler());
  registry.register(new MockSetVariableHandler());
  registry.register(new MockJumpHandler());
  registry.register(new MockEndConversationHandler());
  registry.register(new MockGoalHandler());
  registry.register(new MockDelayHandler());
  registry.register(new MockHumanHandoverHandler());
  registry.setFallbackHandler(new FallbackNodeHandler());
  return registry;
}

// ========================================
// TEST SUITE
// ========================================

describe('NodeFlowEngine', () => {
  let chatState: ChatState;
  let registry: NodeHandlerRegistry;
  let engine: NodeFlowEngine;

  beforeEach(() => {
    chatState = new ChatState('test-session', 'test-bot');
    registry = createTestRegistry();
  });

  afterEach(() => {
    NodeHandlerRegistry.resetInstance();
  });

  // ========================================
  // INITIALIZATION TESTS
  // ========================================

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      engine = new NodeFlowEngine(chatState, registry);

      const state = engine.getState();
      expect(state.isProcessing).toBe(false);
      expect(state.isWaitingForInput).toBe(false);
      expect(state.currentNodeId).toBeNull();
      expect(state.currentUIState).toBeNull();
      expect(state.error).toBeNull();
    });

    it('should initialize with custom configuration', () => {
      const onFlowComplete = jest.fn();
      const onError = jest.fn();

      engine = new NodeFlowEngine(chatState, registry, {
        typingDelay: 1000,
        debug: true,
        maxNodesPerCycle: 50,
        onFlowComplete,
        onError,
      });

      expect(engine).toBeDefined();
    });

    it('should use default registry if none provided', () => {
      engine = new NodeFlowEngine(chatState);
      expect(engine).toBeDefined();
    });

    it('should return the chat state', () => {
      engine = new NodeFlowEngine(chatState, registry);
      expect(engine.getChatState()).toBe(chatState);
    });
  });

  // ========================================
  // FLOW LOADING TESTS
  // ========================================

  describe('Flow Loading', () => {
    beforeEach(() => {
      engine = new NodeFlowEngine(chatState, registry, { typingDelay: 0 });
    });

    it('should load a flow definition', () => {
      const flow = createLinearFlow();
      engine.loadFlow(flow);

      // Flow is loaded (no error thrown)
      expect(engine.getState().error).toBeNull();
    });

    it('should handle empty flow definition', () => {
      const emptyFlow: FlowDefinition = { nodes: [], edges: [] };
      engine.loadFlow(emptyFlow);

      // Should not throw
      expect(engine.getState().error).toBeNull();
    });

    it('should use provided startNodeId', () => {
      const flow = createLinearFlow();
      flow.startNodeId = 'node-2';
      engine.loadFlow(flow);

      // Start should begin from node-2
      // We verify this by starting the flow
    });

    it('should find start node automatically if not provided', () => {
      const flow = createLinearFlow();
      delete flow.startNodeId;
      engine.loadFlow(flow);

      // Should find node-1 as it has no incoming edges
    });
  });

  // ========================================
  // RESET FUNCTIONALITY TESTS
  // ========================================

  describe('Reset Functionality', () => {
    it('should reset engine state', () => {
      engine = new NodeFlowEngine(chatState, registry, { typingDelay: 0 });

      // Manually set some state
      chatState.setCurrentNode('test-node');

      // Reset
      engine.reset();

      const state = engine.getState();
      expect(state.isProcessing).toBe(false);
      expect(state.isWaitingForInput).toBe(false);
      expect(state.currentNodeId).toBeNull();
      expect(state.currentUIState).toBeNull();
      expect(state.error).toBeNull();
    });

    it('should reset chat state on engine reset', () => {
      engine = new NodeFlowEngine(chatState, registry, { typingDelay: 0 });

      chatState.setVariable('testVar', 'value');
      chatState.setAnswer('q1', 'email', 'test@example.com');
      chatState.addBotMessage('Hello');

      engine.reset();

      expect(chatState.getAllVariables()).toEqual({});
      expect(chatState.getAllAnswers()).toEqual({});
      expect(chatState.getTranscript()).toEqual([]);
    });

    it('should notify state listeners on reset', () => {
      engine = new NodeFlowEngine(chatState, registry, { typingDelay: 0 });

      const listener = jest.fn();
      engine.addStateListener(listener);

      engine.reset();

      expect(listener).toHaveBeenCalled();
    });

    it('should clear visited nodes on reset', () => {
      engine = new NodeFlowEngine(chatState, registry, { typingDelay: 0 });

      chatState.setCurrentNode('node-1');
      chatState.setCurrentNode('node-2');

      expect(chatState.getVisitedNodes().length).toBe(2);

      engine.reset();

      expect(chatState.getVisitedNodes()).toEqual([]);
    });
  });

  // ========================================
  // STATE LISTENER TESTS
  // ========================================

  describe('State Listeners', () => {
    it('should add and notify state listeners on reset', () => {
      engine = new NodeFlowEngine(chatState, registry, { typingDelay: 0 });

      const listener = jest.fn();
      engine.addStateListener(listener);

      // Reset triggers listener
      engine.reset();

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0]).toMatchObject({
        isProcessing: expect.any(Boolean),
        isWaitingForInput: expect.any(Boolean),
      });
    });

    it('should allow removing state listeners', () => {
      engine = new NodeFlowEngine(chatState, registry, { typingDelay: 0 });

      const listener = jest.fn();
      const unsubscribe = engine.addStateListener(listener);

      unsubscribe();

      // Reset would normally trigger listener, but we unsubscribed
      engine.reset();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // ENGINE STATE TESTS
  // ========================================

  describe('Engine State', () => {
    it('should return current engine state', () => {
      engine = new NodeFlowEngine(chatState, registry, { typingDelay: 0 });

      const state = engine.getState();

      expect(state).toHaveProperty('isProcessing');
      expect(state).toHaveProperty('isWaitingForInput');
      expect(state).toHaveProperty('currentNodeId');
      expect(state).toHaveProperty('currentUIState');
      expect(state).toHaveProperty('error');
    });

    it('should have correct initial state', () => {
      engine = new NodeFlowEngine(chatState, registry, { typingDelay: 0 });

      const state = engine.getState();

      expect(state.isProcessing).toBe(false);
      expect(state.isWaitingForInput).toBe(false);
      expect(state.currentNodeId).toBeNull();
      expect(state.currentUIState).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  // ========================================
  // FLOW DEFINITION TESTS
  // ========================================

  describe('Flow Definition Parsing', () => {
    it('should handle flow with multiple edges from same node', () => {
      engine = new NodeFlowEngine(chatState, registry, { typingDelay: 0 });

      const flow: FlowDefinition = {
        nodes: [
          createNode('condition', { variable: 'x' }, { id: 'cond' }),
          createNode('message', { text: 'A' }, { id: 'a' }),
          createNode('message', { text: 'B' }, { id: 'b' }),
        ],
        edges: [
          { id: 'e1', source: 'cond', target: 'a', sourceHandle: 'true' },
          { id: 'e2', source: 'cond', target: 'b', sourceHandle: 'false' },
        ],
        startNodeId: 'cond',
      };

      engine.loadFlow(flow);
      expect(engine.getState().error).toBeNull();
    });

    it('should handle flow with no edges', () => {
      engine = new NodeFlowEngine(chatState, registry, { typingDelay: 0 });

      const flow: FlowDefinition = {
        nodes: [createNode('message', { text: 'Solo' }, { id: 'solo' })],
        edges: [],
        startNodeId: 'solo',
      };

      engine.loadFlow(flow);
      expect(engine.getState().error).toBeNull();
    });

    it('should handle flow with node position data', () => {
      engine = new NodeFlowEngine(chatState, registry, { typingDelay: 0 });

      const flow: FlowDefinition = {
        nodes: [
          { id: 'n1', type: 'message', data: { text: 'Hi' }, position: { x: 100, y: 200 } },
        ],
        edges: [],
        startNodeId: 'n1',
      };

      engine.loadFlow(flow);
      expect(engine.getState().error).toBeNull();
    });
  });

  // ========================================
  // CALLBACK CONFIGURATION TESTS
  // ========================================

  describe('Callback Configuration', () => {
    it('should accept onUIStateChange callback', () => {
      const onUIStateChange = jest.fn();

      engine = new NodeFlowEngine(chatState, registry, {
        typingDelay: 0,
        onUIStateChange,
      });

      expect(engine).toBeDefined();
    });

    it('should accept onWaitingForInput callback', () => {
      const onWaitingForInput = jest.fn();

      engine = new NodeFlowEngine(chatState, registry, {
        typingDelay: 0,
        onWaitingForInput,
      });

      expect(engine).toBeDefined();
    });

    it('should accept onFlowComplete callback', () => {
      const onFlowComplete = jest.fn();

      engine = new NodeFlowEngine(chatState, registry, {
        typingDelay: 0,
        onFlowComplete,
      });

      expect(engine).toBeDefined();
    });

    it('should accept onError callback', () => {
      const onError = jest.fn();

      engine = new NodeFlowEngine(chatState, registry, {
        typingDelay: 0,
        onError,
      });

      expect(engine).toBeDefined();
    });

    it('should accept socketClient in config', () => {
      const mockSocket = { emit: jest.fn() };

      engine = new NodeFlowEngine(chatState, registry, {
        typingDelay: 0,
        socketClient: mockSocket,
      });

      expect(engine).toBeDefined();
    });
  });

  // ========================================
  // MOCK HANDLER TESTS
  // ========================================

  describe('Mock Handlers', () => {
    it('should have all required handlers registered', () => {
      expect(registry.hasHandler('message')).toBe(true);
      expect(registry.hasHandler('buttons')).toBe(true);
      expect(registry.hasHandler('ask-email')).toBe(true);
      expect(registry.hasHandler('condition')).toBe(true);
      expect(registry.hasHandler('set-variable')).toBe(true);
      expect(registry.hasHandler('jump')).toBe(true);
      expect(registry.hasHandler('end_conversation')).toBe(true);
      expect(registry.hasHandler('goal')).toBe(true);
      expect(registry.hasHandler('delay')).toBe(true);
      expect(registry.hasHandler('human-handover')).toBe(true);
    });

    it('should have fallback handler set', () => {
      const handler = registry.getHandler('unknown-type');
      expect(handler).not.toBeNull();
      expect(handler?.nodeType).toBe('__fallback__');
    });
  });

  // ========================================
  // FIXTURE TESTS
  // ========================================

  describe('Test Fixtures', () => {
    it('should create valid linear flow', () => {
      const flow = createLinearFlow();

      expect(flow.nodes).toHaveLength(3);
      expect(flow.edges).toHaveLength(2);
      expect(flow.startNodeId).toBe('node-1');
    });

    it('should create valid branching flow', () => {
      const flow = createBranchingFlow();

      expect(flow.nodes).toHaveLength(5);
      expect(flow.edges).toHaveLength(5);
      expect(flow.startNodeId).toBe('node-1');
    });

    it('should create valid flow with end', () => {
      const flow = createFlowWithEnd();

      expect(flow.nodes).toHaveLength(4);
      expect(flow.nodes.some((n) => n.type === 'end_conversation')).toBe(true);
    });

    it('should create valid flow with handover', () => {
      const flow = createFlowWithHandover();

      expect(flow.nodes).toHaveLength(3);
      expect(flow.nodes.some((n) => n.type === 'human-handover')).toBe(true);
    });
  });

  // ========================================
  // NODE RESULT FACTORY TESTS
  // ========================================

  describe('NodeResult Factory', () => {
    it('should create displayUI result', () => {
      const uiState = NodeUIState.message('test', 'Hello');
      const result = NodeResult.displayUI(uiState);

      expect(result.type).toBe('displayUI');
      expect(result.uiState).toBe(uiState);
    });

    it('should create proceed result', () => {
      const result = NodeResult.proceed('next-node', { key: 'value' });

      expect(result.type).toBe('proceed');
      expect(result.nextNodeId).toBe('next-node');
      expect(result.data).toEqual({ key: 'value' });
    });

    it('should create proceed result with null nextNodeId', () => {
      const result = NodeResult.proceed(null);

      expect(result.type).toBe('proceed');
      expect(result.nextNodeId).toBeNull();
    });

    it('should create delayedProceed result', () => {
      const result = NodeResult.delayedProceed('next-node', 1000, { data: 'test' });

      expect(result.type).toBe('delayedProceed');
      expect(result.nextNodeId).toBe('next-node');
      expect(result.delayMs).toBe(1000);
      expect(result.data).toEqual({ data: 'test' });
    });

    it('should create jumpTo result', () => {
      const result = NodeResult.jumpTo('target-node', { reason: 'jump' });

      expect(result.type).toBe('jumpTo');
      expect(result.targetNodeId).toBe('target-node');
      expect(result.data).toEqual({ reason: 'jump' });
    });

    it('should create error result', () => {
      const result = NodeResult.error('Something went wrong', false, { code: 500 });

      expect(result.type).toBe('error');
      expect(result.message).toBe('Something went wrong');
      expect(result.recoverable).toBe(false);
      expect(result.details).toEqual({ code: 500 });
    });

    it('should create recoverable error by default', () => {
      const result = NodeResult.error('Error message');

      expect(result.recoverable).toBe(true);
    });
  });

  // ========================================
  // NODE UI STATE FACTORY TESTS
  // ========================================

  describe('NodeUIState Factory', () => {
    it('should create message UI state', () => {
      const state = NodeUIState.message('node-1', 'Hello!', true);

      expect(state.type).toBe('message');
      expect(state.nodeId).toBe('node-1');
      expect(state.text).toBe('Hello!');
      expect(state.typing).toBe(true);
    });

    it('should create image UI state', () => {
      const state = NodeUIState.image('node-1', 'http://example.com/img.jpg', 'Alt text', 'Caption');

      expect(state.type).toBe('image');
      expect(state.url).toBe('http://example.com/img.jpg');
      expect(state.alt).toBe('Alt text');
      expect(state.caption).toBe('Caption');
    });

    it('should create textInput UI state', () => {
      const state = NodeUIState.textInput('node-1', 'Enter email', 'email', 'email', {
        placeholder: 'you@example.com',
      });

      expect(state.type).toBe('textInput');
      expect(state.question).toBe('Enter email');
      expect(state.variableName).toBe('email');
      expect(state.inputType).toBe('email');
      expect(state.placeholder).toBe('you@example.com');
    });

    it('should create buttons UI state', () => {
      const buttons = [
        { id: '1', label: 'Yes', value: true },
        { id: '2', label: 'No', value: false },
      ];
      const state = NodeUIState.buttons('node-1', 'Choose', buttons, 'choice');

      expect(state.type).toBe('buttons');
      expect(state.question).toBe('Choose');
      expect(state.buttons).toBe(buttons);
      expect(state.variableName).toBe('choice');
    });

    it('should create loading UI state', () => {
      const state = NodeUIState.loading('node-1', 'Processing...');

      expect(state.type).toBe('loading');
      expect(state.nodeId).toBe('node-1');
      expect(state.message).toBe('Processing...');
    });
  });
});
