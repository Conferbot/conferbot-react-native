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
  ratingQuestion?: string;
  ratingStyle?: SurveyRatingStyle;
  maxRating?: number;
  feedbackQuestion?: string;
  feedbackPlaceholder?: string;
  submitButtonText?: string;
  skipButtonText?: string;
  thankYouMessage?: string;
}

export interface SurveyResponse {
  rating?: number;
  feedback?: string;
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
}

export interface HandoverWaitingProps {
  message?: string;
  queueInfo?: QueueInfo;
  onCancel?: () => void;
  showQueuePosition?: boolean;
  showEstimatedTime?: boolean;
}

export interface AgentTypingProps {
  agent?: AgentInfo;
  visible?: boolean;
}

export interface PostChatSurveyProps {
  config: PostChatSurveyConfig;
  agent?: AgentInfo;
  onSubmit: (response: SurveyResponse) => void;
  onSkip?: () => void;
  isSubmitting?: boolean;
}

export interface HandoverConnectedProps {
  agent: AgentInfo;
  message?: string;
  onEndChat?: () => void;
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
  onRetry?: () => void;
  onContinue?: () => void;
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
