// @ts-nocheck
import React, { useRef, useEffect, useCallback, useContext, useMemo } from 'react';
import {
  FlatList,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ViewToken,
  Image,
} from 'react-native';
import { useTheme } from '../../theme';
import { MessageBubble } from '../MessageBubble';
import { TypingIndicator } from '../TypingIndicator';
import { Avatar } from '../Avatar';
import { EmptyState } from '../EmptyState';
import { NodeRenderer } from '../NodeComponents';
import { AgentReplyExtras, RichAgentMessage, SuggestionChips } from '../AgentReply';
import ConferBotContext from '../../context/ConferBotContext';
import { htmlToMarkdown } from '../../utils/chatMarkdown';
import { isAIAgentDetails } from '../../core/agentBot';
import { visitorReceiptOf } from '../../core/liveChat';
import type { NodeUIState } from '../../core/nodes/NodeHandler';
import type { ConferBotTheme } from '../../theme/types';
import type { RecordItem, Reaction, ReactionEmoji, MessageStatusEntry } from '../../types';
import { MessageStatus } from '../../types';

/**
 * MessageList Props
 *
 * @interface MessageListProps
 * @property {RecordItem[]} messages - Array of messages to display
 * @property {boolean} [loading=false] - Whether messages are loading
 * @property {boolean} [showTypingIndicator=false] - Show typing indicator
 * @property {boolean} [showAvatars=true] - Show avatars in messages
 * @property {boolean} [showTimestamps=false] - Show timestamps in messages
 * @property {() => void} [onRefresh] - Pull to refresh callback
 * @property {() => void} [onEndReached] - Load more messages callback
 * @property {() => void} [onMessagePress] - Message press callback
 * @property {() => void} [onMessageLongPress] - Message long press callback
 * @property {React.ReactNode} [emptyComponent] - Custom empty state component
 * @property {React.ReactNode} [loadingComponent] - Custom loading component
 * @property {string} [testID] - Test identifier
 * @property {Map<string, Reaction[]>} [reactions] - Reactions map for messages
 * @property {string} [currentUserId] - Current user ID for reaction highlighting
 * @property {(messageId: string, emoji: ReactionEmoji) => void} [onReactionPress] - Callback when reaction is pressed
 * @property {boolean} [enableReactions=true] - Whether to enable reactions feature
 * @property {Map<string | number, MessageStatusEntry>} [messageStatuses] - Message delivery statuses for read receipts
 * @property {boolean} [showReadReceipts=true] - Whether to show read receipt indicators
 * @property {(messageIds: (string | number)[]) => void} [onVisibleMessagesChange] - Callback with visible message IDs for read receipts
 *
 * @example
 * ```tsx
 * <MessageList
 *   messages={record}
 *   showTypingIndicator={isAgentTyping}
 *   showTimestamps={true}
 *   onRefresh={() => loadMoreMessages()}
 *   onMessageLongPress={(msg) => showMessageActions(msg)}
 *   reactions={reactionsMap}
 *   currentUserId={userId}
 *   onReactionPress={(msgId, emoji) => handleReaction(msgId, emoji)}
 *   enableReactions={true}
 *   messageStatuses={messageStatusMap}
 *   showReadReceipts={true}
 *   onVisibleMessagesChange={(ids) => markVisibleAsRead(ids)}
 * />
 * ```
 */
