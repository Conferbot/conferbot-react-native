// @ts-nocheck
/**
 * While the visitor waits for a person, as the web widget has it: the help
 * card (the articles for their question 6s in, or the server's queue-help
 * pick with "That solved it"), the games offer 2.5s after the waiting
 * signal, and a help article opened in the app. The rules are in
 * core/waitArticles.ts, core/waitingGames.ts and core/gamesCard.ts (ported
 * from the web's waitArticles.ts, games/wire.ts, games/ui.ts and
 * handlers/special.ts _wireQueue); this hook feeds them the signals and the
 * socket, and puts each card in the conversation as a screen-only entry
 * ('cb-wait-help', 'cb-games'), never in the record the server keeps and
 * never on the device (filtered out before the messages are saved).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import type ConferBotSocket from '../../services/socket';
import type { RecordItem } from '../../types';
import { HUMAN_JOINED_EVENT, WAITING_FOR_HUMAN_EVENT, WAIT_OVER_EVENT } from '../../core/handoverWaiting';
import { handoverPhase, queueSelfResolvePayload } from '../../core/handoverState';
import { SOLVE_TIMEOUT_MS, createWaitHelp, findArticle, waitQuestion, type HelpCardState, type HelpItem } from '../../core/waitArticles';
import { createGamesOffer, waitingGamesOf } from '../../core/waitingGames';
import { createGamesCard, type GamesCard } from '../../core/gamesCard';

/** The screen-only entries the cards are drawn at. */
export const WAIT_HELP_ENTRY = 'cb-wait-help';
export const GAMES_ENTRY = 'cb-games';
export const isScreenOnlyEntry = (r: any) => r?.type === WAIT_HELP_ENTRY || r?.type === GAMES_ENTRY;

interface Params {
  socketClient: React.MutableRefObject<ConferBotSocket | null>;
  record: RecordItem[];
  setRecord: React.Dispatch<React.SetStateAction<RecordItem[]>>;
  /** The bot's customizations as the widget applies them (themed). */
  customizations: any;
  /** The handover's signals (useHandoverLifecycle onWidgetSignal). */
  onWidgetSignal: (name: any, fn: (detail: any) => void) => () => void;
  /** Out of the queue because an article helped: the line, the record, the flow on. */
  leftQueueHelped: () => void;
  /** An article the help centre data does not hold (GET knowledge-base/article/:id). */
  fetchArticle?: (id: string) => Promise<any | null>;
}

