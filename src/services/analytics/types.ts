/**
 * Analytics Types
 *
 * Type definitions for the analytics tracking system.
 * Matches the web widget analytics and server API format.
 */

// ========================================
// EVENT TYPES
// ========================================

/** Analytics event types */
export enum AnalyticsEventType {
  // Session events
  SESSION_START = 'session_start',
  SESSION_END = 'session_end',
  SESSION_RESUME = 'session_resume',

  // Node events
  NODE_VISIT = 'node_visit',
  NODE_EXIT = 'node_exit',

  // User behavior events
  TYPING_START = 'typing_start',
  TYPING_END = 'typing_end',
  MESSAGE_SENT = 'message_sent',
  MESSAGE_RECEIVED = 'message_received',
  SCROLL = 'scroll',
  BUTTON_CLICK = 'button_click',
  CHOICE_SELECT = 'choice_select',
  LINK_CLICK = 'link_click',
  FILE_UPLOAD = 'file_upload',
  IMAGE_VIEW = 'image_view',
  VIDEO_WATCH = 'video_watch',
  CAROUSEL_INTERACT = 'carousel_interact',

  // Goal/conversion events
  GOAL_COMPLETION = 'goal_completion',

  // Rating events
  RATING_SUBMIT = 'rating_submit',

  // Drop-off events
  DROP_OFF = 'drop_off',

  // Engagement updates
  ENGAGEMENT_UPDATE = 'engagement_update',
}

// ========================================
// SESSION METRICS
// ========================================

/** Session timing metrics */
export interface SessionMetrics {
  startedAt: number;
  firstMessageAt?: number;
  lastMessageAt?: number;
  totalDuration: number;
  activeDuration: number;
  idleTime: number;
}

/** Message counts */
export interface MessageCounts {
  total: number;
  userMessages: number;
  botMessages: number;
  agentMessages: number;
}

/** Typing behavior metrics */
export interface TypingBehavior {
  totalTypingTime: number;
  deletions: number;
  abandonedMessages: number;
  avgMessageLength: number;
}

// ========================================
// NODE ANALYTICS
// ========================================

/** Node visit tracking data */
export interface NodeVisitData {
  nodeId: string;
  nodeType: string;
  nodeName: string;
  enteredAt: number;
  exitedAt?: number;
  dwellTime?: number;
  exitType?: NodeExitType;
  userInput?: string;
  selectedOption?: string;
}

/** Node exit type */
export type NodeExitType =
  | 'proceeded'
  | 'abandoned'
  | 'back_pressed'
  | 'skipped'
  | 'timeout'
  | 'error';

// ========================================
// ATTRIBUTION
// ========================================

/** Attribution data for mobile */
export interface MobileAttribution {
  appVersion?: string;
  buildNumber?: string;
  deviceModel?: string;
  osName: 'ios' | 'android';
  osVersion?: string;
  screenWidth?: number;
  screenHeight?: number;
  locale?: string;
  timezone?: string;
  entryPoint?: string;
  deepLink?: string;
  pushNotificationId?: string;
}

// ========================================
// ENVIRONMENT DATA
// ========================================

/** Device environment data */
export interface EnvironmentData {
  deviceType: 'mobile' | 'tablet';
  platform: 'ios' | 'android';
  osVersion: string;
  appVersion: string;
  buildNumber?: string;
  deviceModel: string;
  screenResolution: string;
  language: string;
  timezone: string;
  isEmulator?: boolean;
  carrier?: string;
  networkType?: string;
}

// ========================================
// ANALYTICS EVENTS
// ========================================

/** Base analytics event */
export interface BaseAnalyticsEvent {
  eventId: string;
  eventType: AnalyticsEventType;
  timestamp: number;
  chatSessionId: string;
  botId: string;
  visitorId?: string;
}

/** Session start event */
export interface SessionStartEvent extends BaseAnalyticsEvent {
  eventType: AnalyticsEventType.SESSION_START;
  attribution: MobileAttribution;
}

/** Session end event */
export interface SessionEndEvent extends BaseAnalyticsEvent {
  eventType: AnalyticsEventType.SESSION_END;
  finalMetrics: {
    totalDuration: number;
    activeDuration: number;
    idleTime: number;
    messageCounts: MessageCounts;
    typingBehavior: TypingBehavior;
    environment: EnvironmentData;
  };
}

/** Node visit event */
export interface NodeVisitEvent extends BaseAnalyticsEvent {
  eventType: AnalyticsEventType.NODE_VISIT;
  nodeId: string;
  nodeType: string;
  nodeName: string;
  enteredAt: number;
}

