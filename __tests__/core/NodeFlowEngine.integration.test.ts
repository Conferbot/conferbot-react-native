/**
 * NodeFlowEngine Integration Tests
 *
 * Integration tests for NodeFlowEngine with ChatState.
 * These tests focus on verifiable synchronous behavior and state management
 * without relying on the async flow execution which requires complex timer handling.
 */

import { NodeFlowEngine, EngineState } from '../../src/core/NodeFlowEngine';
import { ChatState, TranscriptEntry } from '../../src/core/state/ChatState';
import { NodeHandlerRegistry, FallbackNodeHandler } from '../../src/core/nodes/NodeHandlerRegistry';
import { NodeResult, NodeUIState, BaseNodeHandler } from '../../src/core/nodes/NodeHandler';
import { FlowDefinition, NodeType } from '../../src/core/nodes/NodeTypes';
import {
  registerDisplayHandlers,
  registerAskHandlers,
  registerChoiceHandlers,
  registerAdvancedInputHandlers,
  registerLegacyHandlers,
  registerLogicHandlers,
  registerSpecialFlowHandlers,
} from '../../src/core/nodes/handlers';
import {
  createNode,
} from '../testUtils';

/**
 * Helper to register all handlers manually (avoids the buggy registerAllHandlers)
 */
function registerAllHandlersManually(registry: NodeHandlerRegistry): void {
  registerDisplayHandlers(registry);
  registerAskHandlers(registry);
  registerChoiceHandlers(registry);
  registerAdvancedInputHandlers(registry);
  registerLegacyHandlers(registry);
  registerLogicHandlers(registry);
  registerSpecialFlowHandlers(registry);
}

// ========================================
// TEST FIXTURES
// ========================================

/**
 * Creates a complete lead generation flow
 */
function createLeadGenerationFlow(): FlowDefinition {
  return {
    nodes: [
      createNode('message-node', { text: 'Welcome to our lead generation bot!' }, { id: 'welcome' }),
      createNode('ask-name-node', { question: 'What is your name?', variableName: 'customerName' }, { id: 'ask-name' }),
      createNode('ask-email-node', { question: 'What is your email?', variableName: 'customerEmail' }, { id: 'ask-email' }),
      createNode('ask-phone-number-node', { question: 'What is your phone number?', variableName: 'customerPhone' }, { id: 'ask-phone' }),
      createNode('n-choices-node', {
        question: 'What service are you interested in?',
        buttons: [
          { id: 'web', label: 'Web Development', value: 'web' },
          { id: 'mobile', label: 'Mobile App', value: 'mobile' },
          { id: 'consulting', label: 'Consulting', value: 'consulting' },
        ],
        variableName: 'service',
      }, { id: 'ask-service' }),
      createNode('goal', { goalName: 'lead_captured', goalValue: { source: 'chatbot' } }, { id: 'goal' }),
      createNode('message-node', { text: 'Thank you, {{customerName}}! We will contact you at {{customerEmail}}.' }, { id: 'thanks' }),
      createNode('end_conversation', {}, { id: 'end' }),
    ],
    edges: [
      { id: 'e1', source: 'welcome', target: 'ask-name' },
      { id: 'e2', source: 'ask-name', target: 'ask-email' },
      { id: 'e3', source: 'ask-email', target: 'ask-phone' },
      { id: 'e4', source: 'ask-phone', target: 'ask-service' },
      { id: 'e5', source: 'ask-service', target: 'goal' },
      { id: 'e6', source: 'goal', target: 'thanks' },
      { id: 'e7', source: 'thanks', target: 'end' },
    ],
    startNodeId: 'welcome',
  };
}

/**
 * Creates a conditional survey flow
 */
