/**
 * MessageStatus Component
 *
 * Displays message delivery status with animated icons.
 * Shows clock, single check, double check, or colored double check
 * based on the message status. Also supports pending (offline queue)
 * and failed states.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme';
import { MessageStatus as MessageStatusEnum } from '../../types/messageStatus';

// ========================================
// PROPS INTERFACE
// ========================================

export interface MessageStatusProps {
  /** Current status of the message */
  status: MessageStatusEnum;
  /** Size of the status icon (default: 14) */
  size?: number;
  /** Color for read status (default: theme primary) */
  readColor?: string;
  /** Color for other statuses (default: theme text secondary) */
  defaultColor?: string;
  /** Color for pending/queued status (default: theme warning) */
  pendingColor?: string;
  /** Color for failed status (default: theme error) */
  errorColor?: string;
  /** Whether to animate transitions (default: true) */
  animated?: boolean;
  /** Custom container style */
  style?: object;
  /** Callback when retry is pressed (for failed messages) */
  onRetry?: () => void;
  /** Test identifier */
  testID?: string;
}

// ========================================
// ICON COMPONENTS
// ========================================

/**
 * Pending/Queued icon (pulsing dot)
 */
const PendingIcon: React.FC<{
  size: number;
  color: string;
  pulseAnim: Animated.Value;
}> = ({ size, color, pulseAnim }) => (
  <Animated.View
    style={[
      styles.iconContainer,
      { width: size, height: size, opacity: pulseAnim },
    ]}
    accessibilityLabel="Queued"
  >
    {/* Outer ring */}
    <View
      style={[
        styles.pendingRing,
        {
          width: size * 0.85,
          height: size * 0.85,
          borderWidth: size * 0.1,
          borderColor: color,
          borderRadius: size * 0.5,
        },
      ]}
    />
    {/* Center dot */}
    <View
      style={[
        styles.pendingDot,
        {
          width: size * 0.35,
          height: size * 0.35,
          backgroundColor: color,
          borderRadius: size * 0.2,
        },
      ]}
    />
  </Animated.View>
);

/**
 * Clock icon for SENDING status
 */
const ClockIcon: React.FC<{ size: number; color: string }> = ({
  size,
  color,
}) => (
  <View
    style={[
      styles.iconContainer,
      { width: size, height: size },
    ]}
    accessibilityLabel="Sending"
  >
    {/* Clock circle */}
    <View
      style={[
        styles.clockCircle,
        {
          width: size * 0.85,
          height: size * 0.85,
          borderWidth: size * 0.1,
          borderColor: color,
          borderRadius: size * 0.5,
        },
      ]}
    >
      {/* Clock hands */}
      <View
        style={[
          styles.clockHand,
          {
            width: size * 0.08,
            height: size * 0.3,
            backgroundColor: color,
            top: size * 0.15,
            left: size * 0.35,
          },
        ]}
      />
      <View
        style={[
          styles.clockHand,
          {
            width: size * 0.25,
            height: size * 0.08,
            backgroundColor: color,
            top: size * 0.35,
            left: size * 0.35,
          },
        ]}
      />
    </View>
  </View>
);

/**
 * Single check icon for SENT status
 */
const SingleCheckIcon: React.FC<{ size: number; color: string }> = ({
  size,
  color,
}) => (
  <View
    style={[styles.iconContainer, { width: size, height: size }]}
    accessibilityLabel="Sent"
  >
    <View
      style={[
        styles.checkmark,
        {
          width: size * 0.5,
          height: size * 0.8,
          borderColor: color,
          borderRightWidth: size * 0.15,
          borderBottomWidth: size * 0.15,
        },
      ]}
    />
  </View>
);

/**
 * Double check icon for DELIVERED/READ status
 */
const DoubleCheckIcon: React.FC<{
  size: number;
  color: string;
  isRead: boolean;
}> = ({ size, color, isRead }) => (
  <View
    style={[styles.iconContainer, { width: size * 1.4, height: size }]}
    accessibilityLabel={isRead ? 'Read' : 'Delivered'}
  >
    {/* First check (back) */}
    <View
      style={[
        styles.checkmark,
        styles.checkmarkBack,
        {
          width: size * 0.4,
          height: size * 0.7,
          borderColor: color,
          borderRightWidth: size * 0.12,
          borderBottomWidth: size * 0.12,
          left: 0,
        },
      ]}
    />
    {/* Second check (front) */}
    <View
      style={[
        styles.checkmark,
        styles.checkmarkFront,
        {
          width: size * 0.4,
          height: size * 0.7,
          borderColor: color,
          borderRightWidth: size * 0.12,
          borderBottomWidth: size * 0.12,
          left: size * 0.35,
        },
      ]}
    />
  </View>
);

/**
 * Error/Failed icon
 */
const ErrorIcon: React.FC<{ size: number; color: string }> = ({
  size,
  color,
}) => (
  <View
    style={[styles.iconContainer, { width: size, height: size }]}
    accessibilityLabel="Failed"
  >
    <View
      style={[
        styles.errorCircle,
        {
          width: size * 0.9,
          height: size * 0.9,
          backgroundColor: color,
          borderRadius: size * 0.5,
        },
      ]}
    >
      <Text
        style={[
          styles.errorText,
          {
            fontSize: size * 0.6,
            lineHeight: size * 0.7,
          },
        ]}
      >
        !
      </Text>
    </View>
  </View>
);

