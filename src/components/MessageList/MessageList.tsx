// @ts-nocheck
import React, { useRef, useEffect, useCallback } from 'react';
import {
  FlatList,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ViewToken,
} from 'react-native';
import { useTheme } from '../../theme';
import { MessageBubble } from '../MessageBubble';
import { TypingIndicator } from '../TypingIndicator';
import { Avatar } from '../Avatar';
import { EmptyState } from '../EmptyState';
import { NodeRenderer } from '../NodeComponents';
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
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const flatListRef = useRef<any>(null);
  const visibleMessageIdsRef = useRef<Set<string | number>>(new Set());

  // Auto-scroll to end when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

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

  // Render individual message
  const renderMessage = useCallback(
    ({ item }: { item: RecordItem }) => {
      // Handle frozen choice buttons (submitted choice nodes)
      if ((item as any).shape === 'bot-choice-buttons') {
        return renderFrozenChoiceButtons(item);
      }

      const messageId = item._id;
      const messageReactions = getMessageReactions(item._id);
      const messageStatus = getMessageStatus(item._id);

      // Only show read receipts for user messages
      const isUserMessage =
        item.type === 'user-message' || item.type === 'user-input-response';
      const shouldShowReceipt =
        showReadReceipts && isUserMessage && messageStatus !== undefined;

      return (
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
    ]
  );

  // Render list footer: inline interactive node + typing indicator
  const renderListFooter = () => {
    const hasNode = !!activeNodeUI && !!onNodeSubmit;
    const hasTyping = showTypingIndicator;
    if (!hasNode && !hasTyping) return null;
    return (
      <View>
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
              <Avatar name="Bot" size={32} />
              <TypingIndicator visible={true} />
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
      ListFooterComponent={renderListFooter}
      ListEmptyComponent={renderEmpty}
      style={styles.container}
      contentContainerStyle={[
        styles.contentContainer,
        messages.length === 0 && styles.emptyContent,
      ]}
      showsVerticalScrollIndicator={true}
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
    typingContainer: {
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
    },
  });
