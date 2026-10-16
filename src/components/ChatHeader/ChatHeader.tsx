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
  tagline?: string;
  subtitle?: string;
  agent?: Agent;
  botAvatarUrl?: string;
  /** The bot's header logo (the web shows the logo here, not the avatar). */
  logoUrl?: string | null;
  /** The owner hid the logo. */
  hideLogo?: boolean;
  /** The green "Online" line under the title (off with hideOnlineStatus or a tagline). */
  showOnline?: boolean;
  /**
   * The words on that line: "Online", or the team's reply time ("Typically
   * replies in a few minutes", "Online · team back at 9 AM";
   * core/replyTime.ts headerStatus). Default "Online".
   */
  statusText?: string;
  showConnectionStatus?: boolean;
  /** Back to the home screen, when the bot has one (web templates/shared.ts #chat_head_back-btn). */
  onBack?: () => void;
  onClose?: () => void;
  onAvatarPress?: () => void;
  onTitlePress?: () => void;
  closeIcon?: React.ReactNode;
  rightActions?: React.ReactNode;
  accessibilityLabel?: string;
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
  tagline,
  subtitle,
  agent,
  botAvatarUrl,
  logoUrl,
  hideLogo = false,
  showOnline = false,
  statusText = 'Online',
  showConnectionStatus = true,
  onBack,
  onClose,
  onAvatarPress,
  onTitlePress,
  closeIcon,
  rightActions,
  accessibilityLabel,
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
      accessibilityLabel={
        accessibilityLabel ||
        `Chat header. ${displayTitle}${displaySubtitle ? `. ${displaySubtitle}` : ''}`
      }
      testID={testID}
    >
      {onBack && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}
          accessible={true}
          accessibilityLabel="Back"
          accessibilityRole="button"
          testID={`${testID}-back`}
        >
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
      )}

      {/* The agent's photo, else the bot's logo (none when the owner hid it). */}
      {(agent || !hideLogo) && (
      <TouchableOpacity
        onPress={onAvatarPress}
        disabled={!onAvatarPress}
        accessible={true}
        accessibilityLabel={agent ? `Agent ${agent.name}` : `Bot ${displayTitle}`}
        accessibilityRole="button"
        testID={`${testID}-avatar`}
      >
        <Avatar
          // A person's photo or initials; the bot's logo only for the bot.
          source={agent ? agent.avatar : logoUrl || botAvatarUrl}
          name={agent?.name || displayTitle}
          size={38}
          // Initials on the header: a soft disc in the header text colour, not brand on brand.
          backgroundColor={`${theme.colors.headerText}33`}
          textColor={theme.colors.headerText}
        />
      </TouchableOpacity>
      )}

      {/* Title and subtitle */}
      <View style={styles.titleContainer}>
        <Text
          style={styles.title}
          numberOfLines={1}
          accessible={true}
          accessibilityRole="header"
          onPress={onTitlePress}
        >
          {displayTitle}
        </Text>

        {tagline && (
          <Text style={styles.tagline} numberOfLines={1}>
            {tagline}
          </Text>
        )}

        {!tagline && !displaySubtitle && showOnline && (
          <View style={styles.onlineRow} accessible accessibilityLabel={statusText}>
            <View style={styles.onlineDot} />
            <Text style={[styles.subtitle, { flexShrink: 1 }]} numberOfLines={1}>{statusText}</Text>
          </View>
        )}

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
    backButton: {
      marginRight: -4,
      paddingRight: 2,
    },
    backIcon: {
      fontSize: 30,
      lineHeight: 32,
      marginTop: -3,
      color: theme.colors.headerText,
    },
    titleContainer: {
      flex: 1,
      justifyContent: 'center',
    },
    title: {
      fontSize: 16,
      letterSpacing: -0.16,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.headerText,
      marginBottom: 1,
    },
    tagline: {
      fontSize: 12,
      color: theme.colors.headerText,
      opacity: 0.8,
    },
    subtitle: {
      fontSize: 11,
      color: theme.colors.headerText + 'BF', // 75% opacity
    },
    onlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    // The web's 7px green dot with a soft white ring.
    onlineDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: '#22c55e',
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.35)',
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
