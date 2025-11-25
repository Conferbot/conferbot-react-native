// ********** Core Types ********** //
// Conferbot SDK configuration
export interface ConferBotConfig {
  enableNotifications?: boolean;
  enableOfflineMode?: boolean;
  autoConnect?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
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
}

// ConferBot context actions
export interface ConferBotContextActions {
  openChat: () => void;
  closeChat: () => void;
  sendMessage: (text: string, attachments?: MessageAttachment[]) => Promise<void>;
  registerPushToken: (token: string) => Promise<void>;
  on: (event: SocketEvents, callback: (...args: any[]) => void) => () => void;
  off: (event: SocketEvents, callback: (...args: any[]) => void) => void;
}

// Combined ConferBot context
export interface ConferBotContext extends ConferBotContextState, ConferBotContextActions {}