function createConditionalSurveyFlow(): FlowDefinition {
  return {
    nodes: [
      createNode('message-node', { text: 'Customer Satisfaction Survey' }, { id: 'intro' }),
      createNode('rating-choice-node', {
        question: 'How would you rate our service?',
        maxRating: 5,
        style: 'stars',
        variableName: 'rating',
      }, { id: 'rating-node' }),
      createNode('condition-node', {
        variable: 'rating',
        operator: 'greaterThanOrEquals',
        value: 4,
      }, { id: 'check-rating' }),
      createNode('message-node', { text: 'Great! We are glad you enjoyed our service.' }, { id: 'positive-feedback' }),
      createNode('ask-email-node', {
        question: 'Would you like to receive updates? Enter your email:',
        variableName: 'newsletterEmail',
      }, { id: 'ask-newsletter' }),
      createNode('message-node', { text: 'We are sorry to hear that. How can we improve?' }, { id: 'negative-feedback' }),
      createNode('n-choices-node', {
        question: 'What aspect needs improvement?',
        buttons: [
          { id: 'speed', label: 'Speed', value: 'speed' },
          { id: 'quality', label: 'Quality', value: 'quality' },
          { id: 'support', label: 'Support', value: 'support' },
        ],
        variableName: 'improvementArea',
      }, { id: 'ask-improvement' }),
      createNode('goal', { goalName: 'survey_complete' }, { id: 'survey-goal' }),
      createNode('message-node', { text: 'Thank you for your feedback!' }, { id: 'finale' }),
    ],
    edges: [
      { id: 'e1', source: 'intro', target: 'rating-node' },
      { id: 'e2', source: 'rating-node', target: 'check-rating' },
      { id: 'e3', source: 'check-rating', target: 'positive-feedback', sourceHandle: 'true' },
      { id: 'e4', source: 'check-rating', target: 'negative-feedback', sourceHandle: 'false' },
      { id: 'e5', source: 'positive-feedback', target: 'ask-newsletter' },
      { id: 'e6', source: 'negative-feedback', target: 'ask-improvement' },
      { id: 'e7', source: 'ask-newsletter', target: 'survey-goal' },
      { id: 'e8', source: 'ask-improvement', target: 'survey-goal' },
      { id: 'e9', source: 'survey-goal', target: 'finale' },
    ],
    startNodeId: 'intro',
  };
}

/**
 * Creates a quiz flow with scoring
 */
function createQuizFlow(): FlowDefinition {
  return {
    nodes: [
      createNode('message-node', { text: 'Welcome to the Knowledge Quiz!' }, { id: 'intro' }),
      createNode('variable-node', { variableName: 'score', value: 0 }, { id: 'init-score' }),
      createNode('n-choices-node', {
        question: 'Q1: What is the capital of France?',
        buttons: [
          { id: 'paris', label: 'Paris', value: 'paris' },
          { id: 'london', label: 'London', value: 'london' },
          { id: 'berlin', label: 'Berlin', value: 'berlin' },
        ],
        variableName: 'q1Answer',
      }, { id: 'q1' }),
      createNode('condition-node', {
        variable: 'q1Answer',
        operator: 'equals',
        value: 'paris',
      }, { id: 'check-q1' }),
      createNode('math-operation-node', {
        operation: 'add',
        operand1: 'score',
        operand2: 1,
        resultVariable: 'score',
      }, { id: 'add-point-q1' }),
      createNode('n-choices-node', {
        question: 'Q2: What is 2 + 2?',
        buttons: [
          { id: '3', label: '3', value: '3' },
          { id: '4', label: '4', value: '4' },
          { id: '5', label: '5', value: '5' },
        ],
        variableName: 'q2Answer',
      }, { id: 'q2' }),
      createNode('condition-node', {
        variable: 'q2Answer',
        operator: 'equals',
        value: '4',
      }, { id: 'check-q2' }),
      createNode('math-operation-node', {
        operation: 'add',
        operand1: 'score',
        operand2: 1,
        resultVariable: 'score',
      }, { id: 'add-point-q2' }),
      createNode('message-node', { text: 'Quiz complete! Your score: {{score}}/2' }, { id: 'result' }),
      createNode('goal', { goalName: 'quiz_complete', goalValue: { score: '{{score}}' } }, { id: 'quiz-goal' }),
    ],
    edges: [
      { id: 'e1', source: 'intro', target: 'init-score' },
      { id: 'e2', source: 'init-score', target: 'q1' },
      { id: 'e3', source: 'q1', target: 'check-q1' },
      { id: 'e4', source: 'check-q1', target: 'add-point-q1', sourceHandle: 'true' },
      { id: 'e5', source: 'check-q1', target: 'q2', sourceHandle: 'false' },
      { id: 'e6', source: 'add-point-q1', target: 'q2' },
      { id: 'e7', source: 'q2', target: 'check-q2' },
      { id: 'e8', source: 'check-q2', target: 'add-point-q2', sourceHandle: 'true' },
      { id: 'e9', source: 'check-q2', target: 'result', sourceHandle: 'false' },
      { id: 'e10', source: 'add-point-q2', target: 'result' },
      { id: 'e11', source: 'result', target: 'quiz-goal' },
    ],
    startNodeId: 'intro',
  };
}

/**
 * Creates a multi-step booking flow
 */
