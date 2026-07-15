// @ts-nocheck
/**
 * PostChatSurvey.tsx
 *
 * Post-chat survey component for collecting feedback after a live chat session ends.
 * Supports multiple rating styles (stars, thumbs, emojis, numbers) and optional feedback text.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';

import { useTheme } from '../../theme';
import type { ConferBotTheme } from '../../theme/types';
import type {
  PostChatSurveyProps,
  SurveyResponse,
  SurveyRatingStyle,
  AgentInfo,
} from './types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ========================================
// RATING COMPONENTS
// ========================================

interface RatingProps {
  maxRating: number;
  value: number;
  onChange: (rating: number) => void;
  theme: ConferBotTheme;
}

// Star Rating
const StarRating: React.FC<RatingProps> = ({ maxRating, value, onChange, theme }) => {
  return (
    <View style={styles.ratingContainer}>
      {Array.from({ length: maxRating }, (_, index) => {
        const rating = index + 1;
        const isFilled = rating <= value;

        return (
          <TouchableOpacity
            key={rating}
            onPress={() => onChange(rating)}
            style={styles.ratingItem}
            accessibilityRole="radio"
            accessibilityState={{ checked: isFilled }}
            accessibilityLabel={`${rating} star${rating > 1 ? 's' : ''}`}
          >
            <Text style={[styles.starIcon, { opacity: isFilled ? 1 : 0.3 }]}>
              {isFilled ? '\u2B50' : '\u2606'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// Thumbs Rating (thumbs up/down)
const ThumbsRating: React.FC<Omit<RatingProps, 'maxRating'>> = ({ value, onChange, theme }) => {
  return (
    <View style={styles.thumbsContainer}>
      <TouchableOpacity
        onPress={() => onChange(1)}
        style={[
          styles.thumbButton,
          {
            backgroundColor: value === 1 ? `${theme.colors.success}20` : theme.colors.surface,
            borderColor: value === 1 ? theme.colors.success : theme.colors.border,
            borderRadius: theme.borderRadius.lg,
          },
        ]}
        accessibilityRole="radio"
        accessibilityState={{ checked: value === 1 }}
        accessibilityLabel="Thumbs up - Good"
      >
        <Text style={[styles.thumbIcon, { opacity: value === 1 ? 1 : 0.5 }]}>
          {'\uD83D\uDC4D'}
        </Text>
        <Text
          style={[
            styles.thumbLabel,
            { color: value === 1 ? theme.colors.success : theme.colors.textSecondary },
          ]}
        >
          Good
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => onChange(0)}
        style={[
          styles.thumbButton,
          {
            backgroundColor: value === 0 ? `${theme.colors.error}20` : theme.colors.surface,
            borderColor: value === 0 ? theme.colors.error : theme.colors.border,
            borderRadius: theme.borderRadius.lg,
          },
        ]}
        accessibilityRole="radio"
        accessibilityState={{ checked: value === 0 }}
        accessibilityLabel="Thumbs down - Bad"
      >
        <Text style={[styles.thumbIcon, { opacity: value === 0 ? 1 : 0.5 }]}>
          {'\uD83D\uDC4E'}
        </Text>
        <Text
          style={[
            styles.thumbLabel,
            { color: value === 0 ? theme.colors.error : theme.colors.textSecondary },
          ]}
        >
          Bad
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// Emoji Rating
const EmojiRating: React.FC<RatingProps> = ({ maxRating, value, onChange, theme }) => {
  const emojis = ['\uD83D\uDE21', '\uD83D\uDE1E', '\uD83D\uDE10', '\uD83D\uDE42', '\uD83D\uDE0D'];
  const labels = ['Very Bad', 'Bad', 'Okay', 'Good', 'Excellent'];
  const displayCount = Math.min(maxRating, 5);

  return (
    <View style={styles.emojiContainer}>
      {emojis.slice(0, displayCount).map((emoji, index) => {
        const rating = index + 1;
        const isSelected = rating === value;

        return (
          <TouchableOpacity
            key={rating}
            onPress={() => onChange(rating)}
            style={[
              styles.emojiButton,
              {
                backgroundColor: isSelected ? `${theme.colors.primary}15` : 'transparent',
                borderColor: isSelected ? theme.colors.primary : 'transparent',
                borderRadius: theme.borderRadius.md,
              },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel={labels[index]}
          >
            <Text style={[styles.emojiIcon, { opacity: isSelected ? 1 : 0.6 }]}>
              {emoji}
            </Text>
            {isSelected && (
              <Text
                style={[
                  styles.emojiLabel,
                  { color: theme.colors.primary, fontSize: theme.typography.fontSize.xs },
                ]}
              >
                {labels[index]}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// Number Rating (1-10 scale)
const NumberRating: React.FC<RatingProps> = ({ maxRating, value, onChange, theme }) => {
  return (
    <View style={styles.numberContainer}>
      <View style={styles.numberRow}>
        {Array.from({ length: maxRating }, (_, index) => {
          const rating = index + 1;
          const isSelected = rating === value;

          return (
            <TouchableOpacity
              key={rating}
              onPress={() => onChange(rating)}
              style={[
                styles.numberButton,
                {
                  backgroundColor: isSelected ? theme.colors.primary : theme.colors.surface,
                  borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                  borderRadius: theme.borderRadius.sm,
                },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={`${rating} out of ${maxRating}`}
            >
              <Text
                style={[
                  styles.numberText,
                  {
                    color: isSelected ? theme.colors.textInverse : theme.colors.text,
                    fontSize: theme.typography.fontSize.sm,
                  },
                ]}
              >
                {rating}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.numberLabels}>
        <Text style={[styles.numberLabel, { color: theme.colors.textSecondary }]}>
          Not satisfied
        </Text>
        <Text style={[styles.numberLabel, { color: theme.colors.textSecondary }]}>
          Very satisfied
        </Text>
      </View>
    </View>
  );
};

// ========================================
// AGENT CARD
// ========================================

interface AgentCardProps {
  agent: AgentInfo;
  theme: ConferBotTheme;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent, theme }) => {
  return (
    <View style={styles.agentCard}>
      {agent.avatar ? (
        <Image
          source={{ uri: agent.avatar }}
          style={[styles.agentAvatar, { borderColor: theme.colors.primary }]}
        />
      ) : (
        <View
          style={[
            styles.agentAvatarPlaceholder,
            { backgroundColor: theme.colors.primary },
          ]}
        >
          <Text style={styles.agentAvatarInitial}>
            {agent.name?.charAt(0).toUpperCase() || 'A'}
          </Text>
        </View>
      )}
      <View style={styles.agentInfo}>
        <Text
          style={[
            styles.agentName,
            { color: theme.colors.text, fontSize: theme.typography.fontSize.md },
          ]}
        >
          {agent.name || 'Agent'}
        </Text>
        {agent.role && (
          <Text
            style={[
              styles.agentRole,
              { color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm },
            ]}
          >
            {agent.role}
          </Text>
        )}
      </View>
    </View>
  );
};

// ========================================
// MAIN COMPONENT
// ========================================

export const PostChatSurvey: React.FC<PostChatSurveyProps> = ({
  config,
  agent,
  agentName,
  onSubmit,
  onSkip,
  isSubmitting = false,
  submitButtonText,
  skipButtonText,
  accessibilityLabel,
  testID,
}) => {
  const theme = useTheme();
  const [rating, setRating] = useState<number | undefined>();
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  // Initial animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  // Rating is only mandatory when the config marks it required
  const ratingEnabled = config.ratingEnabled !== false;
  const ratingMissing = ratingEnabled && config.ratingRequired === true && rating === undefined;

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (isSubmitting || ratingMissing) return;

    const trimmedFeedback = feedback.trim() || undefined;
    const response: SurveyResponse = {
      rating,
      feedback: trimmedFeedback,
      // comment mirrors feedback for consumers using that naming
      comment: trimmedFeedback,
      agentId: agent?.id,
      timestamp: new Date().toISOString(),
    };

    setSubmitted(true);
    onSubmit?.(response);
  }, [rating, ratingMissing, feedback, agent, isSubmitting, onSubmit]);

  // Render rating based on style
  const renderRating = useCallback(() => {
    const style = config.ratingStyle || 'stars';
    const maxRating = config.maxRating || 5;
    const currentValue = rating ?? -1;

    switch (style) {
      case 'thumbs':
        return (
          <ThumbsRating
            value={currentValue}
            onChange={setRating}
            theme={theme}
          />
        );
      case 'emojis':
        return (
          <EmojiRating
            maxRating={maxRating}
            value={currentValue}
            onChange={setRating}
            theme={theme}
          />
        );
      case 'numbers':
        return (
          <NumberRating
            maxRating={maxRating}
            value={currentValue}
            onChange={setRating}
            theme={theme}
          />
        );
      case 'stars':
      default:
        return (
          <StarRating
            maxRating={maxRating}
            value={currentValue}
            onChange={setRating}
            theme={theme}
          />
        );
    }
  }, [config.ratingStyle, config.maxRating, rating, theme]);

  // Show thank you message after submission
  if (submitted) {
    return (
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.surface,
            borderRadius: theme.borderRadius.lg,
            opacity: fadeAnim,
          },
          theme.shadows.md,
        ]}
      >
        <Text style={styles.thankYouIcon}>{'\u2705'}</Text>
        <Text
          style={[
            styles.thankYouText,
            { color: theme.colors.text, fontSize: theme.typography.fontSize.lg },
          ]}
        >
          {config.thankYouMessage || 'Thank you for your feedback!'}
        </Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
        theme.shadows.md,
      ]}
      accessibilityRole="form"
      accessibilityLabel={accessibilityLabel || 'Post-chat survey'}
      testID={testID}
    >
      {/* Title */}
      <Text
        style={[
          styles.title,
          { color: theme.colors.text, fontSize: theme.typography.fontSize.xl },
        ]}
      >
        {config.title || 'How was your experience?'}
      </Text>

      {/* Agent Card */}
      {agent && <AgentCard agent={agent} theme={theme} />}
      {!agent && agentName && (
        <Text
          style={[
            styles.question,
            { color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm },
          ]}
        >
          You chatted with {agentName}
        </Text>
      )}

      {/* Rating Question + Component */}
      {ratingEnabled && (
        <>
          <Text
            style={[
              styles.question,
              { color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm },
            ]}
          >
            {config.ratingQuestion || 'Please rate your conversation'}
          </Text>
          {renderRating()}
        </>
      )}

      {/* Feedback Text */}
      {(config.commentEnabled === true || config.feedbackQuestion !== undefined) && (
        <View style={styles.feedbackContainer}>
          <Text
            style={[
              styles.feedbackLabel,
              { color: theme.colors.text, fontSize: theme.typography.fontSize.sm },
            ]}
          >
            {config.feedbackQuestion || 'Any additional feedback? (optional)'}
          </Text>
          <TextInput
            style={[
              styles.feedbackInput,
              {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
                borderRadius: theme.borderRadius.md,
                color: theme.colors.text,
                fontSize: theme.typography.fontSize.md,
              },
            ]}
            value={feedback}
            onChangeText={setFeedback}
            placeholder={
              config.commentPlaceholder ||
              config.feedbackPlaceholder ||
              'Tell us more about your experience...'
            }
            placeholderTextColor={theme.colors.textDisabled}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            accessibilityLabel="Feedback text input"
          />
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            {
              backgroundColor: !ratingMissing ? theme.colors.primary : theme.colors.border,
              borderRadius: theme.borderRadius.md,
              opacity: isSubmitting ? 0.7 : 1,
            },
          ]}
          onPress={handleSubmit}
          disabled={ratingMissing || isSubmitting}
          accessibilityRole="button"
          accessibilityLabel={submitButtonText || config.submitButtonText || 'Submit survey'}
          accessibilityState={{ disabled: ratingMissing || isSubmitting }}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={theme.colors.textInverse} />
          ) : (
            <Text
              style={[
                styles.submitButtonText,
                {
                  color: !ratingMissing ? theme.colors.textInverse : theme.colors.textDisabled,
                  fontSize: theme.typography.fontSize.md,
                },
              ]}
            >
              {submitButtonText || config.submitButtonText || 'Submit'}
            </Text>
          )}
        </TouchableOpacity>

        {onSkip && config.skipEnabled !== false && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={onSkip}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel={skipButtonText || config.skipButtonText || 'Skip survey'}
          >
            <Text
              style={[
                styles.skipButtonText,
                { color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm },
              ]}
            >
              {skipButtonText || config.skipButtonText || 'Skip'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    marginHorizontal: 12,
    padding: 24,
    maxWidth: SCREEN_WIDTH - 24,
  },
  title: {
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  agentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 12,
    marginBottom: 20,
  },
  agentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
  },
  agentAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentAvatarInitial: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
  },
  agentInfo: {
    marginLeft: 12,
    flex: 1,
  },
  agentName: {
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  agentRole: {
    marginTop: 2,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  question: {
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  ratingItem: {
    padding: 8,
  },
  starIcon: {
    fontSize: 32,
  },
  thumbsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
  },
  thumbButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderWidth: 2,
    alignItems: 'center',
  },
  thumbIcon: {
    fontSize: 36,
    marginBottom: 4,
  },
  thumbLabel: {
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  emojiContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    marginBottom: 24,
  },
  emojiButton: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 2,
    alignItems: 'center',
    minWidth: 56,
  },
  emojiIcon: {
    fontSize: 28,
  },
  emojiLabel: {
    marginTop: 4,
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  numberContainer: {
    marginBottom: 24,
  },
  numberRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  numberButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 4,
  },
  numberText: {
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  numberLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: 8,
  },
  numberLabel: {
    fontSize: 12,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  feedbackContainer: {
    marginBottom: 20,
  },
  feedbackLabel: {
    marginBottom: 8,
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  feedbackInput: {
    minHeight: 80,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  actions: {
    gap: 12,
  },
  submitButton: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  skipButton: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  thankYouIcon: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 16,
  },
  thankYouText: {
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
});

export default PostChatSurvey;
