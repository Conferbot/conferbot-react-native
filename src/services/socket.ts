import { io, Socket } from 'socket.io-client';
import {
  SocketEvents,
  type MessageReactionPayload,
  type ReactionEmoji,
} from '../types';
import {
  ReadReceiptSocketEvents,
  type ReadReceiptData,
  type DeliveryReceiptData,
  type BatchReadReceiptPayload,
} from '../types/messageStatus';
import {
  DEFAULT_SOCKET_URL,
  SOCKET_TIMEOUT,
  SOCKET_RECONNECTION_ATTEMPTS,
  SOCKET_RECONNECTION_DELAY,
  SOCKET_RECONNECTION_DELAY_MAX,
  HEADER_API_KEY,
  HEADER_BOT_ID,
} from '../config/constants';

// Socket connection options
interface SocketOptions {
  apiKey: string;
  botId: string;
  userId?: string;
  socketUrl?: string;
  autoConnect?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

// Socket event listeners map
type SocketEventListener = (...args: any[]) => void;
type EventListenersMap = Map<string, Set<SocketEventListener>>;

// ********** Socket Client Class ********** //
class ConferBotSocket {
  private socket: Socket | null = null;
  private apiKey: string;
  private botId: string;
  private userId?: string;
  private socketUrl: string;
  private listeners: EventListenersMap = new Map();
  private isInitialized: boolean = false;
  private chatSessionId?: string;

  constructor(options: SocketOptions) {
    this.apiKey = options.apiKey;
    this.botId = options.botId;
    this.userId = options.userId;
    this.socketUrl = options.socketUrl || DEFAULT_SOCKET_URL;
  }

