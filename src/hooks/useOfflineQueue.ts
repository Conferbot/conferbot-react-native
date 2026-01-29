/**
 * useOfflineQueue.ts
 *
 * React hook for managing offline message queue functionality.
 * Provides easy integration with the OfflineQueueService and
 * network status monitoring.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  OfflineQueueService,
  QueuedMessage,
  OfflineQueueConfig,
  OfflineQueueEvent,
} from '../services/OfflineQueueService';
import type { AsyncStorageInterface } from '../services/StorageService';

// ========================================
// TYPES
// ========================================

/** Configuration options for the hook */
export interface UseOfflineQueueOptions {
  /** Bot ID for storage namespacing */
  botId: string;
  /** AsyncStorage instance */
  asyncStorage?: AsyncStorageInterface;
  /** Callback to send messages via socket */
  sendMessage?: (eventType: string, payload: any) => Promise<boolean>;
  /** Queue configuration */
  config?: OfflineQueueConfig;
  /** Callback when network status changes */
  onNetworkStatusChange?: (isOnline: boolean) => void;
  /** Callback when a message is sent successfully */
  onMessageSent?: (message: QueuedMessage) => void;
  /** Callback when a message fails permanently */
  onMessageFailed?: (message: QueuedMessage, error: string) => void;
}

/** Return value from the hook */
export interface UseOfflineQueueReturn {
  /** Whether the device is currently online */
  isOnline: boolean;
  /** Whether the service is initialized and ready */
  isReady: boolean;
  /** Current message queue */
  queue: QueuedMessage[];
  /** Number of messages in queue */
  queueSize: number;
  /** Number of pending (unsent) messages */
  pendingCount: number;
  /** Number of failed messages */
  failedCount: number;
  /** Whether queue is currently processing */
  isProcessing: boolean;
  /** Add a message to the queue */
  queueMessage: (eventType: string, payload: any, priority?: number) => Promise<QueuedMessage | null>;
  /** Get a queued message by ID */
  getMessage: (id: string) => QueuedMessage | undefined;
  /** Remove a message from queue */
  removeMessage: (id: string) => Promise<boolean>;
  /** Clear entire queue */
  clearQueue: () => Promise<void>;
  /** Clear only failed messages */
  clearFailedMessages: () => Promise<number>;
  /** Retry a specific failed message */
  retryMessage: (id: string) => Promise<boolean>;
  /** Retry all failed messages */
  retryAllFailed: () => Promise<number>;
  /** Manually update network status */
  setNetworkStatus: (isOnline: boolean) => Promise<void>;
  /** Manually trigger queue processing */
  processQueue: () => Promise<void>;
  /** Initialize the service (call with asyncStorage and sendMessage) */
  initialize: (
    asyncStorage: AsyncStorageInterface,
    sendMessage: (eventType: string, payload: any) => Promise<boolean>
  ) => Promise<void>;
}

// ========================================
// HOOK IMPLEMENTATION
// ========================================

/**
 * Hook for managing offline message queue.
 *
 * @example
 * ```tsx
 * function ChatComponent() {
 *   const {
 *     isOnline,
 *     queueSize,
 *     queueMessage,
 *     retryAllFailed,
 *   } = useOfflineQueue({
 *     botId: 'my-bot-id',
 *     asyncStorage: AsyncStorage,
 *     sendMessage: async (eventType, payload) => {
 *       return socket.emit(eventType, payload);
 *     },
 *     onMessageSent: (msg) => console.log('Sent:', msg.id),
 *     onMessageFailed: (msg, err) => console.error('Failed:', msg.id, err),
 *   });
 *
 *   const handleSend = async (text: string) => {
 *     if (!isOnline) {
 *       await queueMessage('response-record', { text });
 *     } else {
 *       // Direct send
 *     }
 *   };
 *
 *   return (
 *     <View>
 *       {!isOnline && <Text>Offline - {queueSize} messages queued</Text>}
 *     </View>
 *   );
 * }
 * ```
 */
