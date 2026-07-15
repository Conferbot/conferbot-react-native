/**
 * Handover Types
 *
 * Type definitions for the human handover feature in Conferbot React Native SDK.
 */

// ========================================
// HANDOVER STAGES
// ========================================

export type HandoverStage =
  | 'pre_chat'      // Collecting user info
  | 'waiting'       // Waiting for agent
  | 'connecting'    // Agent found, establishing connection
  | 'connected'     // Connected to agent
  | 'agent_typing'  // Agent is typing
  | 'ended'         // Chat ended normally
  | 'post_chat'     // Post-chat survey
  | 'no_agents'     // No agents available
  | 'timeout'       // Connection timeout
  | 'error';        // Error state

// ========================================
// PRE-CHAT FORM TYPES
// ========================================

export interface PreChatFieldOption {
  label: string;
  value: string;
}

export interface PreChatField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'select' | 'textarea';
  required?: boolean;
  placeholder?: string;
  /** Initial value for the field */
  defaultValue?: string;
  options?: PreChatFieldOption[];
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    errorMessage?: string;
  };
}

export interface PreChatFormData {
  [fieldId: string]: string;
}

export interface PreChatFormConfig {
  /** Whether the pre-chat form is enabled */
  enabled?: boolean;
  title?: string;
  subtitle?: string;
  fields: PreChatField[];
  submitButtonText?: string;
  departments?: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
  showDepartmentSelector?: boolean;
}

// ========================================
// QUEUE TYPES
// ========================================

export interface QueueInfo {
  position: number;
  estimatedWaitTime?: number; // in seconds
  totalInQueue?: number;
  department?: string;
}

// ========================================
// AGENT TYPES
// ========================================

export interface AgentInfo {
  id: string;
  name: string;
  avatar?: string;
  role?: string;
  department?: string;
  status?: 'online' | 'busy' | 'away';
}

// ========================================
// SURVEY TYPES
// ========================================

export type SurveyRatingStyle = 'stars' | 'thumbs' | 'numbers' | 'emojis';

export interface PostChatSurveyConfig {
  enabled: boolean;
  title?: string;
  /** Show the rating section (default: true) */
  ratingEnabled?: boolean;
  /** Require a rating before allowing submission */
  ratingRequired?: boolean;
  ratingQuestion?: string;
  ratingStyle?: SurveyRatingStyle;
  maxRating?: number;
  /** Show the free-text comment section (default: true) */
  commentEnabled?: boolean;
  /** Placeholder for the comment input (alias of feedbackPlaceholder) */
  commentPlaceholder?: string;
  /** Show the skip button (default: true) */
  skipEnabled?: boolean;
  feedbackQuestion?: string;
  feedbackPlaceholder?: string;
  submitButtonText?: string;
  skipButtonText?: string;
  thankYouMessage?: string;
}

export interface SurveyResponse {
  rating?: number;
  /** Free-text feedback (the platform field name used by the server) */
  feedback?: string;
  /** Alias of feedback for consumers using the comment naming */
  comment?: string;
  agentId?: string;
  sessionId?: string;
  timestamp: string;
}

// ========================================
// HANDOVER STATE
// ========================================

export interface HandoverState {
  stage: HandoverStage;

  // Pre-chat form
  preChatConfig?: PreChatFormConfig;
  preChatData?: PreChatFormData;
  selectedDepartment?: string;

  // Queue info
  queueInfo?: QueueInfo;

  // Agent info
  agent?: AgentInfo;
  isAgentTyping?: boolean;

  // Messages
  waitMessage?: string;
  connectedMessage?: string;
  endedMessage?: string;
  noAgentsMessage?: string;
  timeoutMessage?: string;
  errorMessage?: string;

  // Post-chat survey
  surveyConfig?: PostChatSurveyConfig;
  surveyResponse?: SurveyResponse;

  // Timestamps
  requestedAt?: string;
  connectedAt?: string;
  endedAt?: string;

  // Additional data
  conversationId?: string;
  metadata?: Record<string, any>;
}

// ========================================
// HANDOVER EVENTS
// ========================================

export interface HandoverEvent {
  type: HandoverEventType;
  timestamp: string;
  data?: Record<string, any>;
}

export type HandoverEventType =
  | 'request_started'
  | 'pre_chat_submitted'
  | 'queue_joined'
  | 'queue_update'
  | 'agent_assigned'
  | 'agent_connected'
  | 'agent_typing_start'
  | 'agent_typing_stop'
  | 'agent_message'
  | 'user_message'
  | 'agent_disconnected'
  | 'conversation_ended'
  | 'survey_submitted'
  | 'survey_skipped'
  | 'timeout'
  | 'error'
  | 'cancelled';

// ========================================
// COMPONENT PROPS
// ========================================

export interface PreChatFormProps {
  config: PreChatFormConfig;
  onSubmit: (data: PreChatFormData, department?: string) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  /** Form title (overrides config.title) */
  title?: string;
  /** Form description (overrides config.subtitle) */
  description?: string;
  /** Submit button label (overrides config.submitButtonText) */
  submitButtonText?: string;
  /** Cancel button label (default: 'Cancel') */
  cancelButtonText?: string;
  accessibilityLabel?: string;
  testID?: string;
}

