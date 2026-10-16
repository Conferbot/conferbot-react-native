/**
 * "Your requests" in the provider (web conferbot-widget
 * src/ts/home/requests/card.ts mountRequestsCard, store.ts, and index.ts
 * `_sendResponse` rememberSession). Holds:
 *
 *   - what the device remembers: the chats it started that the visitor
 *     wrote in, and when each request was last read here, per bot in
 *     AsyncStorage (core/requests.ts; in memory without storage);
 *   - the list as the home card has it, for the menu item and the app's
 *     badge: read when the provider connects, when the chat opens or
 *     closes (at most every 15s), when the portal closes, and when a request changes while
 *     the portal is closed;
 *   - the portal's screens (core/requestsPortal.ts).
 *
 * Nothing is asked for a visitor with no chat on this device and no
 * signed-in user (`user.hash`): a first-time visitor has no requests.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import ConferBotSocket from '../../services/socket';
import type { AsyncStorageInterface } from '../../services/StorageService';
import {
  REFRESH_GAP_MS,
  canAskForRequests,
  emptyMemory,
  hasVisitorEntry,
  ordered,
  parseMemory,
  requestsApi,
  requestsStorageKey,
  requestsWho,
  serializeMemory,
  unreadCount,
  withSeen,
  withSession,
  type RequestMemory,
  type RequestSummary,
  type RequestsUser,
} from '../../core/requests';
import { createRequestsPortal, type RequestsPortal } from '../../core/requestsPortal';
import { endedSinceLastLive } from '../../core/liveEvents';

interface Options {
  botId: string;
  socketClient: MutableRefObject<ConferBotSocket | null>;
  /** The connection is up (the provider's isConnected). */
  isConnected: boolean;
  /** The chat is open. */
  isOpen: boolean;
  chatSessionId: string | undefined;
  record: any[];
  user?: RequestsUser | null;
  /** The visitor id the records carry (ChatState `_visitorId`), else the handshake's. */
  visitorId: () => string | undefined;
  storage: AsyncStorageInterface | null;
  /** Open the chat (a request that is the chat on screen). */
  openChat: () => void;
}

export interface RequestsPortalExtras {
  portal: RequestsPortal | null;
  /** The portal is up. */
  requestsOpen: boolean;
  /** The visitor's requests (newest replies first), null until read. */
  requests: RequestSummary[] | null;
  /** Requests with a team reply not read here. */
  requestsUnread: number;
  openRequests: (requestId?: string) => void;
  closeRequests: () => void;
  refreshRequests: (force?: boolean) => Promise<void>;
}

export const useRequestsPortal = (o: Options): RequestsPortalExtras => {
  const memory = useRef<RequestMemory>(emptyMemory());
  const [loaded, setLoaded] = useState(false);
  const [requests, setRequests] = useState<RequestSummary[] | null>(null);
  const [seen, setSeen] = useState<Record<string, number>>({});
  const [requestsOpen, setRequestsOpen] = useState(false);
  const lastLoad = useRef(0);
  const loading = useRef(false);

  // Late-bound: the portal is made once, the provider's values move.
  const live = useRef(o);
  live.current = o;

  const save = useCallback((next: RequestMemory | null) => {
    if (!next) return;
    memory.current = next;
    setSeen(next.seen);
    const store = live.current.storage;
    if (!store) return;
    try {
      store.setItem(requestsStorageKey(live.current.botId), serializeMemory(next)).catch(() => {});
    } catch {
      /* storage full or blocked: this app session still remembers */
    }
  }, []);

  // What the device remembers, once per bot.
  useEffect(() => {
    let gone = false;
    setLoaded(false);
    memory.current = emptyMemory();
    const store = o.storage;
    (store ? store.getItem(requestsStorageKey(o.botId)).catch(() => null) : Promise.resolve(null)).then((raw) => {
      if (gone) return;
      memory.current = parseMemory(raw);
      setSeen(memory.current.seen);
      setLoaded(true);
    });
    return () => {
      gone = true;
    };
  }, [o.botId]);

  const api = useMemo(
    () =>
      requestsApi(
        {
          emitWithAck: (event, payload, timeoutMs) => live.current.socketClient.current?.emitWithAck(event, payload, timeoutMs) ?? Promise.resolve(null),
          emitToServer: (event, payload) => live.current.socketClient.current?.emitToServer(event, payload),
          on: (event, fn) => live.current.socketClient.current?.on(event, fn) ?? (() => {}),
        },
        () => requestsWho(live.current.visitorId(), memory.current, live.current.user)
      ),
    // The socket client is made after the first render: subscribe once it is there.
    [o.socketClient.current]
  );

  const refreshRequests = useCallback(
    async (force = false) => {
      if (loading.current || (!force && Date.now() - lastLoad.current < REFRESH_GAP_MS)) return;
      if (!canAskForRequests(memory.current, live.current.user)) return;
      if (!live.current.socketClient.current?.isConnected()) return;
      loading.current = true;
      lastLoad.current = Date.now();
      try {
        const list = await api.list();
        if (list) setRequests(ordered(list, memory.current.seen));
      } finally {
        loading.current = false;
      }
    },
    [api]
  );

  const portal = useMemo(() => {
    if (!o.socketClient.current) return null;
    return createRequestsPortal({
      api,
      seen: () => memory.current.seen,
      markSeen: (id, at) => save(withSeen(memory.current, id, at)),
      // The chat on screen, not yet over: that chat instead (web index.ts isCurrentChat).
      isCurrentChat: (id) => id === live.current.chatSessionId && !endedSinceLastLive(live.current.record),
      openChat: () => live.current.openChat(),
      onChanged: () => {
        refreshRequests(true);
      },
    });
  }, [api]);

  useEffect(() => {
    if (!portal) return;
    const off = portal.subscribe((s) => setRequestsOpen(s.screen !== 'closed'));
    // A reply arrived while the portal is closed: the list says so.
    const offUpdate = api.onUpdate(() => {
      if (!portal.isOpen()) refreshRequests(true);
    });
    return () => {
      off();
      offUpdate();
      portal.destroy();
    };
  }, [portal]);

  // A chat the visitor wrote in may become a request (web _sendResponse).
  useEffect(() => {
    if (!loaded || !o.chatSessionId || !hasVisitorEntry(o.record)) return;
    save(withSession(memory.current, o.chatSessionId));
  }, [loaded, o.chatSessionId, o.record]);

  // Connected with something to ask about, and each time the chat opens.
  useEffect(() => {
    if (loaded && o.isConnected) refreshRequests(true);
  }, [loaded, o.isConnected, o.user?.hash]);
  // The chat opening or closing is the app's "home screen comes back into
  // view" (web card.ts MutationObserver): read again, at most every 15s.
  useEffect(() => {
    if (loaded) refreshRequests();
  }, [o.isOpen]);

  const openRequests = useCallback(
    (requestId?: string) => {
      if (!portal) return;
      if (requestId) portal.openRequest(requestId);
      else portal.openList();
    },
    [portal]
  );
  const closeRequests = useCallback(() => portal?.close(), [portal]);

  const requestsUnread = useMemo(() => unreadCount(requests, seen), [requests, seen]);

  return { portal, requestsOpen, requests, requestsUnread, openRequests, closeRequests, refreshRequests };
};
