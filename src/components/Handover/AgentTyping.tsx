// @ts-nocheck
/**
 * AgentTyping.tsx
 *
 * Agent typing indicator component shown when the live agent is typing.
 * Displays agent avatar with animated typing dots.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Platform,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';

import { useTheme } from '../../theme';
import type { AgentTypingProps, AgentInfo } from './types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_BUBBLE_WIDTH = SCREEN_WIDTH * 0.75;

// ========================================
// ANIMATED TYPING DOTS
// ========================================

interface TypingDotsProps {
  color: string;
  size?: number;
}

const TypingDots: React.FC<TypingDotsProps> = ({ color, size = 8 }) => {
  const dot1Opacity = useRef(new Animated.Value(0.4)).current;
  const dot2Opacity = useRef(new Animated.Value(0.4)).current;
  const dot3Opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const createAnimation = (value: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 300,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0.4,
            duration: 300,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const animation1 = createAnimation(dot1Opacity, 0);
    const animation2 = createAnimation(dot2Opacity, 150);
    const animation3 = createAnimation(dot3Opacity, 300);

    animation1.start();
    animation2.start();
    animation3.start();

    return () => {
      animation1.stop();
      animation2.stop();
      animation3.stop();
    };
  }, [dot1Opacity, dot2Opacity, dot3Opacity]);

  return (
    <View style={styles.dotsContainer}>
      <Animated.View
        style={[
          styles.dot,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            opacity: dot1Opacity,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.dot,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            opacity: dot2Opacity,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.dot,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            opacity: dot3Opacity,
          },
        ]}
      />
    </View>
  );
};

// ========================================
// AGENT AVATAR
// ========================================

interface AvatarProps {
  agent?: AgentInfo;
  size?: number;
  backgroundColor: string;
  textColor: string;
}

const AgentAvatar: React.FC<AvatarProps> = ({
  agent,
  size = 32,
  backgroundColor,
  textColor,
}) => {
  if (agent?.avatar) {
    return (
      <Image
        source={{ uri: agent.avatar }}
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
        accessibilityLabel={agent.name ? `${agent.name}'s avatar` : 'Agent avatar'}
      />
    );
  }

  const initial = agent?.name ? agent.name.charAt(0).toUpperCase() : 'A';

  return (
    <View
      style={[
        styles.avatarPlaceholder,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
        },
      ]}
      accessibilityLabel={agent?.name ? `${agent.name}'s avatar` : 'Agent avatar'}
    >
      <Text style={[styles.avatarInitial, { color: textColor, fontSize: size * 0.45 }]}>
        {initial}
      </Text>
    </View>
  );
};

// ========================================
// MAIN COMPONENT
// ========================================

export const AgentTyping: React.FC<AgentTypingProps> = ({
  agent,
  visible = true,
  show,
  typingMessage,
  compact = false,
  hideAgentInfo = false,
  animated = true,
  accessibilityLabel,
  testID,
}) => {
  const theme = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(10)).current;

  // `show` is an alias for `visible`; it wins when explicitly provided
  const isVisible = show !== undefined ? show : visible;

  // Animate in/out
  useEffect(() => {
    if (!animated) {
      fadeAnim.setValue(isVisible ? 1 : 0);
      translateYAnim.setValue(isVisible ? 0 : 10);
      return;
    }
    if (isVisible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 10,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, animated, fadeAnim, translateYAnim]);

  if (!isVisible) {
    return null;
  }

  // Resolve the typing message: custom message supports a {name} placeholder,
  // default is "<agent name> is typing...". Empty string hides the text.
  const agentName = agent?.name || 'Agent';
  const resolvedMessage =
    typingMessage !== undefined
      ? typingMessage.replace(/\{name\}/g, agentName)
      : `${agentName} is typing...`;

  const avatarSize = compact ? 24 : 32;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: translateYAnim }],
        },
      ]}
      accessibilityRole="status"
      accessibilityLabel={
        accessibilityLabel || (agent?.name ? `${agent.name} is typing` : 'Agent is typing')
      }
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      <AgentAvatar
        agent={agent}
        size={avatarSize}
        backgroundColor={theme.colors.agentBubble}
        textColor={theme.colors.agentBubbleText}
      />

      <View
        style={[
          styles.bubble,
          compact && styles.bubbleCompact,
          {
            backgroundColor: theme.colors.agentBubble,
            borderRadius: theme.borderRadius.lg,
            borderTopLeftRadius: theme.borderRadius.sm,
          },
          theme.shadows.sm,
        ]}
      >
        <TypingDots color={theme.colors.agentBubbleText} size={compact ? 6 : 8} />
      </View>

      {!hideAgentInfo && resolvedMessage !== '' && (
        <Text
          style={[
            styles.agentName,
            {
              color: theme.colors.textSecondary,
              fontSize: theme.typography.fontSize.xs,
            },
          ]}
        >
          {resolvedMessage}
        </Text>
      )}
    </Animated.View>
  );
};

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 4,
    marginHorizontal: 12,
    maxWidth: MAX_BUBBLE_WIDTH,
  },
  avatar: {
    marginRight: 8,
  },
  avatarPlaceholder: {
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  bubble: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 60,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubbleCompact: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 48,
    minHeight: 32,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    marginHorizontal: 2,
  },
  agentName: {
    position: 'absolute',
    bottom: -16,
    left: 44,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
});

export default AgentTyping;
