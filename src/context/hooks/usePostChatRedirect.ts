/**
 * The owner's post-chat redirect wired into the chat (core/postChatRedirect.ts;
 * web index.ts _afterPostChat, docs/redirect-after-chat.md). The conversation
 * ended (the flow's end, or an agent ending the chat), the post-chat rating
 * is sent or put away (or there is none): the app's onPostChatRedirect,
 * else a 10-second line with Cancel, then the system browser
 * (Linking.openURL). It stops when the chat closes, its conversation is no
 * longer on screen, a new conversation starts, the visitor is blocked or
 * the app goes to the background.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Linking } from 'react-native';
import { PostChatRedirect, type RedirectLine, type RedirectStore } from '../../core/postChatRedirect';

/** As the web: the rating shows 1.5 s after the end, the line waits for it. */
export const REDIRECT_SETTLE_MS = 1500;

interface Params {
  /** The bot's redirectUrl (fetched-chatbot-data). */
  redirectUrl: unknown;
  chatSessionId?: string;
  /** The chat is open on the conversation (not the home screen). */
  chatVisible: boolean;
  /** The workspace blocked this visitor. */
  blocked: boolean;
  /** A person (or a handover) is in the conversation. */
  live: boolean;
  /** The post-chat rating is up and not answered yet. */
  ratingPending: boolean;
  disabled?: boolean;
  onPostChatRedirect?: (url: string) => boolean | void;
  store?: RedirectStore | null;
  /** Opens the URL (tests). Linking.openURL by default. */
  open?: (href: string) => Promise<boolean> | boolean;
}

const openWithLinking = async (href: string): Promise<boolean> => {
  await Linking.openURL(href);
  return true;
};

export function usePostChatRedirect(p: Params) {
  const [line, setLine] = useState<RedirectLine | null>(null);
  // The conversation that ended (the flow's end, an agent ending it).
  const [endedSession, setEndedSession] = useState<string | null>(null);
  // Each end tries once (an agent ending it again tries again; an offered
  // conversation is never offered twice: the controller and the store).
  const [endTick, setEndTick] = useState(0);
  const live = useRef(p);
  live.current = p;

  const ctl = useRef<PostChatRedirect | null>(null);
  if (!ctl.current) {
    ctl.current = new PostChatRedirect({
      onChange: setLine,
      open: (href) => (live.current.open || openWithLinking)(href),
      store: p.store,
    });
  }

  const endedRef = useRef<string | null>(null);
  endedRef.current = endedSession;
  // One try per end, as the web's _afterPostChat.
  const tried = useRef(new Set<string>());

  const stillHere = (session: string) => () => {
    const c = live.current;
    return (
      endedRef.current === session &&
      (c.chatSessionId || '') === session &&
      c.chatVisible &&
      !c.blocked &&
      !c.live &&
      AppState.currentState !== 'background'
    );
  };

  /** The conversation on screen ended (useFlowEngine onFlowComplete, useSocketListeners chat-ended). */
  const conversationEnded = useCallback(() => {
    const session = live.current.chatSessionId || '';
    if (!session) return;
    tried.current.delete(session);
    setEndedSession(session);
    setEndTick((n) => n + 1);
  }, []);

  // Once the rating is answered or put away (or there is none), after the
  // rating's own delay: the app's hook, else the countdown, if the
  // conversation is still on screen then.
  useEffect(() => {
    if (!endedSession || p.ratingPending || tried.current.has(endedSession)) return;
    if (endedSession !== (p.chatSessionId || '')) return;
    const timer = setTimeout(() => {
      tried.current.add(endedSession);
      const c = live.current;
      ctl.current
        ?.start({
          redirectUrl: c.redirectUrl,
          chatSessionId: endedSession,
          disabled: c.disabled === true,
          onPostChatRedirect: c.onPostChatRedirect,
          canGo: stillHere(endedSession),
        })
        .then((r) => {
          if (r === 'counting') {
            const said = ctl.current?.current?.said;
            if (said) AccessibilityInfo?.announceForAccessibility?.(said);
          }
        })
        .catch(() => {});
    }, REDIRECT_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [endedSession, endTick, p.ratingPending, p.chatSessionId]);

  // A new conversation, the chat closed, a block, a person back in it: it stops.
  useEffect(() => {
    if (!ctl.current?.activeSession) return;
    if (ctl.current.activeSession !== (p.chatSessionId || '') || !p.chatVisible || p.blocked || p.live) ctl.current.cancel();
  }, [p.chatSessionId, p.chatVisible, p.blocked, p.live]);
  useEffect(() => {
    if (endedSession && endedSession !== (p.chatSessionId || '')) setEndedSession(null);
  }, [p.chatSessionId]);

  // The app in the background: it stops, as the web stops on a hidden tab.
  useEffect(() => {
    const sub: any = AppState.addEventListener?.('change', (s) => {
      if (s === 'background') ctl.current?.cancel();
    });
    return () => sub?.remove?.();
  }, []);

  useEffect(() => () => ctl.current?.cancel(), []);

  const cancel = useCallback(() => ctl.current?.cancel(), []);
  const continueNow = useCallback(() => ctl.current?.continueNow(), []);
  /** A restart: the countdown stops and the next conversation gets its own. */
  const resetRedirect = useCallback(() => {
    ctl.current?.cancel();
    setEndedSession(null);
  }, []);

  return { line, conversationEnded, cancel, continueNow, resetRedirect };
}
