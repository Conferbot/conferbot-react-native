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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_WIDTH = SCREEN_WIDTH - 24;
const MAX_BUBBLE_WIDTH = SCREEN_WIDTH * 0.75;

// ========================================
// HUMAN HANDOVER VIEW
// ========================================

interface HumanHandoverViewProps extends NodeUIState.HumanHandover {
  onSubmit: (response: any, portName?: string) => void;
}

/**
 * HumanHandoverView component
 *
 * Displays the human handover status and interface.
 * Supports pre-chat forms, waiting, connected, ended, and error states.
 */
export const HumanHandoverView: React.FC<HumanHandoverViewProps> = ({
  nodeId,
  stage,
  agentName,
  agentAvatar,
  waitMessage = 'Please wait while we connect you with an agent...',
  connectedMessage = 'You are now connected with',
  endedMessage = 'The conversation has ended. Thank you for chatting with us!',
  noAgentsMessage = 'Sorry, no agents are available at the moment. Please try again later.',
  timeoutMessage = 'We apologize, but we were unable to connect you with an agent. Please try again later.',
  showPreChatForm = false,
  preChatFields,
  onSubmit,
}) => {
  const theme = useTheme();
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for waiting state
  useEffect(() => {
    if (stage === 'waiting') {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [stage, pulseAnim]);

  const handleFormValueChange = useCallback((fieldId: string, value: any) => {
    setFormValues(prev => ({ ...prev, [fieldId]: value }));
    if (formErrors[fieldId]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  }, [formErrors]);

  const validateForm = useCallback((): boolean => {
    if (!preChatFields) return true;

    const newErrors: Record<string, string> = {};

    preChatFields.forEach(field => {
      const value = formValues[field.id];

      if (field.required && (!value || (typeof value === 'string' && !value.trim()))) {
        newErrors[field.id] = 'This field is required';
        return;
      }

      if (value && field.type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          newErrors[field.id] = 'Please enter a valid email';
        }
      }

      if (value && field.type === 'phone') {
        const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;
        if (!phoneRegex.test(value)) {
          newErrors[field.id] = 'Please enter a valid phone number';
        }
      }
    });

    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [preChatFields, formValues]);

  const handlePreChatSubmit = useCallback(() => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    onSubmit({
      action: 'preChatSubmit',
      formData: formValues,
    });
  }, [validateForm, formValues, onSubmit]);

  const handleEndChat = useCallback(() => {
    onSubmit({
      action: 'endChat',
    });
  }, [onSubmit]);

  const handleRetry = useCallback(() => {
    onSubmit({
      action: 'retry',
    });
  }, [onSubmit]);

  const renderPreChatForm = () => {
    if (!showPreChatForm || !preChatFields) return null;

    return (
      <View style={styles.preChatForm}>
        <Text
          style={[
            styles.preChatTitle,
            {
              color: theme.colors.text,
              fontSize: theme.typography.fontSize.lg,
            },
          ]}
        >
          Before we connect you
        </Text>
        <Text
          style={[
            styles.preChatSubtitle,
            {
              color: theme.colors.textSecondary,
              fontSize: theme.typography.fontSize.sm,
            },
          ]}
        >
          Please provide the following information
        </Text>

        {preChatFields.map(field => (
          <View key={field.id} style={styles.formField}>
            <Text
              style={[
                styles.fieldLabel,
                { color: theme.colors.text },
              ]}
            >
              {field.label}
              {field.required && (
                <Text style={{ color: theme.colors.error }}> *</Text>
              )}
            </Text>

            {field.type === 'select' && field.options ? (
              <View style={styles.selectOptions}>
                {field.options.map(option => {
                  const isSelected = formValues[field.id] === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.selectOption,
                        {
                          backgroundColor: isSelected
                            ? theme.colors.primary
                            : theme.colors.surface,
                          borderColor: isSelected
                            ? theme.colors.primary
                            : theme.colors.border,
                          borderRadius: theme.borderRadius.sm,
                        },
                      ]}
                      onPress={() => handleFormValueChange(field.id, option.value)}
                    >
                      <Text
                        style={{
                          color: isSelected
                            ? theme.colors.textInverse
                            : theme.colors.text,
                        }}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <TextInput
                style={[
                  styles.fieldInput,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: formErrors[field.id]
                      ? theme.colors.error
                      : theme.colors.border,
                    borderRadius: theme.borderRadius.md,
                    color: theme.colors.text,
                  },
                ]}
                value={formValues[field.id] || ''}
                onChangeText={(text) => handleFormValueChange(field.id, text)}
                placeholder={`Enter ${field.label.toLowerCase()}`}
                placeholderTextColor={theme.colors.textDisabled}
                keyboardType={
                  field.type === 'email' ? 'email-address' :
                  field.type === 'phone' ? 'phone-pad' :
                  'default'
                }
                autoCapitalize={field.type === 'email' ? 'none' : 'sentences'}
              />
            )}

            {formErrors[field.id] && (
              <Text
                style={[
                  styles.fieldError,
                  { color: theme.colors.error },
                ]}
              >
                {formErrors[field.id]}
              </Text>
            )}
          </View>
        ))}

        <TouchableOpacity
          style={[
            styles.submitButton,
            {
              backgroundColor: theme.colors.primary,
              borderRadius: theme.borderRadius.md,
            },
          ]}
          onPress={handlePreChatSubmit}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Start chat"
        >
          <Text
            style={[
              styles.submitButtonText,
              {
                color: theme.colors.textInverse,
                fontSize: theme.typography.fontSize.md,
              },
            ]}
          >
            {isSubmitting ? 'Starting...' : 'Start Chat'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderWaitingState = () => (
    <View style={styles.waitingContainer}>
      <Animated.View
        style={[
          styles.waitingIconContainer,
          {
            backgroundColor: theme.colors.primaryLight,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <Text style={styles.waitingIcon}>{'\uD83D\uDE4B'}</Text>
      </Animated.View>
      <Text
        style={[
          styles.waitingTitle,
          {
            color: theme.colors.text,
            fontSize: theme.typography.fontSize.lg,
          },
        ]}
      >
        Connecting you with an agent
      </Text>
      <Text
        style={[
          styles.waitingMessage,
          {
            color: theme.colors.textSecondary,
            fontSize: theme.typography.fontSize.sm,
          },
        ]}
      >
        {waitMessage}
      </Text>
      <ActivityIndicator
        size="small"
        color={theme.colors.primary}
        style={styles.waitingIndicator}
      />
    </View>
  );

  const renderConnectedState = () => (
    <View style={styles.connectedContainer}>
      {agentAvatar ? (
        <Image
          source={{ uri: agentAvatar }}
          style={[
            styles.agentAvatar,
            { borderColor: theme.colors.success },
          ]}
        />
      ) : (
        <View
          style={[
            styles.agentAvatarPlaceholder,
            {
              backgroundColor: theme.colors.success,
            },
          ]}
        >
          <Text style={styles.agentAvatarText}>
            {agentName ? agentName.charAt(0).toUpperCase() : 'A'}
          </Text>
        </View>
      )}
      <View style={styles.connectedInfo}>
        <View style={styles.connectedHeader}>
          <View
            style={[
              styles.onlineIndicator,
              { backgroundColor: theme.colors.success },
            ]}
          />
          <Text
            style={[
              styles.connectedText,
              { color: theme.colors.success },
            ]}
          >
            Connected
          </Text>
        </View>
        <Text
          style={[
            styles.agentName,
            {
              color: theme.colors.text,
              fontSize: theme.typography.fontSize.lg,
            },
          ]}
        >
          {connectedMessage} {agentName || 'an agent'}
        </Text>
      </View>
    </View>
  );

  const renderEndedState = () => (
    <View style={styles.endedContainer}>
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
    </View>
  );

  const renderNoAgentsState = () => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorIcon}>{'\uD83D\uDE14'}</Text>
      <Text
        style={[
          styles.errorMessage,
          {
            color: theme.colors.text,
            fontSize: theme.typography.fontSize.md,
          },
        ]}
      >
        {noAgentsMessage}
      </Text>
      <TouchableOpacity
        style={[
          styles.retryButton,
          {
            backgroundColor: theme.colors.primary,
            borderRadius: theme.borderRadius.md,
          },
        ]}
        onPress={handleRetry}
        accessibilityRole="button"
        accessibilityLabel="Try again"
      >
        <Text
          style={[
            styles.retryButtonText,
            { color: theme.colors.textInverse },
          ]}
        >
          Try Again
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderTimeoutState = () => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorIcon}>{'\u23F0'}</Text>
      <Text
        style={[
          styles.errorMessage,
          {
            color: theme.colors.text,
            fontSize: theme.typography.fontSize.md,
          },
        ]}
      >
        {timeoutMessage}
      </Text>
      <TouchableOpacity
        style={[
          styles.retryButton,
          {
            backgroundColor: theme.colors.primary,
            borderRadius: theme.borderRadius.md,
          },
        ]}
        onPress={handleRetry}
        accessibilityRole="button"
        accessibilityLabel="Try again"
      >
        <Text
          style={[
            styles.retryButtonText,
            { color: theme.colors.textInverse },
          ]}
        >
          Try Again
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    if (showPreChatForm && stage === 'waiting') {
      return renderPreChatForm();
    }

    switch (stage) {
      case 'waiting':
        return renderWaitingState();
      case 'connected':
        return renderConnectedState();
      case 'ended':
        return renderEndedState();
      case 'noAgents':
        return renderNoAgentsState();
      case 'timeout':
        return renderTimeoutState();
      default:
        return null;
    }
  };

  return (
    <View
      style={[
        styles.handoverContainer,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
        },
        theme.shadows.sm,
      ]}
      accessibilityRole="alert"
      accessibilityLabel={`Human handover: ${stage}`}
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
    marginVertical: 8,
    marginHorizontal: 12,
    padding: 20,
    maxWidth: MAX_WIDTH,
  },
  preChatForm: {
    width: '100%',
  },
  preChatTitle: {
    fontWeight: '600',
    marginBottom: 4,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  preChatSubtitle: {
    marginBottom: 20,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  formField: {
    marginBottom: 16,
  },
  fieldLabel: {
    marginBottom: 8,
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  fieldInput: {
    height: 48,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  fieldError: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  selectOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  selectOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  waitingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  waitingIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  waitingIcon: {
    fontSize: 40,
  },
  waitingTitle: {
    fontWeight: '600',
    marginBottom: 8,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  waitingMessage: {
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  waitingIndicator: {
    marginTop: 8,
  },
  connectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  agentAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
  },
  agentAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentAvatarText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  connectedInfo: {
    flex: 1,
    marginLeft: 16,
  },
  connectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  connectedText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  agentName: {
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  endedContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  endedIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  endedMessage: {
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorMessage: {
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  retryButtonText: {
    fontWeight: '600',
    fontSize: 16,
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
