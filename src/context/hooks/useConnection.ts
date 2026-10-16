/**
 * The connection, as the web widget tells it (conferbot-widget
 * src/ts/chat/connectionState.ts): online is the socket connected and,
 * when @react-native-community/netinfo is installed, the device online. A
 * message the visitor sends while it is down waits ("Waiting to send") and
 * goes on reconnect. The web leaves that to socket.io's send buffer; here
 * the SDK's OfflineQueueService holds it (kept on the device when
 * AsyncStorage is there), and on reconnect the conversation's latest record
 * is sent, which carries every message that waited (#80).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type ConferBotSocket from '../../services/socket';
import { OfflineQueueService } from '../../services/OfflineQueueService';
import type { OfflineQueueConfig, OfflineQueueEvent } from '../../services/OfflineQueueService';
import type { AsyncStorageInterface } from '../../services/StorageService';

/** The queued event: a response record (the conversation's record). */
export const OFFLINE_RECORD_EVENT = 'response-record';

/** What the queue keeps for a send made while offline. */
export interface OfflineRecordPayload {
  chatSessionId: string;
  /** The visitor's message, when the send was one. */
  messageId?: string;
  /** When it was queued (ms): a record sent after it already carried it. */
  at: number;
}

/** The part of @react-native-community/netinfo this reads. */
export interface NetInfoLike {
  addEventListener: (listener: (state: { isConnected: boolean | null; isInternetReachable?: boolean | null }) => void) => (() => void) | void;
}

export interface UseConnectionParams {
  botId: string;
  socketClient: { current: ConferBotSocket | null };
  setIsConnected: (connected: boolean) => void;
  /** The conversation's latest record to send (chatState.buildResponseData()), or null when that conversation is gone. */
  latestRecord: (chatSessionId: string) => any | null;
  /** config.enableOfflineMode !== false: queue sends made while offline. */
  enabled: boolean;
  /** config.offlineQueueConfig. */
  queueConfig?: OfflineQueueConfig;
  /** Where the queue is kept across restarts (null: in memory only). */
  storage: AsyncStorageInterface | null;
  /** NetInfo, for tests; undefined: the installed package, if any. null: none. */
  netInfo?: NetInfoLike | null;
}

const memoryStorage = (): AsyncStorageInterface => {
  const items = new Map<string, string>();
  return {
    getItem: async (k: string) => (items.has(k) ? (items.get(k) as string) : null),
    setItem: async (k: string, v: string) => {
      items.set(k, v);
    },
    removeItem: async (k: string) => {
      items.delete(k);
    },
  } as AsyncStorageInterface;
};

const installedNetInfo = (): NetInfoLike | null => {
  try {
    // Optional peer: without it, online is the socket's state alone.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-community/netinfo');
    const lib = mod?.default || mod;
    return lib && typeof lib.addEventListener === 'function' ? lib : null;
  } catch {
    return null;
  }
};