  // ********** Connection Methods ********** //
  // Initialize socket connection
  connect(userId?: string): Promise<void> {
    if (userId) {
      this.userId = userId;
    }

    return new Promise((resolve, reject) => {
      try {
        // Create socket instance
        this.socket = io(this.socketUrl, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: SOCKET_RECONNECTION_ATTEMPTS,
          reconnectionDelay: SOCKET_RECONNECTION_DELAY,
          reconnectionDelayMax: SOCKET_RECONNECTION_DELAY_MAX,
          timeout: SOCKET_TIMEOUT,
          autoConnect: true,
          extraHeaders: {
            [HEADER_API_KEY]: this.apiKey,
            [HEADER_BOT_ID]: this.botId,
          },
        });

        // Set up connection event handlers
        this.setupConnectionHandlers(resolve, reject);

        // Set up message event handlers
        this.setupMessageHandlers();

        // Set up read receipt event handlers
        this.setupReadReceiptHandlers();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Disconnect socket
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isInitialized = false;
      if (__DEV__) {
        console.log('[ConferBot Socket] Disconnected');
      }
    }
  }

  // Check if socket is connected
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Get current user ID
  getUserId(): string | undefined {
    return this.userId;
  }

  // Set user ID
  setUserId(userId: string): void {
    this.userId = userId;
  }

  // ********** Event Handlers Setup ********** //
  // Set up connection event handlers
  private setupConnectionHandlers(resolve: () => void, reject: (error: Error) => void): void {
    if (!this.socket) return;

    // Connection successful
    this.socket.on('connect', () => {
      if (__DEV__) {
        console.log('[ConferBot Socket] Connected:', this.socket?.id);
      }

      // Send initialization payload
      this.sendInitPayload();
      resolve();
    });

    // Connection error
    this.socket.on('connect_error', (error) => {
      if (__DEV__) {
        console.error('[ConferBot Socket] Connection error:', error.message);
      }
      this.emit(SocketEvents.CONNECTION_ERROR, error);
      reject(error);
    });

    // Disconnected
    this.socket.on('disconnect', (reason) => {
      if (__DEV__) {
        console.log('[ConferBot Socket] Disconnected:', reason);
      }
      this.isInitialized = false;
    });

    // Reconnecting
    this.socket.on('reconnect_attempt', (attemptNumber) => {
      if (__DEV__) {
        console.log('[ConferBot Socket] Reconnecting... Attempt:', attemptNumber);
      }
    });

    // Reconnected
    this.socket.on('reconnect', () => {
      if (__DEV__) {
        console.log('[ConferBot Socket] Reconnected');
      }
      this.sendInitPayload();
    });
  }

  // Set up message event handlers
  private setupMessageHandlers(): void {
    if (!this.socket) return;

    // Fetched chatbot data (server to client)
    this.socket.on(SocketEvents.FETCHED_CHATBOT_DATA, (data: any) => {
      if (__DEV__) {
        console.log('[ConferBot Socket] Chatbot data fetched:', data);
      }
      this.emit(SocketEvents.FETCHED_CHATBOT_DATA, data);
    });

    // Bot response (server to client)
    this.socket.on(SocketEvents.BOT_RESPONSE, (data: any) => {
      if (__DEV__) {
        console.log('[ConferBot Socket] Bot response received:', data);
      }
      this.emit(SocketEvents.BOT_RESPONSE, data);
    });

    // Agent message (server to client)
    this.socket.on(SocketEvents.AGENT_MESSAGE, (data: any) => {
      if (__DEV__) {
        console.log('[ConferBot Socket] Agent message received:', data);
      }
      this.emit(SocketEvents.AGENT_MESSAGE, data);
    });

    // Agent accepted (server to client)
    this.socket.on(SocketEvents.AGENT_ACCEPTED, (data: any) => {
      if (__DEV__) {
        console.log('[ConferBot Socket] Agent accepted:', data);
      }
      this.emit(SocketEvents.AGENT_ACCEPTED, data);
    });

    // Agent left (server to client)
    this.socket.on(SocketEvents.AGENT_LEFT, (data: any) => {
      if (__DEV__) {
        console.log('[ConferBot Socket] Agent left:', data);
      }
      this.emit(SocketEvents.AGENT_LEFT, data);
    });

    // Agent typing status (server to client)
    this.socket.on(SocketEvents.AGENT_TYPING_STATUS, (data: any) => {
      if (__DEV__) {
        console.log('[ConferBot Socket] Agent typing status:', data);
      }
      this.emit(SocketEvents.AGENT_TYPING_STATUS, data);
    });

    // Visitor typing status (server to client)
    this.socket.on(SocketEvents.VISITOR_TYPING_STATUS, (data: any) => {
      this.emit(SocketEvents.VISITOR_TYPING_STATUS, data);
    });

    // Chat ended (server to client)
    this.socket.on(SocketEvents.CHAT_ENDED, (data: any) => {
      if (__DEV__) {
        console.log('[ConferBot Socket] Chat ended:', data);
      }
      this.emit(SocketEvents.CHAT_ENDED, data);
    });

    // Visitor disconnected (server to client)
    this.socket.on(SocketEvents.VISITOR_DISCONNECTED, (data: any) => {
      if (__DEV__) {
        console.log('[ConferBot Socket] Visitor disconnected:', data);
      }
      this.emit(SocketEvents.VISITOR_DISCONNECTED, data);
    });

    // Visitor input toggled (server to client)
    this.socket.on(SocketEvents.VISITOR_INPUT_TOGGLED, (data: any) => {
      if (__DEV__) {
        console.log('[ConferBot Socket] Visitor input toggled:', data);
      }
      this.emit(SocketEvents.VISITOR_INPUT_TOGGLED, data);
    });

    // Destroy notification (server to client)
    this.socket.on(SocketEvents.DESTROY_NOTIFICATION, () => {
      if (__DEV__) {
        console.log('[ConferBot Socket] Destroy notification received');
      }
      this.emit(SocketEvents.DESTROY_NOTIFICATION);
    });

    // Message reaction update (server to client)
    this.socket.on(SocketEvents.MESSAGE_REACTION_UPDATE, (data: any) => {
      if (__DEV__) {
        console.log('[ConferBot Socket] Reaction update received:', data);
      }
      this.emit(SocketEvents.MESSAGE_REACTION_UPDATE, data);
    });
  }

  // ********** Read Receipt Event Handlers ********** //
  // Set up read receipt event handlers
  private setupReadReceiptHandlers(): void {
    if (!this.socket) return;

    // Message acknowledged by server (SENT status)
    this.socket.on(ReadReceiptSocketEvents.MESSAGE_ACK, (data: { messageId: string | number }) => {
      if (__DEV__) {
        console.log('[ConferBot Socket] Message acknowledged:', data);
      }
      this.emit(ReadReceiptSocketEvents.MESSAGE_ACK, data);
    });

    // Message delivered to recipient
    this.socket.on(ReadReceiptSocketEvents.MESSAGE_DELIVERED, (data: DeliveryReceiptData) => {
      if (__DEV__) {
        console.log('[ConferBot Socket] Message delivered:', data);
      }
      this.emit(ReadReceiptSocketEvents.MESSAGE_DELIVERED, data);
    });

    // Message read by recipient
    this.socket.on(ReadReceiptSocketEvents.MESSAGE_READ, (data: ReadReceiptData) => {
      if (__DEV__) {
        console.log('[ConferBot Socket] Message read:', data);
      }
      this.emit(ReadReceiptSocketEvents.MESSAGE_READ, data);
    });
  }

  // Send initialization payload
  private sendInitPayload(): void {
    if (!this.socket || this.isInitialized) return;

    const payload = {
      botId: this.botId,
    };

    this.socket.emit(SocketEvents.GET_CHATBOT_DATA, payload);
    this.isInitialized = true;

    if (__DEV__) {
      console.log('[ConferBot Socket] Initialization sent:', payload);
    }
  }

  // ********** Message Sending Methods ********** //
  // Get chatbot data
  getChatbotData(): void {
    if (!this.socket || !this.isConnected()) {
      if (__DEV__) {
        console.warn('[ConferBot Socket] Cannot get chatbot data: not connected');
      }
      return;
    }

    this.socket.emit(SocketEvents.GET_CHATBOT_DATA, {
      botId: this.botId,
    });

    if (__DEV__) {
      console.log('[ConferBot Socket] Getting chatbot data');
    }
  }

  // Join chat room as visitor
  joinChatRoomVisitor(chatSessionId: string): void {
    if (!this.socket || !this.isConnected()) {
      if (__DEV__) {
        console.warn('[ConferBot Socket] Cannot join chat room: not connected');
      }
      return;
    }

    this.chatSessionId = chatSessionId;
    this.socket.emit(SocketEvents.JOIN_CHAT_ROOM_VISITOR, { chatSessionId });

    if (__DEV__) {
      console.log('[ConferBot Socket] Joined chat room as visitor:', chatSessionId);
    }
  }

  // Leave chat room
  leaveChatRoom(chatSessionId: string): void {
    if (!this.socket || !this.isConnected()) return;

    this.socket.emit(SocketEvents.LEAVE_CHAT_ROOM, chatSessionId);

    if (__DEV__) {
      console.log('[ConferBot Socket] Left chat room:', chatSessionId);
    }
  }

  // Send visitor typing status
  sendVisitorTyping(chatSessionId: string, isTyping: boolean): void {
    if (!this.socket || !this.isConnected()) return;

    this.socket.emit(SocketEvents.VISITOR_TYPING, {
      chatSessionId,
      isTyping,
    });
  }

  // Send response record (visitor message)
  // Matches embed-server/socket.js 'response-record' event
  sendResponseRecord(data: {
    chatSessionId: string;
    botId?: string; // Optional, falls back to instance botId
    record: any;
    answerVariables?: any;
  }): void {
    if (!this.socket || !this.isConnected()) {
      if (__DEV__) {
        console.warn('[ConferBot Socket] Cannot send response: not connected');
      }
      return;
    }

    // Include botId from instance if not provided
    const payload = {
      ...data,
      botId: data.botId || this.botId,
    };

    this.socket.emit(SocketEvents.RESPONSE_RECORD, payload);

    if (__DEV__) {
      console.log('[ConferBot Socket] Response record sent');
    }
  }

  // Initiate handover
  initiateHandover(data: any): void {
    if (!this.socket || !this.isConnected()) {
      if (__DEV__) {
        console.warn('[ConferBot Socket] Cannot initiate handover: not connected');
      }
      return;
    }

    this.socket.emit(SocketEvents.INITIATE_HANDOVER, data);

    if (__DEV__) {
      console.log('[ConferBot Socket] Handover initiated');
    }
  }

  // Toggle visitor input
  toggleVisitorInput(chatSessionId: string, isInputEnabled: boolean): void {
    if (!this.socket || !this.isConnected()) return;

    this.socket.emit(SocketEvents.TOGGLE_VISITOR_INPUT, {
      chatSessionId,
      isInputEnabled,
    });

    if (__DEV__) {
      console.log('[ConferBot Socket] Visitor input toggled:', isInputEnabled);
    }
  }

  // Send email node trigger
  emailNodeTrigger(data: any): void {
    if (!this.socket || !this.isConnected()) return;

    this.socket.emit(SocketEvents.EMAIL_NODE_TRIGGER, data);

    if (__DEV__) {
      console.log('[ConferBot Socket] Email node triggered');
    }
  }

  // Send zapier node trigger
  zapierNodeTrigger(data: any): void {
    if (!this.socket || !this.isConnected()) return;

    this.socket.emit(SocketEvents.ZAPIER_NODE_TRIGGER, data);

    if (__DEV__) {
      console.log('[ConferBot Socket] Zapier node triggered');
    }
  }

  // Calendar slot selection record
  calendarSlotSelectionRecord(data: any): void {
    if (!this.socket || !this.isConnected()) return;

    this.socket.emit(SocketEvents.CALENDAR_SLOT_SELECTION_RECORD, data);

    if (__DEV__) {
      console.log('[ConferBot Socket] Calendar slot selected');
    }
  }

  // ********** Reaction Methods ********** //
  /**
   * Send a message reaction to the server
   * @param chatSessionId - The chat session ID
   * @param messageId - The message ID to react to
   * @param emoji - The emoji reaction
   * @param action - 'add' to add reaction, 'remove' to remove
   * @param userName - Optional user name for display
   */
  sendMessageReaction(
    chatSessionId: string,
    messageId: string,
    emoji: ReactionEmoji,
    action: 'add' | 'remove',
    userName?: string
  ): void {
    if (!this.socket || !this.isConnected()) {
      if (__DEV__) {
        console.warn('[ConferBot Socket] Cannot send reaction: not connected');
      }
      return;
    }

    if (!this.userId) {
      if (__DEV__) {
        console.warn('[ConferBot Socket] Cannot send reaction: no user ID');
      }
      return;
    }

    const payload: MessageReactionPayload = {
      chatSessionId,
      messageId,
      emoji,
      action,
      userId: this.userId,
      userName,
    };

    this.socket.emit(SocketEvents.MESSAGE_REACTION, payload);

    if (__DEV__) {
      console.log('[ConferBot Socket] Reaction sent:', payload);
    }
  }

  // ********** Read Receipt Methods ********** //

  /**
   * Mark a single message as read
   * @param messageId - The ID of the message to mark as read
   * @param chatSessionId - The chat session ID
   */
  markMessageAsRead(messageId: string | number, chatSessionId: string): void {
    if (!this.socket || !this.isConnected()) {
      if (__DEV__) {
        console.warn('[ConferBot Socket] Cannot mark message as read: not connected');
      }
      return;
    }

    this.socket.emit(ReadReceiptSocketEvents.MARK_AS_READ, {
      messageId,
      chatSessionId,
      readAt: new Date().toISOString(),
    });

    if (__DEV__) {
      console.log('[ConferBot Socket] Message marked as read:', messageId);
    }
  }

  /**
   * Batch mark multiple messages as read
   * @param messageIds - Array of message IDs to mark as read
   * @param chatSessionId - The chat session ID
   */
  batchMarkMessagesAsRead(messageIds: (string | number)[], chatSessionId: string): void {
    if (!this.socket || !this.isConnected()) {
      if (__DEV__) {
        console.warn('[ConferBot Socket] Cannot batch mark messages as read: not connected');
      }
      return;
    }

    if (messageIds.length === 0) {
      return;
    }

    const payload: BatchReadReceiptPayload = {
      messageIds,
      chatSessionId,
      viewedAt: new Date().toISOString(),
    };

    this.socket.emit(ReadReceiptSocketEvents.BATCH_MARK_AS_READ, payload);

    if (__DEV__) {
      console.log('[ConferBot Socket] Batch messages marked as read:', messageIds.length);
    }
  }

  // ********** Event Listener Methods ********** //
  // Add event listener (supports both SocketEvents and read receipt events)
  on(event: SocketEvents | string, callback: SocketEventListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  // Remove event listener
  off(event: SocketEvents | string, callback: SocketEventListener): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
    }
  }

  // Emit event to all listeners
  private emit(event: SocketEvents | string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((callback) => {
        try {
          callback(...args);
        } catch (error) {
          if (__DEV__) {
            console.error('[ConferBot Socket] Event listener error:', error);
          }
        }
      });
    }
  }

  // Remove all event listeners
  removeAllListeners(event?: SocketEvents | string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

export default ConferBotSocket;
