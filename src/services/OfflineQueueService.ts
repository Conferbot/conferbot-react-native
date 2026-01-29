/**
 * OfflineQueueService.ts
 *
 * Manages offline message queuing for Conferbot React Native SDK.
 * Handles message persistence, retry logic with exponential backoff,
 * and automatic sending when network connectivity is restored.
 */

import type { AsyncStorageInterface } from './StorageService';

// ========================================
// TYPES
// ========================================

/** Message status for queue items */
export type QueuedMessageStatus = 'pending' | 'sending' | 'sent' | 'failed';

/** Queued message structure */
export interface QueuedMessage {
  /** Unique identifier for the queued message */
  id: string;
  /** Chat session ID this message belongs to */
  chatSessionId: string;
  /** Type of socket event to emit */
  eventType: string;
  /** Payload data to send */
  payload: any;
  /** Timestamp when message was queued */
  queuedAt: string;
  /** Current status of the message */
  status: QueuedMessageStatus;
  /** Number of retry attempts */
  retryCount: number;
  /** Timestamp of last retry attempt */
  lastRetryAt?: string;
  /** Error message if failed */
  error?: string;
  /** Priority (lower number = higher priority) */
  priority: number;
}

/** Configuration for offline queue behavior */
export interface OfflineQueueConfig {
  /** Maximum number of messages to queue (default: 50) */
  maxQueueSize?: number;
  /** Maximum retry attempts per message (default: 5) */
  maxRetries?: number;
  /** Initial retry delay in ms (default: 1000) */
  initialRetryDelay?: number;
  /** Maximum retry delay in ms (default: 30000) */
  maxRetryDelay?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Storage key prefix (default: '@conferbot:queue') */
  keyPrefix?: string;
  /** Enable persistent storage (default: true) */
  persistQueue?: boolean;
  /** Auto-process queue when online (default: true) */
  autoProcess?: boolean;
}

/** Event types emitted by the queue service */
export type OfflineQueueEvent =
  | 'networkStatusChanged'
  | 'messageQueued'
  | 'messageStatusChanged'
  | 'messageSent'
  | 'messageFailed'
  | 'queueProcessingStarted'
  | 'queueProcessingComplete'
  | 'queueCleared';

/** Event listener callback */
export type OfflineQueueEventListener = (event: OfflineQueueEvent, data?: any) => void;

/** Network status callback for sending messages */
export type SendMessageCallback = (eventType: string, payload: any) => Promise<boolean>;

// ========================================
// CONSTANTS
// ========================================

const STORAGE_KEY_SUFFIX = 'offline_queue';
const DEFAULT_CONFIG: Required<OfflineQueueConfig> = {
  maxQueueSize: 50,
  maxRetries: 5,
  initialRetryDelay: 1000,
  maxRetryDelay: 30000,
  backoffMultiplier: 2,
  keyPrefix: '@conferbot',
  persistQueue: true,
  autoProcess: true,
};

// ========================================
// OFFLINE QUEUE SERVICE CLASS
// ========================================

/**
 * OfflineQueueService manages message queuing when the device is offline.
 * It handles persistence, retry logic, and automatic processing when back online.
 */
export class OfflineQueueService {
  private storage: AsyncStorageInterface | null = null;
  private config: Required<OfflineQueueConfig>;
  private botId: string;
  private queue: QueuedMessage[] = [];
  private listeners: Set<OfflineQueueEventListener> = new Set();
  private isOnline: boolean = true;
  private isProcessing: boolean = false;
  private sendMessageCallback: SendMessageCallback | null = null;
  private processingTimeout: ReturnType<typeof setTimeout> | null = null;
  private initialized: boolean = false;

