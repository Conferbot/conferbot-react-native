import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { useConferBot } from '../../context/ConferBotContext';
import type { ConferBotTheme } from '../../theme/types';

export type ConnectionStatusValue =
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'reconnecting'
  | 'error';

export interface ConnectionStatusProps {
  /**
   * Explicit status. When provided (or when no ConferBotProvider is present)
   * the component renders standalone; otherwise it derives online/offline
   * from the ConferBot context.
   */
  status?: ConnectionStatusValue;

  // Display mode (context-driven API)
  variant?: 'dot' | 'badge' | 'text';

  // Position (for dot variant)
  position?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left';

  // Custom labels (context-driven API)
  onlineLabel?: string;
  offlineLabel?: string;

  // Visibility (context-driven API)
  showWhenOnline?: boolean;

  // Standalone API
  showText?: boolean;
  showIcon?: boolean;
  compact?: boolean;
  connectedText?: string;
  connectingText?: string;
  disconnectedText?: string;
  reconnectingText?: string;
  errorText?: string;
  showRetry?: boolean;
  onRetry?: () => void;
  retryButtonText?: string;
  onPress?: () => void;
  animated?: boolean;
  pulseWhenConnected?: boolean;
  connectedColor?: string;
  connectingColor?: string;
  disconnectedColor?: string;
  size?: 'small' | 'medium' | 'large';

  // Accessibility
  accessibilityLabel?: string;
  testID?: string;
}

