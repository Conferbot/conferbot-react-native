/**
 * Message Status Types for Read Receipts and Offline Queue
 *
 * Provides status tracking for messages from queued (offline) to read.
 */

// ========================================
// MESSAGE STATUS ENUM
// ========================================

/**
 * Enum representing the delivery status of a message
 */
export enum MessageStatus {
  /** Message is queued offline, waiting for network connectivity */
  PENDING = 'pending',
  /** Message is being sent to the server */
  SENDING = 'sending',
  /** Message has been acknowledged by the server */
  SENT = 'sent',
  /** Message has been delivered to the recipient */
  DELIVERED = 'delivered',
  /** Message has been read by the recipient */
  READ = 'read',
  /** Message failed to send after all retries */
  FAILED = 'failed',
}

// ========================================
// MESSAGE STATUS INTERFACES
// ========================================

/**
 * Read receipt data received from the server
 */
export interface ReadReceiptData {
  /** ID of the message that was read */
  messageId: string | number;
  /** ID of the chat session */
  chatSessionId: string;
  /** Timestamp when the message was read */
  readAt: string | Date;
  /** Who read the message (agent or bot) */
  readBy?: 'agent' | 'bot';
  /** Agent details if read by agent */
  agentDetails?: {
    _id: string;
    name: string;
    email?: string;
  };
}

/**
 * Delivery receipt data received from the server
 */
export interface DeliveryReceiptData {
  /** ID of the message that was delivered */
  messageId: string | number;
  /** ID of the chat session */
  chatSessionId: string;
  /** Timestamp when the message was delivered */
  deliveredAt: string | Date;
}

/**
 * Batch read receipt data for marking multiple messages as read
 */
export interface BatchReadReceiptPayload {
  /** IDs of messages to mark as read */
  messageIds: (string | number)[];
  /** ID of the chat session */
  chatSessionId: string;
  /** Timestamp when messages were viewed */
  viewedAt?: string | Date;
}

/**
 * Message status entry stored in state
 */
export interface MessageStatusEntry {
  /** Current status of the message */
  status: MessageStatus;
  /** Timestamp when status was last updated */
  updatedAt: string;
  /** Timestamp when message was queued (for offline messages) */
  queuedAt?: string;
  /** Timestamp when message was sent */
  sentAt?: string;
  /** Timestamp when message was delivered */
  deliveredAt?: string;
  /** Timestamp when message was read */
  readAt?: string;
  /** Who read the message */
  readBy?: 'agent' | 'bot';
  /** Number of send attempts (for offline queue) */
  retryCount?: number;
  /** Error message if failed */
  error?: string;
  /** ID of the queued message (for offline tracking) */
  queuedMessageId?: string;
}

/**
 * Configuration options for read receipts
 */
export interface ReadReceiptConfig {
  /** Enable or disable read receipts feature */
  enabled: boolean;
  /** Show read receipt indicators in UI */
  showIndicators: boolean;
  /** Debounce time in ms for batching read receipts */
  batchDebounceMs: number;
  /** Automatically mark messages as read when viewed */
  autoMarkAsRead: boolean;
}

/**
 * Default read receipt configuration
 */
export const DEFAULT_READ_RECEIPT_CONFIG: ReadReceiptConfig = {
  enabled: true,
  showIndicators: true,
  batchDebounceMs: 500,
  autoMarkAsRead: true,
};

// ========================================
// SOCKET EVENT NAMES FOR READ RECEIPTS
// ========================================

/**
 * Socket event names for read receipt functionality
 */
export const ReadReceiptSocketEvents = {
  /** Client -> Server: Mark messages as read */
  MARK_AS_READ: 'message:mark-read',
  /** Server -> Client: Message was delivered */
  MESSAGE_DELIVERED: 'message:delivered',
  /** Server -> Client: Message was read */
  MESSAGE_READ: 'message:read',
  /** Client -> Server: Batch mark messages as read */
  BATCH_MARK_AS_READ: 'message:batch-mark-read',
  /** Server -> Client: Acknowledge message sent */
  MESSAGE_ACK: 'message:ack',
} as const;

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Check if a status is "final" (delivered or read)
 */
export function isStatusFinal(status: MessageStatus): boolean {
  return status === MessageStatus.DELIVERED || status === MessageStatus.READ;
}

/**
 * Check if a status indicates the message was successfully sent
 */
export function isStatusSent(status: MessageStatus): boolean {
  return (
    status === MessageStatus.SENT ||
    status === MessageStatus.DELIVERED ||
    status === MessageStatus.READ
  );
}

/**
 * Check if a status indicates the message is still pending
 */
export function isStatusPending(status: MessageStatus): boolean {
  return status === MessageStatus.PENDING || status === MessageStatus.SENDING;
}

/**
 * Check if status A is more advanced than status B
 */
export function isStatusMoreAdvanced(
  statusA: MessageStatus,
  statusB: MessageStatus
): boolean {
  const order = {
    [MessageStatus.FAILED]: -1,
    [MessageStatus.PENDING]: 0,
    [MessageStatus.SENDING]: 1,
    [MessageStatus.SENT]: 2,
    [MessageStatus.DELIVERED]: 3,
    [MessageStatus.READ]: 4,
  };
  return order[statusA] > order[statusB];
}

/**
 * Get the next status in the progression
 */
export function getNextStatus(current: MessageStatus): MessageStatus | null {
  switch (current) {
    case MessageStatus.PENDING:
      return MessageStatus.SENDING;
    case MessageStatus.SENDING:
      return MessageStatus.SENT;
    case MessageStatus.SENT:
      return MessageStatus.DELIVERED;
    case MessageStatus.DELIVERED:
      return MessageStatus.READ;
    case MessageStatus.READ:
      return null;
    case MessageStatus.FAILED:
      return MessageStatus.PENDING; // Can retry
  }
}

/**
 * Convert queued message status to MessageStatus enum
 */
export function queuedStatusToMessageStatus(
  queuedStatus: 'pending' | 'sending' | 'sent' | 'failed'
): MessageStatus {
  switch (queuedStatus) {
    case 'pending':
      return MessageStatus.PENDING;
    case 'sending':
      return MessageStatus.SENDING;
    case 'sent':
      return MessageStatus.SENT;
    case 'failed':
      return MessageStatus.FAILED;
  }
}

/**
 * Get human-readable status text
 */
export function getStatusText(status: MessageStatus): string {
  switch (status) {
    case MessageStatus.PENDING:
      return 'Pending';
    case MessageStatus.SENDING:
      return 'Sending...';
    case MessageStatus.SENT:
      return 'Sent';
    case MessageStatus.DELIVERED:
      return 'Delivered';
    case MessageStatus.READ:
      return 'Read';
    case MessageStatus.FAILED:
      return 'Failed';
  }
}
