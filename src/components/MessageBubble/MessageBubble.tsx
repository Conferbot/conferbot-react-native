import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  GestureResponderEvent,
  Linking,
} from 'react-native';
import { useTheme } from '../../theme';
import { Avatar } from '../Avatar';
import { MessageReactions } from '../MessageReactions';
import { ReactionPicker } from '../ReactionPicker';
import { LinkPreview } from '../LinkPreview';
import { MessageStatus as MessageStatusComponent } from '../MessageStatus';
import { parseTextForUrls, type TextSegment } from '../../utils/LinkDetector';
import { MessageStatus } from '../../types/messageStatus';
import type { ConferBotTheme } from '../../theme/types';
import type { RecordItem, Agent, Reaction, ReactionEmoji } from '../../types';

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
 * @property {Reaction[]} [reactions] - Reactions on this message
 * @property {string} [currentUserId] - Current user ID for reaction highlighting
 * @property {(emoji: ReactionEmoji) => void} [onReactionPress] - Callback when reaction is pressed
 * @property {boolean} [enableReactions=true] - Whether to enable reactions feature
 * @property {boolean} [enableLinkPreviews=true] - Whether to show link previews
 * @property {boolean} [compactLinkPreviews=false] - Whether to show compact link previews
 * @property {(url: string) => void} [onLinkPress] - Custom handler for link presses
 * @property {MessageStatus} [messageStatus] - Message delivery status for read receipts
 * @property {boolean} [showReadReceipt=true] - Whether to show read receipt indicator
 *
 * @example
 * ```tsx
 * <MessageBubble
 *   message={messageData}
 *   showAvatar={true}
 *   showTimestamp={true}
 *   onLongPress={() => console.log('Long pressed')}
 *   reactions={messageReactions}
 *   currentUserId={userId}
 *   onReactionPress={(emoji) => handleReaction(messageData._id, emoji)}
 *   enableReactions={true}
 *   enableLinkPreviews={true}
 *   messageStatus={MessageStatus.READ}
 *   showReadReceipt={true}
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
  // Reaction props
  reactions?: Reaction[];
  currentUserId?: string;
  onReactionPress?: (emoji: ReactionEmoji) => void;
  enableReactions?: boolean;
  // Link preview props
  enableLinkPreviews?: boolean;
  compactLinkPreviews?: boolean;
  onLinkPress?: (url: string) => void;
  // Read receipt props
  messageStatus?: MessageStatus;
  showReadReceipt?: boolean;
}

/**
 * MessageBubble Component
 *
 * Displays a message bubble with different styles based on message type.
 * Supports user, bot, agent, and system messages with optional reactions.
 *
 * Features:
 * - Automatic styling based on message type
 * - Optional avatar display
 * - Optional timestamp
 * - Long press support for actions
 * - Message reactions with emoji picker
 * - Rich link previews with Open Graph metadata
 * - Clickable inline links
 * - Read receipt status indicators
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
  reactions = [],
  currentUserId = '',
  onReactionPress,
  enableReactions = true,
  enableLinkPreviews = true,
  compactLinkPreviews = false,
  onLinkPress,
  messageStatus,
  showReadReceipt = true,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  // State for reaction picker
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState<{ x: number; y: number } | undefined>();

  // Ref for measuring bubble position
  const bubbleRef = useRef<View>(null);

  // Determine message type
  const isUser = message.type === 'user-message' || message.type === 'user-input-response';
  const isAgent = message.type === 'agent-message';
  const isSystem = message.type === 'system-message';

  // Asymmetric bubble radius matching Android SDK
  const r = theme.borderRadius.bubble;
  const rSmall = theme.borderRadius.bubbleSmall;

  // Get colors and radius based on message type
  const getBubbleStyle = () => {
    if (isUser) {
      return {
        backgroundColor: theme.colors.userBubble,
        alignSelf: 'flex-end' as const,
        borderTopLeftRadius: r,
        borderTopRightRadius: r,
        borderBottomLeftRadius: r,
        borderBottomRightRadius: rSmall,
      };
    }
    if (isAgent) {
      return {
        backgroundColor: theme.colors.agentBubble,
        alignSelf: 'flex-start' as const,
        borderTopLeftRadius: r,
        borderTopRightRadius: r,
        borderBottomLeftRadius: rSmall,
        borderBottomRightRadius: r,
      };
    }
    if (isSystem) {
      return {
        backgroundColor: theme.colors.systemBubble,
        alignSelf: 'center' as const,
        borderRadius: r,
      };
    }
    // Bot message (default) — squared bottom-left
    return {
      backgroundColor: theme.colors.botBubble,
      alignSelf: 'flex-start' as const,
      borderTopLeftRadius: r,
      borderTopRightRadius: r,
      borderBottomLeftRadius: rSmall,
      borderBottomRightRadius: r,
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

  // Get agent info if available (embed-server sends agentDetails)
  const agentDetails: AgentDetails | undefined = (message as any).agentDetails;

  // Get message text
  const messageText = 'text' in message ? message.text : undefined;

  // Parse message text for URLs
  const parsedText = useMemo(() => {
    if (!messageText || !enableLinkPreviews) {
      return null;
    }
    return parseTextForUrls(messageText);
  }, [messageText, enableLinkPreviews]);

  // Get user's selected reactions for this message
  const userReactions: ReactionEmoji[] = reactions
    .filter((r) => r.userId === currentUserId)
    .map((r) => r.emoji);

  // Handle link press
  const handleLinkPress = useCallback(
    (url: string) => {
      if (onLinkPress) {
        onLinkPress(url);
      } else {
        Linking.openURL(url).catch((err) => {
          console.warn('[MessageBubble] Failed to open URL:', err);
        });
      }
    },
    [onLinkPress]
  );

  // Handle long press to show reaction picker
  const handleLongPress = useCallback(
    (event: GestureResponderEvent) => {
      if (enableReactions && onReactionPress && !isSystem) {
        // Get press position for anchor
        const { pageX, pageY } = event.nativeEvent;
        setPickerAnchor({ x: pageX, y: pageY });
        setShowReactionPicker(true);
      }
      // Also call original long press handler
      onLongPress?.();
    },
    [enableReactions, onReactionPress, onLongPress, isSystem]
  );

  // Handle reaction selection from picker
  const handleReactionSelect = useCallback(
    (emoji: ReactionEmoji) => {
      onReactionPress?.(emoji);
    },
    [onReactionPress]
  );

  // Handle reaction press from displayed reactions
  const handleExistingReactionPress = useCallback(
    (emoji: ReactionEmoji) => {
      onReactionPress?.(emoji);
    },
    [onReactionPress]
  );

  // Close reaction picker
  const closeReactionPicker = useCallback(() => {
    setShowReactionPicker(false);
    setPickerAnchor(undefined);
  }, []);

  // Render text with clickable links
  const renderTextWithLinks = useCallback(
    (segments: TextSegment[], textColor: string) => {
      return (
        <Text
          style={[styles.messageText, { color: textColor }]}
          accessible={true}
          accessibilityLabel={`Message: ${messageText}`}
          accessibilityRole="text"
        >
          {segments.map((segment, index) => {
            if (segment.type === 'url') {
              return (
                <Text
                  key={`${index}-${segment.content}`}
                  style={[styles.linkText, { color: isUser ? '#FFFFFF' : theme.colors.link }]}
                  onPress={() => handleLinkPress(segment.url!)}
                  accessibilityRole="link"
                  accessibilityHint={`Opens ${segment.content} in browser`}
                >
                  {segment.content}
                </Text>
              );
            }
            return <Text key={`${index}-${segment.content}`}>{segment.content}</Text>;
          })}
        </Text>
      );
    },
    [styles, messageText, isUser, theme.colors.link, handleLinkPress]
  );

  // Render link previews
  const renderLinkPreviews = useCallback(() => {
    if (!parsedText || !parsedText.hasUrls || !enableLinkPreviews) {
      return null;
    }

    // Limit to first 3 URLs for performance
    const urlsToPreview = parsedText.urls.slice(0, 3);

    return (
      <View style={styles.linkPreviewsContainer}>
        {urlsToPreview.map((detectedUrl, index) => (
          <LinkPreview
            key={`${detectedUrl.normalizedUrl}-${index}`}
            url={detectedUrl.normalizedUrl}
            isUserMessage={isUser}
            compact={compactLinkPreviews}
            onPress={onLinkPress}
            testID={`${testID}-link-preview-${index}`}
          />
        ))}
      </View>
    );
  }, [parsedText, enableLinkPreviews, isUser, compactLinkPreviews, onLinkPress, testID, styles]);

  // Determine if reactions should be shown
  const shouldShowReactions = enableReactions && !isSystem && reactions.length > 0;
  const canReact = enableReactions && !isSystem && onReactionPress;

  // Determine if read receipt should be shown (only for user messages)
  const shouldShowReadReceipt = showReadReceipt && isUser && messageStatus !== undefined;

  const textColor = getTextColor();

  const bubbleContent = (
    <View style={[styles.container, { maxWidth: theme.layout.maxBubbleWidth }]}>
      {/* Avatar for non-user messages */}
      {!isUser && !isSystem && showAvatar && (
        <View style={styles.avatarContainer}>
          <Avatar
            source={undefined} // AgentDetails doesn't have avatar in embed-server
            name={agentDetails?.name || 'Bot'}
            size={theme.layout.avatarSize}
          />
        </View>
      )}

      <View style={styles.messageContainer}>
        {/* Message bubble */}
        <View ref={bubbleRef} style={[styles.bubble, getBubbleStyle()]}>
          {/* Agent name for agent messages */}
          {isAgent && agent && (
            <Text style={[styles.agentName, { color: textColor }]}>{agent.name}</Text>
          )}

          {/* Message text with links */}
          {messageText &&
            (parsedText && parsedText.hasUrls ? (
              renderTextWithLinks(parsedText.segments, textColor)
            ) : (
              <Text
                style={[styles.messageText, { color: textColor }]}
                accessible={true}
                accessibilityLabel={`Message: ${messageText}`}
                accessibilityRole="text"
              >
                {messageText}
              </Text>
            ))}

          {/* Link Previews */}
          {renderLinkPreviews()}

          {/* Timestamp and Read Receipt Row */}
          {(showTimestamp || shouldShowReadReceipt) && (
            <View style={styles.metaRow}>
              {/* Timestamp */}
              {showTimestamp && message.time && (
                <Text
                  style={[
                    styles.timestamp,
                    {
                      color: textColor,
                      opacity: 0.6,
                    },
                  ]}
                >
                  {formatTime(message.time)}
                </Text>
              )}

              {/* Read Receipt Status */}
              {shouldShowReadReceipt && (
                <View style={styles.readReceiptContainer}>
                  <MessageStatusComponent
                    status={messageStatus}
                    size={14}
                    readColor={theme.colors.primary}
                    defaultColor={isUser ? theme.colors.userBubbleText : theme.colors.textSecondary}
                    animated={true}
                    testID={`${testID}-status`}
                  />
                </View>
              )}
            </View>
          )}
        </View>

        {/* Message Reactions */}
        {shouldShowReactions && (
          <MessageReactions
            reactions={reactions}
            currentUserId={currentUserId}
            onReactionPress={handleExistingReactionPress}
            isUserMessage={isUser}
            testID={`${testID}-reactions`}
          />
        )}
      </View>

      {/* Spacer for alignment */}
      {isUser && <View style={styles.spacer} />}
    </View>
  );

  // Wrap in TouchableOpacity if press handlers exist or reactions are enabled
  if (onPress || canReact) {
    return (
      <>
        <TouchableOpacity
          onPress={onPress}
          onLongPress={handleLongPress}
          activeOpacity={0.7}
          testID={testID}
          delayLongPress={300}
          accessible={true}
          accessibilityLabel={`Message${canReact ? ', long press to react' : ''}`}
          accessibilityHint={canReact ? 'Long press to add a reaction' : undefined}
        >
          {bubbleContent}
        </TouchableOpacity>

        {/* Reaction Picker */}
        {canReact && (
          <ReactionPicker
            visible={showReactionPicker}
            onSelectReaction={handleReactionSelect}
            onClose={closeReactionPicker}
            anchorPosition={pickerAnchor}
            selectedReactions={userReactions}
            testID={`${testID}-reaction-picker`}
          />
        )}
      </>
    );
  }

  return <View testID={testID}>{bubbleContent}</View>;
};

const createStyles = (theme: ConferBotTheme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      marginVertical: theme.spacing.xs,
      marginHorizontal: theme.spacing.chatContentPadding,
      alignItems: 'flex-end',
      gap: 10,
    },
    avatarContainer: {
      marginBottom: theme.spacing.xs,
    },
    messageContainer: {
      flex: 1,
      flexShrink: 1,
    },
    bubble: {
      paddingHorizontal: theme.spacing.bubblePaddingH,
      paddingVertical: theme.spacing.bubblePaddingV,
      borderRadius: theme.borderRadius.bubble,
      minWidth: 60,
      maxWidth: '100%',
      ...theme.shadows.sm,
    },
    messageText: {
      fontSize: theme.typography.fontSize.md,
      lineHeight: theme.typography.fontSize.md * theme.typography.lineHeight.normal,
    },
    linkText: {
      textDecorationLine: 'underline',
    },
    agentName: {
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.bold,
      marginBottom: theme.spacing.xs,
      opacity: 0.8,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginTop: theme.spacing.xs,
      gap: theme.spacing.xs,
    },
    timestamp: {
      fontSize: theme.typography.fontSize.xs,
    },
    readReceiptContainer: {
      marginLeft: theme.spacing.xs,
    },
    spacer: {
      width: theme.layout.avatarSize,
    },
    linkPreviewsContainer: {
      marginTop: theme.spacing.sm,
    },
  });