export interface MessageListProps {
  /** A chat background is drawn behind the list (the list itself is see-through). */
  transparent?: boolean;
  messages: RecordItem[];
  loading?: boolean;
  showTypingIndicator?: boolean;
  showAvatars?: boolean;
  showTimestamps?: boolean;
  onRefresh?: () => void;
  onEndReached?: () => void;
  onMessagePress?: (message: RecordItem) => void;
  onMessageLongPress?: (message: RecordItem) => void;
  emptyComponent?: React.ReactNode;
  loadingComponent?: React.ReactNode;
  testID?: string;
  // Reaction props
  reactions?: Map<string, Reaction[]>;
  currentUserId?: string;
  onReactionPress?: (messageId: string, emoji: ReactionEmoji) => void;
  enableReactions?: boolean;
  // Read receipt props
  messageStatuses?: Map<string | number, MessageStatusEntry>;
  showReadReceipts?: boolean;
  onVisibleMessagesChange?: (messageIds: (string | number)[]) => void;
  /** Active interactive node UI state to render inline after messages */
  activeNodeUI?: NodeUIState | null;
  /** Callback when user submits a response to the active node */
  onNodeSubmit?: (response: any, portName?: string) => void;
  /** Whether the node is currently loading */
  isNodeLoading?: boolean;
  /** Live chat cards below the messages (queue, leave a message, rating...). */
  footerExtras?: React.ReactNode;
  /** Changes when those cards change, to keep them in view. */
  footerExtrasKey?: string;
}

/**
 * MessageList Component
 *
 * Virtualized list component for displaying chat messages efficiently.
 *
 * Features:
 * - Virtualized rendering for performance
 * - Auto-scroll to bottom for new messages
 * - Pull to refresh for loading history
 * - Typing indicator support
 * - Empty state handling
 * - Inverted list (messages from bottom to top)
 * - Message reactions support
 * - Read receipt status indicators
 * - Visible message tracking for read receipts
 * - Accessibility support
 *
 * Performance:
 * - Uses FlatList for efficient rendering
 * - Only renders visible messages
 * - Optimized for thousands of messages
 *
 * @component
 */