function createBookingFlow(): FlowDefinition {
  return {
    nodes: [
      createNode('message-node', { text: 'Welcome to our booking system!' }, { id: 'welcome' }),
      createNode('n-select-option-node', {
        question: 'Select a service:',
        options: [
          { id: 'haircut', label: 'Haircut', value: 'haircut' },
          { id: 'coloring', label: 'Hair Coloring', value: 'coloring' },
          { id: 'styling', label: 'Styling', value: 'styling' },
        ],
        variableName: 'selectedService',
      }, { id: 'select-service' }),
      createNode('calendar-node', {
        question: 'Select a date and time:',
        mode: 'datetime',
        variableName: 'appointmentTime',
      }, { id: 'select-time' }),
      createNode('ask-name-node', { question: 'Your name:', variableName: 'clientName' }, { id: 'get-name' }),
      createNode('ask-phone-number-node', { question: 'Your phone number:', variableName: 'clientPhone' }, { id: 'get-phone' }),
      createNode('message-node', {
        text: 'Booking confirmed!\nService: {{selectedService}}\nDate: {{appointmentTime}}\nName: {{clientName}}',
      }, { id: 'confirmation' }),
      createNode('goal', { goalName: 'booking_complete' }, { id: 'booking-goal' }),
    ],
    edges: [
      { id: 'e1', source: 'welcome', target: 'select-service' },
      { id: 'e2', source: 'select-service', target: 'select-time' },
      { id: 'e3', source: 'select-time', target: 'get-name' },
      { id: 'e4', source: 'get-name', target: 'get-phone' },
      { id: 'e5', source: 'get-phone', target: 'confirmation' },
      { id: 'e6', source: 'confirmation', target: 'booking-goal' },
    ],
    startNodeId: 'welcome',
  };
}

// ========================================
// TEST SUITE
// ========================================