export function useWaitingExtras({ socketClient, record, setRecord, customizations, onWidgetSignal, leftQueueHelped, fetchArticle }: Params) {
  const recordRef = useRef(record);
  recordRef.current = record;
  const cRef = useRef(customizations);
  cRef.current = customizations;
  // The bot's help centre from fetched-chatbot-data.
  const kbRef = useRef<{ categories: any[]; recentArticles: any[] }>({ categories: [], recentArticles: [] });
  const reducedRef = useRef(false);
  const [helpCard, setHelpCard] = useState<HelpCardState | null>(null);
  const [gamesCard, setGamesCard] = useState<GamesCard | null>(null);
  const [article, setArticle] = useState<any | null>(null);

  useEffect(() => {
    let live = true;
    const a11y: any = AccessibilityInfo;
    Promise.resolve(a11y?.isReduceMotionEnabled?.())
      .then((on) => {
        if (live) reducedRef.current = !!on;
      })
      .catch(() => {});
    const sub = a11y?.addEventListener?.('reduceMotionChanged', (on: boolean) => (reducedRef.current = !!on));
    return () => {
      live = false;
      sub?.remove?.();
    };
  }, []);

  const sid = () => socketClient.current?.chatSessionId || '';

  /** The card's entry at the end of the conversation (one of each kind, moved when replaced). */
  const placeEntry = useCallback(
    (type: string, id: string | null) => {
      setRecord((prev) => {
        const rest = prev.filter((r: any) => r?.type !== type);
        return id ? [...rest, { _id: id, type, time: new Date().toISOString() } as any] : rest;
      });
    },
    [setRecord]
  );

  const help = useRef(
    createWaitHelp({
      customizations: () => cRef.current,
      question: () => waitQuestion(recordRef.current),
      articles: () => kbRef.current,
      joined: () => handoverPhase(recordRef.current) === 'joined',
      onChange: (card) => {
        setHelpCard(card);
        if (!card) placeEntry(WAIT_HELP_ENTRY, null);
      },
    })
  ).current;

  // A new card (its key) is drawn after the conversation so far.
  useEffect(() => {
    if (helpCard) placeEntry(WAIT_HELP_ENTRY, `${WAIT_HELP_ENTRY}-${helpCard.key}`);
  }, [helpCard?.key]);

  const gamesSeq = useRef(0);
  const gamesRef = useRef<GamesCard | null>(null);
  const offer = useRef(
    createGamesOffer({
      enabled: () => waitingGamesOf(cRef.current).enabled,
      mount: (mode) => {
        const card = createGamesCard({
          customizations: cRef.current,
          categories: kbRef.current.categories,
          recentArticles: kbRef.current.recentArticles,
          mode,
          reducedMotion: reducedRef.current,
          onDismiss: () => offer.dismissed(),
        });
        if (!card) return null;
        const n = ++gamesSeq.current;
        // Gone (Not now, the x, the wait over, a person joined before it was played): off the screen.
        card.subscribe((s) => {
          if (s.view === 'gone' && gamesSeq.current === n) {
            gamesRef.current = null;
            setGamesCard(null);
            placeEntry(GAMES_ENTRY, null);
          }
        });
        gamesRef.current = card;
        setGamesCard(card);
        placeEntry(GAMES_ENTRY, `${GAMES_ENTRY}-${n}`);
        return card;
      },
    })
  ).current;

  // The handover's signals.
  useEffect(() => {
    const offs = [
      onWidgetSignal(WAITING_FOR_HUMAN_EVENT, () => offer.waiting()),
      onWidgetSignal(HUMAN_JOINED_EVENT, (d: any) => {
        help.endWait();
        offer.joined(d?.name || '');
      }),
      onWidgetSignal(WAIT_OVER_EVENT, () => {
        help.endWait();
        offer.waitOver();
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [onWidgetSignal]);

  /** The socket: the server's pick of help, and the queue it keeps. */
  const setupWaitingListeners = useCallback(() => {
    const socket = socketClient.current;
    if (!socket) return;
    const own = (data: any) => !data?.chatSessionId || !sid() || data.chatSessionId === sid();
    socket.on('queue-help', (data: any) => {
      if (own(data)) help.queueHelp(data);
    });
    socket.on('queue-left', (data: any) => {
      if (own(data) && data?.reason === 'self_service') help.left();
    });
  }, []);

  /** queue-status, from the event or the poll's answer (useLiveChatExtras). */
  const onQueueStatus = useCallback((data: any) => {
    if (data && (!data.chatSessionId || !sid() || data.chatSessionId === sid())) help.queueStatus(data);
  }, []);

  /** "That solved it": queue-self-resolve with the article; ok leaves the queue. */
  const solveWait = useCallback(async (): Promise<boolean> => {
    const item = help.solving();
    if (!item) return false;
    const res = await socketClient.current?.emitWithAck('queue-self-resolve', queueSelfResolvePayload(sid(), item.id), SOLVE_TIMEOUT_MS);
    const ok = res?.ok === true;
    help.solved(ok);
    if (ok) leftQueueHelped();
    return ok;
  }, [leftQueueHelped]);

  /** A help article opened in the app (found in the help centre data, else asked for). */
  const openArticle = useCallback(
    async (id: string) => {
      if (!id) return;
      help.open(id);
      const kb = kbRef.current;
      const found = findArticle(id, kb.categories, kb.recentArticles);
      if (found) return setArticle(found);
      const fetched = fetchArticle ? await fetchArticle(id).catch(() => null) : null;
      if (fetched) setArticle(fetched);
    },
    [fetchArticle]
  );

  /** A row of the help card: an article in the app (a page opens in the browser, in the view). */
  const openHelpItem = useCallback((item: HelpItem) => {
    help.open(item.id);
    if (item.kind === 'article') openArticle(item.id);
  }, [openArticle]);

  const closeArticle = useCallback(() => setArticle(null), []);

  /** The visitor's words while waiting: "play" opens the games instead (true: do not send). */
  const interceptPlay = useCallback((text: string) => offer.play(text), []);

  /** fetched-chatbot-data's knowledgeBaseData. */
  const setKnowledgeBase = useCallback((kb: any) => {
    kbRef.current = {
      categories: Array.isArray(kb?.categories) ? kb.categories : [],
      recentArticles: Array.isArray(kb?.recentArticles) ? kb.recentArticles : [],
    };
  }, []);

  /** Where the handover begins and ends a wait for a person (useHandoverLifecycle). */
  const waitHooks = useRef({ start: () => help.startWait(), end: () => help.endWait() }).current;

  const resetWaiting = useCallback(() => {
    help.reset();
    offer.reset();
    gamesRef.current?.remove();
    gamesRef.current = null;
    gamesSeq.current += 1;
    setGamesCard(null);
    setArticle(null);
  }, []);

  useEffect(
    () => () => {
      help.reset();
      offer.reset();
      gamesRef.current?.remove();
    },
    []
  );

  return {
    helpCard,
    gamesCard,
    article,
    waitHooks,
    setupWaitingListeners,
    onQueueStatus,
    solveWait,
    openArticle,
    openHelpItem,
    closeArticle,
    interceptPlay,
    setKnowledgeBase,
    resetWaiting,
  };
}

export type WaitingExtras = ReturnType<typeof useWaitingExtras>;
