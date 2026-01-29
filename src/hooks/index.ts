/**
 * Hooks Module
 *
 * React hooks for the Conferbot React Native SDK.
 */

// Analytics hook
export {
  useAnalytics,
  type UseAnalyticsOptions,
  type UseAnalyticsReturn,
  type UserAction,
  type RatingOptions,
} from './useAnalytics';

// Persistence hook
export {
  usePersistence,
  useDebouncedPersistence,
  type UsePersistenceReturn,
} from './usePersistence';

// Read receipts hook
export {
  useReadReceipts,
  type UseReadReceiptsOptions,
  type UseReadReceiptsReturn,
} from './useReadReceipts';

// Reactions hook
export {
  useReactions,
  type UseReactionsReturn,
} from './useReactions';

// Network status hook
export {
  useNetworkStatus,
  type NetworkStatus,
  type ConnectionType,
  type UseNetworkStatusOptions,
  type UseNetworkStatusReturn,
} from './useNetworkStatus';

// Offline queue hook
export {
  useOfflineQueue,
  type UseOfflineQueueOptions,
  type UseOfflineQueueReturn,
} from './useOfflineQueue';

// AI Streaming hook
export {
  useAIStreaming,
  useAIGeneration,
  type UseAIStreamingOptions,
  type UseAIStreamingResult,
  type UseAIGenerationOptions,
  type UseAIGenerationResult,
} from './useAIStreaming';
