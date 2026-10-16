/**
 * The home screen for an app's own screens (web conferbot-widget
 * src/ts/home/): what it shows (core/home.ts homeModel, null while the
 * owner has no home screen) and where each tap goes. Inside a
 * ConferBotProvider; `<ChatWidget />` draws it with `<HomeScreen />`.
 *
 *   const { model, view, showChat } = useHome();
 *   if (model && view === 'home') ... // draw it, or <HomeScreen />
 */
import { useContext, useMemo } from 'react';
import ConferBotContext from '../context/ConferBotContext';
import { homeModel, type HomeModel, type HomeView } from '../core/home';
import type { ExtendedConferBotContext } from '../context/types';

export interface UseHomeReturn {
  /** What the home screen shows; null when the owner turned it off. */
  model: HomeModel | null;
  view: HomeView;
  showHome: () => void;
  /** To the conversation; with `text`, asked there as the visitor. */
  showChat: (text?: string) => void;
  /** The help centre, on a topic or its list. */
  showHelp: (categoryId?: string) => void;
  /** A help article, over the current view. */
  openArticle: (articleId: string) => void;
  /** "Your requests": the list, or one request. */
  openRequests: (requestId?: string) => void;
  /** Matches inside article text from the server. */
  searchArticleText: (query: string) => Promise<Array<{ _id: string; snippet: string }>>;
}

const noop = () => {};

/** The same from a context value that may be missing (outside a provider: no home). */
export const useHomeOf = (ctx: ExtendedConferBotContext | null | undefined): UseHomeReturn => {
  const c = ctx?.serverCustomizations || null;
  const kb = ctx?.knowledgeBase;
  const model = useMemo(
    () =>
      ctx
        ? homeModel({
            c,
            botName: ctx.botName,
            agent: ctx.agentBot,
            categories: kb?.categories,
            recentArticles: kb?.recentArticles,
            memory: ctx.homeMemory,
            chatSessionId: ctx.chatSessionId,
            requests: ctx.requests,
            seen: ctx.requestsSeen,
          })
        : null,
    // The hour and "welcome back" are read when the view is drawn again.
    [ctx && c, ctx?.botName, ctx?.agentBot, kb, ctx?.homeMemory, ctx?.chatSessionId, ctx?.requests, ctx?.requestsSeen, ctx?.homeView]
  );
  return {
    model,
    view: ctx?.homeView || 'chat',
    showHome: ctx?.showHome || noop,
    showChat: ctx?.showChat || noop,
    showHelp: ctx?.showHelp || noop,
    openArticle: ctx?.openArticle || noop,
    openRequests: ctx?.openRequests || noop,
    searchArticleText: ctx?.searchArticleText || (() => Promise.resolve([])),
  };
};

export const useHome = (): UseHomeReturn => useHomeOf(useContext(ConferBotContext));

export default useHome;
