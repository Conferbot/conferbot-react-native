/**
 * SocketClient Tests
 *
 * Tests for the ConferBotSocket class.
 * Covers connection, disconnection, event handling,
 * message sending, reactions, and read receipts.
 */

import { io } from 'socket.io-client';
import ConferBotSocket from '../../src/services/socket';
import { SocketEvents } from '../../src/types';
import { ReadReceiptSocketEvents } from '../../src/types/messageStatus';

// Mock socket.io-client
jest.mock('socket.io-client');

describe('ConferBotSocket', () => {
  let socketClient: ConferBotSocket;
  let mockSocket: any;

  const apiKey = 'test-api-key';
  const botId = 'test-bot-id';
  const userId = 'test-user-id';
  const socketUrl = 'https://socket.test.com';

  beforeEach(() => {
    // Create mock socket instance
    mockSocket = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      connected: false,
      id: 'mock-socket-id',
    };

    // Mock io to return our mock socket
    (io as jest.Mock).mockReturnValue(mockSocket);

    // Create socket client
    socketClient = new ConferBotSocket({
      apiKey,
      botId,
      userId,
      socketUrl,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // CONNECTION TESTS
  // ========================================

  describe('Connection', () => {
    it('should create socket with correct options', async () => {
      // Start connection (will hang since we dont simulate connect)
      const connectPromise = socketClient.connect();

      expect(io).toHaveBeenCalledWith(socketUrl, expect.objectContaining({
        transports: ['websocket', 'polling'],
        reconnection: true,
        extraHeaders: expect.objectContaining({
          'x-api-key': apiKey,
          'x-bot-id': botId,
        }),
      }));

      // Simulate connection
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      );
      expect(connectHandler).toBeDefined();

      // Trigger connect
      connectHandler[1]();

      await connectPromise;
    });

    it('should register all required event handlers on connect', async () => {
      const connectPromise = socketClient.connect();

      // Get connect handler and trigger it
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      );
      connectHandler[1]();

      await connectPromise;

      // Verify event handlers registered
      const registeredEvents = mockSocket.on.mock.calls.map((call: any[]) => call[0]);

      expect(registeredEvents).toContain('connect');
      expect(registeredEvents).toContain('connect_error');
      expect(registeredEvents).toContain('disconnect');
      expect(registeredEvents).toContain('reconnect_attempt');
      expect(registeredEvents).toContain('reconnect');
      expect(registeredEvents).toContain(SocketEvents.FETCHED_CHATBOT_DATA);
      expect(registeredEvents).toContain(SocketEvents.BOT_RESPONSE);
      expect(registeredEvents).toContain(SocketEvents.AGENT_MESSAGE);
      expect(registeredEvents).toContain(SocketEvents.MESSAGE_REACTION_UPDATE);
      expect(registeredEvents).toContain(ReadReceiptSocketEvents.MESSAGE_ACK);
      expect(registeredEvents).toContain(ReadReceiptSocketEvents.MESSAGE_DELIVERED);
      expect(registeredEvents).toContain(ReadReceiptSocketEvents.MESSAGE_READ);
    });

    it('should reject on connection error', async () => {
      const connectPromise = socketClient.connect();

      // Get error handler and trigger it
      const errorHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect_error'
      );
      const error = new Error('Connection failed');
      errorHandler[1](error);

      await expect(connectPromise).rejects.toThrow('Connection failed');
    });

    it('should send initialization payload on connect', async () => {
      const connectPromise = socketClient.connect();

      // Trigger connect
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      );
      connectHandler[1]();

      await connectPromise;

      expect(mockSocket.emit).toHaveBeenCalledWith(
        SocketEvents.GET_CHATBOT_DATA,
        { botId }
      );
    });

    it('should update userId when provided to connect', async () => {
      const newUserId = 'new-user-id';
      const connectPromise = socketClient.connect(newUserId);

      // Trigger connect
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      );
      connectHandler[1]();

      await connectPromise;

      expect(socketClient.getUserId()).toBe(newUserId);
    });
  });

  // ========================================
  // DISCONNECTION TESTS
  // ========================================

  describe('Disconnection', () => {
    it('should disconnect socket', async () => {
      // Connect first
      const connectPromise = socketClient.connect();
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      );
      connectHandler[1]();
      await connectPromise;

      // Disconnect
      socketClient.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should handle disconnect when not connected', () => {
      // Should not throw
      expect(() => socketClient.disconnect()).not.toThrow();
    });
  });

  // ========================================
  // CONNECTION STATUS TESTS
  // ========================================

  describe('Connection Status', () => {
    it('should return false when not connected', () => {
      expect(socketClient.isConnected()).toBe(false);
    });

    it('should return connection status from socket', async () => {
      const connectPromise = socketClient.connect();
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      );
      mockSocket.connected = true;
      connectHandler[1]();
      await connectPromise;

      expect(socketClient.isConnected()).toBe(true);
    });
  });

  // ========================================
  // USER ID TESTS
  // ========================================

  describe('User ID Management', () => {
    it('should get user ID', () => {
      expect(socketClient.getUserId()).toBe(userId);
    });

    it('should set user ID', () => {
      socketClient.setUserId('new-id');
      expect(socketClient.getUserId()).toBe('new-id');
    });
  });

  // ========================================
  // EVENT LISTENER TESTS
  // ========================================

  describe('Event Listeners', () => {
    it('should add event listener and return unsubscribe function', () => {
      const callback = jest.fn();
      const unsubscribe = socketClient.on(SocketEvents.BOT_RESPONSE, callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should call listener when event is emitted internally', async () => {
      const callback = jest.fn();
      socketClient.on(SocketEvents.BOT_RESPONSE, callback);

      // Connect and simulate receiving a bot response
      const connectPromise = socketClient.connect();
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      );
      connectHandler[1]();
      await connectPromise;

      // Find the bot response handler
      const botResponseHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === SocketEvents.BOT_RESPONSE
      );

      // Simulate receiving data
      const mockData = { chatSessionId: 'test', record: [] };
      botResponseHandler[1](mockData);

      expect(callback).toHaveBeenCalledWith(mockData);
    });

    it('should remove listener when unsubscribe is called', () => {
      const callback = jest.fn();
      const unsubscribe = socketClient.on(SocketEvents.BOT_RESPONSE, callback);

      unsubscribe();
      socketClient.off(SocketEvents.BOT_RESPONSE, callback);

      // Listener should be removed
    });

    it('should remove specific listener with off', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      socketClient.on(SocketEvents.BOT_RESPONSE, callback1);
      socketClient.on(SocketEvents.BOT_RESPONSE, callback2);

      socketClient.off(SocketEvents.BOT_RESPONSE, callback1);

      // callback1 should be removed, callback2 should remain
    });

    it('should remove all listeners for event', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      socketClient.on(SocketEvents.BOT_RESPONSE, callback1);
      socketClient.on(SocketEvents.AGENT_MESSAGE, callback2);

      socketClient.removeAllListeners(SocketEvents.BOT_RESPONSE);

      // Only BOT_RESPONSE listeners should be removed
    });

    it('should remove all listeners when no event specified', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      socketClient.on(SocketEvents.BOT_RESPONSE, callback1);
      socketClient.on(SocketEvents.AGENT_MESSAGE, callback2);

      socketClient.removeAllListeners();

      // All listeners should be removed
    });
  });

  // ========================================
  // MESSAGE SENDING TESTS
  // ========================================

  describe('Message Sending', () => {
    beforeEach(async () => {
      // Connect socket
      const connectPromise = socketClient.connect();
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      );
      mockSocket.connected = true;
      connectHandler[1]();
      await connectPromise;
    });

    it('should get chatbot data', () => {
      mockSocket.emit.mockClear();
      socketClient.getChatbotData();

      expect(mockSocket.emit).toHaveBeenCalledWith(
        SocketEvents.GET_CHATBOT_DATA,
        { botId }
      );
    });

    it('should join chat room as visitor', () => {
      const chatSessionId = 'session-123';
      socketClient.joinChatRoomVisitor(chatSessionId);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        SocketEvents.JOIN_CHAT_ROOM_VISITOR,
        { chatSessionId }
      );
    });

    it('should leave chat room', () => {
      const chatSessionId = 'session-123';
      socketClient.leaveChatRoom(chatSessionId);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        SocketEvents.LEAVE_CHAT_ROOM,
        chatSessionId
      );
    });

    it('should send visitor typing status', () => {
      const chatSessionId = 'session-123';
      socketClient.sendVisitorTyping(chatSessionId, true);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        SocketEvents.VISITOR_TYPING,
        { chatSessionId, isTyping: true }
      );
    });

    it('should send response record', () => {
      const data = {
        chatSessionId: 'session-123',
        record: [{ type: 'user-message', text: 'Hello' }],
        answerVariables: [{ name: 'email', value: 'test@test.com' }],
      };

      socketClient.sendResponseRecord(data);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        SocketEvents.RESPONSE_RECORD,
        data
      );
    });

    it('should initiate handover', () => {
      const data = { chatSessionId: 'session-123', botId };
      socketClient.initiateHandover(data);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        SocketEvents.INITIATE_HANDOVER,
        data
      );
    });

    it('should toggle visitor input', () => {
      const chatSessionId = 'session-123';
      socketClient.toggleVisitorInput(chatSessionId, false);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        SocketEvents.TOGGLE_VISITOR_INPUT,
        { chatSessionId, isInputEnabled: false }
      );
    });

    it('should trigger email node', () => {
      const data = { nodeId: 'node-1' };
      socketClient.emailNodeTrigger(data);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        SocketEvents.EMAIL_NODE_TRIGGER,
        data
      );
    });

    it('should trigger zapier node', () => {
      const data = { nodeId: 'node-2' };
      socketClient.zapierNodeTrigger(data);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        SocketEvents.ZAPIER_NODE_TRIGGER,
        data
      );
    });

    it('should send calendar slot selection', () => {
      const data = { slot: '2024-01-15T10:00:00Z' };
      socketClient.calendarSlotSelectionRecord(data);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        SocketEvents.CALENDAR_SLOT_SELECTION_RECORD,
        data
      );
    });
  });

  // ========================================
  // NOT CONNECTED BEHAVIOR TESTS
  // ========================================

  describe('Not Connected Behavior', () => {
    it('should not emit when not connected', () => {
      socketClient.getChatbotData();
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should not join room when not connected', () => {
      socketClient.joinChatRoomVisitor('session-123');
      // Should not throw, just log warning
    });

    it('should not send response when not connected', () => {
      socketClient.sendResponseRecord({
        chatSessionId: 'session-123',
        record: [],
      });
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // REACTION TESTS
  // ========================================

  describe('Reactions', () => {
    beforeEach(async () => {
      const connectPromise = socketClient.connect();
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      );
      mockSocket.connected = true;
      connectHandler[1]();
      await connectPromise;
    });

    it('should send message reaction', () => {
      socketClient.sendMessageReaction(
        'session-123',
        'msg-1',
        '\uD83D\uDC4D' as any,
        'add',
        'John'
      );

      expect(mockSocket.emit).toHaveBeenCalledWith(
        SocketEvents.MESSAGE_REACTION,
        {
          chatSessionId: 'session-123',
          messageId: 'msg-1',
          emoji: '\uD83D\uDC4D',
          action: 'add',
          userId,
          userName: 'John',
        }
      );
    });

    it('should send remove reaction', () => {
      socketClient.sendMessageReaction(
        'session-123',
        'msg-1',
        '\uD83D\uDC4D' as any,
        'remove'
      );

      expect(mockSocket.emit).toHaveBeenCalledWith(
        SocketEvents.MESSAGE_REACTION,
        expect.objectContaining({
          action: 'remove',
        })
      );
    });

    it('should not send reaction without user ID', () => {
      socketClient.setUserId(undefined as any);
      mockSocket.emit.mockClear();

      socketClient.sendMessageReaction(
        'session-123',
        'msg-1',
        '\uD83D\uDC4D' as any,
        'add'
      );

      expect(mockSocket.emit).not.toHaveBeenCalledWith(
        SocketEvents.MESSAGE_REACTION,
        expect.anything()
      );
    });

    it('should not send reaction when not connected', () => {
      mockSocket.connected = false;
      mockSocket.emit.mockClear();

      socketClient.sendMessageReaction(
        'session-123',
        'msg-1',
        '\uD83D\uDC4D' as any,
        'add'
      );

      expect(mockSocket.emit).not.toHaveBeenCalledWith(
        SocketEvents.MESSAGE_REACTION,
        expect.anything()
      );
    });
  });

  // ========================================
  // READ RECEIPT TESTS
  // ========================================

  describe('Read Receipts', () => {
    beforeEach(async () => {
      const connectPromise = socketClient.connect();
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      );
      mockSocket.connected = true;
      connectHandler[1]();
      await connectPromise;
    });

    it('should mark single message as read', () => {
      mockSocket.emit.mockClear();
      socketClient.markMessageAsRead('msg-1', 'session-123');

      expect(mockSocket.emit).toHaveBeenCalledWith(
        ReadReceiptSocketEvents.MARK_AS_READ,
        expect.objectContaining({
          messageId: 'msg-1',
          chatSessionId: 'session-123',
          readAt: expect.any(String),
        })
      );
    });

    it('should batch mark messages as read', () => {
      mockSocket.emit.mockClear();
      socketClient.batchMarkMessagesAsRead(['msg-1', 'msg-2', 'msg-3'], 'session-123');

      expect(mockSocket.emit).toHaveBeenCalledWith(
        ReadReceiptSocketEvents.BATCH_MARK_AS_READ,
        expect.objectContaining({
          messageIds: ['msg-1', 'msg-2', 'msg-3'],
          chatSessionId: 'session-123',
          viewedAt: expect.any(String),
        })
      );
    });

    it('should not batch mark empty array', () => {
      mockSocket.emit.mockClear();
      socketClient.batchMarkMessagesAsRead([], 'session-123');

      expect(mockSocket.emit).not.toHaveBeenCalledWith(
        ReadReceiptSocketEvents.BATCH_MARK_AS_READ,
        expect.anything()
      );
    });

    it('should not mark as read when not connected', () => {
      mockSocket.connected = false;
      mockSocket.emit.mockClear();

      socketClient.markMessageAsRead('msg-1', 'session-123');

      expect(mockSocket.emit).not.toHaveBeenCalledWith(
        ReadReceiptSocketEvents.MARK_AS_READ,
        expect.anything()
      );
    });
  });

  // ========================================
  // RECONNECTION TESTS
  // ========================================

  describe('Reconnection', () => {
    it('should resend init payload on reconnect', async () => {
      // Connect
      const connectPromise = socketClient.connect();
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      );
      mockSocket.connected = true;
      connectHandler[1]();
      await connectPromise;

      mockSocket.emit.mockClear();

      // Simulate reconnect
      const reconnectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'reconnect'
      );
      reconnectHandler[1]();

      expect(mockSocket.emit).toHaveBeenCalledWith(
        SocketEvents.GET_CHATBOT_DATA,
        { botId }
      );
    });
  });

  // ========================================
  // EVENT FORWARDING TESTS
  // ========================================

  describe('Event Forwarding', () => {
    beforeEach(async () => {
      const connectPromise = socketClient.connect();
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      );
      mockSocket.connected = true;
      connectHandler[1]();
      await connectPromise;
    });

    it('should forward fetched chatbot data', () => {
      const callback = jest.fn();
      socketClient.on(SocketEvents.FETCHED_CHATBOT_DATA, callback);

      const handler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === SocketEvents.FETCHED_CHATBOT_DATA
      );
      const mockData = { chatbotData: { name: 'Test Bot' } };
      handler[1](mockData);

      expect(callback).toHaveBeenCalledWith(mockData);
    });

    it('should forward agent messages', () => {
      const callback = jest.fn();
      socketClient.on(SocketEvents.AGENT_MESSAGE, callback);

      const handler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === SocketEvents.AGENT_MESSAGE
      );
      const mockData = { text: 'Agent response' };
      handler[1](mockData);

      expect(callback).toHaveBeenCalledWith(mockData);
    });

    it('should forward agent accepted', () => {
      const callback = jest.fn();
      socketClient.on(SocketEvents.AGENT_ACCEPTED, callback);

      const handler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === SocketEvents.AGENT_ACCEPTED
      );
      const mockData = { agentDetails: { name: 'Agent' } };
      handler[1](mockData);

      expect(callback).toHaveBeenCalledWith(mockData);
    });

    it('should forward reaction updates', () => {
      const callback = jest.fn();
      socketClient.on(SocketEvents.MESSAGE_REACTION_UPDATE, callback);

      const handler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === SocketEvents.MESSAGE_REACTION_UPDATE
      );
      const mockData = { messageId: 'msg-1', reactions: [] };
      handler[1](mockData);

      expect(callback).toHaveBeenCalledWith(mockData);
    });

    it('should forward message acknowledgment', () => {
      const callback = jest.fn();
      socketClient.on(ReadReceiptSocketEvents.MESSAGE_ACK, callback);

      const handler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === ReadReceiptSocketEvents.MESSAGE_ACK
      );
      const mockData = { messageId: 'msg-1' };
      handler[1](mockData);

      expect(callback).toHaveBeenCalledWith(mockData);
    });

    it('should forward message delivered status', () => {
      const callback = jest.fn();
      socketClient.on(ReadReceiptSocketEvents.MESSAGE_DELIVERED, callback);

      const handler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === ReadReceiptSocketEvents.MESSAGE_DELIVERED
      );
      const mockData = { messageId: 'msg-1', deliveredAt: '2024-01-01' };
      handler[1](mockData);

      expect(callback).toHaveBeenCalledWith(mockData);
    });

    it('should forward message read status', () => {
      const callback = jest.fn();
      socketClient.on(ReadReceiptSocketEvents.MESSAGE_READ, callback);

      const handler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === ReadReceiptSocketEvents.MESSAGE_READ
      );
      const mockData = { messageId: 'msg-1', readAt: '2024-01-01' };
      handler[1](mockData);

      expect(callback).toHaveBeenCalledWith(mockData);
    });
  });
});
