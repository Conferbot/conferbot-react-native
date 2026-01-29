/**
 * HandoverWaiting.tsx
 *
 * Waiting screen component shown while connecting to a live agent.
 * Displays queue position, estimated wait time, and animated indicator.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';

import { useTheme } from '../../theme';
import type { HandoverWaitingProps, QueueInfo } from './types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ========================================
// ANIMATED DOTS COMPONENT
// ========================================

interface AnimatedDotsProps {
  color: string;
  size?: number;
}

const AnimatedDots: React.FC<AnimatedDotsProps> = ({ color, size = 12 }) => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createAnimation = (value: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 400,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 400,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const animation1 = createAnimation(dot1, 0);
    const animation2 = createAnimation(dot2, 150);
    const animation3 = createAnimation(dot3, 300);

    animation1.start();
    animation2.start();
    animation3.start();

    return () => {
      animation1.stop();
      animation2.stop();
      animation3.stop();
    };
  }, [dot1, dot2, dot3]);

  const dotStyle = (animatedValue: Animated.Value) => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
    marginHorizontal: 4,
    transform: [
      {
        translateY: animatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -8],
        }),
      },
    ],
    opacity: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0.5, 1],
    }),
  });

  return (
    <View style={styles.dotsContainer}>
      <Animated.View style={dotStyle(dot1)} />
      <Animated.View style={dotStyle(dot2)} />
      <Animated.View style={dotStyle(dot3)} />
    </View>
  );
};

// ========================================
// PULSE ANIMATION COMPONENT
// ========================================

interface PulseCircleProps {
  color: string;
  size?: number;
}

const PulseCircle: React.FC<PulseCircleProps> = ({ color, size = 100 }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.3,
            duration: 1500,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 0.1,
            duration: 1500,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.3,
            duration: 1500,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [scaleAnim, opacityAnim]);

  return (
    <Animated.View
      style={[
        styles.pulseCircle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
      ]}
    />
  );
};

// ========================================
// QUEUE POSITION INDICATOR
// ========================================

interface QueuePositionProps {
  queueInfo: QueueInfo;
  primaryColor: string;
  textColor: string;
  secondaryTextColor: string;
  fontSize: {
    lg: number;
    sm: number;
    xs: number;
  };
}

const QueuePosition: React.FC<QueuePositionProps> = ({
  queueInfo,
  primaryColor,
  textColor,
  secondaryTextColor,
  fontSize,
}) => {
  return (
    <View style={styles.queueContainer}>
      <View style={styles.queuePositionRow}>
        <Text style={[styles.queueLabel, { color: secondaryTextColor, fontSize: fontSize.sm }]}>
          Your position in queue:
        </Text>
        <View
          style={[
            styles.queuePositionBadge,
            { backgroundColor: `${primaryColor}20`, borderColor: primaryColor },
          ]}
        >
          <Text style={[styles.queuePositionNumber, { color: primaryColor, fontSize: fontSize.lg }]}>
            #{queueInfo.position}
          </Text>
        </View>
      </View>

      {queueInfo.totalInQueue && queueInfo.totalInQueue > 1 && (
        <Text style={[styles.queueTotal, { color: secondaryTextColor, fontSize: fontSize.xs }]}>
          {queueInfo.totalInQueue} {queueInfo.totalInQueue === 1 ? 'person' : 'people'} in queue
        </Text>
      )}

      {queueInfo.department && (
        <Text style={[styles.queueDepartment, { color: secondaryTextColor, fontSize: fontSize.xs }]}>
          Department: {queueInfo.department}
        </Text>
      )}
    </View>
  );
};

// ========================================
// ESTIMATED TIME DISPLAY
// ========================================

interface EstimatedTimeProps {
  seconds: number;
  textColor: string;
  secondaryTextColor: string;
  fontSize: {
    lg: number;
    sm: number;
  };
}

const EstimatedTime: React.FC<EstimatedTimeProps> = ({
  seconds,
  textColor,
  secondaryTextColor,
  fontSize,
}) => {
  const formatTime = useCallback((totalSeconds: number): string => {
    if (totalSeconds < 60) {
      return 'Less than a minute';
    }

    const minutes = Math.ceil(totalSeconds / 60);
    if (minutes === 1) {
      return 'About 1 minute';
    }
    if (minutes < 60) {
      return `About ${minutes} minutes`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours === 1) {
      return remainingMinutes > 0
        ? `About 1 hour ${remainingMinutes} minutes`
        : 'About 1 hour';
    }
    return remainingMinutes > 0
      ? `About ${hours} hours ${remainingMinutes} minutes`
      : `About ${hours} hours`;
  }, []);

  return (
    <View style={styles.estimatedTimeContainer}>
      <Text style={[styles.estimatedTimeLabel, { color: secondaryTextColor, fontSize: fontSize.sm }]}>
        Estimated wait time:
      </Text>
      <Text style={[styles.estimatedTimeValue, { color: textColor, fontSize: fontSize.lg }]}>
        {formatTime(seconds)}
      </Text>
    </View>
  );
};

// ========================================
// MAIN COMPONENT
// ========================================

export const HandoverWaiting: React.FC<HandoverWaitingProps> = ({
  message = 'Please wait while we connect you with an agent...',
  queueInfo,
  onCancel,
  showQueuePosition = true,
  showEstimatedTime = true,
}) => {
  const theme = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Fade in animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

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
      accessibilityLabel="Waiting for agent"
      accessibilityLiveRegion="polite"
    >
      {/* Animated Icon */}
      <View style={styles.iconContainer}>
        <PulseCircle color={theme.colors.primaryLight} size={100} />
        <View
          style={[
            styles.iconInner,
            { backgroundColor: theme.colors.primary },
          ]}
        >
          <Text style={styles.iconEmoji}>{'\\uD83D\\uDC64'}</Text>
        </View>
      </View>

      {/* Title */}
      <Text
        style={[
          styles.title,
          { color: theme.colors.text, fontSize: theme.typography.fontSize.xl },
        ]}
      >
        Connecting to Agent
      </Text>

      {/* Message */}
      <Text
        style={[
          styles.message,
          { color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm },
        ]}
      >
        {message}
      </Text>

      {/* Animated Dots */}
      <AnimatedDots color={theme.colors.primary} />

      {/* Queue Info */}
      {showQueuePosition && queueInfo && queueInfo.position > 0 && (
        <QueuePosition
          queueInfo={queueInfo}
          primaryColor={theme.colors.primary}
          textColor={theme.colors.text}
          secondaryTextColor={theme.colors.textSecondary}
          fontSize={{
            lg: theme.typography.fontSize.lg,
            sm: theme.typography.fontSize.sm,
            xs: theme.typography.fontSize.xs,
          }}
        />
      )}

      {/* Estimated Time */}
      {showEstimatedTime && queueInfo?.estimatedWaitTime && queueInfo.estimatedWaitTime > 0 && (
        <EstimatedTime
          seconds={queueInfo.estimatedWaitTime}
          textColor={theme.colors.text}
          secondaryTextColor={theme.colors.textSecondary}
          fontSize={{
            lg: theme.typography.fontSize.lg,
            sm: theme.typography.fontSize.sm,
          }}
        />
      )}

      {/* Cancel Button */}
      {onCancel && (
        <TouchableOpacity
          style={[
            styles.cancelButton,
            {
              borderColor: theme.colors.border,
              borderRadius: theme.borderRadius.md,
            },
          ]}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel and return to bot"
        >
          <Text
            style={[
              styles.cancelButtonText,
              { color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm },
            ]}
          >
            Cancel
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
  container: {
    marginVertical: 8,
    marginHorizontal: 12,
    padding: 24,
    maxWidth: SCREEN_WIDTH - 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  pulseCircle: {
    position: 'absolute',
  },
  iconInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 32,
  },
  title: {
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  message: {
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 30,
    marginBottom: 24,
  },
  queueContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  queuePositionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  queueLabel: {
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  queuePositionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  queuePositionNumber: {
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  queueTotal: {
    marginTop: 8,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  queueDepartment: {
    marginTop: 4,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  estimatedTimeContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  estimatedTimeLabel: {
    marginBottom: 4,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  estimatedTimeValue: {
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
});

export default HandoverWaiting;
