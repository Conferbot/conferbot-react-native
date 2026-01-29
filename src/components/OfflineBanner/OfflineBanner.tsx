/**
 * OfflineBanner.tsx
 *
 * A banner component that displays when the device is offline.
 * Shows connection status and pending message count.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../theme';
import type { ConferBotTheme } from '../../theme/types';

// ========================================
// TYPES
// ========================================

export interface OfflineBannerProps {
  /** Whether the device is currently offline */
  isOffline: boolean;
  /** Number of pending messages in queue */
  pendingCount?: number;
  /** Callback when banner is tapped */
  onPress?: () => void;
  /** Custom text to display when offline */
  offlineText?: string;
  /** Text to show for pending messages (supports {count} placeholder) */
  pendingText?: string;
  /** Whether to animate the banner appearance */
  animated?: boolean;
  /** Position of the banner */
  position?: 'top' | 'bottom';
  /** Accessibility label */
  accessibilityLabel?: string;
  /** Test ID for testing */
  testID?: string;
}

// ========================================
// COMPONENT
// ========================================

/**
 * OfflineBanner Component
 *
 * Displays a prominent banner when the device loses network connectivity.
 * Optionally shows the number of queued messages waiting to be sent.
 *
 * Features:
 * - Animated slide-in/out appearance
 * - Pending message count display
 * - Customizable position (top/bottom)
 * - Accessible with screen reader support
 *
 * @example
 * ```tsx
 * <OfflineBanner
 *   isOffline={!isConnected}
 *   pendingCount={queuedMessages}
 *   onPress={() => showQueueDetails()}
 * />
 * ```
 */
export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  isOffline,
  pendingCount = 0,
  onPress,
  offlineText = 'You are offline',
  pendingText = '{count} message{s} pending',
  animated = true,
  position = 'top',
  accessibilityLabel,
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme, position);

  // Animation value for slide-in effect
  const slideAnim = useRef(new Animated.Value(isOffline ? 0 : -100)).current;
  const opacityAnim = useRef(new Animated.Value(isOffline ? 1 : 0)).current;

  // Handle animation when offline status changes
  useEffect(() => {
    const toSlideValue = isOffline ? 0 : position === 'top' ? -100 : 100;
    const toOpacityValue = isOffline ? 1 : 0;

    if (animated) {
      const slideAnimation = Animated.timing(slideAnim, {
        toValue: toSlideValue,
        duration: theme.animations.duration.normal,
        useNativeDriver: true,
      });
      const opacityAnimation = Animated.timing(opacityAnim, {
        toValue: toOpacityValue,
        duration: theme.animations.duration.normal,
        useNativeDriver: true,
      });

      // Run animations in parallel
      slideAnimation.start();
      opacityAnimation.start();
    } else {
      slideAnim.setValue(toSlideValue);
      opacityAnim.setValue(toOpacityValue);
    }
  }, [isOffline, animated, slideAnim, opacityAnim, position, theme.animations.duration.normal]);

  // Don't render if online and animation is complete
  if (!isOffline && !animated) {
    return null;
  }

  /**
   * Formats the pending text with count
   */
  function formatPendingText(count: number, template: string): string {
    if (count === 0) return '';
    return template
      .replace('{count}', count.toString())
      .replace('{s}', count === 1 ? '' : 's');
  }

  const formattedPendingText = formatPendingText(pendingCount, pendingText);
  const computedAccessibilityLabel = accessibilityLabel || `${offlineText}. ${formattedPendingText}`;

  const content = (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
      accessibilityRole="alert"
      accessibilityLabel={computedAccessibilityLabel}
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      {/* Offline indicator dot */}
      <View style={styles.indicatorContainer}>
        <View style={styles.indicator} />
        <View style={[styles.indicator, styles.indicatorPulse]} />
      </View>

      {/* Text content */}
      <View style={styles.textContainer}>
        <Text style={styles.offlineText}>{offlineText}</Text>
        {pendingCount > 0 && (
          <Text style={styles.pendingText}>{formattedPendingText}</Text>
        )}
      </View>

      {/* Tap hint arrow */}
      {onPress && (
        <View style={styles.arrowContainer}>
          <Text style={styles.arrow}>{'>'}</Text>
        </View>
      )}
    </Animated.View>
  );

  // Wrap in TouchableOpacity if onPress is provided
  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        accessible={true}
        accessibilityRole="button"
        accessibilityHint="Tap to view pending messages"
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

// ========================================
// STYLES
// ========================================

const createStyles = (theme: ConferBotTheme, position: 'top' | 'bottom') =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.warning,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      ...(position === 'top'
        ? { borderBottomLeftRadius: theme.borderRadius.md, borderBottomRightRadius: theme.borderRadius.md }
        : { borderTopLeftRadius: theme.borderRadius.md, borderTopRightRadius: theme.borderRadius.md }),
    },
    indicatorContainer: {
      width: 12,
      height: 12,
      marginRight: theme.spacing.sm,
      justifyContent: 'center',
      alignItems: 'center',
    },
    indicator: {
      position: 'absolute',
      width: 8,
      height: 8,
      borderRadius: theme.borderRadius.full,
      backgroundColor: '#FFFFFF',
    },
    indicatorPulse: {
      width: 12,
      height: 12,
      backgroundColor: 'rgba(255, 255, 255, 0.4)',
    },
    textContainer: {
      flex: 1,
    },
    offlineText: {
      color: '#FFFFFF',
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.semibold,
    },
    pendingText: {
      color: 'rgba(255, 255, 255, 0.85)',
      fontSize: theme.typography.fontSize.xs,
      marginTop: 2,
    },
    arrowContainer: {
      marginLeft: theme.spacing.sm,
      paddingLeft: theme.spacing.sm,
    },
    arrow: {
      color: '#FFFFFF',
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.bold,
    },
  });

export default OfflineBanner;
