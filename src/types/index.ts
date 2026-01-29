// ********** Core Types ********** //
// Conferbot SDK configuration
export interface ConferBotConfig {
  enableNotifications?: boolean;
  enableOfflineMode?: boolean;
  autoConnect?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  /** Enable session persistence (default: true when asyncStorage is provided) */
  enablePersistence?: boolean;
  /** Persistence configuration */
  persistenceConfig?: PersistenceConfig;
  /** AsyncStorage instance for persistence */
  asyncStorage?: AsyncStorageInterface;
  /** Enable read receipts (default: true) */
  enableReadReceipts?: boolean;
  /** Read receipts configuration */
  readReceiptConfig?: ReadReceiptConfig;
  /** Offline queue configuration */
  offlineQueueConfig?: OfflineQueueConfig;
}

// ********** Read Receipt Configuration ********** //
/** Configuration for read receipt behavior */
export interface ReadReceiptConfig {
  /** Enable or disable read receipts feature (default: true) */
  enabled?: boolean;
  /** Show read receipt indicators in UI (default: true) */
  showIndicators?: boolean;
  /** Debounce time in ms for batching read receipts (default: 500) */
  batchDebounceMs?: number;
  /** Automatically mark messages as read when viewed (default: true) */
  autoMarkAsRead?: boolean;
}

// ********** Offline Queue Configuration ********** //
/** Configuration for offline queue behavior */
export interface OfflineQueueConfig {
  /** Maximum number of messages to queue (default: 50) */
  maxQueueSize?: number;
  /** Maximum retry attempts per message (default: 5) */
  maxRetries?: number;
  /** Initial retry delay in ms (default: 1000) */
  initialRetryDelay?: number;
  /** Maximum retry delay in ms (default: 30000) */
  maxRetryDelay?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Enable persistent storage (default: true) */
  persistQueue?: boolean;
  /** Auto-process queue when online (default: true) */
  autoProcess?: boolean;
}

// ********** Persistence Types ********** //
/** AsyncStorage interface for dependency injection */
export interface AsyncStorageInterface {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  multiGet(keys: string[]): Promise<readonly [string, string | null][]>;
  multiSet(keyValuePairs: [string, string][]): Promise<void>;
  multiRemove(keys: string[]): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
}

/** Configuration for persistence behavior */
export interface PersistenceConfig {
  /** Maximum number of messages to persist (default: 100) */
  maxMessages?: number;
  /** Storage key prefix for namespacing (default: '@conferbot') */
  keyPrefix?: string;
  /** Enable storage (can be disabled for testing) */
  enabled?: boolean;
  /** Session expiry time in milliseconds (default: 7 days) */
  sessionExpiryMs?: number;
}

/** Persisted session data structure */
export interface PersistedSession {
  /** Unique chat session identifier */
  chatSessionId: string;
  /** Visitor identifier for returning user recognition */
  visitorId: string;
  /** Bot identifier this session belongs to */
  botId: string;
  /** Timestamp when session was created */
  createdAt: string;
  /** Timestamp when session was last updated */
  updatedAt: string;
  /** Whether the session is still active */
  isActive: boolean;
  /** Current node ID in the flow (for resumption) */
  currentNodeId?: string;
  /** List of visited node IDs */
  visitedNodes?: string[];
  /** Flow completion status */
  isFlowComplete?: boolean;
  /** Flow completion reason */
  flowCompletionReason?: string;
}

/** Persisted user data structure */
export interface PersistedUser {
  /** User identifier */
  userId?: string;
  /** User display name */
  name?: string;
  /** User email address */
  email?: string;
  /** User phone number */
  phone?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
  /** Timestamp when data was last updated */
  updatedAt: string;
}

// User identification
export interface ConferBotUser {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  metadata?: Record<string, any>;
}

// UI customization options
export interface ConferBotCustomization {
  primaryColor?: string;
  fontFamily?: string;
  bubbleRadius?: number;
  headerTitle?: string;
  enableAvatar?: boolean;
  avatarUrl?: string;
  botBubbleColor?: string;
  userBubbleColor?: string;
}

