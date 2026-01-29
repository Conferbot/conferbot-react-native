/**
 * HandoverConnected.tsx
 *
 * Component shown when user is connected to a live agent.
 * Displays agent info with connected status.
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';

import { useTheme } from '../../theme';
import type { HandoverConnectedProps, AgentInfo } from './types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ========================================
// ONLINE INDICATOR
// ========================================

interface OnlineIndicatorProps {
  color: string;
  size?: number;
}

const OnlineIndicator: React.FC<OnlineIndicatorProps> = ({ color, size = 10 }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        styles.onlineIndicator,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          transform: [{ scale: pulseAnim }],
        },
      ]}
    />
  );
};

// ========================================
// AGENT AVATAR
// ========================================

interface AvatarProps {
  agent: AgentInfo;
  size?: number;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
}

const AgentAvatar: React.FC<AvatarProps> = ({
  agent,
  size = 56,
  backgroundColor,
  borderColor,
  textColor,
}) => {
  if (agent.avatar) {
    return (
      <View style={styles.avatarContainer}>
        <Image
          source={{ uri: agent.avatar }}
          style={[
            styles.avatar,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor,
            },
          ]}
          accessibilityLabel={`${agent.name}'s avatar`}
        />
        <View style={[styles.onlineBadge, { borderColor: 'white' }]}>
          <OnlineIndicator color={borderColor} size={12} />
        </View>
      </View>
    );
  }

  const initial = agent.name ? agent.name.charAt(0).toUpperCase() : 'A';

  return (
    <View style={styles.avatarContainer}>
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
        accessibilityLabel={`${agent.name}'s avatar`}
      >
        <Text style={[styles.avatarInitial, { color: textColor, fontSize: size * 0.4 }]}>
          {initial}
        </Text>
      </View>
      <View style={[styles.onlineBadge, { borderColor: 'white' }]}>
        <OnlineIndicator color={borderColor} size={12} />
      </View>
    </View>
  );
};

// ========================================
// MAIN COMPONENT
// ========================================

export const HandoverConnected: React.FC<HandoverConnectedProps> = ({
  agent,
  message,
  onEndChat,
}) => {
  const theme = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const defaultMessage = `You are now connected with ${agent.name || 'an agent'}`;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
        theme.shadows.md,
      ]}
      accessibilityRole="alert"
      accessibilityLabel={`Connected to ${agent.name || 'agent'}`}
    >
      {/* Success Banner */}
      <View
        style={[
          styles.successBanner,
          { backgroundColor: `${theme.colors.success}15` },
        ]}
      >
        <View style={styles.connectedRow}>
          <View
            style={[
              styles.connectedDot,
              { backgroundColor: theme.colors.success },
            ]}
          />
          <Text
            style={[
              styles.connectedText,
              { color: theme.colors.success, fontSize: theme.typography.fontSize.sm },
            ]}
          >
            Connected
          </Text>
        </View>
      </View>

      {/* Agent Info */}
      <View style={styles.content}>
        <AgentAvatar
          agent={agent}
          size={64}
          backgroundColor={theme.colors.success}
          borderColor={theme.colors.success}
          textColor={theme.colors.textInverse}
        />

        <View style={styles.agentInfo}>
          <Text
            style={[
              styles.agentName,
              { color: theme.colors.text, fontSize: theme.typography.fontSize.lg },
            ]}
          >
            {agent.name || 'Agent'}
          </Text>
          {agent.role && (
            <Text
              style={[
                styles.agentRole,
                { color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm },
              ]}
            >
              {agent.role}
            </Text>
          )}
          {agent.department && (
            <Text
              style={[
                styles.agentDepartment,
                { color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.xs },
              ]}
            >
              {agent.department}
            </Text>
          )}
        </View>
      </View>

      {/* Message */}
      <Text
        style={[
          styles.message,
          { color: theme.colors.text, fontSize: theme.typography.fontSize.md },
        ]}
      >
        {message || defaultMessage}
      </Text>

      {/* End Chat Button */}
      {onEndChat && (
        <TouchableOpacity
          style={[
            styles.endChatButton,
            {
              borderColor: theme.colors.border,
              borderRadius: theme.borderRadius.md,
            },
          ]}
          onPress={onEndChat}
          accessibilityRole="button"
          accessibilityLabel="End chat"
        >
          <Text
            style={[
              styles.endChatText,
              { color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm },
            ]}
          >
            End Chat
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
    maxWidth: SCREEN_WIDTH - 24,
    overflow: 'hidden',
  },
  successBanner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  connectedText: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    borderWidth: 3,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2,
    borderRadius: 8,
    backgroundColor: 'white',
    padding: 2,
  },
  onlineIndicator: {},
  agentInfo: {
    flex: 1,
    marginLeft: 16,
  },
  agentName: {
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  agentRole: {
    marginTop: 2,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  agentDepartment: {
    marginTop: 2,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  message: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  endChatButton: {
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  endChatText: {
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
});

export default HandoverConnected;
