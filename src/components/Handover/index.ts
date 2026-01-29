/**
 * Handover Components Index
 *
 * Exports all human handover UI components for the Conferbot React Native SDK.
 */

// Main Components
export { PreChatForm } from './PreChatForm';
export { HandoverWaiting } from './HandoverWaiting';
export { HandoverConnected } from './HandoverConnected';
export { HandoverError } from './HandoverError';
export { PostChatSurvey } from './PostChatSurvey';
export { AgentTyping } from './AgentTyping';
export { HandoverView } from './HandoverView';

// Hook
export { useHandover } from './useHandover';

// Types
export type {
  // Stage types
  HandoverStage,
  HandoverState,
  HandoverEvent,
  HandoverEventType,

  // Pre-chat types
  PreChatField,
  PreChatFieldOption,
  PreChatFormData,
  PreChatFormConfig,

  // Queue types
  QueueInfo,

  // Agent types
  AgentInfo,

  // Survey types
  SurveyRatingStyle,
  PostChatSurveyConfig,
  SurveyResponse,

  // Component props
  PreChatFormProps,
  HandoverWaitingProps,
  AgentTypingProps,
  PostChatSurveyProps,
  HandoverConnectedProps,
  HandoverEndedProps,
  HandoverErrorProps,

  // Socket events
  HandoverSocketEvents,
} from './types';

export type { HandoverViewProps } from './HandoverView';

export default {
  PreChatForm,
  HandoverWaiting,
  HandoverConnected,
  HandoverError,
  PostChatSurvey,
  AgentTyping,
  HandoverView,
  useHandover,
};