describe('NodeFlowEngine Integration with ChatState', () => {
  let chatState: ChatState;
  let registry: NodeHandlerRegistry;
  let engine: NodeFlowEngine;

  beforeEach(() => {
    chatState = new ChatState('test-session', 'test-bot');
    registry = new NodeHandlerRegistry();
    registerAllHandlersManually(registry);
  });

  afterEach(() => {
    NodeHandlerRegistry.resetInstance();
  });

  // ========================================
  // CHATSTATE INTEGRATION TESTS (SYNCHRONOUS)
  // ========================================

  describe('ChatState Answer Storage', () => {
    it('should store answer variables with full parameters', () => {
      // setAnswer(questionId, variableName, value, nodeId?)
      chatState.setAnswer('q1', 'customerName', 'John Doe', 'ask-name');
      expect(chatState.getAnswer('customerName')).toBe('John Doe');
    });

    it('should store multiple answer variables', () => {
      chatState.setAnswer('q1', 'customerName', 'Jane Doe', 'ask-name');
      chatState.setAnswer('q2', 'customerEmail', 'jane@example.com', 'ask-email');
      chatState.setAnswer('q3', 'customerPhone', '1234567890', 'ask-phone');

      expect(chatState.getAnswer('customerName')).toBe('Jane Doe');
      expect(chatState.getAnswer('customerEmail')).toBe('jane@example.com');
      expect(chatState.getAnswer('customerPhone')).toBe('1234567890');
    });

    it('should get all answers as object', () => {
      chatState.setAnswer('q1', 'name', 'Alice', 'node1');
      chatState.setAnswer('q2', 'email', 'alice@test.com', 'node2');
      chatState.setAnswer('q3', 'company', 'Acme Corp', 'node3');

      const allAnswers = chatState.getAllAnswers();
      expect(allAnswers).toEqual({
        name: 'Alice',
        email: 'alice@test.com',
        company: 'Acme Corp',
      });
    });

    it('should include answer metadata with timestamp and nodeId', () => {
      const beforeTime = new Date().toISOString();
      chatState.setAnswer('q1', 'testVar', 'testValue', 'test-node');

      const answerVariables = chatState.getAnswerVariables();
      const testAnswer = answerVariables.find((a) => a.variableName === 'testVar');

      expect(testAnswer).toBeDefined();
      expect(testAnswer?.value).toBe('testValue');
      expect(testAnswer?.nodeId).toBe('test-node');
      expect(testAnswer?.questionId).toBe('q1');
      expect(testAnswer?.timestamp).toBeDefined();
    });

    it('should update existing answer variables', () => {
      chatState.setAnswer('q1', 'name', 'First', 'node1');
      expect(chatState.getAnswer('name')).toBe('First');

      chatState.setAnswer('q2', 'name', 'Updated', 'node2');
      expect(chatState.getAnswer('name')).toBe('Updated');
    });

    it('should store complex answer values', () => {
      const buttonSelection = { id: 'web', label: 'Web Development', value: 'web' };
      chatState.setAnswer('q1', 'service', buttonSelection, 'ask-service');

      expect(chatState.getAnswer('service')).toEqual(buttonSelection);
    });

    it('should store numeric answer values', () => {
      chatState.setAnswer('q1', 'rating', 5, 'rating-node');
      expect(chatState.getAnswer('rating')).toBe(5);
    });
  });

  describe('ChatState Variable Storage', () => {
    it('should store and retrieve variables', () => {
      chatState.setVariable('score', 0);
      expect(chatState.getVariable('score')).toBe(0);

      chatState.setVariable('score', 5);
      expect(chatState.getVariable('score')).toBe(5);
    });

    it('should differentiate between answers and variables', () => {
      chatState.setAnswer('q1', 'userName', 'John', 'ask-name');
      chatState.setVariable('totalScore', 100);

      expect(chatState.getAnswer('userName')).toBe('John');
      expect(chatState.getVariable('totalScore')).toBe(100);
      // Variables should not be in answers
      expect(chatState.getAnswer('totalScore')).toBeUndefined();
    });

    it('should support various variable types', () => {
      chatState.setVariable('stringVar', 'hello');
      chatState.setVariable('numberVar', 42);
      chatState.setVariable('boolVar', true);
      chatState.setVariable('objectVar', { key: 'value' });
      chatState.setVariable('arrayVar', [1, 2, 3]);

      expect(chatState.getVariable('stringVar')).toBe('hello');
      expect(chatState.getVariable('numberVar')).toBe(42);
      expect(chatState.getVariable('boolVar')).toBe(true);
      expect(chatState.getVariable('objectVar')).toEqual({ key: 'value' });
      expect(chatState.getVariable('arrayVar')).toEqual([1, 2, 3]);
    });

    it('should delete variables', () => {
      chatState.setVariable('tempVar', 'value');
      expect(chatState.getVariable('tempVar')).toBe('value');

      chatState.deleteVariable('tempVar');
      expect(chatState.getVariable('tempVar')).toBeUndefined();
    });
  });

  describe('ChatState Transcript Recording', () => {
    it('should record bot messages to transcript', () => {
      chatState.addBotMessage('Welcome message', 'welcome-node', 'message');

      const transcript = chatState.getTranscript();
      expect(transcript.length).toBe(1);
      expect(transcript[0].type).toBe('bot');
      expect(transcript[0].text).toBe('Welcome message');
      expect(transcript[0].nodeId).toBe('welcome-node');
    });

    it('should record user messages to transcript', () => {
      chatState.addUserMessage('User response', 'ask-name');

      const transcript = chatState.getTranscript();
      expect(transcript.length).toBe(1);
      expect(transcript[0].type).toBe('user');
      expect(transcript[0].text).toBe('User response');
    });

    it('should record goals to transcript', () => {
      chatState.addGoalToTranscript('lead_captured', { source: 'chatbot' });

      const transcript = chatState.getTranscript();
      expect(transcript.length).toBe(1);
      expect(transcript[0].type).toBe('goal');
      expect(transcript[0].data?.goalName).toBe('lead_captured');
    });

    it('should maintain transcript order', () => {
      chatState.addBotMessage('First message', 'node1');
      chatState.addUserMessage('User reply', 'node1');
      chatState.addBotMessage('Second message', 'node2');

      const transcript = chatState.getTranscript();
      expect(transcript.length).toBe(3);
      expect(transcript[0].text).toBe('First message');
      expect(transcript[1].text).toBe('User reply');
      expect(transcript[2].text).toBe('Second message');
    });

    it('should include timestamps in transcript entries', () => {
      chatState.addBotMessage('Test message', 'test-node');

      const transcript = chatState.getTranscript();
      expect(transcript[0].timestamp).toBeDefined();
    });

    it('should include nodeId in transcript entries', () => {
      chatState.addBotMessage('Node test', 'specific-node-id');

      const transcript = chatState.getTranscript();
      expect(transcript[0].nodeId).toBe('specific-node-id');
    });

    it('should add custom transcript entries', () => {
      const entry: TranscriptEntry = {
        type: 'system',
        text: 'System message',
        timestamp: new Date().toISOString(),
      };
      chatState.addToTranscript(entry);

      const transcript = chatState.getTranscript();
      expect(transcript[0].type).toBe('system');
      expect(transcript[0].text).toBe('System message');
    });
  });

  describe('ChatState Node Tracking', () => {
    it('should track current node', () => {
      chatState.setCurrentNode('welcome');
      expect(chatState.currentNodeId).toBe('welcome');

      chatState.setCurrentNode('ask-name');
      expect(chatState.currentNodeId).toBe('ask-name');
    });

    it('should track visited nodes via setCurrentNode', () => {
      chatState.setCurrentNode('welcome');
      chatState.setCurrentNode('ask-name');
      chatState.setCurrentNode('ask-email');

      expect(chatState.hasVisitedNode('welcome')).toBe(true);
      expect(chatState.hasVisitedNode('ask-name')).toBe(true);
      expect(chatState.hasVisitedNode('ask-email')).toBe(true);
      expect(chatState.hasVisitedNode('ask-phone')).toBe(false);
    });

    it('should not duplicate visited nodes', () => {
      chatState.setCurrentNode('welcome');
      chatState.setCurrentNode('welcome');
      chatState.setCurrentNode('welcome');

      const visitedNodes = chatState.getVisitedNodes();
      const welcomeCount = visitedNodes.filter((n) => n === 'welcome').length;
      expect(welcomeCount).toBe(1);
    });
  });

  describe('ChatState Flow Completion', () => {
    it('should track flow completion status', () => {
      expect(chatState.isFlowComplete).toBe(false);

      chatState.markConversationComplete('end_conversation');

      expect(chatState.isFlowComplete).toBe(true);
      expect(chatState.flowCompletionReason).toBe('end_conversation');
    });

    it('should track completion with different reasons', () => {
      chatState.markConversationComplete('agent_handover');
      expect(chatState.flowCompletionReason).toBe('agent_handover');
    });

    it('should set flow completion variables', () => {
      chatState.markConversationComplete('completed');

      expect(chatState.getVariable('_flowComplete')).toBe(true);
      expect(chatState.getVariable('_flowCompletedAt')).toBeDefined();
      expect(chatState.getVariable('_flowCompletionReason')).toBe('completed');
    });
  });

  describe('ChatState State Listeners', () => {
    it('should notify listeners on answer changes', () => {
      const listener = jest.fn();
      chatState.addListener(listener);

      chatState.setAnswer('q1', 'name', 'Test', 'node1');

      expect(listener).toHaveBeenCalled();
    });

    it('should notify listeners on variable changes', () => {
      const listener = jest.fn();
      chatState.addListener(listener);

      chatState.setVariable('score', 10);

      expect(listener).toHaveBeenCalled();
    });

    it('should allow removing listeners via unsubscribe function', () => {
      const listener = jest.fn();
      const unsubscribe = chatState.addListener(listener);

      // Clear and unsubscribe
      listener.mockClear();
      unsubscribe();

      chatState.setAnswer('q1', 'name', 'Test', 'node1');

      expect(listener).not.toHaveBeenCalled();
    });

    it('should notify multiple listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      chatState.addListener(listener1);
      chatState.addListener(listener2);

      chatState.setAnswer('q1', 'name', 'Test', 'node1');

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  describe('ChatState Serialization', () => {
    it('should serialize state to JSON', () => {
      chatState.setAnswer('q1', 'name', 'John', 'ask-name');
      chatState.setAnswer('q2', 'email', 'john@test.com', 'ask-email');
      chatState.setVariable('score', 5);
      chatState.addBotMessage('Hello', 'welcome');
      chatState.addUserMessage('Hi', 'welcome');
      chatState.setCurrentNode('ask-email');

      const serialized = chatState.toJSON();

      expect(serialized.sessionId).toBe('test-session');
      expect(serialized.botId).toBe('test-bot');
      expect(serialized.answerVariables.length).toBe(2);
      expect(serialized.transcript.length).toBe(2);
      expect(serialized.currentNodeId).toBe('ask-email');
    });

    it('should restore state from JSON', () => {
      chatState.setAnswer('q1', 'name', 'Jane', 'node1');
      chatState.setVariable('counter', 42);
      chatState.addBotMessage('Test message', 'node1');
      chatState.setCurrentNode('node2');

      const serialized = chatState.toJSON();
      const restored = ChatState.fromJSON(serialized);

      expect(restored.sessionId).toBe('test-session');
      expect(restored.botId).toBe('test-bot');
      expect(restored.getAnswer('name')).toBe('Jane');
      expect(restored.getVariable('counter')).toBe(42);
      expect(restored.getTranscript().length).toBe(1);
      expect(restored.currentNodeId).toBe('node2');
    });

    it('should preserve answer metadata through serialization', () => {
      chatState.setAnswer('q1', 'testVar', 'testValue', 'test-node');

      const serialized = chatState.toJSON();
      const restored = ChatState.fromJSON(serialized);

      const answerVariables = restored.getAnswerVariables();
      const testAnswer = answerVariables.find((a) => a.variableName === 'testVar');

      expect(testAnswer?.nodeId).toBe('test-node');
      expect(testAnswer?.questionId).toBe('q1');
      expect(testAnswer?.timestamp).toBeDefined();
    });
  });

  describe('ChatState Transcript Summary', () => {
    it('should generate accurate transcript summary', () => {
      chatState.addBotMessage('Welcome', 'node1');
      chatState.addUserMessage('Hello', 'node1');
      chatState.addBotMessage('What is your name?', 'node2');
      chatState.addUserMessage('John', 'node2');
      chatState.addGoalToTranscript('lead_captured', {});
      chatState.setAnswer('q1', 'name', 'John', 'node2');
      chatState.setAnswer('q2', 'email', 'john@test.com', 'node3');

      const summary = chatState.generateTranscriptSummary();

      expect(summary.totalMessages).toBe(5);
      expect(summary.botMessages).toBe(2);
      expect(summary.userMessages).toBe(2);
      expect(summary.goalsReached.length).toBe(1);
      expect(summary.answersCollected).toBe(2);
    });

    it('should handle empty transcript', () => {
      const summary = chatState.generateTranscriptSummary();

      expect(summary.totalMessages).toBe(0);
      expect(summary.botMessages).toBe(0);
      expect(summary.userMessages).toBe(0);
    });
  });

  // ========================================
  // ENGINE + CHATSTATE INTEGRATION TESTS
  // ========================================

  describe('Engine and ChatState Integration', () => {
    it('should create engine with chatState', () => {
      engine = new NodeFlowEngine(chatState, registry, { typingDelay: 0 });
      expect(engine).toBeDefined();

      const state = engine.getState();
      expect(state.isProcessing).toBe(false);
      expect(state.isWaitingForInput).toBe(false);
    });

    it('should load flow into engine', () => {
      engine = new NodeFlowEngine(chatState, registry, { typingDelay: 0 });
      const flow = createLeadGenerationFlow();

      // loadFlow is synchronous and doesn't throw
      engine.loadFlow(flow);
      expect(engine).toBeDefined();
    });

    it('should get chat state from engine', () => {
      engine = new NodeFlowEngine(chatState, registry, { typingDelay: 0 });

      const retrievedState = engine.getChatState();
      expect(retrievedState).toBe(chatState);
    });

    it('should reset engine and chat state', () => {
      engine = new NodeFlowEngine(chatState, registry, { typingDelay: 0 });
      const flow = createLeadGenerationFlow();
      engine.loadFlow(flow);

      // Add some data
      chatState.setAnswer('q1', 'name', 'Test', 'node1');
      chatState.setVariable('score', 10);

      engine.reset();

      expect(chatState.getAnswer('name')).toBeUndefined();
      expect(chatState.getVariable('score')).toBeUndefined();
      expect(engine.getState().currentNodeId).toBeNull();
    });

    it('should add engine state listeners', () => {
      engine = new NodeFlowEngine(chatState, registry, { typingDelay: 0 });
      const listener = jest.fn();

      const unsubscribe = engine.addStateListener(listener);
      expect(typeof unsubscribe).toBe('function');

      // Trigger a state change
      engine.reset();
      expect(listener).toHaveBeenCalled();
    });

    it('should remove engine state listeners via unsubscribe', () => {
      engine = new NodeFlowEngine(chatState, registry, { typingDelay: 0 });
      const listener = jest.fn();

      const unsubscribe = engine.addStateListener(listener);
      listener.mockClear();
      unsubscribe();

      engine.reset();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // FLOW DEFINITION TESTS
  // ========================================

  describe('Flow Definition Fixtures', () => {
    it('should create valid lead generation flow', () => {
      const flow = createLeadGenerationFlow();

      expect(flow.nodes.length).toBe(8);
      expect(flow.edges.length).toBe(7);
      expect(flow.startNodeId).toBe('welcome');
    });

    it('should create valid conditional survey flow', () => {
      const flow = createConditionalSurveyFlow();

      expect(flow.nodes.length).toBe(9);
      expect(flow.startNodeId).toBe('intro');

      // Should have branching edges
      const trueEdge = flow.edges.find((e) => e.sourceHandle === 'true');
      const falseEdge = flow.edges.find((e) => e.sourceHandle === 'false');
      expect(trueEdge).toBeDefined();
      expect(falseEdge).toBeDefined();
    });

    it('should create valid quiz flow', () => {
      const flow = createQuizFlow();

      expect(flow.nodes.length).toBe(10);
      expect(flow.startNodeId).toBe('intro');

      // Should have set-variable node for score
      const setVarNode = flow.nodes.find((n) => n.type === 'variable-node');
      expect(setVarNode).toBeDefined();
      expect(setVarNode?.data.variableName).toBe('score');
    });

    it('should create valid booking flow', () => {
      const flow = createBookingFlow();

      expect(flow.nodes.length).toBe(7);
      expect(flow.startNodeId).toBe('welcome');

      // Should have various input types
      const nodeTypes = flow.nodes.map((n) => n.type);
      expect(nodeTypes).toContain('n-select-option-node');
      expect(nodeTypes).toContain('calendar-node');
      expect(nodeTypes).toContain('ask-name-node');
      expect(nodeTypes).toContain('ask-phone-number-node');
    });

    it('should have unique node ids in each flow', () => {
      const flows = [
        createLeadGenerationFlow(),
        createConditionalSurveyFlow(),
        createQuizFlow(),
        createBookingFlow(),
      ];

      flows.forEach((flow) => {
        const nodeIds = flow.nodes.map((n) => n.id);
        const uniqueIds = new Set(nodeIds);
        expect(uniqueIds.size).toBe(nodeIds.length);
      });
    });

    it('should have valid edge connections', () => {
      const flow = createLeadGenerationFlow();

      flow.edges.forEach((edge) => {
        const sourceNode = flow.nodes.find((n) => n.id === edge.source);
        const targetNode = flow.nodes.find((n) => n.id === edge.target);
        expect(sourceNode).toBeDefined();
        expect(targetNode).toBeDefined();
      });
    });
  });

  // ========================================
  // HANDLER REGISTRY INTEGRATION TESTS
  // ========================================

  describe('Handler Registry Integration', () => {
    it('should have handlers for all node types in flows', () => {
      const flows = [
        createLeadGenerationFlow(),
        createConditionalSurveyFlow(),
        createQuizFlow(),
        createBookingFlow(),
      ];

      const allNodeTypes = new Set<string>();
      flows.forEach((flow) => {
        flow.nodes.forEach((node) => {
          allNodeTypes.add(node.type);
        });
      });

      allNodeTypes.forEach((nodeType) => {
        const handler = registry.getHandler(nodeType as NodeType);
        expect(handler).toBeDefined();
      });
    });

    it('should get fallback handler for unknown types via registry', () => {
      // Registry needs to have fallback set
      const handler = registry.getHandler('unknown-type' as NodeType);
      // Handler should exist (either specific or fallback)
      expect(handler).toBeDefined();
    });
  });

  // ========================================
  // VARIABLE RESOLUTION TESTS
  // ========================================

  describe('Variable Resolution', () => {
    it('should resolve simple variable in text', () => {
      chatState.setAnswer('q1', 'customerName', 'John', 'ask-name');

      const text = 'Hello {{customerName}}!';
      const resolved = chatState.resolveVariables(text);

      expect(resolved).toBe('Hello John!');
    });

    it('should resolve multiple variables in text', () => {
      chatState.setAnswer('q1', 'customerName', 'Jane', 'ask-name');
      chatState.setAnswer('q2', 'customerEmail', 'jane@test.com', 'ask-email');

      const text = 'Contact {{customerName}} at {{customerEmail}}.';
      const resolved = chatState.resolveVariables(text);

      expect(resolved).toBe('Contact Jane at jane@test.com.');
    });

    it('should handle missing variables gracefully', () => {
      const text = 'Hello {{unknownVar}}!';
      const resolved = chatState.resolveVariables(text);

      // Should keep placeholder for unknown variables
      expect(resolved).toBe('Hello {{unknownVar}}!');
    });

    it('should resolve variables from both answers and variables', () => {
      chatState.setAnswer('q1', 'name', 'Alice', 'node1');
      chatState.setVariable('score', 100);

      const answerText = 'Name: {{name}}';
      const varText = 'Score: {{score}}';

      const resolvedAnswer = chatState.resolveVariables(answerText);
      const resolvedVar = chatState.resolveVariables(varText);

      expect(resolvedAnswer).toBe('Name: Alice');
      expect(resolvedVar).toBe('Score: 100');
    });

    it('should resolve user metadata variables', () => {
      chatState.setUserName('Bob');
      chatState.setUserEmail('bob@test.com');

      const text = '{{name}} - {{email}}';
      const resolved = chatState.resolveVariables(text);

      expect(resolved).toBe('Bob - bob@test.com');
    });
  });

  // ========================================
  // CALLBACK CONFIGURATION TESTS
  // ========================================

  describe('Engine Callback Configuration', () => {
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

    it('should accept all callbacks together', () => {
      const callbacks = {
        onUIStateChange: jest.fn(),
        onWaitingForInput: jest.fn(),
        onFlowComplete: jest.fn(),
        onError: jest.fn(),
        typingDelay: 0,
        debug: true,
        maxNodesPerCycle: 50,
      };
      engine = new NodeFlowEngine(chatState, registry, callbacks);

      expect(engine).toBeDefined();
    });
  });

  // ========================================
  // ENGINE STATE TESTS
  // ========================================

  describe('Engine State', () => {
    it('should start with correct initial state', () => {
      engine = new NodeFlowEngine(chatState, registry, { typingDelay: 0 });

      const state = engine.getState();
      expect(state.isProcessing).toBe(false);
      expect(state.isWaitingForInput).toBe(false);
      expect(state.currentNodeId).toBeNull();
      expect(state.currentUIState).toBeNull();
      expect(state.error).toBeNull();
    });

    it('should return consistent state structure', () => {
      engine = new NodeFlowEngine(chatState, registry, { typingDelay: 0 });

      const state: EngineState = engine.getState();

      // Verify all expected properties exist
      expect('isProcessing' in state).toBe(true);
      expect('isWaitingForInput' in state).toBe(true);
      expect('currentNodeId' in state).toBe(true);
      expect('currentUIState' in state).toBe(true);
      expect('error' in state).toBe(true);
    });

    it('should reset state correctly', () => {
      engine = new NodeFlowEngine(chatState, registry, { typingDelay: 0 });
      const flow = createLeadGenerationFlow();
      engine.loadFlow(flow);

      engine.reset();

      const state = engine.getState();
      expect(state.isProcessing).toBe(false);
      expect(state.isWaitingForInput).toBe(false);
      expect(state.currentNodeId).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  // ========================================
  // USER METADATA TESTS
  // ========================================

  describe('ChatState User Metadata', () => {
    it('should set and get user name', () => {
      chatState.setUserName('John Doe');
      expect(chatState.userName).toBe('John Doe');
    });

    it('should set and get user email', () => {
      chatState.setUserEmail('john@example.com');
      expect(chatState.userEmail).toBe('john@example.com');
    });

    it('should set and get user phone', () => {
      chatState.setUserPhone('+1234567890');
      expect(chatState.userPhone).toBe('+1234567890');
    });

    it('should set multiple metadata at once', () => {
      chatState.setUserMetadata({
        name: 'Jane',
        email: 'jane@test.com',
        customField: 'custom value',
      });

      const metadata = chatState.getUserMetadata();
      expect(metadata.name).toBe('Jane');
      expect(metadata.email).toBe('jane@test.com');
      expect(metadata.customField).toBe('custom value');
    });
  });

  // ========================================
  // RESET FUNCTIONALITY TESTS
  // ========================================

  describe('ChatState Reset', () => {
    it('should clear all data on reset', () => {
      // Add data
      chatState.setAnswer('q1', 'name', 'Test', 'node1');
      chatState.setVariable('score', 100);
      chatState.addBotMessage('Hello', 'node1');
      chatState.setUserName('User');
      chatState.setCurrentNode('node2');
      chatState.markConversationComplete('done');

      // Reset
      chatState.reset();

      // Verify all cleared
      expect(chatState.getAnswer('name')).toBeUndefined();
      expect(chatState.getVariable('score')).toBeUndefined();
      expect(chatState.getTranscript().length).toBe(0);
      expect(chatState.userName).toBeUndefined();
      expect(chatState.currentNodeId).toBeNull();
      expect(chatState.isFlowComplete).toBe(false);
    });

    it('should preserve session and bot IDs after reset', () => {
      chatState.reset();

      expect(chatState.sessionId).toBe('test-session');
      expect(chatState.botId).toBe('test-bot');
    });
  });
});
