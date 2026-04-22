import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { Avatar } from '../Avatar';
import { ConnectionStatus } from '../ConnectionStatus';
import type { ConferBotTheme } from '../../theme/types';
import type { Agent } from '../../types';

/**
 * ChatHeader Props
 *
 * @interface ChatHeaderProps
 * @property {string} [title='Chat'] - Header title text
 * @property {string} [subtitle] - Subtitle text (e.g., "Online", "Typing...")
 * @property {Agent} [agent] - Current agent information
 * @property {boolean} [showConnectionStatus=true] - Show online/offline indicator
 * @property {() => void} [onClose] - Callback when close button is pressed
 * @property {() => void} [onAvatarPress] - Callback when avatar is pressed
 * @property {React.ReactNode} [closeIcon] - Custom close icon
 * @property {React.ReactNode} [rightActions] - Custom right-side actions
 * @property {string} [testID] - Test identifier
 *
 * @example
 * ```tsx
 * <ChatHeader
 *   title="Customer Support"
 *   subtitle="Online"
 *   agent={currentAgent}
 *   onClose={() => closeChat()}
 *   showConnectionStatus={true}
 * />
 * ```
 */
export interface ChatHeaderProps {
  title?: string;
  subtitle?: string;
  agent?: Agent;
  botAvatarUrl?: string;
  showConnectionStatus?: boolean;
  onClose?: () => void;
  onAvatarPress?: () => void;
  closeIcon?: React.ReactNode;
  rightActions?: React.ReactNode;
  testID?: string;
}

/**
 * ChatHeader Component
 *
 * Header component for chat interface showing title, agent info, and connection status.
 *
 * Features:
 * - Displays chat title and subtitle
 * - Shows current agent information with avatar
 * - Connection status indicator
 * - Close button
 * - Custom actions support
 * - Responsive design
 * - Accessibility support
 *
 * @component
 */
export const ChatHeader: React.FC<ChatHeaderProps> = ({
  title = 'Chat',
  subtitle,
  agent,
  botAvatarUrl,
  showConnectionStatus = true,
  onClose,
  onAvatarPress,
  closeIcon,
  rightActions,
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  const displayTitle = agent ? agent.name : title;
  const displaySubtitle = agent
    ? agent.email || subtitle
    : subtitle;

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityLabel={`Chat header. ${displayTitle}${displaySubtitle ? `. ${displaySubtitle}` : ''}`}
      testID={testID}
    >
      {/* Avatar — always shown (bot avatar or agent avatar) */}
      <TouchableOpacity
        onPress={onAvatarPress}
        disabled={!onAvatarPress}
        accessible={true}
        accessibilityLabel={agent ? `Agent ${agent.name}` : `Bot ${displayTitle}`}
        accessibilityRole="button"
        testID={`${testID}-avatar`}
      >
        <Avatar
          source={agent?.avatar || botAvatarUrl}
          name={agent?.name || displayTitle}
          size={32}
        />
      </TouchableOpacity>

      {/* Title and subtitle */}
      <View style={styles.titleContainer}>
        <Text
          style={styles.title}
          numberOfLines={1}
          accessible={true}
          accessibilityRole="header"
        >
          {displayTitle}
        </Text>

        {displaySubtitle && (
          <Text
            style={styles.subtitle}
            numberOfLines={1}
            accessible={true}
            accessibilityRole="text"
          >
            {displaySubtitle}
          </Text>
        )}

        {showConnectionStatus && !displaySubtitle && (
          <ConnectionStatus
            variant="text"
            showWhenOnline={false}
          />
        )}
      </View>

      {/* Right actions */}
      {rightActions && (
        <View style={styles.actionsContainer}>
          {rightActions}
        </View>
      )}

      {/* Close button */}
      {onClose && (
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessible={true}
          accessibilityLabel="Close chat"
          accessibilityRole="button"
          testID={`${testID}-close`}
        >
          {closeIcon || (
            <Text style={styles.closeIcon}>✕</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const createStyles = (theme: ConferBotTheme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      backgroundColor: theme.colors.headerBg,
      height: theme.layout.headerHeight,
      gap: 10,
      ...theme.shadows.md,
    },
    titleContainer: {
      flex: 1,
      justifyContent: 'center',
    },
    title: {
      fontSize: 16,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.headerText,
      marginBottom: 1,
    },
    subtitle: {
      fontSize: 11,
      color: theme.colors.headerText + 'BF', // 75% opacity
    },
    actionsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    closeButton: {
      justifyContent: 'center',
      alignItems: 'center',
      width: 32,
      height: 32,
    },
    closeIcon: {
      fontSize: 20,
      color: theme.colors.headerText,
    },
  });
