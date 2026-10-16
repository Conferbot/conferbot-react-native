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
import { t } from '../../core/i18n';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ========================================
// ERROR ICONS
// ========================================

const errorIcons: Record<HandoverErrorProps['errorType'], string> = {
  no_agents: '\uD83D\uDE14', // Pensive face
  timeout: '\u23F0',        // Alarm clock
  error: '\u26A0\uFE0F',    // Warning
};

const defaultMessages = (): Record<HandoverErrorProps['errorType'], string> => ({
  no_agents: t('sdk.handover.noAgentsMessage'),
  timeout: t('sdk.handover.timeoutMessage'),
  error: t('sdk.handover.errorMessage'),
});

// ========================================
// MAIN COMPONENT
// ========================================

export const HandoverError: React.FC<HandoverErrorProps> = ({
  errorType,
  message,
  errorMessage,
  noAgentsMessage,
  timeoutMessage,
  onRetry,
  onContinue,
  onCancel,
  retryButtonText = t('sdk.handover.tryAgain'),
  cancelButtonText = t('sdk.handover.goBack'),
  accessibilityLabel,
  testID,
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

  // Tolerate an undefined errorType (falls back to the generic error state)
  const resolvedType: HandoverErrorProps['errorType'] = errorType || 'error';
  const icon = errorIcons[resolvedType];

  // Per-type message props win over the generic message prop
  const typeMessage =
    resolvedType === 'no_agents'
      ? noAgentsMessage
      : resolvedType === 'timeout'
        ? timeoutMessage
        : errorMessage;
  const displayMessage = typeMessage || message || defaultMessages()[resolvedType];

  // Determine colors based on error type
  const iconBackgroundColor = resolvedType === 'no_agents'
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
      accessibilityLabel={accessibilityLabel || `${t('sdk.common.error')}: ${displayMessage}`}
      testID={testID}
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
        {resolvedType === 'no_agents' && t('sdk.handover.noAgentsTitle')}
        {resolvedType === 'timeout' && t('sdk.handover.timeoutTitle')}
        {resolvedType === 'error' && t('sdk.status.error')}
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
            accessibilityLabel={t('common.tryAgain')}
          >
            <Text
              style={[
                styles.retryButtonText,
                { color: theme.colors.textInverse, fontSize: theme.typography.fontSize.md },
              ]}
            >
              {retryButtonText}
            </Text>
          </TouchableOpacity>
        )}

        {onCancel && (
          <TouchableOpacity
            style={[
              styles.continueButton,
              {
                borderColor: theme.colors.border,
                borderRadius: theme.borderRadius.md,
              },
            ]}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel={t('sdk.handover.cancelGoBack')}
          >
            <Text
              style={[
                styles.continueButtonText,
                { color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm },
              ]}
            >
              {cancelButtonText}
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
            accessibilityLabel={t('sdk.handover.continueBot')}
          >
            <Text
              style={[
                styles.continueButtonText,
                { color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm },
              ]}
            >
              {t('sdk.handover.continueBot')}
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
