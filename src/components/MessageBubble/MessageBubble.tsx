// @ts-nocheck
import React, { useState, useCallback, useContext, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  GestureResponderEvent,
  Linking,
  Image,
  Animated,
  Easing,
} from 'react-native';
import { useTheme } from '../../theme';
import ConferBotContext from '../../context/ConferBotContext';
import { Avatar } from '../Avatar';
import { MessageReactions } from '../MessageReactions';
import { ReactionPicker } from '../ReactionPicker';
import { LinkPreview } from '../LinkPreview';
import { MessageStatus as MessageStatusComponent } from '../MessageStatus';
import { parseTextForUrls, type TextSegment } from '../../utils/LinkDetector';
import { ChatText } from '../AgentReply/ChatText';
import { isAIAgentDetails } from '../../core/agentBot';
import { inactiveCloseLine } from '../../core/liveEvents';
import { fileNameOf, fileUrlOf, isImageUrl, resolveMediaUrl, translationLabels } from '../../core/liveChat';
import { getApiOrigin } from '../../config/constants';
import { HANDED_OVER_NOTE, handoverLineText, isHandoverOutcome } from '../../core/handoverState';
import { MessageStatus } from '../../types/messageStatus';
import type { ConferBotTheme } from '../../theme/types';
import type { RecordItem, Agent, Reaction, ReactionEmoji } from '../../types';
import { t, widgetLanguage } from '../../core/i18n';
import { useChatFont } from '../../hooks/useChatFont';
import { ChangeAnswerLink, ConfettiBurst, ReactionBadge } from '../Delight/Delight';

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
/**
 * The typing dots of a pending "Connecting you with the team…" line (the
 * web's .cb-sys__typing): three dots fading in turn, one native-driven loop.
 */
