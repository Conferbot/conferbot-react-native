// @ts-nocheck
import { useCallback, useState } from 'react';
import type { ConferBotUser, Reaction, ReactionEmoji } from '../../types';
import type ConferBotSocket from '../../services/socket';

interface UseReactionsParams {
  chatSessionId: string | undefined;
  user?: ConferBotUser;
  socketClient: React.MutableRefObject<ConferBotSocket | null>;
}

export function useReactions({ chatSessionId, user, socketClient }: UseReactionsParams) {
  const [reactions, setReactions] = useState<Map<string, Reaction[]>>(new Map());

  const addReaction = useCallback(
    (messageId: string, emoji: ReactionEmoji) => {
      if (!chatSessionId || !user) {
        console.warn('[ConferBot] Cannot add reaction: no active session or user');
        return;
      }

      const newReaction: Reaction = {
        emoji,
        userId: user.id,
        userName: user.name,
        timestamp: new Date().toISOString(),
      };

      setReactions((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(messageId) || [];
        const alreadyReacted = existing.some((r) => r.userId === user.id && r.emoji === emoji);
        if (!alreadyReacted) {
          newMap.set(messageId, [...existing, newReaction]);
        }
        return newMap;
      });

      if (socketClient.current?.isConnected()) {
        socketClient.current.sendMessageReaction(chatSessionId, messageId, emoji, 'add', user.name);
      }
    },
    [chatSessionId, user]
  );

  const removeReaction = useCallback(
    (messageId: string, emoji: ReactionEmoji) => {
      if (!chatSessionId || !user) {
        console.warn('[ConferBot] Cannot remove reaction: no active session or user');
        return;
      }

      setReactions((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(messageId) || [];
        const filtered = existing.filter((r) => !(r.userId === user.id && r.emoji === emoji));
        if (filtered.length > 0) {
          newMap.set(messageId, filtered);
        } else {
          newMap.delete(messageId);
        }
        return newMap;
      });

      if (socketClient.current?.isConnected()) {
        socketClient.current.sendMessageReaction(
          chatSessionId,
          messageId,
          emoji,
          'remove',
          user.name
        );
      }
    },
    [chatSessionId, user]
  );

  const getReactions = useCallback(
    (messageId: string): Reaction[] => {
      return reactions.get(messageId) || [];
    },
    [reactions]
  );

  return {
    reactions,
    setReactions,
    addReaction,
    removeReaction,
    getReactions,
  };
}
