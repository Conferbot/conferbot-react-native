/**
 * The home screen in the provider (web conferbot-widget
 * src/ts/home/firstImpression.ts enhanceHome / goToChat, index.ts's view
 * switches, ts/home/visitorMemory.ts, ts/knowledgeBase/kbContent.ts
 * remoteSearch). Holds:
 *
 *   - which view the open chat shows: the home screen, the conversation or
 *     the help centre (core/home.ts safeHomeView: the home only while the
 *     owner has it on). It starts on the home and keeps the last view while
 *     the app runs, as the web keeps it for the page;
 *   - what the device remembers for "Welcome back" (per bot in
 *     AsyncStorage, in memory without storage): the first real question of
 *     the latest conversation the visitor typed in, their first name once a
 *     flow asked for it, when they last wrote;
 *   - the help centre's data from fetched-chatbot-data, for the home's
 *     cards, and the server's search inside article text.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import ConferBotSocket from '../../services/socket';
import type { AsyncStorageInterface } from '../../services/StorageService';
import {
  homeMemoryKey,
  homeOn,
  parseHomeMemory,
  safeHomeView,
  withMessage,
  withName,
  type HomeView,
  type VisitorMemory,
} from '../../core/home';

/** The web's wait for the server's article search (kbContent.ts SEARCH_TIMEOUT_MS). */
export const SEARCH_TIMEOUT_MS = 5000;
/** Into the chat, then the question: the same pause the greeting card's "send" has. */
export const ASK_AFTER_MS = 400;

interface Options {
  botId: string;
  socketClient: MutableRefObject<ConferBotSocket | null>;
  /** The bot's settings (themed, personalised). */
  customizations: any;
  chatSessionId: string | undefined;
  record: any[];
  /** The name a flow asked for (ChatState user metadata). */
  visitorName: () => string | undefined;
  storage: AsyncStorageInterface | null;
  /** Send the visitor's words (the provider's sendMessage). */
  send: (text: string) => Promise<any> | void;
  /** The home screen came into view: read the requests again (at most every 15s). */
  onHomeShown?: () => void;
}

export interface HomeScreenExtras {
  /** The view the open chat shows. */
  view: HomeView;
  /** Back to the home screen (nothing when the owner has none). */
  showHome: () => void;
  /** To the conversation; with `text`, ask it there as the visitor. */
  showChat: (text?: string) => void;
  /** The help centre, on one topic or its list. */
  showHelp: (categoryId?: string) => void;
  /** The topic the help centre opened on, if any. */
  helpCategoryId: string | null;
  memory: VisitorMemory | null;
  knowledgeBase: { categories: any[]; recentArticles: any[] };
  setKnowledgeBase: (kb: any) => void;
  /** The visitor typed this in a live (or agent) chat. */
  rememberText: (text: string) => void;
  /** Matches inside article text from the server ([] on failure). */
  searchArticleText: (query: string) => Promise<Array<{ _id: string; snippet: string }>>;
}

export const useHomeScreen = (o: Options): HomeScreenExtras => {
  const [chosen, setChosen] = useState<HomeView | null>(null);
  const [helpCategoryId, setHelpCategoryId] = useState<string | null>(null);
  const [memory, setMemory] = useState<VisitorMemory | null>(null);
  const [knowledgeBase, setKb] = useState<{ categories: any[]; recentArticles: any[] }>({ categories: [], recentArticles: [] });
  const memoryRef = useRef<VisitorMemory | null>(null);
  const lastName = useRef<string>('');
  const searches = useRef(new Map<string, Array<{ _id: string; snippet: string }>>());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const live = useRef(o);
  live.current = o;

  const view = safeHomeView(o.customizations, chosen);

  const save = useCallback((next: VisitorMemory | null) => {
    if (!next) return;
    memoryRef.current = next;
    setMemory(next);
    const store = live.current.storage;
    if (!store) return;
    try {
      store.setItem(homeMemoryKey(live.current.botId), JSON.stringify(next)).catch(() => {});
    } catch {
      /* storage full or blocked: this app session still remembers */
    }
  }, []);

  // What the device remembers, once per bot.
  useEffect(() => {
    let gone = false;
    memoryRef.current = null;
    setMemory(null);
    searches.current.clear();
    const store = o.storage;
    (store ? store.getItem(homeMemoryKey(o.botId)).catch(() => null) : Promise.resolve(null)).then((raw) => {
      if (gone) return;
      const m = parseHomeMemory(raw);
      // Something written while it loaded wins.
      if (!memoryRef.current) {
        memoryRef.current = m;
        setMemory(m);
      }
    });
    return () => {
      gone = true;
    };
  }, [o.botId]);

  const rememberText = useCallback((text: string) => {
    if (!text || !String(text).trim()) return;
    save(withMessage(memoryRef.current, live.current.chatSessionId, text));
  }, [save]);

  // A flow asked for their name (web index.ts _setUserMetaData "name").
  useEffect(() => {
    const name = String(o.visitorName() || '').trim();
    if (!name || name === lastName.current) return;
    lastName.current = name;
    save(withName(memoryRef.current, name));
  }, [o.record]);

  const setKnowledgeBase = useCallback((kb: any) => {
    setKb({
      categories: Array.isArray(kb?.categories) ? kb.categories : [],
      recentArticles: Array.isArray(kb?.recentArticles) ? kb.recentArticles : [],
    });
  }, []);

  const showHome = useCallback(() => {
    if (homeOn(live.current.customizations)) setChosen('home');
  }, []);

  const showChat = useCallback((text?: string) => {
    setChosen('chat');
    const words = typeof text === 'string' ? text.trim() : '';
    if (!words) return;
    const t = setTimeout(() => {
      timers.current = timers.current.filter((x) => x !== t);
      Promise.resolve(live.current.send(words)).catch(() => {});
    }, ASK_AFTER_MS);
    timers.current.push(t);
  }, []);

  const showHelp = useCallback((categoryId?: string) => {
    setHelpCategoryId(categoryId || null);
    setChosen('help');
  }, []);

  // The home screen came back into view: its requests card reads again.
  useEffect(() => {
    if (view === 'home') live.current.onHomeShown?.();
  }, [view]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /** Web kbContent.ts remoteSearch: `search-kb-articles`, cached per query when it answered. */
  const searchArticleText = useCallback(async (query: string) => {
    const key = String(query || '').trim().toLowerCase();
    if (key.length < 2) return [];
    const hit = searches.current.get(key);
    if (hit) return hit;
    const socket = live.current.socketClient.current;
    if (!socket?.isConnected?.()) return [];
    const reply: any = await socket
      .emitWithAck('search-kb-articles', { chatbotId: live.current.botId, query: key, limit: 10 }, SEARCH_TIMEOUT_MS)
      .catch(() => null);
    const list =
      reply?.success && Array.isArray(reply.articles)
        ? reply.articles.filter((a: any) => a && a._id).map((a: any) => ({ _id: String(a._id), snippet: String(a.snippet || '') }))
        : [];
    // Failures are not kept, so the next keystroke can try again.
    if (reply?.success) searches.current.set(key, list);
    return list;
  }, []);

  return {
    view,
    showHome,
    showChat,
    showHelp,
    helpCategoryId,
    memory,
    knowledgeBase,
    setKnowledgeBase,
    rememberText,
    searchArticleText,
  };
};
