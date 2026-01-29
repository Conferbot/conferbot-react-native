import { useCallback, useMemo } from 'react';
import { useConferBot } from '../context/ConferBotContext';
import type { Reaction, ReactionEmoji, ReactionGroup } from '../types';

/**
 * useReactions Hook
 *
 * A custom hook for managing message reactions in the Conferbot SDK.
 * Provides convenient methods for adding, removing, and toggling reactions,
 * as well as helpers for rendering grouped reactions.
 *
 * @returns {UseReactionsReturn} Reaction state and action handlers
 *
 * @example
 * ```tsx
 * const { reactions, addReaction, removeReaction, toggleReaction, getGroupedReactions } = useReactions();
 *
 * // Toggle a reaction on a message
 * const handleReaction = (messageId: string, emoji: ReactionEmoji) => {
 *   toggleReaction(messageId, emoji);
 * };
 *
 * // Get grouped reactions for display
 * const groups = getGroupedReactions(messageId);
 * ```
 */
export interface UseReactionsReturn {
  /** All reactions map (messageId -> Reaction[]) */
  reactions: Map<string, Reaction[]>;

  /** Add a reaction to a message */
  addReaction: (messageId: string, emoji: ReactionEmoji) => void;

  /** Remove a reaction from a message */
  removeReaction: (messageId: string, emoji: ReactionEmoji) => void;

  /** Toggle a reaction (add if not present, remove if present) */
  toggleReaction: (messageId: string, emoji: ReactionEmoji) => void;

  /** Get reactions for a specific message */
  getReactions: (messageId: string) => Reaction[];

  /** Get grouped reactions for a message (for display) */
  getGroupedReactions: (messageId: string) => ReactionGroup[];

  /** Check if current user has reacted with a specific emoji */
  hasUserReacted: (messageId: string, emoji: ReactionEmoji) => boolean;

  /** Get total reaction count for a message */
  getReactionCount: (messageId: string) => number;

  /** Current user ID */
  currentUserId: string | undefined;
}

/**
 * Hook for managing message reactions
 */
export function useReactions(): UseReactionsReturn {
  const context = useConferBot();

  const {
    reactions,
    addReaction: contextAddReaction,
    removeReaction: contextRemoveReaction,
    getReactions: contextGetReactions,
  } = context;

  // Get current user ID from chat state or context
  const currentUserId = context.chatState?.getUserMetadata()?.userId || undefined;

  // Add reaction wrapper
  const addReaction = useCallback(
    (messageId: string, emoji: ReactionEmoji) => {
      contextAddReaction(messageId, emoji);
    },
    [contextAddReaction]
  );

  // Remove reaction wrapper
  const removeReaction = useCallback(
    (messageId: string, emoji: ReactionEmoji) => {
      contextRemoveReaction(messageId, emoji);
    },
    [contextRemoveReaction]
  );

  // Toggle reaction (add if not present, remove if present)
  const toggleReaction = useCallback(
    (messageId: string, emoji: ReactionEmoji) => {
      const messageReactions = contextGetReactions(messageId);
      const hasReacted = messageReactions.some(
        (r) => r.userId === currentUserId && r.emoji === emoji
      );

      if (hasReacted) {
        contextRemoveReaction(messageId, emoji);
      } else {
        contextAddReaction(messageId, emoji);
      }
    },
    [contextGetReactions, contextAddReaction, contextRemoveReaction, currentUserId]
  );

  // Get reactions for a message
  const getReactions = useCallback(
    (messageId: string): Reaction[] => {
      return contextGetReactions(messageId);
    },
    [contextGetReactions]
  );

  // Get grouped reactions for display
  const getGroupedReactions = useCallback(
    (messageId: string): ReactionGroup[] => {
      const messageReactions = contextGetReactions(messageId);
      const groups = new Map<ReactionEmoji, ReactionGroup>();

      messageReactions.forEach((reaction) => {
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
    },
    [contextGetReactions, currentUserId]
  );

  // Check if current user has reacted with a specific emoji
  const hasUserReacted = useCallback(
    (messageId: string, emoji: ReactionEmoji): boolean => {
      if (!currentUserId) return false;
      const messageReactions = contextGetReactions(messageId);
      return messageReactions.some(
        (r) => r.userId === currentUserId && r.emoji === emoji
      );
    },
    [contextGetReactions, currentUserId]
  );

  // Get total reaction count for a message
  const getReactionCount = useCallback(
    (messageId: string): number => {
      return contextGetReactions(messageId).length;
    },
    [contextGetReactions]
  );

  return {
    reactions,
    addReaction,
    removeReaction,
    toggleReaction,
    getReactions,
    getGroupedReactions,
    hasUserReacted,
    getReactionCount,
    currentUserId,
  };
}

export default useReactions;
