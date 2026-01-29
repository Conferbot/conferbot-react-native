/**
 * SpecialComponents.tsx
 *
 * Components for special node types.
 * Includes: HumanHandoverView, GPTResponseView, LoadingIndicator, QuizQuestion
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  Animated,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';

import { NodeUIState } from '../../core/nodes/NodeHandler';
import { useTheme } from '../../theme';
import {
  HandoverView,
  PreChatForm,
  HandoverWaiting,
  HandoverConnected,
  HandoverError,
  PostChatSurvey,
  AgentTyping,
} from '../Handover';
import type {
  HandoverStage,
  PreChatFormConfig,
  PostChatSurveyConfig,
  AgentInfo,
  QueueInfo,
  PreChatFormData,
  SurveyResponse,
} from '../Handover/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_WIDTH = SCREEN_WIDTH - 24;
const MAX_BUBBLE_WIDTH = SCREEN_WIDTH * 0.75;

// ========================================
// EXTENDED HUMAN HANDOVER UI STATE
// ========================================

/**
 * Extended HumanHandover UI state with full handover flow support.
 * This extends the base NodeUIState.HumanHandover with additional fields.
 */
export interface ExtendedHumanHandoverState extends NodeUIState.HumanHandover {
  /** Extended stage for full handover flow */
  extendedStage?: HandoverStage;

  /** Queue information */
  queueInfo?: QueueInfo;

  /** Agent info when connected */
  agent?: AgentInfo;

  /** Whether agent is currently typing */
  isAgentTyping?: boolean;

  /** Pre-chat form configuration */
  preChatConfig?: PreChatFormConfig;

  /** Post-chat survey configuration */
  surveyConfig?: PostChatSurveyConfig;

  /** Custom questions from nodeData */
  customQuestions?: Array<{
    id: string;
    question: string;
    type: 'text' | 'email' | 'phone' | 'select';
    required?: boolean;
    options?: Array<{ label: string; value: string }>;
  }>;

  /** Department selection options */
  departments?: Array<{
    id: string;
    name: string;
    description?: string;
  }>;

  /** Error message for error states */
  errorMessage?: string;
}

// ========================================
// HUMAN HANDOVER VIEW
// ========================================

interface HumanHandoverViewProps extends ExtendedHumanHandoverState {
  onSubmit: (response: any, portName?: string) => void;
}

/**
 * HumanHandoverView component
 *
 * Complete human handover UI with full flow support:
 * - Pre-chat form with validation
 * - Queue position and estimated wait time
 * - Agent connection status
 * - Agent typing indicator
 * - Post-chat survey
 * - Error handling (no agents, timeout, errors)
 */
