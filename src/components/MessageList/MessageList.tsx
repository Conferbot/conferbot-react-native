import React, { useRef, useEffect } from 'react';
import { FlatList, View, StyleSheet, RefreshControl } from 'react-native';
import { useTheme } from '../../theme';
import { MessageBubble } from '../MessageBubble';
import { TypingIndicator } from '../TypingIndicator';
import { EmptyState } from '../EmptyState';
import type { ConferBotTheme } from '../../theme/types';
import type { RecordItem } from '../../types';

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
 *
 * @example
 * ```tsx
 * <MessageList
 *   messages={record}
 *   showTypingIndicator={isAgentTyping}
 *   showTimestamps={true}
 *   onRefresh={() => loadMoreMessages()}
 *   onMessageLongPress={(msg) => showMessageActions(msg)}
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
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const flatListRef = useRef<any>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      // Small delay to ensure render is complete
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
    }
  }, [messages.length]);

  // Render individual message
  const renderMessage = ({ item }: { item: RecordItem }) => (
    <MessageBubble
      message={item}
      showAvatar={showAvatars}
      showTimestamp={showTimestamps}
      onPress={() => onMessagePress?.(item)}
      onLongPress={() => onMessageLongPress?.(item)}
      testID={`${testID}-message-${item._id}`}
    />
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
  const keyExtractor = (item: RecordItem) => item._id;

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
