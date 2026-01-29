import React, { useRef, useEffect, useCallback } from 'react';
import {
  FlatList,
  View,
  StyleSheet,
  RefreshControl,
  ViewToken,
} from 'react-native';
import { useTheme } from '../../theme';
import { MessageBubble } from '../MessageBubble';
import { TypingIndicator } from '../TypingIndicator';
import { EmptyState } from '../EmptyState';
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
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const flatListRef = useRef<any>(null);
  const visibleMessageIdsRef = useRef<Set<string | number>>(new Set());

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      // Small delay to ensure render is complete
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
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

  // Render individual message
  const renderMessage = useCallback(
    ({ item }: { item: RecordItem }) => {
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
    ]
  );

  // Render typing indicator as list header (appears at bottom since list is inverted)
  const renderListHeader = () => {
    if (!showTypingIndicator) return null;
    return (
      <View style={styles.typingContainer}>
        <TypingIndicator visible={true} />
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
      ListHeaderComponent={renderListHeader}
      ListEmptyComponent={renderEmpty}
      inverted={true} // Messages appear from bottom to top
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