// ========================================
// MAIN COMPONENT
// ========================================

/**
 * MessageStatus Component
 *
 * Displays message delivery status with animated icons:
 * - Pulsing dot: Message is queued (offline)
 * - Clock: Message is being sent
 * - Single check: Message sent to server
 * - Double check (gray): Message delivered
 * - Double check (blue): Message read
 * - Exclamation: Message failed
 */
export const MessageStatus: React.FC<MessageStatusProps> = ({
  status,
  size = 14,
  readColor,
  defaultColor,
  pendingColor,
  errorColor,
  animated = true,
  style,
  onRetry,
  testID,
}) => {
  const theme = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const prevStatusRef = useRef<MessageStatusEnum>(status);
  // Track running animations for cleanup
  const animationsRef = useRef<{ stop: () => void }[]>([]);

  // Determine colors
  const resolvedReadColor = readColor || theme.colors.primary;
  const resolvedDefaultColor =
    defaultColor || theme.colors.textSecondary || '#999';
  const resolvedPendingColor = pendingColor || theme.colors.warning || '#F59E0B';
  const resolvedErrorColor = errorColor || theme.colors.error || '#EF4444';

  // Pulsing animation for pending status
  useEffect(() => {
    // Clear previous animations
    animationsRef.current.forEach(anim => anim.stop());
    animationsRef.current = [];

    if (status === MessageStatusEnum.PENDING && animated) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
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
      pulseAnimation.start();
      animationsRef.current.push(pulseAnimation);
    } else {
      pulseAnim.setValue(1);
    }

    return () => {
      animationsRef.current.forEach(anim => anim.stop());
      animationsRef.current = [];
    };
  }, [status, animated, pulseAnim]);

  // Animate on status change
  useEffect(() => {
    if (animated && prevStatusRef.current !== status) {
      // Reset animations
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);

      // Run entry animation - use timing instead of spring for compatibility
      const fadeAnimation = Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      });
      const scaleAnimation = Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      });

      fadeAnimation.start();
      scaleAnimation.start();

      prevStatusRef.current = status;
    } else if (!animated) {
      fadeAnim.setValue(1);
      scaleAnim.setValue(1);
    }
  }, [status, animated, fadeAnim, scaleAnim]);

  // Initial animation
  useEffect(() => {
    if (animated) {
      const fadeAnimation = Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      });
      const scaleAnimation = Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      });

      fadeAnimation.start();
      scaleAnimation.start();
    } else {
      fadeAnim.setValue(1);
      scaleAnim.setValue(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render appropriate icon based on status
  const renderIcon = () => {
    switch (status) {
      case MessageStatusEnum.PENDING:
        return (
          <PendingIcon
            size={size}
            color={resolvedPendingColor}
            pulseAnim={pulseAnim}
          />
        );

      case MessageStatusEnum.SENDING:
        return <ClockIcon size={size} color={resolvedDefaultColor} />;

      case MessageStatusEnum.SENT:
        return <SingleCheckIcon size={size} color={resolvedDefaultColor} />;

      case MessageStatusEnum.DELIVERED:
        return (
          <DoubleCheckIcon
            size={size}
            color={resolvedDefaultColor}
            isRead={false}
          />
        );

      case MessageStatusEnum.READ:
        return (
          <DoubleCheckIcon
            size={size}
            color={resolvedReadColor}
            isRead={true}
          />
        );

      case MessageStatusEnum.FAILED:
        return <ErrorIcon size={size} color={resolvedErrorColor} />;

      default:
        return null;
    }
  };

  const content = (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={`Message status: ${status}`}
    >
      {renderIcon()}
    </Animated.View>
  );

  // Wrap in TouchableOpacity for failed status with retry callback
  if (status === MessageStatusEnum.FAILED && onRetry) {
    return (
      <TouchableOpacity
        onPress={onRetry}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Message failed. Tap to retry"
        accessibilityHint="Double tap to retry sending this message"
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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  // Pending styles
  pendingRing: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingDot: {
    position: 'absolute',
  },
  // Clock styles
  clockCircle: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockHand: {
    position: 'absolute',
  },
  // Check styles
  checkmark: {
    transform: [{ rotate: '45deg' }],
    position: 'absolute',
    bottom: 2,
  },
  checkmarkBack: {
    opacity: 0.6,
  },
  checkmarkFront: {},
  // Error styles
  errorCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
  },
});

// ========================================
// UTILITY HOOK
// ========================================

/**
 * Hook to get status display text
 */
export const useMessageStatusText = (status: MessageStatusEnum): string => {
  switch (status) {
    case MessageStatusEnum.PENDING:
      return 'Queued';
    case MessageStatusEnum.SENDING:
      return 'Sending...';
    case MessageStatusEnum.SENT:
      return 'Sent';
    case MessageStatusEnum.DELIVERED:
      return 'Delivered';
    case MessageStatusEnum.READ:
      return 'Read';
    case MessageStatusEnum.FAILED:
      return 'Failed';
    default:
      return '';
  }
};

export default MessageStatus;