export function useConnection({
  botId,
  socketClient,
  setIsConnected,
  latestRecord,
  enabled,
  queueConfig,
  storage,
  netInfo,
}: UseConnectionParams) {
  const [socketUp, setSocketUp] = useState(false);
  const [deviceOnline, setDeviceOnline] = useState(true);
  const [pendingMessageCount, setPendingMessageCount] = useState(0);
  const [failedMessageCount, setFailedMessageCount] = useState(0);

  const socketUpRef = useRef(false);
  const deviceOnlineRef = useRef(true);
  const latestRecordRef = useRef(latestRecord);
  latestRecordRef.current = latestRecord;
  // Per conversation: when its record last went, after a reconnect.
  const flushedAt = useRef<Record<string, number>>({});

  const queueRef = useRef<OfflineQueueService | null>(null);
  // Sends wait for the kept queue to be read first (it would replace them).
  const readyRef = useRef<Promise<void>>(Promise.resolve());

  const tellQueue = useCallback(() => {
    queueRef.current?.setNetworkStatus(socketUpRef.current && deviceOnlineRef.current);
  }, []);

  // The queue: set up once, counts kept in state.
  useEffect(() => {
    if (!enabled) return;
    const queue = new OfflineQueueService(botId, {
      ...(queueConfig || {}),
      persistQueue: storage ? queueConfig?.persistQueue !== false : false,
    });
    queueRef.current = queue;
    let live = true;
    const recount = () => {
      if (!live) return;
      const stats = queue.getStats();
      setPendingMessageCount(stats.pending + stats.sending);
      setFailedMessageCount(stats.failed);
    };
    const off = queue.on((_event: OfflineQueueEvent) => recount());
    const send = async (_event: string, payload: OfflineRecordPayload): Promise<boolean> => {
      const socket = socketClient.current;
      if (!socket || !socket.isConnected()) return false;
      const sid = payload?.chatSessionId;
      // A record sent since it was queued already carried it.
      if (sid && (flushedAt.current[sid] || 0) >= (payload.at || 0)) return true;
      const data = sid ? latestRecordRef.current(sid) : null;
      // That conversation is gone (restarted, cleared): nothing to send.
      if (!data) return true;
      socket.sendResponseRecord(data);
      flushedAt.current[sid] = Date.now();
      return true;
    };
    readyRef.current = queue
      .initialize(storage || memoryStorage(), send)
      .then(() => {
        if (!live) return;
        recount();
        tellQueue();
        // Sends queued in an earlier run go once the socket is up.
        if (socketUpRef.current && deviceOnlineRef.current) queue.processQueue();
      })
      .catch(() => {});
    return () => {
      live = false;
      off();
      queue.destroy();
      if (queueRef.current === queue) queueRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The device's own network, when NetInfo is installed.
  useEffect(() => {
    const lib = netInfo === undefined ? installedNetInfo() : netInfo;
    if (!lib) return;
    const unsubscribe = lib.addEventListener((state) => {
      const online = state?.isConnected !== false && state?.isInternetReachable !== false;
      deviceOnlineRef.current = online;
      setDeviceOnline(online);
      tellQueue();
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** On the socket once it is made (with the provider's other listeners). */
  const setupConnectionListeners = useCallback(() => {
    const socket = socketClient.current;
    if (!socket) return;
    const up = (connected: boolean) => {
      socketUpRef.current = connected;
      setSocketUp(connected);
      setIsConnected(connected);
      tellQueue();
    };
    socket.on('connect', () => up(true));
    socket.on('disconnect', () => up(false));
    if (!enabled) return;
    socket.setOfflineHandler((data: any, meta?: { messageId?: string }) => {
      const sid = data?.chatSessionId;
      if (!sid) return;
      const payload: OfflineRecordPayload = { chatSessionId: sid, at: Date.now(), ...(meta?.messageId ? { messageId: meta.messageId } : {}) };
      readyRef.current.then(() => queueRef.current?.queueMessage(OFFLINE_RECORD_EVENT, payload)).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** A failed send again, by the queue's id or the visitor's message id. */
  const retryFailedMessage = useCallback(async (messageId: string): Promise<boolean> => {
    const queue = queueRef.current;
    if (!queue) return false;
    const entry = queue.getQueue().find((m) => m.id === messageId || m.payload?.messageId === messageId);
    return entry ? queue.retryMessage(entry.id) : false;
  }, []);

  const retryAllFailedMessages = useCallback(async (): Promise<number> => (queueRef.current ? queueRef.current.retryAllFailed() : 0), []);

  const clearFailedMessages = useCallback(async (): Promise<number> => {
    const queue = queueRef.current;
    if (!queue) return 0;
    const n = await queue.clearFailedMessages();
    setFailedMessageCount(queue.getStats().failed);
    return n;
  }, []);

  return {
    isOnline: socketUp && deviceOnline,
    pendingMessageCount,
    failedMessageCount,
    retryFailedMessage,
    retryAllFailedMessages,
    clearFailedMessages,
    setupConnectionListeners,
  };
}
