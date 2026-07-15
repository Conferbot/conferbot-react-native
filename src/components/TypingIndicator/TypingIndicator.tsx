import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import type { ConferBotTheme } from '../../theme/types';

export interface TypingIndicatorProps {
  // Visibility. isTyping takes precedence when provided; `visible` is the
  // legacy prop used by MessageList. When neither is provided the indicator
  // is hidden.
  isTyping?: boolean;
  visible?: boolean;

  // Content
  typingText?: string;
  name?: string;
  showName?: boolean;
  avatar?: string;
  showAvatar?: boolean;

  // Dots
  dotColor?: string;
  dotSize?: number;
  dotCount?: number;

  // Animation
  animated?: boolean;
  animationType?: 'bounce' | 'pulse' | 'fade';
  animationSpeed?: number;
  animationDuration?: number;
  dotAnimationDelay?: number;

  // Styling
  backgroundColor?: string;
  textColor?: string;
  size?: 'small' | 'medium' | 'large';
  style?: 'bubble' | 'minimal' | 'text';

  // Accessibility
  accessibilityLabel?: string;
  testID?: string;
}

const SIZE_SCALE: Record<'small' | 'medium' | 'large', number> = {
  small: 0.75,
  medium: 1,
  large: 1.5,
};

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  isTyping,
  visible,
  typingText,
  name,
  showName = false,
  avatar,
  showAvatar = true,
  dotColor,
  dotSize = 8,
  dotCount = 3,
  animated = true,
  animationSpeed = 600,
  animationDuration,
  dotAnimationDelay,
  backgroundColor,
  textColor,
  size = 'medium',
  style = 'bubble',
  accessibilityLabel = 'Agent is typing',
  testID,
}) => {
  const theme = useTheme();
  const shown = isTyping !== undefined ? isTyping : visible === true;
  const effectiveDotCount = Math.max(0, Math.min(dotCount, 10));
  const effectiveDotSize = dotSize * SIZE_SCALE[size];
  const duration = animationDuration ?? animationSpeed;
  const styles = createStyles(theme, effectiveDotSize);

  // Animation values, one per dot (max 10)
  const dotOpacities = useRef(
    Array.from({ length: 10 }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    if (!shown || !animated || effectiveDotCount === 0) {
      // Reset to initial state
      dotOpacities.forEach((v) => v.setValue(0.3));
      return undefined;
    }

    // Create pulsing animation for each dot with delay
    const animateDot = (animatedValue: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: duration / 3,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue, {
            toValue: 0.3,
            duration: duration / 3,
            useNativeDriver: true,
          }),
        ])
      );
    };

    // Start animations with staggered delays
    const perDotDelay = dotAnimationDelay ?? duration / 3;
    const animations = dotOpacities
      .slice(0, effectiveDotCount)
      .map((value, index) => animateDot(value, index * perDotDelay));

    animations.forEach((animation) => animation.start());

    return () => {
      animations.forEach((animation) => animation.stop());
    };
  }, [shown, animated, duration, dotAnimationDelay, effectiveDotCount, dotOpacities]);

  if (!shown) {
    return null;
  }

  const color = dotColor || theme.colors.typing;
  const resolvedTextColor = textColor || theme.colors.textSecondary;

  const containerStyle = [
    styles.container,
    style === 'minimal' && styles.containerMinimal,
    style === 'text' && styles.containerMinimal,
    backgroundColor !== undefined && { backgroundColor },
  ];

  return (
    <View
      style={containerStyle}
      accessible={true}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      {showAvatar && avatar ? (
        <Image source={{ uri: avatar }} style={styles.avatar} />
      ) : null}

      {showName && name ? (
        <Text style={[styles.text, { color: resolvedTextColor }]} numberOfLines={1}>
          {name}
        </Text>
      ) : null}

      {style !== 'text' &&
        Array.from({ length: effectiveDotCount }, (_, index) => (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              { backgroundColor: color, opacity: animated ? dotOpacities[index] : 0.6 },
            ]}
          />
        ))}

      {typingText ? (
        <Text style={[styles.text, { color: resolvedTextColor }]} numberOfLines={1}>
          {typingText}
        </Text>
      ) : null}
    </View>
  );
};

const createStyles = (theme: ConferBotTheme, dotSize: number) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.botBubble,
      borderRadius: theme.borderRadius.lg,
      alignSelf: 'flex-start',
    },
    containerMinimal: {
      backgroundColor: 'transparent',
      paddingHorizontal: 0,
      paddingVertical: 0,
    },
    dot: {
      width: dotSize,
      height: dotSize,
      borderRadius: dotSize / 2,
    },
    avatar: {
      width: 20,
      height: 20,
      borderRadius: 10,
      marginRight: theme.spacing.xs,
    },
    text: {
      fontSize: theme.typography.fontSize.sm,
      maxWidth: 220,
    },
  });
