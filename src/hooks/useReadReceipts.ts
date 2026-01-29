/**
 * useReadReceipts Hook
 *
 * Manages read receipt functionality including:
 * - Tracking message status
 * - Listening for status updates
 * - Batch marking messages as read
 * - Debounced read receipt sending
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type ConferBotSocket from '../services/socket';
import type { ChatState } from '../core/state/ChatState';
import {
  MessageStatus,
  MessageStatusEntry,
  ReadReceiptSocketEvents,
  ReadReceiptConfig,
  DEFAULT_READ_RECEIPT_CONFIG,
  type ReadReceiptData,
  type DeliveryReceiptData,
} from '../types/messageStatus';

// ========================================
// TYPES
// ========================================

export interface UseReadReceiptsOptions {
  /** Socket client instance */
  socket: ConferBotSocket | null;
  /** Chat state instance */
  chatState: ChatState | null;
  /** Chat session ID */
  chatSessionId?: string;
  /** Read receipt configuration */
  config?: Partial<ReadReceiptConfig>;
  /** Is the chat currently open/visible */
  isChatVisible?: boolean;
}

export interface UseReadReceiptsReturn {
  /** Map of message statuses by message ID */
  messageStatuses: Map<string | number, MessageStatusEntry>;
  /** Get status for a specific message */
  getMessageStatus: (messageId: string | number) => MessageStatus | undefined;
  /** Mark a specific message as read */
  markAsRead: (messageId: string | number) => void;
  /** Mark multiple messages as read */
  batchMarkAsRead: (messageIds: (string | number)[]) => void;
  /** Mark all visible messages as read */
  markVisibleMessagesAsRead: (visibleMessageIds: (string | number)[]) => void;
  /** Set message status to sending (when user sends) */
  setMessageSending: (messageId: string | number) => void;
  /** Is read receipts feature enabled */
  isEnabled: boolean;
}

// ========================================
// HOOK IMPLEMENTATION
// ========================================