export const MessageList: React.FC<MessageListProps> = ({
  transparent = false,
  messages,
  loading = false,
  showTypingIndicator = false,
  showAvatars = true,
  showTimestamps = false,
  onRefresh,
  onEndReached,
  onMessagePress,
  onMessageLongPress,
  emptyComponent,
  loadingComponent,
  testID,
  reactions,
  currentUserId = '',
  onReactionPress,
  enableReactions = true,
  messageStatuses,
  showReadReceipts = true,
  onVisibleMessagesChange,
  activeNodeUI,
  onNodeSubmit,
  isNodeLoading,
  footerExtras,
  footerExtrasKey = '',
}) => {
  const theme = useTheme();
  // Optional: the list also renders standalone (tests, previews).
  const conferBot = useContext(ConferBotContext);
  const styles = createStyles(theme);
  const flatListRef = useRef<any>(null);
  const atEndRef = useRef(true);
  const visibleMessageIdsRef = useRef<Set<string | number>>(new Set());

  // Opened on an existing conversation: start at its latest message.
  useEffect(() => {
    const t = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 250);
    return () => clearTimeout(t);
  }, []);

  // Auto-scroll to end when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // ...and while a reply is written, or new suggestions or a node appear
  // below the last message.
  const footerKey = `${conferBot?.agentStream?.text?.length || 0}:${(conferBot?.suggestions || []).length}:${!!activeNodeUI}:${showTypingIndicator}:${footerExtrasKey}`;
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      const t = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 60);
      return () => clearTimeout(t);
    }
  }, [footerKey]);

  // Get reactions for a specific message
  const getMessageReactions = useCallback(
    (messageId: string | number): Reaction[] => {
      if (!reactions) return [];
      return reactions.get(String(messageId)) || [];
    },
    [reactions]
  );

  // Get status for a specific message
  const getMessageStatus = useCallback(
    (messageId: string | number): MessageStatus | undefined => {
      if (!messageStatuses) return undefined;
      return messageStatuses.get(messageId)?.status;
    },
    [messageStatuses]
  );

  // Handle reaction press - toggle the reaction
  const handleReactionPress = useCallback(
    (messageId: string | number, emoji: ReactionEmoji) => {
      if (onReactionPress) {
        onReactionPress(String(messageId), emoji);
      }
    },
    [onReactionPress]
  );

  // Handle viewable items change for read receipts
  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (!onVisibleMessagesChange) return;

      const newVisibleIds = new Set<string | number>();
      viewableItems.forEach((item) => {
        if (item.item && item.item._id) {
          newVisibleIds.add(item.item._id);
        }
      });

      // Only trigger callback if the set changed
      const prevIds = visibleMessageIdsRef.current;
      const hasChanged =
        newVisibleIds.size !== prevIds.size ||
        ![...newVisibleIds].every((id) => prevIds.has(id));

      if (hasChanged) {
        visibleMessageIdsRef.current = newVisibleIds;

        // Filter to only user messages (those that need read receipts)
        const userMessageIds = viewableItems
          .filter(
            (item) =>
              item.item &&
              (item.item.type === 'user-message' ||
                item.item.type === 'user-input-response')
          )
          .map((item) => item.item._id);

        if (userMessageIds.length > 0) {
          onVisibleMessagesChange(userMessageIds);
        }
      }
    },
    [onVisibleMessagesChange]
  );

  // Viewability config for tracking visible items
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 500, // Item must be visible for 500ms
  }).current;

  // Render frozen choice buttons (choices that were already submitted)
  const renderFrozenChoiceButtons = useCallback(
    (item: RecordItem) => {
      const choiceUI = (item as any).choiceUI;
      if (!choiceUI || !choiceUI.buttons) return null;

      const selectedId = choiceUI.selectedButtonId;
      const selectedIds = choiceUI.selectedButtonIds || (selectedId ? [selectedId] : []);

      return (
        <View style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          paddingLeft: theme.layout.avatarSize + 10 + theme.spacing.chatContentPadding,
          paddingRight: theme.spacing.chatContentPadding,
          marginBottom: 8,
        }}>
          {choiceUI.buttons.map((button: any) => {
            const isSelected = selectedIds.includes(button.id);
            return (
              <TouchableOpacity
                key={button.id}
                style={{
                  backgroundColor: isSelected ? theme.colors.primary : theme.colors.optionBubble,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: theme.borderRadius.button,
                  opacity: isSelected ? 1 : 0.5,
                }}
                disabled={true}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected, disabled: true }}
                accessibilityLabel={button.label}
              >
                <Text style={{
                  color: isSelected ? theme.colors.textInverse : theme.colors.optionBubbleText,
                  fontSize: theme.typography.fontSize.md,
                  fontWeight: '500',
                }}>
                  {button.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    },
    [theme]
  );

  // Render a standalone bot image (e.g. welcome node image/GIF) - shown as a
  // rounded image below the text bubble, like the web widget
  const renderBotImage = useCallback(
    (item: RecordItem) => {
      const url = (item as any).url;
      const mediaNodeId = (item as any).mediaNodeId;
      if (!url) return null;
      // An image step moves the flow on once its picture loads (or fails),
      // as the web widget does; the engine caps the wait at 4 s.
      const onSettled = mediaNodeId ? () => conferBot?.flowEngine?.mediaSettled?.(mediaNodeId) : undefined;
      return <BotImage url={url} theme={theme} onSettled={onSettled} />;
    },
    [theme, conferBot?.flowEngine]
  );

  // "Sent / Delivered / Seen" under the visitor's latest live message, while
  // a person (not the AI) is on the other end.
  const agent: any = conferBot?.currentAgent;
  const humanAgent = !!agent && agent.isAIAgent !== true && !String(agent.id || '').startsWith('ai-agent-');
  const liveReceipt = useMemo(
    () => (humanAgent && conferBot?.receiptMarks ? visitorReceiptOf(messages as any[], conferBot.receiptMarks) : null),
    [humanAgent, messages, conferBot?.receiptMarks]
  );

  // Render individual message
  const renderMessage = useCallback(
    ({ item }: { item: RecordItem }) => {
      // Handle frozen choice buttons (submitted choice nodes)
      if ((item as any).shape === 'bot-choice-buttons') {
        return renderFrozenChoiceButtons(item);
      }

      // Handle standalone bot images (welcome node image/GIF)
      if ((item as any).shape === 'bot-image-message') {
        return renderBotImage(item);
      }

      // An agent's article, quick replies or card
      if ((item as any).shape === 'agent-message-rich' && (item as any).rich) {
        return <RichAgentMessage message={item} testID={`${testID}-rich-${item._id}`} />;
      }

      const messageId = item._id;
      const messageReactions = getMessageReactions(item._id);
      const messageStatus = getMessageStatus(item._id);

      // Only show read receipts for user messages
      const isUserMessage =
        item.type === 'user-message' || item.type === 'user-input-response';
      const shouldShowReceipt =
        showReadReceipts && isUserMessage && messageStatus !== undefined;

      // An AI agent's reply: its sources, buttons, cards and "Helpful?" below.
      const isAIReply = item.type === 'agent-message' && isAIAgentDetails((item as any).agentDetails) && !(item as any).deleted;
      const receipt = liveReceipt && String(item._id) === liveReceipt.id ? liveReceipt.state : null;

      const bubble = (
        <MessageBubble
          message={item}
          showAvatar={showAvatars}
          showTimestamp={showTimestamps}
          onPress={() => onMessagePress?.(item)}
          onLongPress={() => onMessageLongPress?.(item)}
          testID={`${testID}-message-${item._id}`}
          // Reaction props
          reactions={messageReactions}
          currentUserId={currentUserId}
          onReactionPress={
            enableReactions && onReactionPress
              ? (emoji) => handleReactionPress(item._id, emoji)
              : undefined
          }
          enableReactions={enableReactions}
          // Read receipt props
          messageStatus={shouldShowReceipt ? messageStatus : undefined}
          showReadReceipt={showReadReceipts}
        />
      );
      if (receipt) {
        return (
          <View>
            {bubble}
            <Text style={styles.receiptLine} testID={`${testID}-receipt`}>
              {receipt === 'seen' ? 'Seen' : receipt === 'delivered' ? 'Delivered' : 'Sent'}
            </Text>
          </View>
        );
      }
      if (!isAIReply) return bubble;
      return (
        <View>
          {bubble}
          <AgentReplyExtras message={item} testID={`${testID}-extras-${item._id}`} />
        </View>
      );
    },
    [
      showAvatars,
      showTimestamps,
      onMessagePress,
      onMessageLongPress,
      testID,
      getMessageReactions,
      getMessageStatus,
      currentUserId,
      enableReactions,
      onReactionPress,
      handleReactionPress,
      showReadReceipts,
      renderFrozenChoiceButtons,
      renderBotImage,
      liveReceipt,
    ]
  );

  // Render list footer: inline interactive node + typing indicator
  const renderListFooter = () => {
    const hasNode = !!activeNodeUI && !!onNodeSubmit;
    const stream = conferBot?.agentStream || null;
    // The live reply replaces the dots once it is writing.
    const hasTyping = showTypingIndicator && !stream;
    const suggestions = !stream && !hasTyping ? conferBot?.suggestions || [] : [];
    if (!hasNode && !hasTyping && !stream && !suggestions.length && !footerExtras) return null;
    return (
      <View>
        {footerExtras}
        {stream && (
          <MessageBubble
            message={{ _id: `stream-${stream.id}`, type: 'agent-message', text: htmlToMarkdown(stream.text), agentDetails: stream.agentDetails, time: new Date().toISOString() } as any}
            showAvatar={showAvatars}
            enableReactions={false}
            enableLinkPreviews={false}
            testID={`${testID}-stream`}
          />
        )}
        {suggestions.length > 0 && (
          <SuggestionChips items={suggestions} onPick={(q) => conferBot?.sendMessage?.(q)} testID={`${testID}-suggestions`} />
        )}
        {hasNode && (
          <View style={{ paddingBottom: theme.spacing.sm }}>
            <NodeRenderer
              uiState={activeNodeUI}
              onSubmit={onNodeSubmit}
              isLoading={isNodeLoading}
              isBot={true}
            />
          </View>
        )}
        {hasTyping && (
          <View style={styles.typingContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              {!(conferBot?.serverCustomizations && conferBot.customizations.hideAvatar) && (
                <Avatar
                  source={conferBot?.currentAgent ? conferBot.currentAgent.avatar : conferBot?.customizations?.avatar || conferBot?.botAvatarUrl || undefined}
                  name={conferBot?.currentAgent?.name || conferBot?.botName || 'Bot'}
                  size={conferBot?.serverCustomizations ? conferBot.customizations.avatarSize : 32}
                  shape={conferBot?.serverCustomizations ? conferBot.customizations.avatarShape : undefined}
                />
              )}
              <TypingIndicator visible={true} variant={conferBot?.customizations?.typingStyle} />
            </View>
          </View>
        )}
      </View>
    );
  };

  // Render empty state
  const renderEmpty = () => {
    if (loading && loadingComponent) {
      return <View style={styles.centerContent}>{loadingComponent}</View>;
    }

    if (emptyComponent) {
      return <View style={styles.centerContent}>{emptyComponent}</View>;
    }

    return (
      <View style={styles.centerContent}>
        <EmptyState
          title="No messages yet"
          message="Start a conversation by sending a message below"
        />
      </View>
    );
  };

  // Key extractor for FlatList
  const keyExtractor = (item: RecordItem) => String(item._id);

  return (
    <FlatList
      ref={flatListRef}
      data={messages}
      renderItem={renderMessage}
      keyExtractor={keyExtractor}
      // An element, not the function: a new function each render would
      // remount the footer and wipe what the visitor is typing in a card.
      ListFooterComponent={renderListFooter()}
      // A tap on a card button (Send, a star) works with the keyboard up.
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={renderEmpty}
      style={[styles.container, transparent && { backgroundColor: 'transparent' }]}
      contentContainerStyle={[
        styles.contentContainer,
        messages.length === 0 && styles.emptyContent,
      ]}
      showsVerticalScrollIndicator={true}
      // A card below the messages grew (a rating opened its feedback box,
      // a reply streamed in): kept in view while the visitor is at the end.
      onScroll={(e: any) => {
        const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
        atEndRef.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 160;
      }}
      scrollEventThrottle={100}
      onContentSizeChange={() => {
        if (atEndRef.current) flatListRef.current?.scrollToEnd({ animated: true });
      }}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={loading}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        ) : undefined
      }
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      windowSize={10}
      // Viewability tracking for read receipts
      onViewableItemsChanged={
        onVisibleMessagesChange ? handleViewableItemsChanged : undefined
      }
      viewabilityConfig={onVisibleMessagesChange ? viewabilityConfig : undefined}
      accessible={true}
      accessibilityLabel="Message list"
      accessibilityRole="list"
      testID={testID}
    />
  );
};