export const HumanHandoverView: React.FC<HumanHandoverViewProps> = ({
  nodeId,
  stage,
  extendedStage,
  agentName,
  agentAvatar,
  waitMessage = 'Please wait while we connect you with an agent...',
  connectedMessage = 'You are now connected with',
  endedMessage = 'The conversation has ended. Thank you for chatting with us!',
  noAgentsMessage = 'Sorry, no agents are available at the moment. Please try again later.',
  timeoutMessage = 'We apologize, but we were unable to connect you with an agent. Please try again later.',
  errorMessage,
  showPreChatForm = false,
  preChatFields,
  preChatConfig,
  surveyConfig,
  customQuestions,
  departments,
  queueInfo,
  agent,
  isAgentTyping = false,
  onSubmit,
}) => {
  const theme = useTheme();
  const [currentStage, setCurrentStage] = useState<HandoverStage>(
    extendedStage || mapLegacyStage(stage)
  );
  const [isPreChatSubmitting, setIsPreChatSubmitting] = useState(false);
  const [isSurveySubmitting, setIsSurveySubmitting] = useState(false);

  // Update stage when props change
  useEffect(() => {
    if (extendedStage) {
      setCurrentStage(extendedStage);
    } else {
      setCurrentStage(mapLegacyStage(stage));
    }
  }, [stage, extendedStage]);

  // Map legacy stage to extended stage
  function mapLegacyStage(legacyStage: string): HandoverStage {
    switch (legacyStage) {
      case 'waiting':
        return showPreChatForm && !preChatFields ? 'pre_chat' : 'waiting';
      case 'connected':
        return 'connected';
      case 'ended':
        return surveyConfig?.enabled ? 'post_chat' : 'ended';
      case 'noAgents':
        return 'no_agents';
      case 'timeout':
        return 'timeout';
      default:
        return 'pre_chat';
    }
  }

  // Build pre-chat config from legacy fields or new config
  const effectivePreChatConfig: PreChatFormConfig = preChatConfig || {
    title: 'Before we connect you',
    subtitle: 'Please provide the following information',
    fields: [
      ...(preChatFields || []).map((field) => ({
        id: field.id,
        label: field.label,
        type: field.type as 'text' | 'email' | 'phone' | 'select',
        required: field.required,
        options: field.options?.map((opt) => ({
          label: opt.label,
          value: String(opt.value),
        })),
      })),
      ...(customQuestions || []).map((q) => ({
        id: q.id,
        label: q.question,
        type: q.type as 'text' | 'email' | 'phone' | 'select',
        required: q.required,
        options: q.options,
      })),
    ],
    departments: departments,
    showDepartmentSelector: !!departments && departments.length > 0,
    submitButtonText: 'Start Chat',
  };

  // Build agent info from legacy fields or new agent object
  const effectiveAgent: AgentInfo = agent || {
    id: '',
    name: agentName || 'Agent',
    avatar: agentAvatar,
  };

  // Default survey config
  const effectiveSurveyConfig: PostChatSurveyConfig = surveyConfig || {
    enabled: true,
    title: 'How was your experience?',
    ratingQuestion: 'Please rate your conversation',
    ratingStyle: 'stars',
    maxRating: 5,
    feedbackQuestion: 'Any additional feedback? (optional)',
    submitButtonText: 'Submit',
    skipButtonText: 'Skip',
    thankYouMessage: 'Thank you for your feedback!',
  };

  // Handle pre-chat form submission
  const handlePreChatSubmit = useCallback(
    (data: PreChatFormData, department?: string) => {
      setIsPreChatSubmitting(true);
      onSubmit({
        action: 'preChatSubmit',
        formData: data,
        department,
      });
      // Move to waiting state after submit
      setTimeout(() => {
        setCurrentStage('waiting');
        setIsPreChatSubmitting(false);
      }, 500);
    },
    [onSubmit]
  );

  // Handle cancel
  const handleCancel = useCallback(() => {
    onSubmit({
      action: 'cancel',
    });
  }, [onSubmit]);

  // Handle retry
  const handleRetry = useCallback(() => {
    setCurrentStage('pre_chat');
    onSubmit({
      action: 'retry',
    });
  }, [onSubmit]);

  // Handle end chat
  const handleEndChat = useCallback(() => {
    setCurrentStage(effectiveSurveyConfig.enabled ? 'post_chat' : 'ended');
    onSubmit({
      action: 'endChat',
    });
  }, [effectiveSurveyConfig.enabled, onSubmit]);

  // Handle survey submission
  const handleSurveySubmit = useCallback(
    (response: SurveyResponse) => {
      setIsSurveySubmitting(true);
      onSubmit({
        action: 'surveySubmit',
        surveyResponse: response,
      });
      setTimeout(() => {
        setIsSurveySubmitting(false);
      }, 500);
    },
    [onSubmit]
  );

  // Handle survey skip
  const handleSurveySkip = useCallback(() => {
    setCurrentStage('ended');
    onSubmit({
      action: 'surveySkip',
    });
  }, [onSubmit]);

  // Handle continue (back to bot)
  const handleContinue = useCallback(() => {
    onSubmit({
      action: 'continue',
    });
  }, [onSubmit]);

  // Render based on current stage
  const renderContent = () => {
    switch (currentStage) {
      case 'pre_chat':
        // Show pre-chat form if configured
        if (effectivePreChatConfig.fields.length > 0) {
          return (
            <PreChatForm
              config={effectivePreChatConfig}
              onSubmit={handlePreChatSubmit}
              onCancel={handleCancel}
              isSubmitting={isPreChatSubmitting}
            />
          );
        }
        // If no fields, go directly to waiting
        return (
          <HandoverWaiting
            message={waitMessage}
            queueInfo={queueInfo}
            onCancel={handleCancel}
          />
        );

      case 'waiting':
      case 'connecting':
        return (
          <HandoverWaiting
            message={waitMessage}
            queueInfo={queueInfo}
            onCancel={handleCancel}
            showQueuePosition={!!queueInfo?.position}
            showEstimatedTime={!!queueInfo?.estimatedWaitTime}
          />
        );

      case 'connected':
      case 'agent_typing':
        return (
          <View>
            <HandoverConnected
              agent={effectiveAgent}
              message={`${connectedMessage} ${effectiveAgent.name}`}
              onEndChat={handleEndChat}
            />
            <AgentTyping
              agent={effectiveAgent}
              visible={isAgentTyping || currentStage === 'agent_typing'}
            />
          </View>
        );

      case 'post_chat':
        return (
          <PostChatSurvey
            config={effectiveSurveyConfig}
            agent={effectiveAgent}
            onSubmit={handleSurveySubmit}
            onSkip={handleSurveySkip}
            isSubmitting={isSurveySubmitting}
          />
        );

      case 'ended':
        return (
          <View
            style={[
              styles.endedContainer,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: theme.borderRadius.lg,
              },
              theme.shadows.sm,
            ]}
          >
            <Text style={styles.endedIcon}>{'\u2705'}</Text>
            <Text
              style={[
                styles.endedMessage,
                {
                  color: theme.colors.text,
                  fontSize: theme.typography.fontSize.md,
                },
              ]}
            >
              {endedMessage}
            </Text>
            <TouchableOpacity
              style={[
                styles.continueButton,
                {
                  borderColor: theme.colors.border,
                  borderRadius: theme.borderRadius.md,
                },
              ]}
              onPress={handleContinue}
            >
              <Text
                style={[
                  styles.continueButtonText,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Continue
              </Text>
            </TouchableOpacity>
          </View>
        );

      case 'no_agents':
        return (
          <HandoverError
            errorType="no_agents"
            message={noAgentsMessage}
            onRetry={handleRetry}
            onContinue={handleContinue}
          />
        );

      case 'timeout':
        return (
          <HandoverError
            errorType="timeout"
            message={timeoutMessage}
            onRetry={handleRetry}
            onContinue={handleContinue}
          />
        );

      case 'error':
        return (
          <HandoverError
            errorType="error"
            message={errorMessage || 'An error occurred. Please try again.'}
            onRetry={handleRetry}
            onContinue={handleContinue}
          />
        );

      default:
        return null;
    }
  };

  return (
    <View
      style={styles.handoverContainer}
      accessibilityRole="alert"
      accessibilityLabel={`Human handover: ${currentStage}`}
    >
      {renderContent()}
    </View>
  );
};

// ========================================
// GPT RESPONSE VIEW
// ========================================

interface GPTResponseViewProps extends NodeUIState.GPTResponse {}

/**
 * GPTResponseView component
 *
 * Displays a GPT/AI generated response with streaming support.
 */
export const GPTResponseView: React.FC<GPTResponseViewProps> = ({
  nodeId,
  text,
  isStreaming = false,
  isComplete = true,
}) => {
  const theme = useTheme();
  const [displayText, setDisplayText] = useState('');
  const cursorAnim = useRef(new Animated.Value(0)).current;

  // Cursor blink animation
  useEffect(() => {
    if (isStreaming && !isComplete) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(cursorAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(cursorAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [isStreaming, isComplete, cursorAnim]);

  // Update display text
  useEffect(() => {
    setDisplayText(text);
  }, [text]);

  return (
    <View
      style={[
        styles.gptResponseContainer,
        {
          backgroundColor: theme.colors.botBubble,
          borderRadius: theme.borderRadius.lg,
          borderTopLeftRadius: theme.borderRadius.sm,
        },
        theme.shadows.sm,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`AI response: ${displayText}`}
    >
      <Text
        style={[
          styles.gptResponseText,
          {
            color: theme.colors.botBubbleText,
            fontSize: theme.typography.fontSize.md,
            lineHeight: theme.typography.lineHeight.relaxed,
          },
        ]}
      >
        {displayText}
        {isStreaming && !isComplete && (
          <Animated.Text
            style={[
              styles.cursor,
              {
                color: theme.colors.primary,
                opacity: cursorAnim,
              },
            ]}
          >
            |
          </Animated.Text>
        )}
      </Text>
      {isStreaming && !isComplete && (
        <View style={styles.streamingIndicator}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text
            style={[
              styles.streamingText,
              {
                color: theme.colors.textSecondary,
                fontSize: theme.typography.fontSize.xs,
              },
            ]}
          >
            AI is thinking...
          </Text>
        </View>
      )}
    </View>
  );
};

// ========================================
// LOADING INDICATOR
// ========================================

interface LoadingIndicatorProps extends NodeUIState.Loading {}

/**
 * LoadingIndicator component
 *
 * Displays a loading spinner with optional message.
 */
export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  nodeId,
  message = 'Loading...',
}) => {
  const theme = useTheme();
  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(dotAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [dotAnim]);

  return (
    <View
      style={[
        styles.loadingContainer,
        {
          backgroundColor: theme.colors.botBubble,
          borderRadius: theme.borderRadius.lg,
          borderTopLeftRadius: theme.borderRadius.sm,
        },
        theme.shadows.sm,
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
    >
      <View style={styles.loadingContent}>
        <View style={styles.loadingDots}>
          {[0, 1, 2].map((index) => (
            <Animated.View
              key={index}
              style={[
                styles.loadingDot,
                {
                  backgroundColor: theme.colors.typing,
                  transform: [
                    {
                      scale: dotAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: index === 1 ? [1, 1.3] : [1, 1],
                      }),
                    },
                  ],
                  opacity: dotAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange:
                      index === 0
                        ? [0.4, 1, 0.4]
                        : index === 1
                        ? [0.6, 1, 0.6]
                        : [0.8, 1, 0.8],
                  }),
                },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

// ========================================
// QUIZ QUESTION
// ========================================

interface QuizQuestionProps extends NodeUIState.Quiz {
  onSubmit: (response: any, portName?: string) => void;
}

/**
 * QuizQuestion component
 *
 * Displays a quiz question with multiple choice options.
 * Shows feedback on answer selection.
 */
export const QuizQuestion: React.FC<QuizQuestionProps> = ({
  nodeId,
  question,
  options,
  variableName,
  showCorrectAnswer = true,
  feedback,
  onSubmit,
}) => {
  const theme = useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;

  const handleOptionSelect = useCallback(
    (optionId: string) => {
      if (hasAnswered) return;

      setSelectedId(optionId);
    },
    [hasAnswered]
  );

  const handleSubmit = useCallback(() => {
    if (!selectedId || hasAnswered) return;

    const selectedOption = options.find((opt) => opt.id === selectedId);
    const correct = selectedOption?.isCorrect ?? false;

    setIsCorrect(correct);
    setHasAnswered(true);

    // Animate feedback
    if (correct) {
      Animated.spring(bounceAnim, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }

    // Submit after animation
    setTimeout(() => {
      onSubmit({
        selectedId,
        isCorrect: correct,
        selectedLabel: selectedOption?.label,
        variableName,
      });
    }, 1500);
  }, [selectedId, hasAnswered, options, variableName, bounceAnim, shakeAnim, onSubmit]);

  const getOptionStyle = (option: QuizQuestionProps['options'][0]) => {
    const isSelected = selectedId === option.id;

    if (!hasAnswered) {
      return {
        backgroundColor: isSelected
          ? theme.colors.primaryLight
          : theme.colors.surface,
        borderColor: isSelected ? theme.colors.primary : theme.colors.border,
      };
    }

    // After answering
    if (option.isCorrect) {
      return {
        backgroundColor: `${theme.colors.success}20`,
        borderColor: theme.colors.success,
      };
    }

    if (isSelected && !option.isCorrect) {
      return {
        backgroundColor: `${theme.colors.error}20`,
        borderColor: theme.colors.error,
      };
    }

    return {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      opacity: 0.5,
    };
  };

  const getOptionIcon = (option: QuizQuestionProps['options'][0]): string | null => {
    if (!hasAnswered) return null;

    if (option.isCorrect) return '\u2713';
    if (selectedId === option.id && !option.isCorrect) return '\u2717';
    return null;
  };

  return (
    <Animated.View
      style={[
        styles.quizContainer,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          transform: [{ translateX: shakeAnim }],
        },
        theme.shadows.sm,
      ]}
      accessibilityRole="radiogroup"
      accessibilityLabel={question}
    >
      <View style={styles.quizHeader}>
        <Text style={styles.quizIcon}>{'\u2753'}</Text>
        <Text
          style={[
            styles.quizLabel,
            {
              color: theme.colors.textSecondary,
              fontSize: theme.typography.fontSize.sm,
            },
          ]}
        >
          Quiz Question
        </Text>
      </View>

      <Text
        style={[
          styles.quizQuestion,
          {
            color: theme.colors.text,
            fontSize: theme.typography.fontSize.lg,
          },
        ]}
      >
        {question}
      </Text>

      <View style={styles.quizOptions}>
        {options.map((option, index) => {
          const icon = getOptionIcon(option);
          const optionStyle = getOptionStyle(option);

          return (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.quizOption,
                optionStyle,
                { borderRadius: theme.borderRadius.md },
              ]}
              onPress={() => handleOptionSelect(option.id)}
              disabled={hasAnswered}
              accessibilityRole="radio"
              accessibilityState={{ checked: selectedId === option.id }}
              accessibilityLabel={option.label}
            >
              <View
                style={[
                  styles.optionLetter,
                  {
                    backgroundColor:
                      selectedId === option.id
                        ? theme.colors.primary
                        : theme.colors.background,
                    borderRadius: theme.borderRadius.full,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.optionLetterText,
                    {
                      color:
                        selectedId === option.id
                          ? theme.colors.textInverse
                          : theme.colors.text,
                    },
                  ]}
                >
                  {String.fromCharCode(65 + index)}
                </Text>
              </View>
              <Text
                style={[
                  styles.optionText,
                  {
                    color: theme.colors.text,
                    fontSize: theme.typography.fontSize.md,
                  },
                ]}
              >
                {option.label}
              </Text>
              {icon && (
                <Text
                  style={[
                    styles.optionIcon,
                    {
                      color: option.isCorrect
                        ? theme.colors.success
                        : theme.colors.error,
                    },
                  ]}
                >
                  {icon}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {hasAnswered && feedback && (
        <Animated.View
          style={[
            styles.feedbackContainer,
            {
              backgroundColor: isCorrect
                ? `${theme.colors.success}15`
                : `${theme.colors.error}15`,
              borderRadius: theme.borderRadius.md,
              transform: [
                {
                  scale: bounceAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Text
            style={[
              styles.feedbackIcon,
              {
                color: isCorrect ? theme.colors.success : theme.colors.error,
              },
            ]}
          >
            {isCorrect ? '\uD83C\uDF89' : '\uD83D\uDCA1'}
          </Text>
          <Text
            style={[
              styles.feedbackText,
              {
                color: theme.colors.text,
                fontSize: theme.typography.fontSize.sm,
              },
            ]}
          >
            {isCorrect ? feedback.correct : feedback.incorrect}
          </Text>
        </Animated.View>
      )}

      {!hasAnswered && (
        <TouchableOpacity
          style={[
            styles.submitButton,
            {
              backgroundColor:
                selectedId === null ? theme.colors.border : theme.colors.primary,
              borderRadius: theme.borderRadius.md,
            },
          ]}
          onPress={handleSubmit}
          disabled={selectedId === null}
          accessibilityRole="button"
          accessibilityLabel="Submit answer"
        >
          <Text
            style={[
              styles.submitButtonText,
              {
                color:
                  selectedId === null
                    ? theme.colors.textDisabled
                    : theme.colors.textInverse,
                fontSize: theme.typography.fontSize.md,
              },
            ]}
          >
            Submit Answer
          </Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  // Common styles
  submitButton: {
    width: '100%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  submitButtonText: {
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },

  // Human Handover styles
  handoverContainer: {
    width: '100%',
  },
  endedContainer: {
    marginVertical: 8,
    marginHorizontal: 12,
    padding: 24,
    alignItems: 'center',
    maxWidth: MAX_WIDTH,
  },
  endedIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  endedMessage: {
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  continueButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderWidth: 1,
  },
  continueButtonText: {
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },

  // GPT Response styles
  gptResponseContainer: {
    marginVertical: 4,
    marginHorizontal: 12,
    padding: 16,
    maxWidth: MAX_BUBBLE_WIDTH,
  },
  gptResponseText: {
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  cursor: {
    fontWeight: 'bold',
    marginLeft: 2,
  },
  streamingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  streamingText: {
    marginLeft: 8,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },

  // Loading styles
  loadingContainer: {
    marginVertical: 4,
    marginHorizontal: 12,
    padding: 16,
    maxWidth: 100,
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingDots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 4,
  },

  // Quiz styles
  quizContainer: {
    marginVertical: 8,
    marginHorizontal: 12,
    padding: 16,
    maxWidth: MAX_WIDTH,
  },
  quizHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  quizIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  quizLabel: {
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  quizQuestion: {
    fontWeight: '600',
    marginBottom: 20,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  quizOptions: {
    width: '100%',
  },
  quizOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1.5,
  },
  optionLetter: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionLetterText: {
    fontWeight: '600',
    fontSize: 14,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  optionText: {
    flex: 1,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  optionIcon: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  feedbackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginTop: 16,
  },
  feedbackIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  feedbackText: {
    flex: 1,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
});

export default {
  HumanHandoverView,
  GPTResponseView,
  LoadingIndicator,
  QuizQuestion,
};