// ********** Reaction Types ********** //
// Common emoji reactions available in the picker
export const REACTION_EMOJIS = ['👍', '👎', '❤️', '😊', '😮', '😢'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

// Individual reaction from a user
export interface Reaction {
  emoji: ReactionEmoji;
  userId: string;
  userName?: string;
  timestamp: string;
}

// Grouped reactions for display (emoji with count and users)
export interface ReactionGroup {
  emoji: ReactionEmoji;
  count: number;
  users: Array<{
    userId: string;
    userName?: string;
  }>;
  hasUserReacted: boolean; // Whether current user has reacted with this emoji
}

// Reactions map for a message
export interface MessageReactions {
  messageId: string;
  reactions: Reaction[];
}

// ********** Message Types ********** //
// Message types matching embed-server record structure
export type MessageType =
  | 'agent-message'
  | 'agent-message-file'
  | 'agent-message-audio'
  | 'agent-joined-message'
  | 'visitor-disconnected-message'
  | 'visitor-reconnected-message'
  | 'bot-message'
  | 'user-message'
  | 'user-input-response'
  | 'system-message';

// Agent details structure from embed-server
export interface AgentDetails {
  _id: string;
  name: string;
  email: string;
}

// Base record item structure matching embed-server Response model
export interface BaseRecordItem {
  _id: string | number;
  type: MessageType;
  time: Date | string;
  reactions?: Reaction[]; // Added reactions support
  /** Queued message ID for offline queue tracking */
  queuedMessageId?: string;
}

// Agent message record item
export interface AgentMessageRecord extends BaseRecordItem {
  type: 'agent-message';
  text: string;
  agentDetails: AgentDetails;
}

// Agent file message record item
export interface AgentMessageFileRecord extends BaseRecordItem {
  type: 'agent-message-file';
  file: string;
  agentDetails?: AgentDetails;
}

// Agent audio message record item
export interface AgentMessageAudioRecord extends BaseRecordItem {
  type: 'agent-message-audio';
  url: string;
  agentDetails: AgentDetails;
}

// Agent joined message record item
export interface AgentJoinedMessageRecord extends BaseRecordItem {
  type: 'agent-joined-message';
  agentDetails: AgentDetails;
}

// Visitor disconnected message record item
export interface VisitorDisconnectedMessageRecord extends BaseRecordItem {
  type: 'visitor-disconnected-message';
}

// Visitor reconnected message record item
export interface VisitorReconnectedMessageRecord extends BaseRecordItem {
  type: 'visitor-reconnected-message';
}

// Bot message record item
export interface BotMessageRecord extends BaseRecordItem {
  type: 'bot-message';
  text?: string;
  [key: string]: any; // Bot messages can have various node-specific fields
}

// User message record item
export interface UserMessageRecord extends BaseRecordItem {
  type: 'user-message';
  text: string;
  [key: string]: any;
}

// User input response record item
export interface UserInputResponseRecord extends BaseRecordItem {
  type: 'user-input-response';
  text: string;
  [key: string]: any;
}

// System message record item
export interface SystemMessageRecord extends BaseRecordItem {
  type: 'system-message';
  text: string;
}

// Union type for all record items
export type RecordItem =
  | AgentMessageRecord
  | AgentMessageFileRecord
  | AgentMessageAudioRecord
  | AgentJoinedMessageRecord
  | VisitorDisconnectedMessageRecord
  | VisitorReconnectedMessageRecord
  | BotMessageRecord
  | UserMessageRecord
  | UserInputResponseRecord
  | SystemMessageRecord;

// Message attachment
export interface MessageAttachment {
  type: 'image' | 'file' | 'video' | 'audio';
  url: string;
  name?: string;
  size?: number;
  mimeType?: string;
}

// ********** Agent Types ********** //
// Live agent information
export interface Agent {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  title?: string;
  status?: 'online' | 'offline' | 'away';
}

// ********** Session Types ********** //
// Chat session matching embed-server Response model
export interface ChatSession {
  id: string; // Alias for chatSessionId
  _id?: string;
  botId: string;
  version?: string;
  chatSessionId: string;
  isActive: boolean;
  visitorId?: string;
  chatDate?: Date;
  deviceInfo?: string;
  location?: string;
  visitorMeta?: Record<string, any>;
  vIp?: string;
  originWebsite?: string;
  record: RecordItem[];
  answerVariables?: any[];
  integrationResponses?: any[];
  ticket?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// ********** API Types ********** //
// Chatbot configuration from backend
export interface ChatbotConfig {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  welcomeMessage?: string;
  customizations?: ConferBotCustomization;
  features?: {
    fileUpload?: boolean;
    voiceMessage?: boolean;
    typing?: boolean;
    readReceipts?: boolean;
    reactions?: boolean; // Added reactions feature flag
    offlineQueue?: boolean; // Added offline queue feature flag
  };
}

// Knowledge base article
export interface KnowledgeBaseArticle {
  id: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
}

// API response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ********** Socket Event Types ********** //
// Socket.IO event names matching embed-server/socket.js
export enum SocketEvents {
  // Client to server events
  GET_CHATBOT_DATA = 'get-chatbot-data',
  JOIN_CHAT_ROOM_VISITOR = 'join-chat-room-visitor',
  JOIN_CHAT_ROOM_AGENT = 'join-chat-room-agent',
  LEAVE_CHAT_ROOM = 'leave-chat-room',
  VISITOR_TYPING = 'visitor-typing',
  AGENT_TYPING = 'agent-typing',
  RESPONSE_RECORD = 'response-record',
  INITIATE_HANDOVER = 'initiate-handover',
  ACCEPT_HANDOVER = 'accept-handover',
  ACCEPT_HANDOVER_FROM_CHAT = 'accept-handover-from-chat',
  HANDOVER_DECLINE = 'handover-decline',
  SEND_AGENT_MESSAGE = 'send-agent-message',
  END_CHAT = 'end-chat',
  LEAVE_CHAT = 'leave-chat',
  TOGGLE_VISITOR_INPUT = 'toggle-visitor-input',
  EMAIL_NODE_TRIGGER = 'email-node-trigger',
  ZAPIER_NODE_TRIGGER = 'zapier-node-trigger',
  CALENDAR_SLOT_SELECTION_RECORD = 'calendar-slot-selection-record',
  HANDOVER_TIMEOUT = 'handover-timeout',
  JOIN_WORKSPACE = 'join-workspace',
  DISCONNECT_USER = 'disconnect-user',
  INVITE_AGENT_TO_CHAT = 'invite-agent-to-chat',
  DECLINE_AGENT_INVITATION = 'decline-agent-invitation',
  SHOW_ACCEPT_HANDOVER_BUTTON = 'show-accept-handover-button',

  // Reaction events
  MESSAGE_REACTION = 'message:reaction',
  MESSAGE_REACTION_UPDATE = 'message:reaction:update',

  // Server to client events
  FETCHED_CHATBOT_DATA = 'fetched-chatbot-data',
  BOT_RESPONSE = 'bot-response',
  AGENT_MESSAGE = 'agent-message',
  AGENT_ACCEPTED = 'agent-accepted',
  AGENT_LEFT = 'agent-left',
  AGENT_TYPING_STATUS = 'agent-typing-status',
  VISITOR_TYPING_STATUS = 'visitor-typing-status',
  CHAT_ENDED = 'chat-ended',
  VISITOR_DISCONNECTED = 'visitor-disconnected',
  VISITOR_INPUT_TOGGLED = 'visitor-input-toggled',
  DESTROY_NOTIFICATION = 'destroy-notification',

  // Connection events
  CONNECTION_ERROR = 'connection-error',
}

// Socket initialization payload for mobile-init
export interface SocketInitPayload {
  botId: string;
  chatSessionId?: string;
  visitorId?: string;
  platform: 'react-native';
  deviceInfo?: {
    os: 'ios' | 'android';
    osVersion?: string;
    appVersion?: string;
    deviceModel?: string;
  };
  visitorMeta?: Record<string, any>;
}

// Socket event payloads matching embed-server
export interface JoinChatRoomVisitorPayload {
  chatSessionId: string;
}

export interface VisitorTypingPayload {
  chatSessionId: string;
  isTyping: boolean;
}

export interface ResponseRecordPayload {
  chatSessionId: string;
  botId: string;
  record: RecordItem[];
  answerVariables?: any[];
  visitorMeta?: string;
  vIp?: string;
}

export interface InitiateHandoverPayload {
  chatSessionId: string;
  botId: string;
  workspaceId: string;
  transcript?: string;
  chatDate?: Date;
  answerVariables?: any[];
}

export interface SendAgentMessagePayload {
  agentMessageId: number | string;
  agentDetails: AgentDetails;
  chatSessionId: string;
  message: string;
  isFileInput?: boolean;
  isAudioInput?: boolean;
  uploadedFile?: {
    name: string;
    type: string;
  };
}

// Reaction socket payloads
export interface MessageReactionPayload {
  chatSessionId: string;
  messageId: string;
  emoji: ReactionEmoji;
  action: 'add' | 'remove';
  userId: string;
  userName?: string;
}

export interface MessageReactionUpdatePayload {
  chatSessionId: string;
  messageId: string;
  reactions: Reaction[];
}

// Socket event responses
export interface FetchedChatbotDataResponse {
  chatbotData: any;
  knowledgeBaseData: {
    recentArticles: KnowledgeBaseArticle[];
    categories: string[];
  };
}

export interface BotResponsePayload {
  chatSessionId: string;
  record: RecordItem[];
  answerVariables?: any[];
}

export interface AgentMessagePayload extends SendAgentMessagePayload {}

export interface AgentAcceptedPayload {
  agentDetails: AgentDetails;
}

export interface AgentLeftPayload {
  chatSessionId: string;
  agentDetails: AgentDetails;
}

export interface AgentTypingStatusPayload {
  chatSessionId: string;
  agentDetails: AgentDetails;
  isTyping: boolean;
}

export interface VisitorTypingStatusPayload {
  chatSessionId: string;
  isTyping: boolean;
}

export interface ChatEndedPayload {
  chatSessionId: string;
  agentDetails: AgentDetails;
}

export interface VisitorDisconnectedPayload {
  chatSessionId: string;
}

export interface VisitorInputToggledPayload {
  chatSessionId: string;
  isInputEnabled: boolean;
}

// ********** Event Callback Types ********** //
// Event listener callback types
export type RecordItemCallback = (item: RecordItem) => void;
export type AgentCallback = (agent: Agent) => void;
export type SessionCallback = (chatSessionId: string) => void;
export type TypingCallback = (isTyping: boolean) => void;
export type UnreadCountCallback = (count: number) => void;
export type ErrorCallback = (error: Error) => void;
export type ReactionCallback = (messageId: string, reactions: Reaction[]) => void;
export type NetworkStatusCallback = (isOnline: boolean) => void;

// ********** Message Status Types (Re-exported from messageStatus.ts) ********** //
export {
  MessageStatus,
  ReadReceiptSocketEvents,
  isStatusFinal,
  isStatusSent,
  isStatusPending,
  isStatusMoreAdvanced,
  getNextStatus,
  getStatusText,
  queuedStatusToMessageStatus,
  DEFAULT_READ_RECEIPT_CONFIG,
} from './messageStatus';

export type {
  MessageStatusEntry,
  ReadReceiptData,
  DeliveryReceiptData,
  BatchReadReceiptPayload,
  ReadReceiptConfig as FullReadReceiptConfig,
} from './messageStatus';

// ********** Context Types ********** //
// ConferBot context state
export interface ConferBotContextState {
  isInitialized: boolean;
  isConnected: boolean;
  isOpen: boolean;
  chatSessionId?: string;
  unreadCount: number;
  currentAgent?: Agent;
  record: RecordItem[];
  chatbotConfig?: ChatbotConfig;
  reactions: Map<string, Reaction[]>; // Added reactions state
  // Persistence state
  isRestoring: boolean;
  hasPersistedSession: boolean;
  // Read receipt state
  messageStatuses: Map<string | number, import('./messageStatus').MessageStatusEntry>;
  readReceiptsEnabled: boolean;
  // Offline queue state
  isOnline: boolean;
  pendingMessageCount: number;
  failedMessageCount: number;
}

// ConferBot context actions
export interface ConferBotContextActions {
  openChat: () => void;
  closeChat: () => void;
  sendMessage: (text: string, attachments?: MessageAttachment[]) => Promise<void>;
  registerPushToken: (token: string) => Promise<void>;
  on: (event: SocketEvents, callback: (...args: any[]) => void) => () => void;
  off: (event: SocketEvents, callback: (...args: any[]) => void) => void;
  // Reaction actions
  addReaction: (messageId: string, emoji: ReactionEmoji) => void;
  removeReaction: (messageId: string, emoji: ReactionEmoji) => void;
  getReactions: (messageId: string) => Reaction[];
  // Persistence actions
  clearPersistedData: () => Promise<void>;
  resetConversation: () => Promise<void>;
  // Read receipt actions
  getMessageStatus: (
    messageId: string | number
  ) => import('./messageStatus').MessageStatus | undefined;
  markMessageAsRead: (messageId: string | number) => void;
  markVisibleMessagesAsRead: (messageIds: (string | number)[]) => void;
  // Offline queue actions
  retryFailedMessage: (messageId: string) => Promise<boolean>;
  retryAllFailedMessages: () => Promise<number>;
  clearFailedMessages: () => Promise<number>;
}

// Combined ConferBot context
export interface ConferBotContext extends ConferBotContextState, ConferBotContextActions {}