const PendingDots: React.FC<{ color: string }> = ({ color }) => {
  const t = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(t, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [t]);
  const dot = (i: number) => ({
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginHorizontal: 1.5,
    backgroundColor: color,
    opacity: t.interpolate({
      inputRange: [0, (i + 0.5) / 4, (i + 1.5) / 4, 1],
      outputRange: [0.3, 1, 0.3, 0.3],
      extrapolate: 'clamp',
    }),
  });
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="cb-handover-dots">
      {[0, 1, 2].map((i) => (
        <Animated.View key={i} style={dot(i)} />
      ))}
    </View>
  );
};

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
  // Presentational component: the provider is optional so the bubble can be
  // rendered standalone (e.g. previews, tests). Falls back to defaults.
  const conferBot = useContext(ConferBotContext);
  const botAvatarUrl = conferBot?.botAvatarUrl ?? null;
  const botName = conferBot?.botName ?? null;
  // The owner's bubble and avatar settings (core/customizations), when a bot is loaded.
  const look = conferBot?.serverCustomizations ? conferBot.customizations : null;
  const styles = createStyles(theme);
  const font = useChatFont();

  // State for reaction picker
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState<{ x: number; y: number } | undefined>();

  // Ref for measuring bubble position
  const bubbleRef = useRef<View>(null);

  // Determine message type
  const isUser = message.type === 'user-message' || message.type === 'user-input-response';
  const isAgent = message.type === 'agent-message' || message.type === 'agent-message-file' || message.type === 'agent-message-audio';
  const isSystem =
    message.type === 'system-message' ||
    message.type === 'agent-joined-message' ||
    message.type === 'agent-left-chat' ||
    message.type === 'agent-chat-ended' ||
    message.type === 'queue-self-resolved' ||
    // Back in the queue: "Connecting you to another agent..." (core/liveEvents.ts).
    (message.type as string) === 'live-chat-requeued' ||
    // The AI let an idle visitor go: "Chat paused" or "Chat ended".
    (message.type as string) === 'ai-agent-inactive-close';
  const inactiveLine = (message.type as string) === 'ai-agent-inactive-close' ? inactiveCloseLine(message) : null;
  // "Connecting you with the team…" while an AI hands the visitor on, then
  // how the wait ended (core/handoverState.ts); dots only while pending.
  const isHandoverLine = message.type === 'agent-left-chat' && (message as any).handover === true;
  const handoverPending = isHandoverLine && !isHandoverOutcome((message as any).settled);
  // A person's join after an AI handover: "They can see your conversation so far".
  const systemNote = inactiveLine
    ? inactiveLine.note
    : isSystem
    ? (message as any).note || (message.type === 'agent-joined-message' && (message as any).afterAI === true ? HANDED_OVER_NOTE : null)
    : null;

  // Asymmetric bubble radius matching Android SDK
  const r = theme.borderRadius.bubble;
  const rSmall = theme.borderRadius.bubbleSmall;

  // Get colors and radius based on message type
  const corners = (c: { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number }) => ({
    borderTopLeftRadius: c.topLeft,
    borderTopRightRadius: c.topRight,
    borderBottomRightRadius: c.bottomRight,
    borderBottomLeftRadius: c.bottomLeft,
  });

  const getBubbleStyle = () => {
    if (look && !isSystem) {
      const base = isUser
        ? { backgroundColor: theme.colors.userBubble, alignSelf: 'flex-end' as const }
        : { backgroundColor: isAgent ? theme.colors.agentBubble : theme.colors.botBubble, alignSelf: 'flex-start' as const };
      // The theme's outline round every bubble (cartoon, neo-brutal, sketch...).
      const outline = look.bubbleBorder ? { borderWidth: look.bubbleBorder.width, borderColor: look.bubbleBorder.color } : null;
      return { ...base, ...corners(isUser ? look.userBubble : look.botBubble), ...outline };
    }
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
    const minuteStr = minutes < 10 ? `0${minutes}` : minutes;
    // English keeps "10:30 AM"; nl, fr, de and es write the 24-hour clock.
    if (widgetLanguage() !== 'en') return `${hours < 10 ? `0${hours}` : hours}:${minuteStr}`;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minuteStr} ${ampm}`;
  };

  // Get agent info if available (embed-server sends agentDetails)
  const agentDetails: AgentDetails | undefined = (message as any).agentDetails;

  // An agent unsent it / edited it (agent-message-deleted / -edited).
  const isDeleted = isAgent && (message as any).deleted === true;
  const isEdited = isAgent && !isDeleted && (message as any).edited === true;

  // An agent's message in the visitor's language: the original one tap away.
  const translation = isAgent && !isDeleted ? (message as any).translation : null;
  const [showOriginal, setShowOriginal] = useState(false);
  const [seeOriginal, seeTranslation] = translationLabels(translation?.to);

  // A file the agent sent or the visitor uploaded.
  const rawFileUrl = isDeleted ? null : fileUrlOf(message);
  const fileUrl = rawFileUrl ? resolveMediaUrl(rawFileUrl, getApiOrigin()) : null;
  const [imageFailed, setImageFailed] = useState(false);
  const fileIsImage = !!fileUrl && !imageFailed && isImageUrl(fileUrl, (message as any).fileType || (message as any).mimeType);

  // Get message text
  const messageText = inactiveLine
    ? inactiveLine.text
    : isHandoverLine
    ? handoverLineText((message as any).settled)
    : isDeleted
    ? t('message.removed')
    : translation && showOriginal
      ? translation.original
      : 'text' in message
        ? message.text
        : undefined;
  // An agent's text is formatted (lists, bold, links); an AI reply's pages
  // come as its sources, so no link previews under it.
  const formatted = isAgent && !isDeleted;
  const isAIReply = isAgent && isAIAgentDetails((message as any).agentDetails);

  // Parse message text for URLs
  const parsedText = useMemo(() => {
    if (!messageText || !enableLinkPreviews || isAIReply || isDeleted) {
      return null;
    }
    return parseTextForUrls(messageText);
  }, [messageText, enableLinkPreviews, isAIReply, isDeleted]);

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
        // Get press position for anchor (nativeEvent may be absent in tests)
        const { pageX, pageY } = event?.nativeEvent ?? { pageX: 0, pageY: 0 };
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
          accessibilityLabel={t('sdk.bubble.label', { text: messageText })}
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
                  accessibilityHint={t('sdk.bubble.opensLink', { url: segment.content })}
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

  // The bot's tapback, the burst and "Edit" on the visitor's answer (core/delight.ts).
  const rowKey = String((message as any)._id ?? (message as any).id ?? '');
  const touch = isUser ? conferBot?.answerTouches?.[rowKey] : undefined;
  const showChange = isUser && !!rowKey && conferBot?.changeAnswerRowId === rowKey;

  const bubbleContent = (
    <View style={[styles.container, isUser && { alignSelf: 'flex-end' }]}>
      {/* Avatar for non-user messages */}
      {!isUser && !isSystem && showAvatar && !look?.hideAvatar && (
        <View style={styles.avatarContainer}>
          <Avatar
            source={agentDetails && !agentDetails.isAIAgent ? agentDetails.avatar : agentDetails?.avatar || look?.avatar || botAvatarUrl || undefined}
            name={agentDetails?.name || botName || t('transcript.bot')}
            size={look ? look.avatarSize : theme.layout.avatarSize}
            shape={look?.avatarShape}
          />
        </View>
      )}

      <View style={styles.messageContainer}>
        {/* Message bubble */}
        <View ref={bubbleRef} style={[styles.bubble, getBubbleStyle(), touch?.reaction ? { marginBottom: 18, overflow: 'visible' } : null]}>
          {/* Agent name for agent messages */}
          {isAgent && agentDetails && (
            <Text style={[styles.agentName, { color: textColor }, font.body(700)]}>{agentDetails.name}</Text>
          )}

          {handoverPending ? <PendingDots color={textColor} /> : null}

          {/* Message text with links */}
          {messageText && formatted ? (
            <ChatText
              text={messageText}
              // The server answering because the AI failed: the same bubble,
              // muted and italic (web _markAgentFallbackBubble).
              muted={(message as any).isFallback === true}
              color={textColor}
              fontSize={theme.typography.fontSize.md}
              lineHeight={theme.typography.fontSize.md * theme.typography.lineHeight.normal}
              linkColor={theme.colors.link}
              onLinkPress={handleLinkPress}
            />
          ) : messageText &&
            (parsedText && parsedText.hasUrls ? (
              renderTextWithLinks(parsedText.segments, textColor)
            ) : (
              <Text
                style={[styles.messageText, { color: textColor }, font.body(), isDeleted && { fontStyle: 'italic', opacity: 0.7 }]}
                accessible={true}
                accessibilityLabel={t('sdk.bubble.label', { text: messageText })}
                accessibilityRole="text"
              >
                {messageText}
              </Text>
            ))}
          {fileUrl && fileIsImage ? (
            <TouchableOpacity onPress={() => Linking.openURL(fileUrl).catch(() => {})} accessibilityRole="imagebutton" accessibilityLabel={fileNameOf(message, fileUrl)}>
              <Image source={{ uri: fileUrl }} style={styles.fileImage} resizeMode="cover" onError={() => setImageFailed(true)} />
            </TouchableOpacity>
          ) : fileUrl ? (
            <TouchableOpacity style={styles.fileRow} onPress={() => Linking.openURL(fileUrl).catch(() => {})} accessibilityRole="link">
              <Text style={[styles.fileIcon, { color: textColor }]}>{'\u{1F4CE}'}</Text>
              <Text style={[styles.fileName, { color: textColor }]} numberOfLines={1}>{fileNameOf(message, fileUrl)}</Text>
            </TouchableOpacity>
          ) : null}
          {systemNote ? (
            <Text style={[styles.timestamp, { color: textColor, opacity: 0.7, marginTop: 2, textAlign: 'center' }]}>{systemNote}</Text>
          ) : null}
          {isEdited ? <Text style={[styles.timestamp, { color: textColor, opacity: 0.6, marginTop: 2 }]}>{t('message.edited')}</Text> : null}
          {translation ? (
            <TouchableOpacity onPress={() => setShowOriginal((v) => !v)} accessibilityRole="button" hitSlop={{ top: 6, bottom: 6 }}>
              <Text style={[styles.timestamp, { color: textColor, opacity: 0.7, marginTop: 4, textDecorationLine: 'underline' }]}>
                {showOriginal ? seeTranslation : seeOriginal}
              </Text>
            </TouchableOpacity>
          ) : null}

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
          {touch?.celebrate ? (
            <ConfettiBurst
              key={touch.celebrate}
              accent={look?.accent || theme.colors.primary}
              onDone={() => conferBot?.clearAnswerTouch?.(rowKey)}
              testID={`${testID || 'cb-message'}-confetti`}
            />
          ) : null}
          {touch?.reaction ? (
            <ReactionBadge
              emoji={touch.reaction}
              card={theme.colors.surface}
              ring={theme.colors.background}
              testID={`${testID || 'cb-message'}-tapback`}
            />
          ) : null}
        </View>
        {showChange ? (
          <ChangeAnswerLink
            onPress={() => conferBot?.changeAnswer?.()}
            muted={theme.colors.textSecondary}
            font={font.body(500)}
            testID={`${testID || 'cb-message'}-edit`}
          />
        ) : null}

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

    </View>
  );

  // Wrap in TouchableOpacity if press handlers exist or reactions are enabled
  if (onPress || onLongPress || canReact) {
    return (
      <>
        <TouchableOpacity
          onPress={onPress}
          onLongPress={handleLongPress}
          activeOpacity={0.7}
          testID={testID}
          delayLongPress={300}
          accessible={true}
          accessibilityLabel={canReact ? t('sdk.bubble.messageReact') : t('sdk.bubble.message')}
          accessibilityHint={canReact ? t('sdk.bubble.reactHint') : undefined}
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
      maxWidth: theme.layout.maxBubbleWidth,
      ...theme.shadows.sm,
    },
    fileImage: {
      width: 220,
      height: 160,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.border,
    },
    fileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: 240,
    },
    fileIcon: { fontSize: 16 },
    fileName: { flexShrink: 1, fontSize: theme.typography.fontSize.md, textDecorationLine: 'underline' },
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
