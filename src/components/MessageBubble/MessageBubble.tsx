import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme';
import { Avatar } from '../Avatar';
import type { ConferBotTheme } from '../../theme/types';
import type { RecordItem, Agent } from '../../types';

/**
 * MessageBubble Props
 *
 * @interface MessageBubbleProps
 * @property {RecordItem} message - The message object to display
 * @property {boolean} [showAvatar=true] - Whether to show avatar
 * @property {boolean} [showTimestamp=false] - Whether to show timestamp
 * @property {() => void} [onPress] - Callback when message is pressed
 * @property {() => void} [onLongPress] - Callback when message is long pressed
 * @property {string} [testID] - Test identifier for testing
 *
 * @example
 * ```tsx
 * <MessageBubble
 *   message={messageData}
 *   showAvatar={true}
 *   showTimestamp={true}
 *   onLongPress={() => console.log('Long pressed')}
 * />
 * ```
 */
export interface MessageBubbleProps {
  message: RecordItem;
  showAvatar?: boolean;
  showTimestamp?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  testID?: string;
}

/**
 * MessageBubble Component
 *
 * Displays a message bubble with different styles based on message type.
 * Supports user, bot, agent, and system messages.
 *
 * Features:
 * - Automatic styling based on message type
 * - Optional avatar display
 * - Optional timestamp
 * - Long press support for actions
 * - Accessibility support
 *
 * @component
 */
export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  showAvatar = true,
  showTimestamp = false,
  onPress,
  onLongPress,
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  // Determine message type
  const isUser = message.type === 'user-message';
  const isAgent = message.type === 'agent-message';
  const isSystem = message.type === 'system-message';

  // Get colors based on message type
  const getBubbleStyle = () => {
    if (isUser) {
      return {
        backgroundColor: theme.colors.userBubble,
        alignSelf: 'flex-end' as const,
      };
    }
    if (isAgent) {
      return {
        backgroundColor: theme.colors.agentBubble,
        alignSelf: 'flex-start' as const,
      };
    }
    if (isSystem) {
      return {
        backgroundColor: theme.colors.systemBubble,
        alignSelf: 'center' as const,
      };
    }
    // Bot message (default)
    return {
      backgroundColor: theme.colors.botBubble,
      alignSelf: 'flex-start' as const,
    };
  };

  const getTextColor = () => {
    if (isUser) return theme.colors.userBubbleText;
    if (isAgent) return theme.colors.agentBubbleText;
    if (isSystem) return theme.colors.systemBubbleText;
    return theme.colors.botBubbleText;
  };

  // Format timestamp
  const formatTime = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    const minuteStr = minutes < 10 ? `0${minutes}` : minutes;
    return `${hour12}:${minuteStr} ${ampm}`;
  };

  // Get agent info if available
  const agent: Agent | undefined = (message as any).agent;

  const bubbleContent = (
    <View style={[styles.container, { maxWidth: theme.layout.maxBubbleWidth }]}>
      {/* Avatar for non-user messages */}
      {!isUser && !isSystem && showAvatar && (
        <View style={styles.avatarContainer}>
          <Avatar
            source={agent?.avatar}
            name={agent?.name || 'Bot'}
            size={theme.layout.avatarSize}
          />
        </View>
      )}

      {/* Message bubble */}
      <View style={[styles.bubble, getBubbleStyle()]}>
        {/* Agent name for agent messages */}
        {isAgent && agent && (
          <Text style={[styles.agentName, { color: getTextColor() }]}>
            {agent.name}
          </Text>
        )}

        {/* Message text */}
        {'text' in message && message.text && (
          <Text
            style={[styles.messageText, { color: getTextColor() }]}
            accessible={true}
            accessibilityLabel={`Message: ${message.text}`}
            accessibilityRole="text"
          >
            {message.text}
          </Text>
        )}

        {/* Timestamp */}
        {showTimestamp && message.time && (
          <Text
            style={[
              styles.timestamp,
              {
                color: getTextColor(),
                opacity: 0.6,
              },
            ]}
          >
            {formatTime(message.time)}
          </Text>
        )}
      </View>

      {/* Spacer for alignment */}
      {isUser && <View style={styles.spacer} />}
    </View>
  );

  // Wrap in TouchableOpacity if press handlers exist
  if (onPress || onLongPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.7}
        testID={testID}
      >
        {bubbleContent}
      </TouchableOpacity>
    );
  }

  return <View testID={testID}>{bubbleContent}</View>;
};

const createStyles = (theme: ConferBotTheme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      marginVertical: theme.spacing.xs,
      marginHorizontal: theme.spacing.md,
      alignItems: 'flex-end',
      gap: theme.spacing.sm,
    },
    avatarContainer: {
      marginBottom: theme.spacing.xs,
    },
    bubble: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.lg,
      minWidth: 60,
      maxWidth: '100%',
    },
    messageText: {
      fontSize: theme.typography.fontSize.md,
      lineHeight: theme.typography.fontSize.md * theme.typography.lineHeight.normal,
    },
    agentName: {
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.bold,
      marginBottom: theme.spacing.xs,
      opacity: 0.8,
    },
    timestamp: {
      fontSize: theme.typography.fontSize.xs,
      marginTop: theme.spacing.xs,
    },
    spacer: {
      width: theme.layout.avatarSize,
    },
  });