export interface HandoverWaitingProps {
  message?: string;
  /** Alias for message (takes precedence when provided) */
  waitingMessage?: string;
  queueInfo?: QueueInfo;
  onCancel?: () => void;
  showQueuePosition?: boolean;
  showEstimatedTime?: boolean;
  /** Cancel button label (default: 'Cancel') */
  cancelButtonText?: string;
  /** Show the connecting state (agent found, establishing connection) */
  isConnecting?: boolean;
  /** Message shown while connecting */
  connectingMessage?: string;
  accessibilityLabel?: string;
  testID?: string;
}

export interface AgentTypingProps {
  agent?: AgentInfo;
  visible?: boolean;
  /** Alias for visible (both supported; show wins when provided) */
  show?: boolean;
  /** Custom typing message; supports a {name} placeholder for the agent name */
  typingMessage?: string;
  /** Compact layout (smaller avatar and bubble) */
  compact?: boolean;
  /** Hide the agent name/message text */
  hideAgentInfo?: boolean;
  /** Enable/disable the dot animation */
  animated?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

export interface PostChatSurveyProps {
  config: PostChatSurveyConfig;
  agent?: AgentInfo;
  /** Agent display name (used when a full agent object is not available) */
  agentName?: string;
  onSubmit?: (response: SurveyResponse) => void;
  onSkip?: () => void;
  isSubmitting?: boolean;
  /** Submit button label (overrides config.submitButtonText) */
  submitButtonText?: string;
  /** Skip button label (overrides config.skipButtonText) */
  skipButtonText?: string;
  accessibilityLabel?: string;
  testID?: string;
}

export interface HandoverConnectedProps {
  agent: AgentInfo;
  message?: string;
  onEndChat?: () => void;
  /** End chat button label (default: 'End Chat') */
  endChatButtonText?: string;
  accessibilityLabel?: string;
  testID?: string;
}

export interface HandoverEndedProps {
  message?: string;
  showSurvey?: boolean;
  surveyConfig?: PostChatSurveyConfig;
  agent?: AgentInfo;
  onSurveySubmit?: (response: SurveyResponse) => void;
  onSurveySkip?: () => void;
  onContinue?: () => void;
}

export interface HandoverErrorProps {
  errorType: 'no_agents' | 'timeout' | 'error';
  message?: string;
  /** Message for the generic error state (overrides message) */
  errorMessage?: string;
  /** Message for the no_agents state (overrides message) */
  noAgentsMessage?: string;
  /** Message for the timeout state (overrides message) */
  timeoutMessage?: string;
  onRetry?: () => void;
  onContinue?: () => void;
  /** Cancel/back callback - renders the cancel button when provided */
  onCancel?: () => void;
  /** Retry button label (default: 'Try Again') */
  retryButtonText?: string;
  /** Cancel button label (default: 'Go Back') */
  cancelButtonText?: string;
  accessibilityLabel?: string;
  testID?: string;
}

// ========================================
// SOCKET EVENTS
// ========================================

export interface HandoverSocketEvents {
  // Outgoing events
  'handover:request': {
    sessionId: string;
    botId: string;
    nodeId: string;
    preChatData?: PreChatFormData;
    department?: string;
    priority?: string;
    transcript?: any[];
    userMetadata?: Record<string, any>;
  };

  'handover:cancel': {
    sessionId: string;
    conversationId?: string;
  };

  'handover:message': {
    sessionId: string;
    conversationId: string;
    message: string;
    attachments?: any[];
  };

  'handover:typing': {
    sessionId: string;
    conversationId: string;
    isTyping: boolean;
  };

  'handover:end': {
    sessionId: string;
    conversationId: string;
    reason?: string;
  };

  'handover:survey': {
    sessionId: string;
    conversationId: string;
    response: SurveyResponse;
  };

  // Incoming events
  'handover:queued': {
    sessionId: string;
    conversationId: string;
    queueInfo: QueueInfo;
  };

  'handover:queue_update': {
    sessionId: string;
    conversationId: string;
    queueInfo: QueueInfo;
  };

  'handover:agent_assigned': {
    sessionId: string;
    conversationId: string;
    agent: AgentInfo;
  };

  'handover:connected': {
    sessionId: string;
    conversationId: string;
    agent: AgentInfo;
  };

  'handover:agent_typing': {
    sessionId: string;
    conversationId: string;
    isTyping: boolean;
  };

  'handover:agent_message': {
    sessionId: string;
    conversationId: string;
    message: string;
    attachments?: any[];
    timestamp: string;
  };

  'handover:ended': {
    sessionId: string;
    conversationId: string;
    reason?: string;
    showSurvey?: boolean;
    surveyConfig?: PostChatSurveyConfig;
  };

  'handover:no_agents': {
    sessionId: string;
    message?: string;
  };

  'handover:timeout': {
    sessionId: string;
    message?: string;
  };

  'handover:error': {
    sessionId: string;
    error: string;
    code?: string;
  };
}

export default HandoverState;