const createStyles = (theme: ConferBotTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      paddingVertical: theme.spacing.md,
      flexGrow: 1,
    },
    emptyContent: {
      justifyContent: 'center',
    },
    centerContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    receiptLine: {
      alignSelf: 'flex-end',
      marginRight: theme.spacing.chatContentPadding ?? theme.spacing.md,
      marginTop: -2,
      marginBottom: theme.spacing.xs,
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.textSecondary,
    },
    typingContainer: {
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
    },
  });

/** A bot's standalone image; one that does not load is not drawn (no empty box). */
const BotImage: React.FC<{ url: string; theme: ConferBotTheme; onSettled?: () => void }> = ({ url, theme, onSettled }) => {
  const [failed, setFailed] = React.useState(false);
  if (failed) return null;
  return (
    <View style={{
      paddingLeft: theme.layout.avatarSize + 10 + theme.spacing.chatContentPadding,
      paddingRight: theme.spacing.chatContentPadding,
      marginBottom: 8,
    }}>
      <Image
        source={{ uri: url }}
        style={{
          width: 220,
          maxWidth: '100%',
          height: 160,
          borderRadius: theme.borderRadius.bubble,
          backgroundColor: theme.colors.botBubble,
        }}
        resizeMode="cover"
        onLoad={() => onSettled?.()}
        onError={() => {
          setFailed(true);
          onSettled?.();
        }}
        accessible={true}
        accessibilityRole="image"
        accessibilityLabel="Image"
      />
    </View>
  );
};
