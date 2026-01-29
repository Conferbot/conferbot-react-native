/**
 * ArticleRating Component
 *
 * Thumbs up/down rating component with feedback animation
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { useTheme } from '../../theme';
import type { ConferBotTheme } from '../../theme/types';

export interface ArticleRatingProps {
  articleId: string;
  onRate: (articleId: string, helpful: boolean) => Promise<boolean>;
  hasRated?: boolean;
  question?: string;
  thankYouMessage?: string;
  testID?: string;
}

/**
 * Was this article helpful? Yes/No rating component
 */
export const ArticleRating: React.FC<ArticleRatingProps> = ({
  articleId,
  onRate,
  hasRated = false,
  question = 'Was this article helpful?',
  thankYouMessage = 'Thank you for your feedback!',
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  const [isRated, setIsRated] = useState(hasRated);
  const [selectedRating, setSelectedRating] = useState<'yes' | 'no' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const thankYouFadeAnim = useRef(new Animated.Value(0)).current;
  const yesScaleAnim = useRef(new Animated.Value(1)).current;
  const noScaleAnim = useRef(new Animated.Value(1)).current;

  // Handle rating submission
  const handleRate = useCallback(
    async (helpful: boolean) => {
      if (isRated || isSubmitting) return;

      setIsSubmitting(true);
      setSelectedRating(helpful ? 'yes' : 'no');

      // Animate button selection
      const scaleAnim = helpful ? yesScaleAnim : noScaleAnim;
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1.1,
          tension: 100,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 5,
          useNativeDriver: true,
        }),
      ]).start();

      try {
        const success = await onRate(articleId, helpful);

        if (success) {
          setIsRated(true);

          // Fade out question, fade in thank you
          Animated.sequence([
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(thankYouFadeAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start();
        }
      } catch (error) {
        console.error('Failed to submit rating:', error);
        setSelectedRating(null);
      } finally {
        setIsSubmitting(false);
      }
    },
    [articleId, onRate, isRated, isSubmitting, fadeAnim, thankYouFadeAnim, yesScaleAnim, noScaleAnim]
  );

  return (
    <View style={styles.container} testID={testID}>
      {/* Question and Buttons */}
      {!isRated && (
        <Animated.View style={[styles.questionContainer, { opacity: fadeAnim }]}>
          <Text style={styles.question}>{question}</Text>

          <View style={styles.buttonContainer}>
            {/* Yes Button */}
            <Animated.View style={{ transform: [{ scale: yesScaleAnim }] }}>
              <TouchableOpacity
                style={[
                  styles.ratingButton,
                  styles.yesButton,
                  selectedRating === 'yes' && styles.selectedButton,
                  selectedRating === 'no' && styles.unselectedButton,
                ]}
                onPress={() => handleRate(true)}
                disabled={isSubmitting || isRated}
                accessible={true}
                accessibilityLabel="Yes, helpful"
                accessibilityRole="button"
                testID={`${testID}-yes`}
              >
                <ThumbsUpIcon
                  color={
                    selectedRating === 'yes'
                      ? theme.colors.textInverse
                      : theme.colors.success
                  }
                />
                <Text
                  style={[
                    styles.buttonText,
                    styles.yesText,
                    selectedRating === 'yes' && styles.selectedText,
                    selectedRating === 'no' && styles.unselectedText,
                  ]}
                >
                  Yes
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* No Button */}
            <Animated.View style={{ transform: [{ scale: noScaleAnim }] }}>
              <TouchableOpacity
                style={[
                  styles.ratingButton,
                  styles.noButton,
                  selectedRating === 'no' && styles.selectedButtonNo,
                  selectedRating === 'yes' && styles.unselectedButton,
                ]}
                onPress={() => handleRate(false)}
                disabled={isSubmitting || isRated}
                accessible={true}
                accessibilityLabel="No, not helpful"
                accessibilityRole="button"
                testID={`${testID}-no`}
              >
                <ThumbsDownIcon
                  color={
                    selectedRating === 'no'
                      ? theme.colors.textInverse
                      : theme.colors.error
                  }
                />
                <Text
                  style={[
                    styles.buttonText,
                    styles.noText,
                    selectedRating === 'no' && styles.selectedText,
                    selectedRating === 'yes' && styles.unselectedText,
                  ]}
                >
                  No
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Animated.View>
      )}

      {/* Thank You Message */}
      {isRated && (
        <Animated.View
          style={[
            styles.thankYouContainer,
            { opacity: thankYouFadeAnim },
          ]}
        >
          <CheckCircleIcon color={theme.colors.success} />
          <Text style={styles.thankYouText}>{thankYouMessage}</Text>
        </Animated.View>
      )}
    </View>
  );
};

// Thumbs Up Icon
const ThumbsUpIcon: React.FC<{ color: string }> = ({ color }) => (
  <View style={{ width: 20, height: 20 }}>
    {/* Thumb */}
    <View
      style={{
        width: 10,
        height: 14,
        backgroundColor: color,
        borderRadius: 3,
        position: 'absolute',
        top: 0,
        left: 8,
        transform: [{ rotate: '-10deg' }],
      }}
    />
    {/* Fist */}
    <View
      style={{
        width: 14,
        height: 8,
        backgroundColor: color,
        borderRadius: 2,
        position: 'absolute',
        bottom: 0,
        left: 0,
      }}
    />
  </View>
);

// Thumbs Down Icon
const ThumbsDownIcon: React.FC<{ color: string }> = ({ color }) => (
  <View style={{ width: 20, height: 20 }}>
    {/* Thumb */}
    <View
      style={{
        width: 10,
        height: 14,
        backgroundColor: color,
        borderRadius: 3,
        position: 'absolute',
        bottom: 0,
        left: 8,
        transform: [{ rotate: '10deg' }],
      }}
    />
    {/* Fist */}
    <View
      style={{
        width: 14,
        height: 8,
        backgroundColor: color,
        borderRadius: 2,
        position: 'absolute',
        top: 0,
        left: 0,
      }}
    />
  </View>
);

// Check Circle Icon
const CheckCircleIcon: React.FC<{ color: string }> = ({ color }) => (
  <View
    style={{
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: color,
      justifyContent: 'center',
      alignItems: 'center',
    }}
  >
    <View
      style={{
        width: 10,
        height: 6,
        borderLeftWidth: 2,
        borderBottomWidth: 2,
        borderColor: color,
        transform: [{ rotate: '-45deg' }, { translateY: -1 }],
      }}
    />
  </View>
);

const createStyles = (theme: ConferBotTheme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginVertical: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderLight,
      alignItems: 'center',
    },
    questionContainer: {
      alignItems: 'center',
    },
    question: {
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
      textAlign: 'center',
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    ratingButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1.5,
      gap: theme.spacing.sm,
    },
    yesButton: {
      backgroundColor: theme.colors.success + '10',
      borderColor: theme.colors.success,
    },
    noButton: {
      backgroundColor: theme.colors.error + '10',
      borderColor: theme.colors.error,
    },
    selectedButton: {
      backgroundColor: theme.colors.success,
      borderColor: theme.colors.success,
    },
    selectedButtonNo: {
      backgroundColor: theme.colors.error,
      borderColor: theme.colors.error,
    },
    unselectedButton: {
      opacity: 0.4,
    },
    buttonText: {
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.medium,
    },
    yesText: {
      color: theme.colors.success,
    },
    noText: {
      color: theme.colors.error,
    },
    selectedText: {
      color: theme.colors.textInverse,
    },
    unselectedText: {
      opacity: 0.6,
    },
    thankYouContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    thankYouText: {
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.success,
    },
  });

export default ArticleRating;