/** Safe context access - returns null outside a ConferBotProvider */
function useOptionalConferBot(): { isConnected: boolean } | null {
  try {
    return useConferBot();
  } catch {
    return null;
  }
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  status,
  variant = 'badge',
  position = 'bottom-right',
  onlineLabel = 'Online',
  offlineLabel = 'Offline',
  showWhenOnline = false,
  showText = false,
  showIcon = true,
  compact = false,
  connectedText = 'Connected',
  connectingText = 'Connecting...',
  disconnectedText = 'Disconnected',
  reconnectingText = 'Reconnecting...',
  errorText = 'Connection error',
  showRetry = false,
  onRetry,
  retryButtonText = 'Retry',
  onPress,
  animated = true,
  pulseWhenConnected = false,
  connectedColor,
  connectingColor,
  disconnectedColor,
  size = 'medium',
  accessibilityLabel,
  testID,
}) => {
  const theme = useTheme();
  const context = useOptionalConferBot();
  const styles = createStyles(theme);

  const isStandalone = status !== undefined || context === null;

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isBusy = status === 'connecting' || status === 'reconnecting';
  const shouldAnimate =
    isStandalone && animated && (isBusy || (status === 'connected' && pulseWhenConnected));

  useEffect(() => {
    if (!shouldAnimate) {
      pulseAnim.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shouldAnimate, pulseAnim]);

  // ----- Standalone mode: explicit status prop (or no provider) -----
  if (isStandalone) {
    const statusText: Record<string, string> = {
      connected: connectedText,
      connecting: connectingText,
      disconnected: disconnectedText,
      reconnecting: reconnectingText,
      error: errorText,
    };

    const statusColor: Record<string, string> = {
      connected: connectedColor || theme.colors.online,
      connecting: connectingColor || theme.colors.warning,
      reconnecting: connectingColor || theme.colors.warning,
      disconnected: disconnectedColor || theme.colors.offline,
      error: disconnectedColor || theme.colors.error,
    };

    const currentColor = statusColor[status ?? ''] || theme.colors.offline;
    const currentText = statusText[status ?? ''] ?? '';
    const dotScale = size === 'small' ? 0.75 : size === 'large' ? 1.5 : 1;
    const showRetryButton = showRetry && status !== 'connected' && status !== 'connecting';

    const content = (
      <>
        {showIcon && (
          <Animated.View
            style={[
              styles.standaloneDot,
              {
                backgroundColor: currentColor,
                opacity: pulseAnim,
                width: 10 * dotScale,
                height: 10 * dotScale,
                borderRadius: 5 * dotScale,
              },
            ]}
          />
        )}
        {showText && currentText ? (
          <Text style={[styles.text, { color: currentColor }]} numberOfLines={2}>
            {currentText}
          </Text>
        ) : null}
        {showRetryButton && (
          <TouchableOpacity
            onPress={onRetry}
            disabled={!onRetry || status === 'reconnecting'}
            accessible={true}
            accessibilityLabel={retryButtonText}
            accessibilityRole="button"
            style={styles.retryButton}
            testID={testID ? `${testID}-retry` : undefined}
          >
            <Text style={styles.retryText}>{retryButtonText}</Text>
          </TouchableOpacity>
        )}
      </>
    );

    const containerStyle = [styles.standaloneContainer, compact && styles.compactContainer];
    const a11yLabel = accessibilityLabel || `Connection status: ${status ?? 'unknown'}`;

    if (onPress) {
      return (
        <TouchableOpacity
          style={containerStyle}
          onPress={onPress}
          accessible={true}
          accessibilityLabel={a11yLabel}
          accessibilityRole="button"
          testID={testID}
        >
          {content}
        </TouchableOpacity>
      );
    }

    return (
      <View
        style={containerStyle}
        accessible={true}
        accessibilityLabel={a11yLabel}
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
        testID={testID}
      >
        {content}
      </View>
    );
  }

  // ----- Context-driven mode (legacy API, used by ChatHeader) -----
  const { isConnected } = context as { isConnected: boolean };

  // Don't show if online and showWhenOnline is false
  if (isConnected && !showWhenOnline) {
    return null;
  }

  // Dot variant
  if (variant === 'dot') {
    return (
      <View
        style={[
          styles.dot,
          isConnected ? styles.dotOnline : styles.dotOffline,
          position === 'top-right' && styles.dotTopRight,
          position === 'bottom-right' && styles.dotBottomRight,
          position === 'top-left' && styles.dotTopLeft,
          position === 'bottom-left' && styles.dotBottomLeft,
        ]}
        accessible={true}
        accessibilityLabel={accessibilityLabel || `Connection status: ${isConnected ? onlineLabel : offlineLabel}`}
        accessibilityRole="text"
        testID={testID}
      />
    );
  }

  // Badge variant
  if (variant === 'badge') {
    return (
      <View
        style={[styles.badge, isConnected ? styles.badgeOnline : styles.badgeOffline]}
        accessible={true}
        accessibilityLabel={accessibilityLabel || `Connection status: ${isConnected ? onlineLabel : offlineLabel}`}
        accessibilityRole="text"
        testID={testID}
      >
        <View style={[styles.badgeDot, isConnected ? styles.dotOnline : styles.dotOffline]} />
        <Text style={[styles.badgeText, isConnected ? styles.textOnline : styles.textOffline]}>
          {isConnected ? onlineLabel : offlineLabel}
        </Text>
      </View>
    );
  }

  // Text variant
  return (
    <Text
      style={[styles.text, isConnected ? styles.textOnline : styles.textOffline]}
      accessible={true}
      accessibilityLabel={accessibilityLabel || `Connection status: ${isConnected ? onlineLabel : offlineLabel}`}
      accessibilityRole="text"
      testID={testID}
    >
      {isConnected ? onlineLabel : offlineLabel}
    </Text>
  );
};

const createStyles = (theme: ConferBotTheme) =>
  StyleSheet.create({
    // Standalone styles
    standaloneContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    compactContainer: {
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: 0,
    },
    standaloneDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    retryButton: {
      marginLeft: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: theme.colors.primary,
    },
    retryText: {
      color: theme.colors.textInverse,
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.medium,
    },

    // Dot styles
    dot: {
      width: 10,
      height: 10,
      borderRadius: theme.borderRadius.full,
      borderWidth: 2,
      borderColor: theme.colors.surface,
    },
    dotOnline: {
      backgroundColor: theme.colors.online,
    },
    dotOffline: {
      backgroundColor: theme.colors.offline,
    },
    dotTopRight: {
      position: 'absolute',
      top: 0,
      right: 0,
    },
    dotBottomRight: {
      position: 'absolute',
      bottom: 0,
      right: 0,
    },
    dotTopLeft: {
      position: 'absolute',
      top: 0,
      left: 0,
    },
    dotBottomLeft: {
      position: 'absolute',
      bottom: 0,
      left: 0,
    },

    // Badge styles
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.borderRadius.full,
      gap: theme.spacing.xs,
    },
    badgeOnline: {
      backgroundColor: `${theme.colors.online}15`,
    },
    badgeOffline: {
      backgroundColor: `${theme.colors.offline}15`,
    },
    badgeDot: {
      width: 6,
      height: 6,
      borderRadius: theme.borderRadius.full,
    },
    badgeText: {
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.medium,
    },

    // Text styles
    text: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.medium,
    },
    textOnline: {
      color: theme.colors.online,
    },
    textOffline: {
      color: theme.colors.offline,
    },
  });