  constructor(botId: string, config?: OfflineQueueConfig) {
    this.botId = botId;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ========================================
  // INITIALIZATION
  // ========================================

  /**
   * Initializes the offline queue service with AsyncStorage.
   *
   * @param asyncStorage - AsyncStorage instance
   * @param sendCallback - Callback function to send messages via socket
   */
  async initialize(
    asyncStorage: AsyncStorageInterface,
    sendCallback: SendMessageCallback
  ): Promise<void> {
    this.storage = asyncStorage;
    this.sendMessageCallback = sendCallback;
    this.initialized = true;

    // Load persisted queue
    if (this.config.persistQueue) {
      await this.loadQueue();
    }

    if (__DEV__) {
      console.log('[OfflineQueue] Initialized with', this.queue.length, 'queued messages');
    }
  }

  /**
   * Checks if the service is ready for operations.
   */
  isReady(): boolean {
    return this.initialized && this.sendMessageCallback !== null;
  }

  // ========================================
  // STORAGE KEY
  // ========================================

  /**
   * Gets the storage key for this bot's queue.
   */
  private getStorageKey(): string {
    return `${this.config.keyPrefix}:${this.botId}:${STORAGE_KEY_SUFFIX}`;
  }

  // ========================================
  // QUEUE OPERATIONS
  // ========================================

  /**
   * Adds a message to the offline queue.
   *
   * @param eventType - Socket event type
   * @param payload - Message payload
   * @param priority - Priority (lower = higher priority, default: 10)
   * @returns Queued message object
   */
  async queueMessage(
    eventType: string,
    payload: any,
    priority: number = 10
  ): Promise<QueuedMessage | null> {
    // Check queue size limit
    if (this.queue.length >= this.config.maxQueueSize) {
      if (__DEV__) {
        console.warn('[OfflineQueue] Queue is full, cannot add message');
      }
      return null;
    }

    const message: QueuedMessage = {
      id: this.generateMessageId(),
      chatSessionId: payload.chatSessionId || '',
      eventType,
      payload,
      queuedAt: new Date().toISOString(),
      status: 'pending',
      retryCount: 0,
      priority,
    };

    // Insert message in priority order (FIFO within same priority)
    const insertIndex = this.queue.findIndex((m) => m.priority > message.priority);
    if (insertIndex === -1) {
      this.queue.push(message);
    } else {
      this.queue.splice(insertIndex, 0, message);
    }

    // Persist queue
    await this.saveQueue();

    // Emit event
    this.emit('messageQueued', message);

    if (__DEV__) {
      console.log('[OfflineQueue] Message queued:', message.id, eventType);
    }

    // Process immediately if online and autoProcess is enabled
    if (this.isOnline && this.config.autoProcess && !this.isProcessing) {
      this.processQueue();
    }

    return message;
  }

  /**
   * Gets the current queue.
   */
  getQueue(): QueuedMessage[] {
    return [...this.queue];
  }

  /**
   * Gets the number of queued messages.
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Gets the number of pending messages.
   */
  getPendingCount(): number {
    return this.queue.filter((m) => m.status === 'pending').length;
  }

  /**
   * Gets a queued message by ID.
   */
  getMessage(id: string): QueuedMessage | undefined {
    return this.queue.find((m) => m.id === id);
  }

  /**
   * Removes a message from the queue by ID.
   */
  async removeMessage(id: string): Promise<boolean> {
    const index = this.queue.findIndex((m) => m.id === id);
    if (index === -1) return false;

    this.queue.splice(index, 1);
    await this.saveQueue();

    if (__DEV__) {
      console.log('[OfflineQueue] Message removed:', id);
    }

    return true;
  }

  /**
   * Clears all messages from the queue.
   */
  async clearQueue(): Promise<void> {
    this.queue = [];
    await this.saveQueue();
    this.emit('queueCleared');

    if (__DEV__) {
      console.log('[OfflineQueue] Queue cleared');
    }
  }

  /**
   * Clears failed messages from the queue.
   */
  async clearFailedMessages(): Promise<number> {
    const failedCount = this.queue.filter((m) => m.status === 'failed').length;
    this.queue = this.queue.filter((m) => m.status !== 'failed');
    await this.saveQueue();

    if (__DEV__) {
      console.log('[OfflineQueue] Cleared', failedCount, 'failed messages');
    }

    return failedCount;
  }

  /**
   * Retries a specific failed message.
   */
  async retryMessage(id: string): Promise<boolean> {
    const message = this.queue.find((m) => m.id === id);
    if (!message || message.status !== 'failed') return false;

    message.status = 'pending';
    message.retryCount = 0;
    message.error = undefined;
    await this.saveQueue();

    // Process immediately if online
    if (this.isOnline && this.config.autoProcess && !this.isProcessing) {
      this.processQueue();
    }

    return true;
  }

  /**
   * Retries all failed messages.
   */
  async retryAllFailed(): Promise<number> {
    let count = 0;
    for (const message of this.queue) {
      if (message.status === 'failed') {
        message.status = 'pending';
        message.retryCount = 0;
        message.error = undefined;
        count++;
      }
    }

    if (count > 0) {
      await this.saveQueue();

      // Process immediately if online
      if (this.isOnline && this.config.autoProcess && !this.isProcessing) {
        this.processQueue();
      }
    }

    return count;
  }

  // ========================================
  // NETWORK STATUS
  // ========================================

  /**
   * Updates the network status.
   *
   * @param isOnline - Whether the device is online
   */
  async setNetworkStatus(isOnline: boolean): Promise<void> {
    const wasOffline = !this.isOnline;
    this.isOnline = isOnline;

    this.emit('networkStatusChanged', { isOnline });

    if (__DEV__) {
      console.log('[OfflineQueue] Network status:', isOnline ? 'online' : 'offline');
    }

    // Process queue when coming back online
    if (isOnline && wasOffline && this.config.autoProcess && !this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Gets the current network status.
   */
  getNetworkStatus(): boolean {
    return this.isOnline;
  }

  // ========================================
  // QUEUE PROCESSING
  // ========================================

  /**
   * Processes the queue, sending pending messages.
   */
  async processQueue(): Promise<void> {
    if (!this.isReady() || !this.isOnline || this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.emit('queueProcessingStarted');

    if (__DEV__) {
      console.log('[OfflineQueue] Processing queue, size:', this.queue.length);
    }

    try {
      // Get pending messages (already sorted by priority)
      const pendingMessages = this.queue.filter((m) => m.status === 'pending');

      for (const message of pendingMessages) {
        // Check if still online
        if (!this.isOnline) {
          if (__DEV__) {
            console.log('[OfflineQueue] Went offline during processing, stopping');
          }
          break;
        }

        await this.processMessage(message);
      }
    } finally {
      this.isProcessing = false;
      this.emit('queueProcessingComplete');
    }
  }

  /**
   * Processes a single message from the queue.
   */
  private async processMessage(message: QueuedMessage): Promise<void> {
    if (!this.sendMessageCallback) return;

    // Update status to sending
    message.status = 'sending';
    message.lastRetryAt = new Date().toISOString();
    this.emit('messageStatusChanged', { message, status: 'sending' });
    await this.saveQueue();

    try {
      const success = await this.sendMessageCallback(message.eventType, message.payload);

      if (success) {
        // Message sent successfully - remove from queue
        message.status = 'sent';
        this.emit('messageSent', message);

        // Remove from queue
        const index = this.queue.findIndex((m) => m.id === message.id);
        if (index !== -1) {
          this.queue.splice(index, 1);
        }

        await this.saveQueue();

        if (__DEV__) {
          console.log('[OfflineQueue] Message sent:', message.id);
        }
      } else {
        throw new Error('Send callback returned false');
      }
    } catch (error) {
      await this.handleMessageFailure(message, error);
    }
  }

  /**
   * Handles a message send failure with retry logic.
   */
  private async handleMessageFailure(message: QueuedMessage, error: unknown): Promise<void> {
    message.retryCount++;
    message.error = error instanceof Error ? error.message : String(error);

    if (message.retryCount >= this.config.maxRetries) {
      // Max retries reached - mark as failed
      message.status = 'failed';
      this.emit('messageFailed', { message, error: message.error });

      if (__DEV__) {
        console.warn('[OfflineQueue] Message failed permanently:', message.id, message.error);
      }
    } else {
      // Schedule retry with exponential backoff
      message.status = 'pending';

      const delay = this.calculateRetryDelay(message.retryCount);

      if (__DEV__) {
        console.log(
          '[OfflineQueue] Message retry scheduled:',
          message.id,
          'attempt:',
          message.retryCount,
          'delay:',
          delay
        );
      }

      // Schedule next retry
      if (this.processingTimeout) {
        clearTimeout(this.processingTimeout);
      }
      this.processingTimeout = setTimeout(() => {
        if (this.isOnline && !this.isProcessing) {
          this.processQueue();
        }
      }, delay);
    }

    this.emit('messageStatusChanged', { message, status: message.status });
    await this.saveQueue();
  }

  /**
   * Calculates retry delay using exponential backoff.
   */
  private calculateRetryDelay(retryCount: number): number {
    const delay = this.config.initialRetryDelay * Math.pow(this.config.backoffMultiplier, retryCount - 1);
    return Math.min(delay, this.config.maxRetryDelay);
  }

  // ========================================
  // PERSISTENCE
  // ========================================

  /**
   * Loads the queue from storage.
   */
  private async loadQueue(): Promise<void> {
    if (!this.storage) return;

    try {
      const data = await this.storage.getItem(this.getStorageKey());
      if (data) {
        const parsed = JSON.parse(data);
        this.queue = Array.isArray(parsed) ? parsed : [];

        // Reset any 'sending' status to 'pending' (interrupted sends)
        for (const message of this.queue) {
          if (message.status === 'sending') {
            message.status = 'pending';
          }
        }

        if (__DEV__) {
          console.log('[OfflineQueue] Queue loaded:', this.queue.length, 'messages');
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[OfflineQueue] Failed to load queue:', error);
      }
      this.queue = [];
    }
  }

  /**
   * Saves the queue to storage.
   */
  private async saveQueue(): Promise<void> {
    if (!this.storage || !this.config.persistQueue) return;

    try {
      await this.storage.setItem(this.getStorageKey(), JSON.stringify(this.queue));
    } catch (error) {
      if (__DEV__) {
        console.error('[OfflineQueue] Failed to save queue:', error);
      }
    }
  }

  // ========================================
  // EVENT LISTENERS
  // ========================================

  /**
   * Adds an event listener.
   */
  on(listener: OfflineQueueEventListener): () => void {
    this.listeners.add(listener);
    return () => this.off(listener);
  }

  /**
   * Removes an event listener.
   */
  off(listener: OfflineQueueEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Emits an event to all listeners.
   */
  private emit(event: OfflineQueueEvent, data?: any): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event, data);
      } catch (error) {
        if (__DEV__) {
          console.error('[OfflineQueue] Listener error:', error);
        }
      }
    });
  }

  // ========================================
  // UTILITIES
  // ========================================

  /**
   * Generates a unique message ID.
   */
  private generateMessageId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `msg_${timestamp}_${random}`;
  }

  /**
   * Checks if a message with the given payload already exists in the queue.
   * Useful for deduplication.
   */
  hasMessage(eventType: string, payload: any): boolean {
    return this.queue.some(
      (m) =>
        m.eventType === eventType &&
        JSON.stringify(m.payload) === JSON.stringify(payload)
    );
  }

  /**
   * Gets queue statistics.
   */
  getStats(): {
    total: number;
    pending: number;
    sending: number;
    failed: number;
    isOnline: boolean;
    isProcessing: boolean;
  } {
    return {
      total: this.queue.length,
      pending: this.queue.filter((m) => m.status === 'pending').length,
      sending: this.queue.filter((m) => m.status === 'sending').length,
      failed: this.queue.filter((m) => m.status === 'failed').length,
      isOnline: this.isOnline,
      isProcessing: this.isProcessing,
    };
  }

  /**
   * Destroys the service and clears timeouts.
   */
  destroy(): void {
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
      this.processingTimeout = null;
    }
    this.listeners.clear();
    this.sendMessageCallback = null;
    this.initialized = false;

    if (__DEV__) {
      console.log('[OfflineQueue] Service destroyed');
    }
  }
}

export default OfflineQueueService;