/** Node exit event */
export interface NodeExitEvent extends BaseAnalyticsEvent {
  eventType: AnalyticsEventType.NODE_EXIT;
  nodeId: string;
  exitedAt: number;
  exitType: NodeExitType;
  dwellTime: number;
  userInput?: string;
  selectedOption?: string;
}

/** User message event */
export interface MessageSentEvent extends BaseAnalyticsEvent {
  eventType: AnalyticsEventType.MESSAGE_SENT;
  messageIndex: number;
  text: string;
  nodeId?: string;
  responseTimeMs?: number;
}

/** Interaction event */
export interface InteractionEvent extends BaseAnalyticsEvent {
  eventType:
    | AnalyticsEventType.BUTTON_CLICK
    | AnalyticsEventType.CHOICE_SELECT
    | AnalyticsEventType.LINK_CLICK
    | AnalyticsEventType.FILE_UPLOAD
    | AnalyticsEventType.IMAGE_VIEW
    | AnalyticsEventType.VIDEO_WATCH
    | AnalyticsEventType.CAROUSEL_INTERACT;
  interactionType: string;
  nodeId?: string;
  data?: Record<string, any>;
}

/** Goal completion event */
export interface GoalCompletionEvent extends BaseAnalyticsEvent {
  eventType: AnalyticsEventType.GOAL_COMPLETION;
  goalId: string;
  conversionEvent?: string;
  conversionValue?: number;
}

/** Rating submit event */
export interface RatingSubmitEvent extends BaseAnalyticsEvent {
  eventType: AnalyticsEventType.RATING_SUBMIT;
  csatScore?: number;
  feedback?: string;
  thumbsUp?: boolean;
  npsScore?: number;
  source: string;
}

/** Drop-off event */
export interface DropOffEvent extends BaseAnalyticsEvent {
  eventType: AnalyticsEventType.DROP_OFF;
  nodeId?: string;
  nodeType?: string;
  nodeName?: string;
  reason: DropOffReason;
  timeBeforeDropOff: number;
  lastUserAction?: string;
}

/** Drop-off reason */
export type DropOffReason =
  | 'app_backgrounded'
  | 'app_closed'
  | 'timeout'
  | 'navigated_away'
  | 'session_expired'
  | 'network_error';

/** Engagement update event */
export interface EngagementUpdateEvent extends BaseAnalyticsEvent {
  eventType: AnalyticsEventType.ENGAGEMENT_UPDATE;
  sessionMetrics: SessionMetrics;
  typingBehavior: TypingBehavior;
  currentNodeId?: string;
}

/** Union type for all analytics events */
export type AnalyticsEvent =
  | SessionStartEvent
  | SessionEndEvent
  | NodeVisitEvent
  | NodeExitEvent
  | MessageSentEvent
  | InteractionEvent
  | GoalCompletionEvent
  | RatingSubmitEvent
  | DropOffEvent
  | EngagementUpdateEvent;

// ========================================
// ANALYTICS CONFIG
// ========================================

/** Analytics service configuration */
export interface AnalyticsConfig {
  /** Enable/disable analytics */
  enabled: boolean;
  /** Batch size before sending */
  batchSize: number;
  /** Batch interval in milliseconds */
  batchIntervalMs: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Retry delay in milliseconds */
  retryDelayMs: number;
  /** Enable debug logging */
  debug: boolean;
  /** Custom storage key prefix */
  storageKeyPrefix: string;
  /** Idle threshold in milliseconds (60 seconds) */
  idleThresholdMs: number;
}

/** Default analytics configuration */
export const DEFAULT_ANALYTICS_CONFIG: AnalyticsConfig = {
  enabled: true,
  batchSize: 10,
  batchIntervalMs: 30000, // 30 seconds
  maxRetries: 3,
  retryDelayMs: 5000, // 5 seconds
  debug: false,
  storageKeyPrefix: 'conferbot_analytics_',
  idleThresholdMs: 60000, // 60 seconds
};

// ========================================
// SOCKET EVENT NAMES
// ========================================

/** Analytics socket events (matching server) */
export const AnalyticsSocketEvents = {
  TRACK_CHAT_START: 'track-chat-start',
  TRACK_NODE_VISIT: 'track-node-visit',
  TRACK_NODE_EXIT: 'track-node-exit',
  TRACK_CHAT_ENGAGEMENT: 'track-chat-engagement',
  TRACK_DROP_OFF: 'track-drop-off',
  TRACK_SENTIMENT: 'track-sentiment',
  TRACK_INTERACTION: 'track-interaction',
  TRACK_GOAL_COMPLETION: 'track-goal-completion',
  SUBMIT_CHAT_RATING: 'submit-chat-rating',
  FINALIZE_ANALYTICS: 'finalize-analytics',
} as const;
