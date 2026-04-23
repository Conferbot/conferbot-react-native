// @ts-nocheck
/**
 * HandoverError.tsx
 *
 * Error state component for handover failures (no agents, timeout, error).
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';

import { useTheme } from '../../theme';
import type { HandoverErrorProps } from './types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ========================================
// ERROR ICONS
// ========================================

const errorIcons: Record<HandoverErrorProps['errorType'], string> = {
  no_agents: '\uD83D\uDE14', // Pensive face
  timeout: '\u23F0',        // Alarm clock
  error: '\u26A0\uFE0F',    // Warning
};

const defaultMessages: Record<HandoverErrorProps['errorType'], string> = {
  no_agents: 'Sorry, no agents are available at the moment. Please try again later or leave a message.',
  timeout: 'We apologize, but we were unable to connect you with an agent. The wait time has exceeded our limit.',
  error: 'Something went wrong while connecting you to an agent. Please try again.',
};

// ========================================
// MAIN COMPONENT
// ========================================

export const HandoverError: React.FC<HandoverErrorProps> = ({
  errorType,
  message,
  onRetry,
  onContinue,
}) => {
  const theme = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Shake animation for icon
    Animated.sequence([
      Animated.delay(200),
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, shakeAnim]);

  const icon = errorIcons[errorType];
  const displayMessage = message || defaultMessages[errorType];

  // Determine colors based on error type
  const iconBackgroundColor = errorType === 'no_agents'
    ? `${theme.colors.warning}20`
    : `${theme.colors.error}20`;

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
      accessibilityRole="alert"
      accessibilityLabel={`Error: ${displayMessage}`}
    >
      {/* Icon */}
      <Animated.View
        style={[
          styles.iconContainer,
          {
            backgroundColor: iconBackgroundColor,
            transform: [{ translateX: shakeAnim }],
          },
        ]}
      >
        <Text style={styles.icon}>{icon}</Text>
      </Animated.View>

      {/* Title */}
      <Text
        style={[
          styles.title,
          { color: theme.colors.text, fontSize: theme.typography.fontSize.lg },
        ]}
      >
        {errorType === 'no_agents' && 'No Agents Available'}
        {errorType === 'timeout' && 'Connection Timeout'}
        {errorType === 'error' && 'Connection Error'}
      </Text>

      {/* Message */}
      <Text
        style={[
          styles.message,
          { color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm },
        ]}
      >
        {displayMessage}
      </Text>

      {/* Actions */}
      <View style={styles.actions}>
        {onRetry && (
          <TouchableOpacity
            style={[
              styles.retryButton,
              {
                backgroundColor: theme.colors.primary,
                borderRadius: theme.borderRadius.md,
              },
            ]}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text
              style={[
                styles.retryButtonText,
                { color: theme.colors.textInverse, fontSize: theme.typography.fontSize.md },
              ]}
            >
              Try Again
            </Text>
          </TouchableOpacity>
        )}

        {onContinue && (
          <TouchableOpacity
            style={[
              styles.continueButton,
              {
                borderColor: theme.colors.border,
                borderRadius: theme.borderRadius.md,
              },
            ]}
            onPress={onContinue}
            accessibilityRole="button"
            accessibilityLabel="Continue with bot"
          >
            <Text
              style={[
                styles.continueButtonText,
                { color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm },
              ]}
            >
              Continue with Bot
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
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  message: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  retryButton: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  continueButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  continueButtonText: {
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
});

export default HandoverError;
