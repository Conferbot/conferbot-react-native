/**
 * usePersistence.ts
 *
 * Custom hook for accessing persistence functionality in the Conferbot SDK.
 * Provides convenient methods for managing persisted state.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useConferBot } from '../context/ConferBotContext';

/** Debounce delay for persistence operations (ms) */
const DEBOUNCE_DELAY = 500;

/**
 * Hook return type for persistence operations
 */
export interface UsePersistenceReturn {
  /** Whether the SDK is currently restoring from persisted state */
  isRestoring: boolean;
  /** Whether there is a persisted session available */
  hasPersistedSession: boolean;
  /** Clear all persisted data (full logout) */
  clearAll: () => Promise<void>;
  /** Reset conversation but keep user data (start new chat) */
  resetConversation: () => Promise<void>;
  /** Check if persistence is enabled */
  isPersistenceEnabled: boolean;
}

/**
 * Custom hook for persistence operations.
 *
 * @example
 * ```tsx
 * const { isRestoring, hasPersistedSession, clearAll, resetConversation } = usePersistence();
 *
 * // Show loading while restoring
 * if (isRestoring) {
 *   return <LoadingScreen />;
 * }
 *
 * // Start fresh conversation
 * const handleNewChat = async () => {
 *   await resetConversation();
 * };
 *
 * // Full logout
 * const handleLogout = async () => {
 *   await clearAll();
 * };
 * ```
 */
export function usePersistence(): UsePersistenceReturn {
  const {
    isRestoring,
    hasPersistedSession,
    clearPersistedData,
    resetConversation,
  } = useConferBot();

  // Track if persistence is available
  const isPersistenceEnabled = typeof clearPersistedData === 'function';

  return {
    isRestoring,
    hasPersistedSession,
    clearAll: clearPersistedData,
    resetConversation,
    isPersistenceEnabled,
  };
}

/**
 * Creates a debounced function that delays invoking the provided function
 * until after the specified delay has elapsed since the last time it was invoked.
 */
function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = DEBOUNCE_DELAY
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  ) as T;

  return debouncedCallback;
}

/**
 * Hook for debounced persistence operations.
 * Useful when you need to persist state changes frequently but want to reduce storage writes.
 *
 * @param persistFn - The persistence function to debounce
 * @param delay - Debounce delay in milliseconds (default: 500)
 *
 * @example
 * ```tsx
 * const debouncedPersist = useDebouncedPersistence(
 *   async (data) => {
 *     await storageService.saveSession(data);
 *   },
 *   300
 * );
 *
 * // This will only persist after 300ms of inactivity
 * useEffect(() => {
 *   debouncedPersist({ currentNodeId: nodeId });
 * }, [nodeId]);
 * ```
 */
export function useDebouncedPersistence<T extends (...args: any[]) => Promise<void>>(
  persistFn: T,
  delay: number = DEBOUNCE_DELAY
): T {
  return useDebouncedCallback(persistFn, delay);
}

export default usePersistence;