export function useReadReceipts(
  options: UseReadReceiptsOptions
): UseReadReceiptsReturn {
  const { socket, chatState, chatSessionId, config, isChatVisible = true } = options;

  // Merge config with defaults
  const resolvedConfig: ReadReceiptConfig = {
    ...DEFAULT_READ_RECEIPT_CONFIG,
    ...config,
  };

  // State for message statuses (mirrors chatState for reactivity)
  const [messageStatuses, setMessageStatuses] = useState<Map<string | number, MessageStatusEntry>>(
    new Map()
  );

  // Debounce timer ref for batch read receipts
  const batchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const pendingReadIdsRef = useRef<Set<string | number>>(new Set());

  // ========================================
  // Sync message statuses from ChatState
  // ========================================
  useEffect(() => {
    if (!chatState) return;

    // Initial sync
    setMessageStatuses(chatState.getAllMessageStatuses());

    // Listen for changes
    const unsubscribe = chatState.addStatusListener((_messageId, _status) => {
      setMessageStatuses(chatState.getAllMessageStatuses());
    });

    return unsubscribe;
  }, [chatState]);

  // ========================================
  // Socket Event Listeners
  // ========================================
  useEffect(() => {
    if (!socket || !chatState || !resolvedConfig.enabled) return;

    // Message acknowledged (SENT status)
    const handleMessageAck = (data: { messageId: string | number }) => {
      chatState.setMessageSent(data.messageId);
    };

    // Message delivered
    const handleMessageDelivered = (data: DeliveryReceiptData) => {
      chatState.setMessageDelivered(
        data.messageId,
        typeof data.deliveredAt === 'string' ? data.deliveredAt : data.deliveredAt.toISOString()
      );
    };

    // Message read
    const handleMessageRead = (data: ReadReceiptData) => {
      chatState.setMessageRead(
        data.messageId,
        typeof data.readAt === 'string' ? data.readAt : data.readAt.toISOString(),
        data.readBy
      );
    };

    // Subscribe to socket events
    const unsubAck = socket.on(ReadReceiptSocketEvents.MESSAGE_ACK, handleMessageAck);
    const unsubDelivered = socket.on(ReadReceiptSocketEvents.MESSAGE_DELIVERED, handleMessageDelivered);
    const unsubRead = socket.on(ReadReceiptSocketEvents.MESSAGE_READ, handleMessageRead);

    return () => {
      unsubAck();
      unsubDelivered();
      unsubRead();
    };
  }, [socket, chatState, resolvedConfig.enabled]);

  // ========================================
  // Auto-mark messages as read when chat becomes visible
  // ========================================
  useEffect(() => {
    if (
      !chatState ||
      !socket ||
      !chatSessionId ||
      !isChatVisible ||
      !resolvedConfig.autoMarkAsRead ||
      !resolvedConfig.enabled
    ) {
      return;
    }

    // When chat becomes visible, mark all delivered messages as read
    const unreadIds = chatState.getUnreadMessageIds();
    if (unreadIds.length > 0) {
      // Use debounced batch marking
      unreadIds.forEach((id) => pendingReadIdsRef.current.add(id));
      debouncedBatchSend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChatVisible, chatSessionId, resolvedConfig.autoMarkAsRead, resolvedConfig.enabled]);

  // ========================================
  // Debounced batch send for read receipts
  // ========================================
  const debouncedBatchSend = useCallback(() => {
    if (batchDebounceRef.current) {
      clearTimeout(batchDebounceRef.current);
    }

    batchDebounceRef.current = setTimeout(() => {
      if (
        !socket ||
        !chatSessionId ||
        !chatState ||
        pendingReadIdsRef.current.size === 0
      ) {
        return;
      }

      const idsToSend = Array.from(pendingReadIdsRef.current);
      pendingReadIdsRef.current.clear();

      // Update local state first (optimistic)
      const now = new Date().toISOString();
      idsToSend.forEach((id) => {
        chatState.setMessageRead(id, now);
      });

      // Send to server
      socket.batchMarkMessagesAsRead(idsToSend, chatSessionId);

      if (__DEV__) {
        console.log('[useReadReceipts] Batch marked as read:', idsToSend.length);
      }
    }, resolvedConfig.batchDebounceMs);
  }, [socket, chatSessionId, chatState, resolvedConfig.batchDebounceMs]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (batchDebounceRef.current) {
        clearTimeout(batchDebounceRef.current);
      }
    };
  }, []);

  // ========================================
  // Public API
  // ========================================

  /**
   * Get status for a specific message
   */
  const getMessageStatus = useCallback(
    (messageId: string | number): MessageStatus | undefined => {
      return messageStatuses.get(messageId)?.status;
    },
    [messageStatuses]
  );

  /**
   * Mark a specific message as read
   */
  const markAsRead = useCallback(
    (messageId: string | number) => {
      if (!resolvedConfig.enabled || !chatState || !chatSessionId || !socket) {
        return;
      }

      const currentStatus = messageStatuses.get(messageId);
      if (currentStatus?.status === MessageStatus.READ) {
        return; // Already read
      }

      // Add to pending batch
      pendingReadIdsRef.current.add(messageId);
      debouncedBatchSend();
    },
    [resolvedConfig.enabled, chatState, chatSessionId, socket, messageStatuses, debouncedBatchSend]
  );

  /**
   * Mark multiple messages as read
   */
  const batchMarkAsRead = useCallback(
    (messageIds: (string | number)[]) => {
      if (!resolvedConfig.enabled || !chatState || !chatSessionId || !socket) {
        return;
      }

      const unreadIds = messageIds.filter((id) => {
        const status = messageStatuses.get(id);
        return !status || status.status !== MessageStatus.READ;
      });

      if (unreadIds.length === 0) return;

      // Add to pending batch
      unreadIds.forEach((id) => pendingReadIdsRef.current.add(id));
      debouncedBatchSend();
    },
    [resolvedConfig.enabled, chatState, chatSessionId, socket, messageStatuses, debouncedBatchSend]
  );

  /**
   * Mark visible messages as read (called by MessageList on scroll)
   */
  const markVisibleMessagesAsRead = useCallback(
    (visibleMessageIds: (string | number)[]) => {
      if (!isChatVisible || !resolvedConfig.autoMarkAsRead) {
        return;
      }
      batchMarkAsRead(visibleMessageIds);
    },
    [isChatVisible, resolvedConfig.autoMarkAsRead, batchMarkAsRead]
  );

  /**
   * Set message status to sending (called when user sends a message)
   */
  const setMessageSending = useCallback(
    (messageId: string | number) => {
      if (!chatState || !resolvedConfig.enabled) return;
      chatState.setMessageSending(messageId);
    },
    [chatState, resolvedConfig.enabled]
  );

  return {
    messageStatuses,
    getMessageStatus,
    markAsRead,
    batchMarkAsRead,
    markVisibleMessagesAsRead,
    setMessageSending,
    isEnabled: resolvedConfig.enabled && resolvedConfig.showIndicators,
  };
}

export default useReadReceipts;
