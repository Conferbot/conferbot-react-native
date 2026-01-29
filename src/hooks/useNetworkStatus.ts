/**
 * useNetworkStatus.ts
 *
 * React hook for monitoring network connectivity status.
 * Uses @react-native-community/netinfo for reliable cross-platform
 * network detection in React Native.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ========================================
// TYPES
// ========================================

/** Network connection type */
export type ConnectionType =
  | 'wifi'
  | 'cellular'
  | 'bluetooth'
  | 'ethernet'
  | 'wimax'
  | 'vpn'
  | 'other'
  | 'none'
  | 'unknown';

/** Network status state */
export interface NetworkStatus {
  /** Whether the device has an active internet connection */
  isConnected: boolean;
  /** Whether network status has been determined */
  isInternetReachable: boolean | null;
  /** Type of network connection */
  type: ConnectionType;
  /** Whether the hook is still initializing */
  isLoading: boolean;
}

/** NetInfo state shape (from @react-native-community/netinfo) */
interface NetInfoState {
  type: string;
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  details: any;
}

/** NetInfo library interface */
interface NetInfoLib {
  fetch: () => Promise<NetInfoState>;
  addEventListener: (listener: (state: NetInfoState) => void) => () => void;
}

/** Configuration options */
export interface UseNetworkStatusOptions {
  /** Callback when network status changes */
  onStatusChange?: (status: NetworkStatus) => void;
  /** Custom NetInfo instance (for testing) */
  netInfo?: NetInfoLib;
  /** Polling interval for manual checks (ms, 0 = disabled) */
  pollingInterval?: number;
}

/** Return type for the hook */
export interface UseNetworkStatusReturn extends NetworkStatus {
  /** Manually refresh the network status */
  refresh: () => Promise<void>;
}

// ========================================
// DEFAULT STATE
// ========================================

const DEFAULT_STATUS: NetworkStatus = {
  isConnected: true,
  isInternetReachable: null,
  type: 'unknown',
  isLoading: true,
};

// ========================================
// HOOK IMPLEMENTATION
// ========================================

/**
 * Hook for monitoring network connectivity status.
 *
 * @example
 * ```tsx
 * import { useNetworkStatus } from '@conferbot/react-native';
 *
 * function MyComponent() {
 *   const { isConnected, type, refresh } = useNetworkStatus({
 *     onStatusChange: (status) => {
 *       if (!status.isConnected) {
 *         console.log('Lost network connection');
 *       }
 *     }
 *   });
 *
 *   return (
 *     <View>
 *       <Text>Network: {isConnected ? 'Online' : 'Offline'}</Text>
 *       <Text>Type: {type}</Text>
 *       <Button title="Refresh" onPress={refresh} />
 *     </View>
 *   );
 * }
 * ```
 */
export function useNetworkStatus(
  options: UseNetworkStatusOptions = {}
): UseNetworkStatusReturn {
  const { onStatusChange, netInfo: customNetInfo, pollingInterval = 0 } = options;

  const [status, setStatus] = useState<NetworkStatus>(DEFAULT_STATUS);
  const netInfoRef = useRef<NetInfoLib | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);

  // Keep callback ref up to date
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  /**
   * Converts NetInfo state to our NetworkStatus type
   */
  const parseNetInfoState = useCallback((state: NetInfoState): NetworkStatus => {
    const connectionType = state.type.toLowerCase() as ConnectionType;

    return {
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable,
      type: connectionType,
      isLoading: false,
    };
  }, []);

  /**
   * Handles network state updates
   */
  const handleStateChange = useCallback(
    (state: NetInfoState) => {
      const newStatus = parseNetInfoState(state);

      setStatus((prevStatus) => {
        // Only update if something actually changed
        if (
          prevStatus.isConnected !== newStatus.isConnected ||
          prevStatus.isInternetReachable !== newStatus.isInternetReachable ||
          prevStatus.type !== newStatus.type ||
          prevStatus.isLoading !== newStatus.isLoading
        ) {
          // Call the status change callback
          if (onStatusChangeRef.current) {
            onStatusChangeRef.current(newStatus);
          }
          return newStatus;
        }
        return prevStatus;
      });
    },
    [parseNetInfoState]
  );

  /**
   * Manually refresh network status
   */
  const refresh = useCallback(async (): Promise<void> => {
    if (netInfoRef.current) {
      try {
        const state = await netInfoRef.current.fetch();
        handleStateChange(state);
      } catch (error) {
        if (__DEV__) {
          console.error('[useNetworkStatus] Failed to refresh:', error);
        }
      }
    }
  }, [handleStateChange]);

  /**
   * Initialize NetInfo and set up listeners
   */
  useEffect(() => {
    let isMounted = true;

    const initNetInfo = async () => {
      try {
        // Use custom NetInfo if provided, otherwise try to import
        if (customNetInfo) {
          netInfoRef.current = customNetInfo;
        } else {
          // Try to dynamically import @react-native-community/netinfo
          try {
            const NetInfo = require('@react-native-community/netinfo');
            netInfoRef.current = NetInfo.default || NetInfo;
          } catch (importError) {
            if (__DEV__) {
              console.warn(
                '[useNetworkStatus] @react-native-community/netinfo is not installed.',
                'Network status monitoring will use fallback behavior.',
                'Install with: npm install @react-native-community/netinfo'
              );
            }
            // Use fallback - assume online
            if (isMounted) {
              setStatus({
                isConnected: true,
                isInternetReachable: true,
                type: 'unknown',
                isLoading: false,
              });
            }
            return;
          }
        }

        if (!netInfoRef.current) {
          if (isMounted) {
            setStatus({
              isConnected: true,
              isInternetReachable: true,
              type: 'unknown',
              isLoading: false,
            });
          }
          return;
        }

        // Get initial state
        const initialState = await netInfoRef.current.fetch();
        if (isMounted) {
          handleStateChange(initialState);
        }

        // Subscribe to changes
        unsubscribeRef.current = netInfoRef.current.addEventListener((state) => {
          if (isMounted) {
            handleStateChange(state);
          }
        });

        // Set up polling if configured
        if (pollingInterval > 0 && isMounted) {
          pollingIntervalRef.current = setInterval(async () => {
            if (netInfoRef.current && isMounted) {
              try {
                const state = await netInfoRef.current.fetch();
                handleStateChange(state);
              } catch (error) {
                // Silently ignore polling errors
              }
            }
          }, pollingInterval);
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[useNetworkStatus] Initialization error:', error);
        }
        if (isMounted) {
          setStatus({
            isConnected: true,
            isInternetReachable: null,
            type: 'unknown',
            isLoading: false,
          });
        }
      }
    };

    initNetInfo();

    // Cleanup
    return () => {
      isMounted = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [customNetInfo, handleStateChange, pollingInterval]);

  return {
    ...status,
    refresh,
  };
}

export default useNetworkStatus;
