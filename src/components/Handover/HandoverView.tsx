/**
 * HandoverView.tsx
 *
 * Main human handover view component that orchestrates all handover states.
 * This component manages the complete handover flow from pre-chat to post-chat survey.
 */

import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';

import { PreChatForm } from './PreChatForm';
import { HandoverWaiting } from './HandoverWaiting';
import { HandoverConnected } from './HandoverConnected';
import { HandoverError } from './HandoverError';
import { PostChatSurvey } from './PostChatSurvey';
import { AgentTyping } from './AgentTyping';

import type {
  HandoverState,
  HandoverStage,
  PreChatFormData,
  SurveyResponse,
  PreChatFormConfig,
  PostChatSurveyConfig,
  AgentInfo,
  QueueInfo,
} from './types';

// ========================================
// COMPONENT PROPS
// ========================================

export interface HandoverViewProps {
  /** Node ID for tracking */
  nodeId: string;

  /** Current handover stage */
  stage: HandoverStage;

  /** Pre-chat form configuration */
  preChatConfig?: PreChatFormConfig;

  /** Post-chat survey configuration */
  surveyConfig?: PostChatSurveyConfig;

  /** Connected agent information */
  agent?: AgentInfo;

  /** Queue information */
  queueInfo?: QueueInfo;

  /** Whether agent is typing */
  isAgentTyping?: boolean;

  /** Custom messages */
  waitMessage?: string;
  connectedMessage?: string;
  endedMessage?: string;
  noAgentsMessage?: string;
  timeoutMessage?: string;
  errorMessage?: string;

  /** Callbacks */
  onPreChatSubmit?: (data: PreChatFormData, department?: string) => void;
  onCancel?: () => void;
  onRetry?: () => void;
  onEndChat?: () => void;
  onSurveySubmit?: (response: SurveyResponse) => void;
  onSurveySkip?: () => void;
  onContinue?: () => void;

  /** Loading states */
  isPreChatSubmitting?: boolean;
  isSurveySubmitting?: boolean;
}

// ========================================
// DEFAULT CONFIGURATIONS
// ========================================

const defaultPreChatConfig: PreChatFormConfig = {
  title: 'Before we connect you',
  subtitle: 'Please provide the following information',
  fields: [
    {
      id: 'name',
      label: 'Name',
      type: 'text',
      required: true,
      placeholder: 'Enter your name',
    },
    {
      id: 'email',
      label: 'Email',
      type: 'email',
      required: true,
      placeholder: 'Enter your email',
    },
  ],
  submitButtonText: 'Start Chat',
};

const defaultSurveyConfig: PostChatSurveyConfig = {
  enabled: true,
  title: 'How was your experience?',
  ratingQuestion: 'Please rate your conversation',
  ratingStyle: 'stars',
  maxRating: 5,
  feedbackQuestion: 'Any additional feedback? (optional)',
  feedbackPlaceholder: 'Tell us more about your experience...',
  submitButtonText: 'Submit',
  skipButtonText: 'Skip',
  thankYouMessage: 'Thank you for your feedback!',
};

// ========================================
// MAIN COMPONENT
// ========================================

export const HandoverView: React.FC<HandoverViewProps> = ({
  nodeId,
  stage,
  preChatConfig,
  surveyConfig,
  agent,
  queueInfo,
  isAgentTyping = false,
  waitMessage,
  connectedMessage,
  endedMessage,
  noAgentsMessage,
  timeoutMessage,
  errorMessage,
  onPreChatSubmit,
  onCancel,
  onRetry,
  onEndChat,
  onSurveySubmit,
  onSurveySkip,
  onContinue,
  isPreChatSubmitting = false,
  isSurveySubmitting = false,
}) => {
  // Memoize configs to prevent unnecessary re-renders
  const effectivePreChatConfig = useMemo(
    () => preChatConfig || defaultPreChatConfig,
    [preChatConfig]
  );

  const effectiveSurveyConfig = useMemo(
    () => surveyConfig || defaultSurveyConfig,
    [surveyConfig]
  );

  // Handler for pre-chat form submission
  const handlePreChatSubmit = useCallback(
    (data: PreChatFormData, department?: string) => {
      onPreChatSubmit?.(data, department);
    },
    [onPreChatSubmit]
  );

  // Handler for survey submission
  const handleSurveySubmit = useCallback(
    (response: SurveyResponse) => {
      onSurveySubmit?.(response);
    },
    [onSurveySubmit]
  );

  // Render based on current stage
  const renderContent = () => {
    switch (stage) {
      case 'pre_chat':
        return (
          <PreChatForm
            config={effectivePreChatConfig}
            onSubmit={handlePreChatSubmit}
            onCancel={onCancel}
            isSubmitting={isPreChatSubmitting}
          />
        );

      case 'waiting':
      case 'connecting':
        return (
          <HandoverWaiting
            message={waitMessage}
            queueInfo={queueInfo}
            onCancel={onCancel}
            showQueuePosition={!!queueInfo?.position}
            showEstimatedTime={!!queueInfo?.estimatedWaitTime}
          />
        );

      case 'connected':
      case 'agent_typing':
        return (
          <View style={styles.connectedContainer}>
            <HandoverConnected
              agent={agent || { id: '', name: 'Agent' }}
              message={connectedMessage}
              onEndChat={onEndChat}
            />
            <AgentTyping
              agent={agent}
              visible={isAgentTyping || stage === 'agent_typing'}
            />
          </View>
        );

      case 'ended':
        if (effectiveSurveyConfig.enabled && onSurveySubmit) {
          return (
            <PostChatSurvey
              config={effectiveSurveyConfig}
              agent={agent}
              onSubmit={handleSurveySubmit}
              onSkip={onSurveySkip}
              isSubmitting={isSurveySubmitting}
            />
          );
        }
        // If survey is disabled, just show ended state
        return (
          <HandoverError
            errorType="no_agents"
            message={endedMessage || 'The conversation has ended. Thank you for chatting with us!'}
            onContinue={onContinue}
          />
        );

      case 'post_chat':
        return (
          <PostChatSurvey
            config={effectiveSurveyConfig}
            agent={agent}
            onSubmit={handleSurveySubmit}
            onSkip={onSurveySkip}
            isSubmitting={isSurveySubmitting}
          />
        );

      case 'no_agents':
        return (
          <HandoverError
            errorType="no_agents"
            message={noAgentsMessage}
            onRetry={onRetry}
            onContinue={onContinue}
          />
        );

      case 'timeout':
        return (
          <HandoverError
            errorType="timeout"
            message={timeoutMessage}
            onRetry={onRetry}
            onContinue={onContinue}
          />
        );

      case 'error':
        return (
          <HandoverError
            errorType="error"
            message={errorMessage}
            onRetry={onRetry}
            onContinue={onContinue}
          />
        );

      default:
        return null;
    }
  };

  return (
    <View
      style={styles.container}
      accessibilityLabel={`Handover view - ${stage}`}
    >
      {renderContent()}
    </View>
  );
};

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  connectedContainer: {
    width: '100%',
  },
});

export default HandoverView;
