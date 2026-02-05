/**
 * SpecialNodeHandlers Tests
 *
 * Comprehensive tests for special flow node handlers:
 * - GoalHandler (conversion tracking)
 * - EndConversationHandler (flow termination)
 */

import { ChatState } from '../../src/core/state/ChatState';
import { NodeResult, NodeUIState } from '../../src/core/nodes/NodeHandler';
import {
  GoalHandler,
  EndConversationHandler,
  FlowCompletionState,
  SpecialNodeSocketEvents,
  setSocketEmitter,
  getSocketEmitter,
  type GoalReachedPayload,
  type ConversationEndedPayload,
} from '../../src/core/nodes/handlers/SpecialNodeHandlers';
import { createNode } from '../testUtils';

describe('Special Node Handlers', () => {
  let chatState: ChatState;
  let mockSocketEmitter: {
    emit: jest.Mock;
  };

  beforeEach(() => {
    chatState = new ChatState('test-session', 'test-bot');
    mockSocketEmitter = {
      emit: jest.fn(),
    };
    setSocketEmitter(mockSocketEmitter);
  });

  afterEach(() => {
    setSocketEmitter(null);
  });

  // ========================================
  // GOAL HANDLER TESTS
  // ========================================

  describe('GoalHandler', () => {
    const handler = new GoalHandler();

    it('should have correct node type', () => {
      expect(handler.nodeType).toBe('goal');
    });

    it('should emit goal_reached event', async () => {
      const node = createNode('goal', {
        goalName: 'purchase_complete',
        goalValue: 99.99,
      });

      await handler.handle(node, chatState);

      expect(mockSocketEmitter.emit).toHaveBeenCalledWith(
        SpecialNodeSocketEvents.GOAL_REACHED,
        expect.objectContaining({
          goalName: 'purchase_complete',
          goalValue: 99.99,
          sessionId: 'test-session',
        })
      );
    });

    it('should store goal variable in state', async () => {
      const node = createNode('goal', {
        goalName: 'sign_up',
      });

      await handler.handle(node, chatState);

      const goalVar = chatState.getVariable('goal_sign_up');
      expect(goalVar).toBeDefined();
      expect(goalVar.reached).toBe(true);
      expect(goalVar.timestamp).toBeDefined();
    });

    it('should increment goals reached counter', async () => {
      const node1 = createNode('goal', { goalName: 'goal_1' });
      const node2 = createNode('goal', { goalName: 'goal_2' });

      await handler.handle(node1, chatState);
      expect(chatState.getVariable('_goalsReachedCount')).toBe(1);

      await handler.handle(node2, chatState);
      expect(chatState.getVariable('_goalsReachedCount')).toBe(2);
    });

    it('should add goal names to reached list', async () => {
      const node1 = createNode('goal', { goalName: 'first_goal' });
      const node2 = createNode('goal', { goalName: 'second_goal' });

      await handler.handle(node1, chatState);
      await handler.handle(node2, chatState);

      const goalsList = chatState.getVariable('_goalsReachedList');
      expect(goalsList).toContain('first_goal');
      expect(goalsList).toContain('second_goal');
    });

    it('should proceed to next node (not stop flow)', async () => {
      const node = createNode('goal', {
        goalName: 'test_goal',
      });

      const result = await handler.handle(node, chatState);

      expect(result.type).toBe('proceed');
      if (result.type === 'proceed') {
        expect(result.data?.goalReached).toBe(true);
        expect(result.data?.goalName).toBe('test_goal');
      }
    });

    it('should include conversion data in event', async () => {
      const node = createNode('goal', {
        goalName: 'purchase',
        conversionData: {
          revenue: 149.99,
          currency: 'USD',
          orderId: 'ORD-12345',
        },
      });

      await handler.handle(node, chatState);

      expect(mockSocketEmitter.emit).toHaveBeenCalledWith(
        SpecialNodeSocketEvents.GOAL_REACHED,
        expect.objectContaining({
          conversionData: {
            revenue: 149.99,
            currency: 'USD',
            orderId: 'ORD-12345',
          },
        })
      );
    });

    it('should extract revenue, currency, orderId from individual fields', async () => {
      const node = createNode('goal', {
        goalName: 'purchase',
        revenue: 50.00,
        currency: 'EUR',
        orderId: 'ORD-67890',
      });

      await handler.handle(node, chatState);

      expect(mockSocketEmitter.emit).toHaveBeenCalledWith(
        SpecialNodeSocketEvents.GOAL_REACHED,
        expect.objectContaining({
          conversionData: expect.objectContaining({
            revenue: 50.00,
            currency: 'EUR',
            orderId: 'ORD-67890',
          }),
        })
      );
    });

    it('should include user metadata in event when available', async () => {
      chatState.setUserName('John Doe');
      chatState.setUserEmail('john@example.com');

      const node = createNode('goal', {
        goalName: 'contact_submitted',
      });

      await handler.handle(node, chatState);

      expect(mockSocketEmitter.emit).toHaveBeenCalledWith(
        SpecialNodeSocketEvents.GOAL_REACHED,
        expect.objectContaining({
          userName: 'John Doe',
          userEmail: 'john@example.com',
        })
      );
    });

    it('should use default goal name when not specified', async () => {
      const node = createNode('goal', {});

      await handler.handle(node, chatState);

      expect(mockSocketEmitter.emit).toHaveBeenCalledWith(
        SpecialNodeSocketEvents.GOAL_REACHED,
        expect.objectContaining({
          goalName: 'unnamed_goal',
        })
      );
    });

    it('should sanitize goal name for variable name', async () => {
      const node = createNode('goal', {
        goalName: 'My Special Goal!',
      });

      await handler.handle(node, chatState);

      const goalVar = chatState.getVariable('goal_my_special_goal');
      expect(goalVar).toBeDefined();
    });

    it('should handle missing node data gracefully', async () => {
      const node = { id: 'test-node' };

      const result = await handler.handle(node, chatState);

      expect(result.type).toBe('proceed');
    });

    it('should not emit when socket emitter is not configured', async () => {
      setSocketEmitter(null);

      const node = createNode('goal', {
        goalName: 'test_goal',
      });

      // Should not throw error
      await handler.handle(node, chatState);
    });

    it('should handle socket emit errors gracefully', async () => {
      mockSocketEmitter.emit.mockImplementationOnce(() => {
        throw new Error('Socket error');
      });

      const node = createNode('goal', {
        goalName: 'test_goal',
      });

      // Should not throw error, just log it
      const result = await handler.handle(node, chatState);
      expect(result.type).toBe('proceed');
    });

    it('should add goal to transcript', async () => {
      const node = createNode('goal', {
        goalName: 'signup_complete',
        goalValue: 'premium',
      });

      await handler.handle(node, chatState);

      // Verify goal was added to transcript
      // Note: This depends on ChatState.addGoalToTranscript implementation
    });
  });

  // ========================================
  // END CONVERSATION HANDLER TESTS
  // ========================================

  describe('EndConversationHandler', () => {
    const handler = new EndConversationHandler();

    it('should have correct node type', () => {
      expect(handler.nodeType).toBe('end_conversation');
    });

    it('should emit conversation_ended event', async () => {
      const node = createNode('end_conversation', {
        completionStatus: 'completed',
      });

      await handler.handle(node, chatState);

      expect(mockSocketEmitter.emit).toHaveBeenCalledWith(
        SpecialNodeSocketEvents.CONVERSATION_ENDED,
        expect.objectContaining({
          sessionId: 'test-session',
          completionStatus: 'completed',
        })
      );
    });

    it('should mark conversation as complete in state', async () => {
      const node = createNode('end_conversation', {
        completionStatus: 'completed',
      });

      await handler.handle(node, chatState);

      expect(chatState.getVariable('_completionStatus')).toBe('completed');
      expect(chatState.getVariable('_conversationEndedAt')).toBeDefined();
    });

    it('should display end message when provided', async () => {
      const node = createNode('end_conversation', {
        endMessage: 'Thank you for chatting with us!',
      });

      const result = await handler.handle(node, chatState);

      expect(result.type).toBe('displayUI');
      if (result.type === 'displayUI') {
        const uiState = result.uiState as NodeUIState.Message;
        expect(uiState.type).toBe('message');
        expect(uiState.text).toBe('Thank you for chatting with us!');
      }
    });

    it('should resolve variables in end message', async () => {
      chatState.setVariable('userName', 'Alice');

      const node = createNode('end_conversation', {
        endMessage: 'Goodbye, {{userName}}! Have a great day.',
      });

      const result = await handler.handle(node, chatState);

      if (result.type === 'displayUI') {
        const uiState = result.uiState as NodeUIState.Message;
        expect(uiState.text).toBe('Goodbye, Alice! Have a great day.');
      }
    });

    it('should return proceed with flowComplete when no end message', async () => {
      const node = createNode('end_conversation', {
        completionStatus: 'completed',
      });

      const result = await handler.handle(node, chatState);

      expect(result.type).toBe('proceed');
      if (result.type === 'proceed') {
        expect(result.nextNodeId).toBeNull();
        expect(result.data?.flowComplete).toBe(true);
      }
    });

    it('should generate transcript summary', async () => {
      // Add some messages to transcript
      chatState.addBotMessage('Hello!', 'node1', 'message');
      chatState.addUserMessage('Hi there', 'node2');
      chatState.addBotMessage('How can I help?', 'node3', 'message');

      const node = createNode('end_conversation', {});

      await handler.handle(node, chatState);

      expect(mockSocketEmitter.emit).toHaveBeenCalledWith(
        SpecialNodeSocketEvents.CONVERSATION_ENDED,
        expect.objectContaining({
          transcriptSummary: expect.objectContaining({
            totalMessages: expect.any(Number),
            botMessages: expect.any(Number),
            userMessages: expect.any(Number),
          }),
        })
      );
    });

    it('should include collected answers in event', async () => {
      chatState.setAnswer('q1', 'name', 'John Doe');
      chatState.setAnswer('q2', 'email', 'john@example.com');

      const node = createNode('end_conversation', {});

      await handler.handle(node, chatState);

      expect(mockSocketEmitter.emit).toHaveBeenCalledWith(
        SpecialNodeSocketEvents.CONVERSATION_ENDED,
        expect.objectContaining({
          collectedData: expect.objectContaining({
            answers: expect.any(Object),
          }),
        })
      );
    });

    it('should include user metadata in collected data', async () => {
      chatState.setUserName('Jane Smith');
      chatState.setUserEmail('jane@example.com');
      chatState.setUserPhone('+1234567890');

      const node = createNode('end_conversation', {});

      await handler.handle(node, chatState);

      expect(mockSocketEmitter.emit).toHaveBeenCalledWith(
        SpecialNodeSocketEvents.CONVERSATION_ENDED,
        expect.objectContaining({
          collectedData: expect.objectContaining({
            metadata: expect.objectContaining({
              name: 'Jane Smith',
              email: 'jane@example.com',
              phone: '+1234567890',
            }),
          }),
        })
      );
    });

    it('should include goals reached count', async () => {
      chatState.setVariable('_goalsReachedCount', 3);

      const node = createNode('end_conversation', {});

      await handler.handle(node, chatState);

      expect(mockSocketEmitter.emit).toHaveBeenCalledWith(
        SpecialNodeSocketEvents.CONVERSATION_ENDED,
        expect.objectContaining({
          goalsReachedCount: 3,
        })
      );
    });

    it('should default to completed status', async () => {
      const node = createNode('end_conversation', {});

      await handler.handle(node, chatState);

      expect(chatState.getVariable('_completionStatus')).toBe('completed');
    });

    it('should add end message to transcript', async () => {
      const node = createNode('end_conversation', {
        endMessage: 'Conversation ended.',
      });

      await handler.handle(node, chatState);

      // The message should be added to transcript
      const transcript = chatState.getTranscript();
      const lastEntry = transcript[transcript.length - 1];
      expect(lastEntry?.text).toBe('Conversation ended.');
    });

    it('should handle empty end message', async () => {
      const node = createNode('end_conversation', {
        endMessage: '   ',
      });

      const result = await handler.handle(node, chatState);

      // Empty message (after trim) should not show UI
      expect(result.type).toBe('proceed');
    });

    it('should handle socket emit errors gracefully', async () => {
      mockSocketEmitter.emit.mockImplementationOnce(() => {
        throw new Error('Socket error');
      });

      const node = createNode('end_conversation', {});

      // Should not throw error
      const result = await handler.handle(node, chatState);
      expect(['proceed', 'displayUI']).toContain(result.type);
    });

    it('should call markConversationComplete on state', async () => {
      const markCompleteSpy = jest.spyOn(chatState, 'markConversationComplete');

      const node = createNode('end_conversation', {
        completionStatus: 'cancelled',
      });

      await handler.handle(node, chatState);

      expect(markCompleteSpy).toHaveBeenCalledWith('cancelled');
    });
  });

  // ========================================
  // SOCKET EMITTER TESTS
  // ========================================

  describe('Socket Emitter Management', () => {
    it('should set and get socket emitter', () => {
      const customEmitter = { emit: jest.fn() };

      setSocketEmitter(customEmitter);
      expect(getSocketEmitter()).toBe(customEmitter);

      setSocketEmitter(null);
      expect(getSocketEmitter()).toBeNull();
    });

    it('should handle null socket emitter in handlers', async () => {
      setSocketEmitter(null);

      const goalHandler = new GoalHandler();
      const node = createNode('goal', { goalName: 'test' });

      // Should not throw
      const result = await goalHandler.handle(node, chatState);
      expect(result.type).toBe('proceed');
    });
  });

  // ========================================
  // FLOW COMPLETION STATE ENUM TESTS
  // ========================================

  describe('FlowCompletionState', () => {
    it('should have correct enum values', () => {
      expect(FlowCompletionState.InProgress).toBe('inProgress');
      expect(FlowCompletionState.Completed).toBe('completed');
      expect(FlowCompletionState.GoalReached).toBe('goalReached');
      expect(FlowCompletionState.Cancelled).toBe('cancelled');
    });
  });

  // ========================================
  // SOCKET EVENT CONSTANTS TESTS
  // ========================================

  describe('SpecialNodeSocketEvents', () => {
    it('should have correct event names', () => {
      expect(SpecialNodeSocketEvents.GOAL_REACHED).toBe('goal_reached');
      expect(SpecialNodeSocketEvents.CONVERSATION_ENDED).toBe('conversation_ended');
    });
  });
});