export function useOfflineQueue(
  options: UseOfflineQueueOptions
): UseOfflineQueueReturn {
  const {
    botId,
    asyncStorage: initialAsyncStorage,
    sendMessage: initialSendMessage,
    config,
    onNetworkStatusChange,
    onMessageSent,
    onMessageFailed,
  } = options;

  // State
  const [isOnline, setIsOnline] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Refs
  const serviceRef = useRef<OfflineQueueService | null>(null);
  const callbacksRef = useRef({
    onNetworkStatusChange,
    onMessageSent,
    onMessageFailed,
  });

  // Keep callbacks ref up to date
  useEffect(() => {
    callbacksRef.current = {
      onNetworkStatusChange,
      onMessageSent,
      onMessageFailed,
    };
  }, [onNetworkStatusChange, onMessageSent, onMessageFailed]);

  // Create service instance on mount
  useEffect(() => {
    serviceRef.current = new OfflineQueueService(botId, config);

    // Set up event listener
    const unsubscribe = serviceRef.current.on((event: OfflineQueueEvent, data?: any) => {
      switch (event) {
        case 'networkStatusChanged':
          setIsOnline(data.isOnline);
          callbacksRef.current.onNetworkStatusChange?.(data.isOnline);
          break;

        case 'messageQueued':
        case 'messageStatusChanged':
        case 'queueCleared':
          setQueue(serviceRef.current?.getQueue() || []);
          break;

        case 'queueProcessingStarted':
          setIsProcessing(true);
          break;

        case 'queueProcessingComplete':
          setIsProcessing(false);
          setQueue(serviceRef.current?.getQueue() || []);
          break;

        case 'messageSent':
          setQueue(serviceRef.current?.getQueue() || []);
          callbacksRef.current.onMessageSent?.(data);
          break;

        case 'messageFailed':
          setQueue(serviceRef.current?.getQueue() || []);
          callbacksRef.current.onMessageFailed?.(data.message, data.error);
          break;
      }
    });

    // Cleanup
    return () => {
      unsubscribe();
      serviceRef.current?.destroy();
      serviceRef.current = null;
    };
  }, [botId, config]);

  // Initialize service when asyncStorage and sendMessage are available
  const initialize = useCallback(
    async (
      asyncStorage: AsyncStorageInterface,
      sendMessage: (eventType: string, payload: any) => Promise<boolean>
    ): Promise<void> => {
      if (!serviceRef.current) return;

      try {
        await serviceRef.current.initialize(asyncStorage, sendMessage);
        setIsReady(true);
        setQueue(serviceRef.current.getQueue());
        setIsOnline(serviceRef.current.getNetworkStatus());

        if (__DEV__) {
          console.log('[useOfflineQueue] Initialized');
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[useOfflineQueue] Initialization failed:', error);
        }
      }
    },
    []
  );

  // Auto-initialize if asyncStorage and sendMessage are provided
  useEffect(() => {
    if (initialAsyncStorage && initialSendMessage && !isReady) {
      initialize(initialAsyncStorage, initialSendMessage);
    }
  }, [initialAsyncStorage, initialSendMessage, isReady, initialize]);

  // Queue a message
  const queueMessage = useCallback(
    async (
      eventType: string,
      payload: any,
      priority?: number
    ): Promise<QueuedMessage | null> => {
      if (!serviceRef.current?.isReady()) {
        if (__DEV__) {
          console.warn('[useOfflineQueue] Service not ready');
        }
        return null;
      }

      return serviceRef.current.queueMessage(eventType, payload, priority);
    },
    []
  );

  // Get a message by ID
  const getMessage = useCallback((id: string): QueuedMessage | undefined => {
    return serviceRef.current?.getMessage(id);
  }, []);

  // Remove a message
  const removeMessage = useCallback(async (id: string): Promise<boolean> => {
    if (!serviceRef.current) return false;
    const result = await serviceRef.current.removeMessage(id);
    setQueue(serviceRef.current.getQueue());
    return result;
  }, []);

  // Clear queue
  const clearQueue = useCallback(async (): Promise<void> => {
    if (!serviceRef.current) return;
    await serviceRef.current.clearQueue();
    setQueue([]);
  }, []);

  // Clear failed messages
  const clearFailedMessages = useCallback(async (): Promise<number> => {
    if (!serviceRef.current) return 0;
    const count = await serviceRef.current.clearFailedMessages();
    setQueue(serviceRef.current.getQueue());
    return count;
  }, []);

  // Retry a specific message
  const retryMessage = useCallback(async (id: string): Promise<boolean> => {
    if (!serviceRef.current) return false;
    const result = await serviceRef.current.retryMessage(id);
    setQueue(serviceRef.current.getQueue());
    return result;
  }, []);

  // Retry all failed messages
  const retryAllFailed = useCallback(async (): Promise<number> => {
    if (!serviceRef.current) return 0;
    const count = await serviceRef.current.retryAllFailed();
    setQueue(serviceRef.current.getQueue());
    return count;
  }, []);

  // Update network status
  const setNetworkStatus = useCallback(async (online: boolean): Promise<void> => {
    if (!serviceRef.current) return;
    await serviceRef.current.setNetworkStatus(online);
  }, []);

  // Process queue
  const processQueue = useCallback(async (): Promise<void> => {
    if (!serviceRef.current) return;
    await serviceRef.current.processQueue();
  }, []);

  // Calculate derived values
  const queueSize = queue.length;
  const pendingCount = queue.filter((m) => m.status === 'pending').length;
  const failedCount = queue.filter((m) => m.status === 'failed').length;

  return {
    isOnline,
    isReady,
    queue,
    queueSize,
    pendingCount,
    failedCount,
    isProcessing,
    queueMessage,
    getMessage,
    removeMessage,
    clearQueue,
    clearFailedMessages,
    retryMessage,
    retryAllFailed,
    setNetworkStatus,
    processQueue,
    initialize,
  };
}

export default useOfflineQueue;
