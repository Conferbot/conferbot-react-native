import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import type { ConferBotTheme } from '../../theme/types';

export interface TypingIndicatorProps {
  // Visibility
  visible?: boolean;

  // Dot colors
  dotColor?: string;

  // Dot size
  dotSize?: number;

  // Animation speed
  animationSpeed?: number;

  // Accessibility
  accessibilityLabel?: string;
  testID?: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  visible = true,
  dotColor,
  dotSize = 8,
  animationSpeed = 600,
  accessibilityLabel = 'Agent is typing',
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme, dotSize);

  // Animation values for each dot
  const dot1Opacity = useRef(new Animated.Value(0.3)).current;
  const dot2Opacity = useRef(new Animated.Value(0.3)).current;
  const dot3Opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (!visible) {
      // Reset to initial state
      dot1Opacity.setValue(0.3);
      dot2Opacity.setValue(0.3);
      dot3Opacity.setValue(0.3);
      return;
    }

    // Create pulsing animation for each dot with delay
    const animateDot = (animatedValue: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: animationSpeed / 3,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue, {
            toValue: 0.3,
            duration: animationSpeed / 3,
            useNativeDriver: true,
          }),
        ])
      );
    };

    // Start animations with staggered delays
    const animation1 = animateDot(dot1Opacity, 0);
    const animation2 = animateDot(dot2Opacity, animationSpeed / 3);
    const animation3 = animateDot(dot3Opacity, (animationSpeed / 3) * 2);

    animation1.start();
    animation2.start();
    animation3.start();

    return () => {
      animation1.stop();
      animation2.stop();
      animation3.stop();
    };
  }, [visible, animationSpeed, dot1Opacity, dot2Opacity, dot3Opacity]);

  if (!visible) {
    return null;
  }

  const color = dotColor || theme.colors.typing;

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      <Animated.View style={[styles.dot, { backgroundColor: color, opacity: dot1Opacity }]} />
      <Animated.View style={[styles.dot, { backgroundColor: color, opacity: dot2Opacity }]} />
      <Animated.View style={[styles.dot, { backgroundColor: color, opacity: dot3Opacity }]} />
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
    dot: {
      width: dotSize,
      height: dotSize,
      borderRadius: dotSize / 2,
    },
  });
