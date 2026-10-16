/**
 * Push notifications wired into the chat (core/push.ts; embed-server #189,
 * docs/mobile-push.md). Opt-in: nothing happens until the app passes its
 * FCM or APNs token to `setPushToken`; the SDK never loads Firebase.
 *
 * - The token is registered with the current conversation, again for each
 *   new one, and tried again as the conversation goes on while the server
 *   does not have it yet (a new chat is stored when the visitor answers).
 * - Unregistered when the app's user logs out (the `user` prop goes away or
 *   changes), on `clearPersistedData`, or `unregisterPush()`.
 * - `handlePushNotification(data)` recognises a Conferbot notification for
 *   this bot and opens its conversation: the chat when it is the one on the
 *   device, else that conversation in "Your requests".
 */
import { useCallback, useEffect, useRef } from 'react';
import {
  createPushRegistrar,
  parseConferbotPush,
  type ConferbotPush,
  type PushDeviceInfo,
  type PushRegistrar,
  type PushTokenType,
} from '../../core/push';
import type { PushRegisterResult } from '../../core/push';

/** A burst of messages is one retry. */
export const PUSH_RETRY_DEBOUNCE_MS = 1000;

export interface HandlePushOptions {
  /** false: only count it as unread (a notification that arrived in the foreground and should not take the screen). Default true. */
  open?: boolean;
}

interface Params {
  botId: string;
  /** The SDK's API client (services/api.ts). */
  api: () => {
    registerPushToken: (body: any) => Promise<PushRegisterResult>;
    unregisterPushToken: (token: string) => Promise<boolean>;
  } | null;
  chatSessionId?: string;
  /** Grows as the conversation goes on. */
  recordLength: number;
  /** The app's user id (undefined: nobody signed in). */
  userId?: string;
  isInitialized: boolean;
  isOpen: boolean;
  /** The conversation is on screen (not the home screen). */
  chatVisible: boolean;
  openChat: () => void;
  showChat: () => void;
  openRequests: (requestId?: string) => void;
  bumpUnread: () => void;
  deviceInfo?: () => PushDeviceInfo | undefined;
}

export const usePushNotifications = (p: Params) => {
  const live = useRef(p);
  live.current = p;

  const registrar = useRef<PushRegistrar | null>(null);
  if (!registrar.current) {
    registrar.current = createPushRegistrar({
      register: async (body) => {
        const api = live.current.api();
        return api ? api.registerPushToken(body) : { ok: false, error: 'NETWORK' };
      },
      unregister: async (token) => {
        const api = live.current.api();
        return api ? api.unregisterPushToken(token) : false;
      },
      deviceInfo: () => live.current.deviceInfo?.(),
    });
  }
  const reg = registrar.current;

  // A new conversation: registered with it.
  useEffect(() => {
    reg.setSession(p.chatSessionId);
  }, [p.chatSessionId]);

  // The conversation went on: a registration still waiting tries again.
  useEffect(() => {
    if (!p.recordLength) return;
    const t = setTimeout(() => reg.poke(), PUSH_RETRY_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [p.recordLength]);

  // Logout (identify(null)) or another user: this device stops getting the old conversation's pushes.
  const lastUser = useRef(p.userId);
  useEffect(() => {
    const before = lastUser.current;
    lastUser.current = p.userId;
    if (before && before !== p.userId) reg.unregister();
  }, [p.userId]);

  const setPushToken = useCallback((token: string | null, type?: PushTokenType) => reg.setToken(token, type), []);
  const unregisterPush = useCallback(() => reg.unregister(), []);

  const openFor = (push: ConferbotPush) => {
    const o = live.current;
    const current = o.chatSessionId;
    o.openChat();
    if (!current || current === push.chatSessionId) o.showChat();
    // Another of the visitor's conversations: that one, in "Your requests".
    else o.openRequests(push.chatSessionId);
  };

  // A tap that came before the SDK was ready (the app started from it).
  const pending = useRef<ConferbotPush | null>(null);
  useEffect(() => {
    if (!p.isInitialized || !pending.current) return;
    const push = pending.current;
    pending.current = null;
    openFor(push);
  }, [p.isInitialized]);

  const handlePushNotification = useCallback((data: unknown, options?: HandlePushOptions): boolean => {
    const push = parseConferbotPush(data);
    if (!push || push.botId !== live.current.botId) return false;
    const o = live.current;
    if (options?.open === false) {
      if (!(o.isOpen && o.chatVisible && o.chatSessionId === push.chatSessionId)) o.bumpUnread();
      return true;
    }
    if (!o.isInitialized) pending.current = push;
    else openFor(push);
    return true;
  }, []);

  return { setPushToken, unregisterPush, handlePushNotification, registrar: reg };
};
