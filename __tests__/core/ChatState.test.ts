/**
 * ChatState Tests
 *
 * Tests for the central state management class.
 * Covers state initialization, message operations, variable management,
 * metadata handling, reactions, and message status tracking.
 */

import { ChatState } from '../../src/core/state/ChatState';
import { MessageStatus } from '../../src/types/messageStatus';
import {
  createReaction,
  createMessageStatusEntry,
  generateId,
} from '../testUtils';

describe('ChatState', () => {
  let chatState: ChatState;
  const sessionId = 'test-session-123';
  const botId = 'test-bot-456';

  beforeEach(() => {
    chatState = new ChatState(sessionId, botId);
  });

  // ========================================
  // INITIALIZATION TESTS
  // ========================================

  describe('Initialization', () => {
    it('should initialize with provided session and bot IDs', () => {
      expect(chatState.sessionId).toBe(sessionId);
      expect(chatState.botId).toBe(botId);
    });

    it('should start with null current node', () => {
      expect(chatState.currentNodeId).toBeNull();
    });

    it('should start with flow not complete', () => {
      expect(chatState.isFlowComplete).toBe(false);
      expect(chatState.flowCompletionReason).toBeUndefined();
    });

    it('should start with empty state', () => {
      expect(chatState.getAllAnswers()).toEqual({});
      expect(chatState.getAllVariables()).toEqual({});
      expect(chatState.getUserMetadata()).toEqual({});
      expect(chatState.getTranscript()).toEqual([]);
      expect(chatState.getRecord()).toEqual([]);
      expect(chatState.getVisitedNodes()).toEqual([]);
    });
  });

  // ========================================
  // ANSWER VARIABLE TESTS
  // ========================================

  describe('Answer Variables', () => {
    it('should set and get answer variables', () => {
      chatState.setAnswer('q1', 'email', 'test@example.com', 'node-1');

      expect(chatState.getAnswer('email')).toBe('test@example.com');
    });

    it('should return undefined for non-existent answers', () => {
      expect(chatState.getAnswer('nonexistent')).toBeUndefined();
    });

    it('should get all answers as plain object', () => {
      chatState.setAnswer('q1', 'email', 'test@example.com');
      chatState.setAnswer('q2', 'name', 'John Doe');
      chatState.setAnswer('q3', 'age', 25);

      const answers = chatState.getAllAnswers();
      expect(answers).toEqual({
        email: 'test@example.com',
        name: 'John Doe',
        age: 25,
      });
    });

    it('should get answer variables with full metadata', () => {
      chatState.setAnswer('q1', 'email', 'test@example.com', 'node-1');

      const variables = chatState.getAnswerVariables();
      expect(variables).toHaveLength(1);
      expect(variables[0]).toMatchObject({
        questionId: 'q1',
        variableName: 'email',
        value: 'test@example.com',
        nodeId: 'node-1',
      });
      expect(variables[0].timestamp).toBeDefined();
    });

    it('should overwrite existing answer with same variable name', () => {
      chatState.setAnswer('q1', 'email', 'old@example.com');
      chatState.setAnswer('q2', 'email', 'new@example.com');

      expect(chatState.getAnswer('email')).toBe('new@example.com');
    });
  });

  // ========================================
  // GENERAL VARIABLE TESTS
  // ========================================

  describe('General Variables', () => {
    it('should set and get variables', () => {
      chatState.setVariable('counter', 5);
      chatState.setVariable('isActive', true);
      chatState.setVariable('data', { key: 'value' });

      expect(chatState.getVariable('counter')).toBe(5);
      expect(chatState.getVariable('isActive')).toBe(true);
      expect(chatState.getVariable('data')).toEqual({ key: 'value' });
    });

    it('should return undefined for non-existent variables', () => {
      expect(chatState.getVariable('nonexistent')).toBeUndefined();
    });

    it('should get all variables as plain object', () => {
      chatState.setVariable('a', 1);
      chatState.setVariable('b', 'two');

      expect(chatState.getAllVariables()).toEqual({ a: 1, b: 'two' });
    });

    it('should delete variables', () => {
      chatState.setVariable('toDelete', 'value');
      expect(chatState.getVariable('toDelete')).toBe('value');

      const result = chatState.deleteVariable('toDelete');
      expect(result).toBe(true);
      expect(chatState.getVariable('toDelete')).toBeUndefined();
    });

    it('should return false when deleting non-existent variable', () => {
      const result = chatState.deleteVariable('nonexistent');
      expect(result).toBe(false);
    });
  });

  // ========================================
  // USER METADATA TESTS
  // ========================================

  describe('User Metadata', () => {
    it('should set and get user metadata', () => {
      chatState.setUserMetadata({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
      });

      const metadata = chatState.getUserMetadata();
      expect(metadata).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
      });
    });

    it('should provide shortcuts for common metadata fields', () => {
      chatState.setUserName('Jane Doe');
      chatState.setUserEmail('jane@example.com');
      chatState.setUserPhone('+0987654321');

      expect(chatState.userName).toBe('Jane Doe');
      expect(chatState.userEmail).toBe('jane@example.com');
      expect(chatState.userPhone).toBe('+0987654321');
    });

    it('should merge metadata updates', () => {
      chatState.setUserMetadata({ name: 'First' });
      chatState.setUserMetadata({ email: 'test@example.com' });

      const metadata = chatState.getUserMetadata();
      expect(metadata.name).toBe('First');
      expect(metadata.email).toBe('test@example.com');
    });

    it('should support custom metadata fields', () => {
      chatState.setUserMetadata({
        customField: 'customValue',
        anotherField: 123,
      });

      const metadata = chatState.getUserMetadata();
      expect(metadata.customField).toBe('customValue');
      expect(metadata.anotherField).toBe(123);
    });
  });

  // ========================================
  // TRANSCRIPT TESTS
  // ========================================

  describe('Transcript', () => {
    it('should add bot messages to transcript', () => {
      chatState.addBotMessage('Hello!', 'node-1', 'message');

      const transcript = chatState.getTranscript();
      expect(transcript).toHaveLength(1);
      expect(transcript[0]).toMatchObject({
        type: 'bot',
        text: 'Hello!',
        nodeId: 'node-1',
        nodeType: 'message',
      });
      expect(transcript[0].timestamp).toBeDefined();
    });

    it('should add user messages to transcript', () => {
      chatState.addUserMessage('Hi there!', 'node-2');

      const transcript = chatState.getTranscript();
      expect(transcript).toHaveLength(1);
      expect(transcript[0]).toMatchObject({
        type: 'user',
        text: 'Hi there!',
        nodeId: 'node-2',
      });
    });

    it('should add system messages to transcript', () => {
      chatState.addSystemMessage('Connection established', { status: 'connected' });

      const transcript = chatState.getTranscript();
      expect(transcript).toHaveLength(1);
      expect(transcript[0]).toMatchObject({
        type: 'system',
        text: 'Connection established',
        data: { status: 'connected' },
      });
    });

    it('should add goal entries to transcript', () => {
      chatState.addGoalToTranscript('Purchase', { amount: 99.99 });

      const transcript = chatState.getTranscript();
      expect(transcript).toHaveLength(1);
      expect(transcript[0]).toMatchObject({
        type: 'goal',
        data: { goalName: 'Purchase', goalValue: { amount: 99.99 } },
      });
    });

    it('should add custom entries to transcript', () => {
      chatState.addToTranscript({
        type: 'bot',
        text: 'Custom entry',
        timestamp: '2024-01-01T00:00:00Z',
        data: { custom: true },
      });

      const transcript = chatState.getTranscript();
      expect(transcript).toHaveLength(1);
      expect(transcript[0].data).toEqual({ custom: true });
    });

    it('should maintain transcript order', () => {
      chatState.addBotMessage('First');
      chatState.addUserMessage('Second');
      chatState.addBotMessage('Third');

      const transcript = chatState.getTranscript();
      expect(transcript).toHaveLength(3);
      expect(transcript[0].text).toBe('First');
      expect(transcript[1].text).toBe('Second');
      expect(transcript[2].text).toBe('Third');
    });
  });

  // ========================================
  // RECORD TESTS
  // ========================================

  describe('Record', () => {
    it('should add record entries', () => {
      const entry = {
        _id: 'rec-1',
        type: 'user-message',
        time: new Date(),
        text: 'Hello',
      };
      chatState.addRecord(entry);

      const record = chatState.getRecord();
      expect(record).toHaveLength(1);
      expect(record[0]).toEqual(entry);
    });

    it('should set entire record for restoration', () => {
      const records = [
        { _id: 1, type: 'bot-message', time: new Date(), text: 'Hi' },
        { _id: 2, type: 'user-message', time: new Date(), text: 'Hello' },
      ];
      chatState.setRecord(records);

      expect(chatState.getRecord()).toEqual(records);
    });

    it('should return a copy of the record array', () => {
      chatState.addRecord({ _id: 1, type: 'bot-message', time: new Date() });
      const record = chatState.getRecord();
      record.push({ _id: 2, type: 'user-message', time: new Date() });

      expect(chatState.getRecord()).toHaveLength(1);
    });
  });

  // ========================================
  // NODE TRACKING TESTS
  // ========================================

  describe('Node Tracking', () => {
    it('should set current node and add to visited', () => {
      chatState.setCurrentNode('node-1');

      expect(chatState.currentNodeId).toBe('node-1');
      expect(chatState.hasVisitedNode('node-1')).toBe(true);
    });

    it('should track multiple visited nodes', () => {
      chatState.setCurrentNode('node-1');
      chatState.setCurrentNode('node-2');
      chatState.setCurrentNode('node-3');

      expect(chatState.currentNodeId).toBe('node-3');
      expect(chatState.getVisitedNodes()).toContain('node-1');
      expect(chatState.getVisitedNodes()).toContain('node-2');
      expect(chatState.getVisitedNodes()).toContain('node-3');
    });

    it('should not duplicate visited nodes', () => {
      chatState.setCurrentNode('node-1');
      chatState.setCurrentNode('node-1');

      expect(chatState.getVisitedNodes()).toHaveLength(1);
    });

    it('should return false for non-visited nodes', () => {
      expect(chatState.hasVisitedNode('nonexistent')).toBe(false);
    });
  });

  // ========================================
  // FLOW COMPLETION TESTS
  // ========================================

  describe('Flow Completion', () => {
    it('should mark conversation as complete', () => {
      chatState.markConversationComplete();

      expect(chatState.isFlowComplete).toBe(true);
      expect(chatState.getVariable('_flowComplete')).toBe(true);
      expect(chatState.getVariable('_flowCompletedAt')).toBeDefined();
    });

    it('should store completion reason', () => {
      chatState.markConversationComplete('user_ended');

      expect(chatState.flowCompletionReason).toBe('user_ended');
      expect(chatState.getVariable('_flowCompletionReason')).toBe('user_ended');
    });
  });

  // ========================================
  // VARIABLE RESOLUTION TESTS
  // ========================================

  describe('Variable Resolution', () => {
    it('should resolve answer variables in text', () => {
      chatState.setAnswer('q1', 'name', 'John');

      const result = chatState.resolveVariables('Hello {{name}}!');
      expect(result).toBe('Hello John!');
    });

    it('should resolve general variables in text', () => {
      chatState.setVariable('greeting', 'Welcome');

      const result = chatState.resolveVariables('{{greeting}} to our store!');
      expect(result).toBe('Welcome to our store!');
    });

    it('should resolve user metadata in text', () => {
      chatState.setUserMetadata({ name: 'Jane' });

      const result = chatState.resolveVariables('Hi {{name}}!');
      expect(result).toBe('Hi Jane!');
    });

    it('should prioritize answer variables over general variables', () => {
      chatState.setAnswer('q1', 'value', 'answer');
      chatState.setVariable('value', 'variable');

      const result = chatState.resolveVariables('Result: {{value}}');
      expect(result).toBe('Result: answer');
    });

    it('should keep original placeholder for undefined variables', () => {
      const result = chatState.resolveVariables('Unknown: {{unknown}}');
      expect(result).toBe('Unknown: {{unknown}}');
    });

    it('should handle multiple variables in text', () => {
      chatState.setAnswer('q1', 'firstName', 'John');
      chatState.setAnswer('q2', 'lastName', 'Doe');

      const result = chatState.resolveVariables('Name: {{firstName}} {{lastName}}');
      expect(result).toBe('Name: John Doe');
    });

    it('should handle empty or null input', () => {
      expect(chatState.resolveVariables('')).toBe('');
      expect(chatState.resolveVariables(null as any)).toBe(null);
    });

    it('should trim variable names', () => {
      chatState.setVariable('name', 'Test');

      const result = chatState.resolveVariables('{{ name }}');
      expect(result).toBe('Test');
    });
  });

  // ========================================
  // MESSAGE STATUS TESTS
  // ========================================

  describe('Message Status (Read Receipts)', () => {
    it('should set message sending status', () => {
      chatState.setMessageSending('msg-1');

      const status = chatState.getMessageStatus('msg-1');
      expect(status?.status).toBe(MessageStatus.SENDING);
      expect(status?.sentAt).toBeDefined();
    });

    it('should update message to sent status', () => {
      chatState.setMessageSending('msg-1');
      chatState.setMessageSent('msg-1');

      const status = chatState.getMessageStatus('msg-1');
      expect(status?.status).toBe(MessageStatus.SENT);
    });

    it('should update message to delivered status', () => {
      chatState.setMessageSending('msg-1');
      chatState.setMessageSent('msg-1');
      chatState.setMessageDelivered('msg-1');

      const status = chatState.getMessageStatus('msg-1');
      expect(status?.status).toBe(MessageStatus.DELIVERED);
      expect(status?.deliveredAt).toBeDefined();
    });

    it('should update message to read status', () => {
      chatState.setMessageSending('msg-1');
      chatState.setMessageRead('msg-1', undefined, 'agent');

      const status = chatState.getMessageStatus('msg-1');
      expect(status?.status).toBe(MessageStatus.READ);
      expect(status?.readAt).toBeDefined();
      expect(status?.readBy).toBe('agent');
    });

    it('should not downgrade status', () => {
      chatState.setMessageRead('msg-1');
      chatState.setMessageDelivered('msg-1');

      const status = chatState.getMessageStatus('msg-1');
      expect(status?.status).toBe(MessageStatus.READ);
    });

    it('should batch update message statuses', () => {
      chatState.setMessageSending('msg-1');
      chatState.setMessageSending('msg-2');
      chatState.setMessageSending('msg-3');

      chatState.batchUpdateMessageStatus(['msg-1', 'msg-2', 'msg-3'], MessageStatus.READ);

      expect(chatState.getMessageStatus('msg-1')?.status).toBe(MessageStatus.READ);
      expect(chatState.getMessageStatus('msg-2')?.status).toBe(MessageStatus.READ);
      expect(chatState.getMessageStatus('msg-3')?.status).toBe(MessageStatus.READ);
    });

    it('should get all message statuses', () => {
      chatState.setMessageSending('msg-1');
      chatState.setMessageRead('msg-2');

      const allStatuses = chatState.getAllMessageStatuses();
      expect(allStatuses.size).toBe(2);
    });

    it('should get unread message IDs', () => {
      chatState.setMessageSent('msg-1');
      chatState.setMessageDelivered('msg-2');
      chatState.setMessageRead('msg-3');

      const unread = chatState.getUnreadMessageIds();
      expect(unread).toContain('msg-1');
      expect(unread).toContain('msg-2');
      expect(unread).not.toContain('msg-3');
    });

    it('should get message IDs with status or lower', () => {
      chatState.setMessageSending('msg-1');
      chatState.setMessageSent('msg-2');
      chatState.setMessageDelivered('msg-3');
      chatState.setMessageRead('msg-4');

      const sent = chatState.getMessageIdsWithStatusOrLower(MessageStatus.SENT);
      expect(sent).toContain('msg-1');
      expect(sent).toContain('msg-2');
      expect(sent).not.toContain('msg-3');
      expect(sent).not.toContain('msg-4');
    });

    it('should update status using updateMessageStatus method', () => {
      chatState.updateMessageStatus('msg-1', MessageStatus.SENT);
      expect(chatState.getMessageStatus('msg-1')?.status).toBe(MessageStatus.SENT);

      chatState.updateMessageStatus('msg-1', MessageStatus.READ, { readBy: 'bot' });
      expect(chatState.getMessageStatus('msg-1')?.status).toBe(MessageStatus.READ);
      expect(chatState.getMessageStatus('msg-1')?.readBy).toBe('bot');
    });
  });

  // ========================================
  // REACTION TESTS
  // ========================================

  describe('Message Reactions', () => {
    it('should add reaction to message', () => {
      chatState.addReaction('msg-1', '\uD83D\uDC4D' as any, 'user-1', 'John');

      const reactions = chatState.getReactions('msg-1');
      expect(reactions).toHaveLength(1);
      expect(reactions[0].emoji).toBe('\uD83D\uDC4D');
      expect(reactions[0].userId).toBe('user-1');
      expect(reactions[0].userName).toBe('John');
    });

    it('should not duplicate same reaction from same user', () => {
      chatState.addReaction('msg-1', '\uD83D\uDC4D' as any, 'user-1');
      chatState.addReaction('msg-1', '\uD83D\uDC4D' as any, 'user-1');

      expect(chatState.getReactions('msg-1')).toHaveLength(1);
    });

    it('should allow same emoji from different users', () => {
      chatState.addReaction('msg-1', '\uD83D\uDC4D' as any, 'user-1');
      chatState.addReaction('msg-1', '\uD83D\uDC4D' as any, 'user-2');

      expect(chatState.getReactions('msg-1')).toHaveLength(2);
    });

    it('should allow different emojis from same user', () => {
      chatState.addReaction('msg-1', '\uD83D\uDC4D' as any, 'user-1');
      chatState.addReaction('msg-1', '\u2764\uFE0F' as any, 'user-1');

      expect(chatState.getReactions('msg-1')).toHaveLength(2);
    });

    it('should remove reaction', () => {
      chatState.addReaction('msg-1', '\uD83D\uDC4D' as any, 'user-1');
      chatState.removeReaction('msg-1', '\uD83D\uDC4D' as any, 'user-1');

      expect(chatState.getReactions('msg-1')).toHaveLength(0);
    });

    it('should toggle reaction - add when not present', () => {
      const result = chatState.toggleReaction('msg-1', '\uD83D\uDC4D' as any, 'user-1');

      expect(result).toBe('added');
      expect(chatState.getReactions('msg-1')).toHaveLength(1);
    });

    it('should toggle reaction - remove when present', () => {
      chatState.addReaction('msg-1', '\uD83D\uDC4D' as any, 'user-1');
      const result = chatState.toggleReaction('msg-1', '\uD83D\uDC4D' as any, 'user-1');

      expect(result).toBe('removed');
      expect(chatState.getReactions('msg-1')).toHaveLength(0);
    });

    it('should check if user has reacted', () => {
      chatState.addReaction('msg-1', '\uD83D\uDC4D' as any, 'user-1');

      expect(chatState.hasUserReacted('msg-1', '\uD83D\uDC4D' as any, 'user-1')).toBe(true);
      expect(chatState.hasUserReacted('msg-1', '\u2764\uFE0F' as any, 'user-1')).toBe(false);
      expect(chatState.hasUserReacted('msg-1', '\uD83D\uDC4D' as any, 'user-2')).toBe(false);
    });

    it('should get all reactions', () => {
      chatState.addReaction('msg-1', '\uD83D\uDC4D' as any, 'user-1');
      chatState.addReaction('msg-2', '\u2764\uFE0F' as any, 'user-2');

      const allReactions = chatState.getAllReactions();
      expect(allReactions.size).toBe(2);
    });

    it('should set reactions for a message (sync from server)', () => {
      const reactions = [
        createReaction('\uD83D\uDC4D' as any, { userId: 'user-1' }),
        createReaction('\u2764\uFE0F' as any, { userId: 'user-2' }),
      ];
      chatState.setReactions('msg-1', reactions);

      expect(chatState.getReactions('msg-1')).toHaveLength(2);
    });
  });

  // ========================================
  // LISTENER TESTS
  // ========================================

  describe('Listeners', () => {
    it('should notify listeners on state change', () => {
      const listener = jest.fn();
      chatState.addListener(listener);

      chatState.setVariable('test', 'value');

      expect(listener).toHaveBeenCalledWith(chatState);
    });

    it('should allow removing listeners', () => {
      const listener = jest.fn();
      const unsubscribe = chatState.addListener(listener);

      chatState.setVariable('test1', 'value1');
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      chatState.setVariable('test2', 'value2');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should notify status listeners on status change', () => {
      const listener = jest.fn();
      chatState.addStatusListener(listener);

      chatState.setMessageSending('msg-1');

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0]).toBe('msg-1');
      expect(listener.mock.calls[0][1].status).toBe(MessageStatus.SENDING);
    });

    it('should notify reaction listeners on reaction change', () => {
      const listener = jest.fn();
      chatState.addReactionListener(listener);

      chatState.addReaction('msg-1', '\uD83D\uDC4D' as any, 'user-1');

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0]).toBe('msg-1');
      expect(listener.mock.calls[0][1]).toHaveLength(1);
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      const normalListener = jest.fn();

      chatState.addListener(errorListener);
      chatState.addListener(normalListener);

      // Should not throw
      chatState.setVariable('test', 'value');

      // Normal listener should still be called
      expect(normalListener).toHaveBeenCalled();
    });
  });

  // ========================================
  // TRANSCRIPT SUMMARY TESTS
  // ========================================

  describe('Transcript Summary', () => {
    it('should generate correct transcript summary', () => {
      chatState.addBotMessage('Hi');
      chatState.addBotMessage('How can I help?');
      chatState.addUserMessage('I need help');
      chatState.addGoalToTranscript('ContactSupport');
      chatState.setAnswer('q1', 'email', 'test@example.com');
      chatState.setVariable('source', 'web');
      chatState.addReaction('msg-1', '\uD83D\uDC4D' as any, 'user-1');

      const summary = chatState.generateTranscriptSummary();

      expect(summary.totalMessages).toBe(4);
      expect(summary.botMessages).toBe(2);
      expect(summary.userMessages).toBe(1);
      expect(summary.goalsReached).toHaveLength(1);
      expect(summary.answersCollected).toBe(1);
      expect(summary.variablesSet).toBe(1);
      expect(summary.totalReactions).toBe(1);
      expect(summary.messagesWithReactions).toBe(1);
    });
  });

  // ========================================
  // SERIALIZATION TESTS
  // ========================================

  describe('Serialization', () => {
    it('should serialize state to JSON', () => {
      chatState.setAnswer('q1', 'email', 'test@example.com');
      chatState.setVariable('counter', 5);
      chatState.setUserMetadata({ name: 'John' });
      chatState.addBotMessage('Hello');
      chatState.setCurrentNode('node-1');
      chatState.setMessageSent('msg-1');
      chatState.addReaction('msg-1', '\uD83D\uDC4D' as any, 'user-1');

      const json = chatState.toJSON();

      expect(json.sessionId).toBe(sessionId);
      expect(json.botId).toBe(botId);
      expect(json.answerVariables).toHaveLength(1);
      expect(json.variables).toEqual({ counter: 5 });
      expect(json.userMetadata).toEqual({ name: 'John' });
      expect(json.transcript).toHaveLength(1);
      expect(json.currentNodeId).toBe('node-1');
      expect(json.visitedNodes).toContain('node-1');
      expect(json.messageStatuses).toHaveProperty('msg-1');
      expect(json.reactions).toHaveLength(1);
    });

    it('should deserialize state from JSON', () => {
      const data = {
        sessionId: 'restored-session',
        botId: 'restored-bot',
        answerVariables: [
          { questionId: 'q1', variableName: 'email', value: 'restored@example.com', timestamp: '2024-01-01' },
        ],
        variables: { restored: true },
        userMetadata: { name: 'Restored User' },
        transcript: [{ type: 'bot', text: 'Restored message', timestamp: '2024-01-01' }],
        record: [{ _id: 1, type: 'bot-message', time: '2024-01-01' }],
        currentNodeId: 'restored-node',
        visitedNodes: ['restored-node'],
        isFlowComplete: true,
        flowCompletionReason: 'restored',
        messageStatuses: { 'msg-1': { status: MessageStatus.READ, updatedAt: '2024-01-01' } },
        reactions: [{ messageId: 'msg-1', reactions: [{ emoji: '\uD83D\uDC4D', userId: 'user-1', timestamp: '2024-01-01' }] }],
      };

      const restored = ChatState.fromJSON(data);

      expect(restored.sessionId).toBe('restored-session');
      expect(restored.botId).toBe('restored-bot');
      expect(restored.getAnswer('email')).toBe('restored@example.com');
      expect(restored.getVariable('restored')).toBe(true);
      expect(restored.userName).toBe('Restored User');
      expect(restored.getTranscript()).toHaveLength(1);
      expect(restored.getRecord()).toHaveLength(1);
      expect(restored.currentNodeId).toBe('restored-node');
      expect(restored.hasVisitedNode('restored-node')).toBe(true);
      expect(restored.isFlowComplete).toBe(true);
      expect(restored.flowCompletionReason).toBe('restored');
      expect(restored.getMessageStatus('msg-1')?.status).toBe(MessageStatus.READ);
      expect(restored.getReactions('msg-1')).toHaveLength(1);
    });
  });

  // ========================================
  // RESET TESTS
  // ========================================

  describe('Reset', () => {
    it('should reset all state', () => {
      // Set up state
      chatState.setAnswer('q1', 'email', 'test@example.com');
      chatState.setVariable('counter', 5);
      chatState.setUserMetadata({ name: 'John' });
      chatState.addBotMessage('Hello');
      chatState.addRecord({ _id: 1, type: 'bot-message', time: new Date() });
      chatState.setCurrentNode('node-1');
      chatState.markConversationComplete('done');
      chatState.setMessageSent('msg-1');
      chatState.addReaction('msg-1', '\uD83D\uDC4D' as any, 'user-1');

      // Reset
      chatState.reset();

      // Verify all reset
      expect(chatState.getAllAnswers()).toEqual({});
      expect(chatState.getAllVariables()).toEqual({});
      expect(chatState.getUserMetadata()).toEqual({});
      expect(chatState.getTranscript()).toEqual([]);
      expect(chatState.getRecord()).toEqual([]);
      expect(chatState.currentNodeId).toBeNull();
      expect(chatState.getVisitedNodes()).toEqual([]);
      expect(chatState.isFlowComplete).toBe(false);
      expect(chatState.flowCompletionReason).toBeUndefined();
      expect(chatState.getAllMessageStatuses().size).toBe(0);
      expect(chatState.getAllReactions().size).toBe(0);

      // Bot ID should remain; session ID is regenerated on reset
      // (matches the web widget, which starts a fresh chatSessionId on restart)
      expect(chatState.sessionId).toBeTruthy();
      expect(chatState.sessionId).not.toBe(sessionId);
      expect(chatState.botId).toBe(botId);
    });

    it('should notify listeners on reset', () => {
      const listener = jest.fn();
      chatState.addListener(listener);

      chatState.reset();

      expect(listener).toHaveBeenCalled();
    });
  });
});
