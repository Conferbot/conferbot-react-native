// @ts-nocheck
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  FlatList,
  Animated,
} from 'react-native';
import { useTheme } from '../../theme';
import type { ConferBotTheme } from '../../theme/types';
import type { Reaction, ReactionEmoji, ReactionGroup } from '../../types';

/**
 * MessageReactions Props
 *
 * @interface MessageReactionsProps
 * @property {Reaction[]} reactions - Array of reactions on the message
 * @property {string} currentUserId - Current user's ID to highlight their reactions
 * @property {(emoji: ReactionEmoji) => void} onReactionPress - Callback when reaction is tapped
 * @property {boolean} [isUserMessage=false] - Whether this is a user's own message
 * @property {string} [testID] - Test identifier
 *
 * @example
 * ```tsx
 * <MessageReactions
 *   reactions={messageReactions}
 *   currentUserId={userId}
 *   onReactionPress={(emoji) => toggleReaction(messageId, emoji)}
 *   isUserMessage={false}
 * />
 * ```
 */
export interface MessageReactionsProps {
  reactions: Reaction[];
  currentUserId: string;
  onReactionPress: (emoji: ReactionEmoji) => void;
  isUserMessage?: boolean;
  testID?: string;
}

/**
 * MessageReactions Component
 *
 * Displays emoji reactions on messages with counts and user information.
 *
 * Features:
 * - Grouped reactions with counts
 * - Tap to add/remove same reaction
 * - Show who reacted (modal on long press)
 * - Visual highlight for user's own reactions
 * - Animated reaction addition
 *
 * @component
 */
export const MessageReactions: React.FC<MessageReactionsProps> = ({
  reactions,
  currentUserId,
  onReactionPress,
  isUserMessage = false,
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  // State for reaction details modal
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedReactionGroup, setSelectedReactionGroup] = useState<ReactionGroup | null>(null);

  // Group reactions by emoji
  const reactionGroups: ReactionGroup[] = useMemo(() => {
    const groups = new Map<ReactionEmoji, ReactionGroup>();

    reactions.forEach((reaction) => {
      const existing = groups.get(reaction.emoji);
      if (existing) {
        existing.count += 1;
        existing.users.push({
          userId: reaction.userId,
          userName: reaction.userName,
        });
        if (reaction.userId === currentUserId) {
          existing.hasUserReacted = true;
        }
      } else {
        groups.set(reaction.emoji, {
          emoji: reaction.emoji,
          count: 1,
          users: [{ userId: reaction.userId, userName: reaction.userName }],
          hasUserReacted: reaction.userId === currentUserId,
        });
      }
    });

    return Array.from(groups.values());
  }, [reactions, currentUserId]);

  // Handle reaction press - toggle reaction
  const handleReactionPress = useCallback(
    (emoji: ReactionEmoji) => {
      onReactionPress(emoji);
    },
    [onReactionPress]
  );

  // Handle long press - show who reacted
  const handleReactionLongPress = useCallback((group: ReactionGroup) => {
    setSelectedReactionGroup(group);
    setShowDetailsModal(true);
  }, []);

  // Close details modal
  const closeDetailsModal = useCallback(() => {
    setShowDetailsModal(false);
    setSelectedReactionGroup(null);
  }, []);

  // Render individual reaction user in modal
  const renderReactionUser = ({
    item,
  }: {
    item: { userId: string; userName?: string };
  }) => (
    <View style={styles.reactionUserItem}>
      <View style={styles.userAvatar}>
        <Text style={styles.userAvatarText}>
          {(item.userName || 'U').charAt(0).toUpperCase()}
        </Text>
      </View>
      <Text style={styles.userName}>
        {item.userName || (item.userId === currentUserId ? 'You' : 'User')}
        {item.userId === currentUserId && item.userName ? ' (You)' : ''}
      </Text>
    </View>
  );

  // Don't render if no reactions
  if (reactionGroups.length === 0) {
    return null;
  }

  return (
    <>
      <View
        style={[
          styles.container,
          isUserMessage ? styles.containerUser : styles.containerBot,
        ]}
        testID={testID}
      >
        {reactionGroups.map((group) => (
          <TouchableOpacity
            key={group.emoji}
            style={[
              styles.reactionBadge,
              group.hasUserReacted && styles.reactionBadgeSelected,
            ]}
            onPress={() => handleReactionPress(group.emoji)}
            onLongPress={() => handleReactionLongPress(group)}
            activeOpacity={0.7}
            delayLongPress={300}
            accessible={true}
            accessibilityLabel={`${group.emoji} reaction, ${group.count} ${
              group.count === 1 ? 'person' : 'people'
            }${group.hasUserReacted ? ', you reacted' : ''}`}
            accessibilityRole="button"
            accessibilityHint="Tap to toggle reaction, long press to see who reacted"
            testID={`${testID}-reaction-${group.emoji}`}
          >
            <Text style={styles.reactionEmoji}>{group.emoji}</Text>
            <Text
              style={[
                styles.reactionCount,
                group.hasUserReacted && styles.reactionCountSelected,
              ]}
            >
              {group.count}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Reaction Details Modal */}
      <Modal
        visible={showDetailsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeDetailsModal}
        testID={`${testID}-details-modal`}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeDetailsModal}>
          <View style={styles.modalContent}>
            {selectedReactionGroup && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalEmoji}>{selectedReactionGroup.emoji}</Text>
                  <Text style={styles.modalTitle}>
                    {selectedReactionGroup.count}{' '}
                    {selectedReactionGroup.count === 1 ? 'Reaction' : 'Reactions'}
                  </Text>
                </View>
                <FlatList
                  data={selectedReactionGroup.users}
                  renderItem={renderReactionUser}
                  keyExtractor={(item) => item.userId}
                  style={styles.userList}
                  showsVerticalScrollIndicator={false}
                />
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const createStyles = (theme: ConferBotTheme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
      marginTop: theme.spacing.xs,
    },
    containerUser: {
      justifyContent: 'flex-end',
    },
    containerBot: {
      justifyContent: 'flex-start',
    },
    reactionBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.full,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderWidth: 1,
      borderColor: theme.colors.borderLight,
      ...theme.shadows.sm,
    },
    reactionBadgeSelected: {
      backgroundColor: theme.colors.primaryLight + '20',
      borderColor: theme.colors.primary,
    },
    reactionEmoji: {
      fontSize: 14,
      marginRight: theme.spacing.xs,
    },
    reactionCount: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.textSecondary,
      fontWeight: theme.typography.fontWeight.medium,
    },
    reactionCountSelected: {
      color: theme.colors.primary,
    },
    // Modal styles
    modalBackdrop: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.lg,
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      minWidth: 250,
      maxWidth: 300,
      maxHeight: 400,
      ...theme.shadows.xl,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.divider,
    },
    modalEmoji: {
      fontSize: 32,
      marginRight: theme.spacing.sm,
    },
    modalTitle: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.text,
    },
    userList: {
      maxHeight: 300,
    },
    reactionUserItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
    },
    userAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.spacing.sm,
    },
    userAvatarText: {
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textInverse,
    },
    userName: {
      fontSize: theme.typography.fontSize.md,
      color: theme.colors.text,
    },
  });
