/**
 * While you wait for a person: the help that may answer the visitor
 * meanwhile, as one card. Ported from the web widget:
 *
 *   - conferbot-widget src/ts/chat/waitArticles.ts: WAIT_BEFORE_MS, the
 *     articles picked for the visitor's last real question
 *     (waitArticlesFor), and the card (mountHelpCard): up to two rows,
 *     "That solved it" when the wait can end there.
 *   - src/ts/chat/handlers/special.ts: the timer's start and stop points
 *     (waitForPerson), lastVisitorText (ASKS_FOR_PERSON), queueServerSeen,
 *     and _wireQueue: the server's own pick (queue-help, or queue-status's
 *     `help`) replacing the card when it has new items, and "That solved it"
 *     sending queue-self-resolve {chatSessionId, articleId}.
 *   - src/ts/home/askBox.ts answersFor / keywordsOf, homeUtils.ts
 *     flattenArticles, knowledgeBase/kbUtils.ts tokenize / searchArticles,
 *     home/visitorMemory.ts isRealQuestion, core/helpCentre.ts helpCentreOn.
 *   - src/ts/chat/handoverState.ts: once the wait is over the card stays as
 *     history under "Articles that might help".
 *
 * The server (embed-server liveChat/queueHelp.js) emits queue-help
 * { chatSessionId, items: [{ kind: 'article' | 'page', id, title,
 * description, url?, score }], offer } to the chat room; at most two cards
 * per wait. Pure: the provider (context/hooks/useWaitingExtras.ts) feeds it.
 */

import { localized } from './i18n';

/** The articles card comes this long into a wait for a person. */
export const WAIT_BEFORE_MS = 6000;
/** "That solved it" waits this long for the server's answer. */
export const SOLVE_TIMEOUT_MS = 8000;

/** The card's words (web wait.*, handover.articlesTitle, queue.leftHelped), in the active language. */
export const WAIT_TEXT = Object.assign(
  localized({
    label: 'wait.label',
    title: 'wait.title',
    /** Once nobody is waiting any more (web handover.articlesTitle). */
    settledTitle: 'handover.articlesTitle',
    read: 'common.read',
    solved: 'wait.solved',
    done: 'wait.done',
    /** The line drawn for a queue left this way (web queue.leftHelped). */
    leftHelped: 'queue.leftHelped',
  }),
  /** What the record keeps (web special.ts leave()): English, for the team. */
  { recordText: 'Resolved while waiting' as const }
);

// ------------------------------------------------------------ help centre

/** The help centre is on only when enableKnowledgeBase is true (web core/helpCentre.ts). */
export const helpCentreOn = (c: any): boolean => !!c && c.enableKnowledgeBase === true;

export interface HelpArticle {
  _id: string;
  title: string;
  description: string;
  categoryName: string;
  _text: string;
}

const plain = (html: unknown): string =>
  String(html ?? '')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Every article the visitor can open, once each: the categories' articles
 * first (they carry the category name), then any recent article not
 * already listed. Only ones with an id and a title (web homeUtils.ts).
 */
export const flattenArticles = (categories: any[], recent: any[] = []): HelpArticle[] => {
  const out: HelpArticle[] = [];
  const seen = new Set<string>();
  const add = (a: any, categoryName: string) => {
    const id = a && a._id ? String(a._id) : '';
    const title = a && typeof a.title === 'string' ? a.title.trim() : '';
    if (!id || !title || seen.has(id)) return;
    seen.add(id);
    out.push({ _id: id, title, description: String(a.description || ''), categoryName, _text: plain(a.content) });
  };
  (Array.isArray(categories) ? categories : []).forEach((c) =>
    (Array.isArray(c?.articles) ? c.articles : []).forEach((a: any) => add(a, String(c?.name || '')))
  );
  (Array.isArray(recent) ? recent : []).forEach((a) => add(a, String(a?.category?.name || '')));
  return out;
};

/** An article by id among the bot's help centre data, or null. */
export const findArticle = (id: string, categories: any[], recent: any[]): any | null => {
  if (!id) return null;
  for (const c of Array.isArray(categories) ? categories : []) {
    const hit = (Array.isArray(c?.articles) ? c.articles : []).find((a: any) => String(a?._id) === id);
    if (hit) return hit;
  }
  return (Array.isArray(recent) ? recent : []).find((a: any) => String(a?._id) === id) || null;
};

// ------------------------------------------------------------ search (web kbUtils.ts, askBox.ts)

export const tokenize = (query: string): string[] => {
  const words = String(query || '')
    .toLowerCase()
    .split(/[^a-z0-9À-￿]+/)
    .filter((w) => w.length > 0);
  // One-letter words only count when they are all there is.
  const long = words.filter((w) => w.length > 1);
  return Array.from(new Set(long.length ? long : words));
};

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Rank articles for a query. Every word must appear somewhere (title,
 * summary, category or body); titles weigh most, then summaries, then the
 * category, then the body. A title that starts with the query wins.
 */
export const searchArticles = <T extends Partial<HelpArticle>>(articles: T[], query: string): T[] => {
  const tokens = tokenize(query);
  if (!tokens.length) return [];
  const phrase = String(query || '').trim().toLowerCase();
  const scored: Array<{ article: T; score: number; index: number }> = [];
  articles.forEach((article, index) => {
    const title = String(article.title || '').toLowerCase();
    const desc = String(article.description || '').toLowerCase();
    const cat = String(article.categoryName || '').toLowerCase();
    const body = String(article._text || '').toLowerCase();
    let score = 0;
    for (const t of tokens) {
      const inTitle = title.includes(t);
      const inDesc = desc.includes(t);
      const inCat = cat.includes(t);
      const inBody = body.includes(t);
      if (!inTitle && !inDesc && !inCat && !inBody) return; // every word must match
      if (inTitle) score += new RegExp(`(^|[^a-z0-9\\u00c0-\\uffff])${escapeRegExp(t)}`).test(title) ? 12 : 8;
      if (inDesc) score += 4;
      if (inCat) score += 3;
      if (inBody) score += 1;
    }
    if (phrase && title.startsWith(phrase)) score += 10;
    else if (phrase && title.includes(phrase)) score += 5;
    scored.push({ article, score, index });
  });
  return scored.sort((a, b) => b.score - a.score || a.index - b.index).map((s) => s.article);
};

// Words that say nothing about what the question is about.
const STOP = new Set(
  (
    'a an and are as at be but by can could did do does for from get got had has have how i if in is it its ' +
    'me my of on or our so that the their them then there this to us was we what when where which who why ' +
    'will with would you your yours about any anyone need want please hi hello hey tell know help there\'s ' +
    "i'm im ive i've dont don't cant can't"
  ).split(/\s+/)
);

/** The words of a question worth matching on (no "how do I ..."). */
export const keywordsOf = (query: string): string[] => tokenize(query).filter((w) => (w.length > 2 || /\d/.test(w)) && !STOP.has(w));

// A word and its plain forms: "changing" also finds "change", "plans" "plan".
const stemsOf = (w: string): string[] => {
  const out = [w];
  if (w.length > 5 && w.endsWith('ing')) out.push(w.slice(0, -3), `${w.slice(0, -3)}e`);
  if (w.length > 4 && w.endsWith('es')) out.push(w.slice(0, -2));
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) out.push(w.slice(0, -1));
  if (w.length > 4 && w.endsWith('ed')) out.push(w.slice(0, -2), w.slice(0, -1));
  return out;
};
const has = (text: string, w: string) => stemsOf(w).some((s) => text.includes(s));

/**
 * The articles that answer a question, best first: those matching every
 * word, then those matching most of its key words, weighted to titles.
 */
export const answersFor = <T extends HelpArticle>(articles: T[], query: string, max = 4): T[] => {
  const strict = searchArticles(articles, query);
  const seen = new Set(strict.map((a) => a._id));
  const words = keywordsOf(query);
  const need = Math.max(1, Math.ceil(words.length / 2));
  const loose = words.length
    ? articles
        .filter((a) => !seen.has(a._id))
        .map((a, index) => {
          const title = a.title.toLowerCase();
          const desc = `${a.description} ${a.categoryName}`.toLowerCase();
          const body = String(a._text || '').toLowerCase();
          let hits = 0;
          let score = 0;
          words.forEach((w) => {
            const t = has(title, w);
            const d = has(desc, w);
            const b = has(body, w);
            if (t || d || b) hits += 1;
            score += (t ? 6 : 0) + (d ? 3 : 0) + (b ? 1 : 0);
          });
          return { a, hits, score, index };
        })
        .filter((r) => r.hits >= need)
        .sort((x, y) => y.hits - x.hits || y.score - x.score || x.index - y.index)
        .map((r) => r.a)
    : [];
  return [...strict, ...loose].slice(0, max);
};

// ------------------------------------------------------------ the question

const GREETING_ONLY =
  /^(hi+|hey+|hello+|yo|hiya|ok(ay)?|thanks?|thank you|thx|ty|yes|no|yep|nope|sure|cool|great|bye|good (morning|afternoon|evening))[\s!.?,]*$/i;

/** Is this a question worth matching (web visitorMemory.ts)? */
export const isRealQuestion = (text: string): boolean => {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length < 10 || t.length > 300) return false;
  if (GREETING_ONLY.test(t)) return false;
  if (/^\S+@\S+\.\S+$/.test(t) || /^[+\d\s().-]{7,}$/.test(t)) return false;
  return t.split(' ').filter((w) => /[a-zÀ-￿]{2,}/i.test(w)).length >= 3;
};

/** "Can I talk to a person" says nothing about the problem (web special.ts). */
export const ASKS_FOR_PERSON =
  /\b(human|person|agent|someone|somebody|representative|operator|real people|staff|talk to|speak to|speak with|call me)\b/i;

/**
 * The visitor's last real question in their own words (web special.ts
 * lastVisitorText): the newest typed message that is a real question and
 * not an ask for a person.
 */
export const waitQuestion = (record: unknown): string => {
  const list = Array.isArray(record) ? record : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const r: any = list[i];
    const kind = String(r?.type || r?.shape || '');
    if (kind !== 'user-message' && kind !== 'user-input-response' && kind !== 'user-live-message' && kind !== 'user-input') continue;
    const text = String(r?.text ?? r?.value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (isRealQuestion(text) && !ASKS_FOR_PERSON.test(text)) return text;
  }
  return '';
};

// ------------------------------------------------------------ the card

export interface HelpItem {
  kind: 'article' | 'page';
  id: string;
  title: string;
  description?: string;
  /** A page's address (http/https only). */
  url?: string;
}

/** The articles to offer for this question (none when the help centre is off). */
export const waitArticlesFor = (c: any, question: string, categories: any[], recent: any[]): HelpItem[] => {
  if (!helpCentreOn(c) || !String(question || '').trim()) return [];
  return answersFor(flattenArticles(categories || [], recent || []), question, 2).map((a) => ({
    kind: 'article',
    id: String(a._id),
    title: a.title,
    ...(a.description ? { description: a.description } : {}),
  }));
};

const safeUrl = (u: unknown) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : '');

/** The server's items (queue-help, queue-status help), cleaned: an id and a title each. */
export const helpItemsOf = (data: any): HelpItem[] =>
  (Array.isArray(data?.items) ? data.items : [])
    .filter((i: any) => i && i.id && typeof i.title === 'string' && i.title.trim())
    .map((i: any) => {
      const kind: HelpItem['kind'] = i.kind === 'page' ? 'page' : 'article';
      const url = kind === 'page' ? safeUrl(i.url) : '';
      return {
        kind,
        id: String(i.id),
        title: String(i.title).trim(),
        ...(typeof i.description === 'string' && i.description.trim() ? { description: i.description.trim() } : {}),
        ...(url ? { url } : {}),
      };
    });

export interface HelpCardState {
  /** Bumped each time a new card replaces the old (it is drawn at the end again). */
  key: number;
  items: HelpItem[];
  /** The wait can end here ("That solved it"): only the server's pick. */
  solvable: boolean;
  /** The wait is over: the history title, no button. */
  settled: boolean;
  /** "That solved it" is waiting for the server. */
  busy: boolean;
  /** Left the queue this way: "Glad that helped." */
  done: boolean;
}

type Timer = unknown;

export interface WaitHelpOptions {
  /** The bot's customizations (the help centre switch). */
  customizations: () => any;
  /** The visitor's last real question (waitQuestion of the record). */
  question: () => string;
  /** The bot's help centre: { categories, recentArticles }. */
  articles: () => { categories: any[]; recentArticles: any[] };
  /** A person is here already (a join the timer missed). */
  joined: () => boolean;
  /** The card changed (null: none). */
  onChange: (card: HelpCardState | null) => void;
  setTimer?: (fn: () => void, ms: number) => Timer;
  clearTimer?: (t: Timer) => void;
}

/**
 * The help card's rules. startWait() where a wait for a person begins
 * (with no AI agent taking it first), endWait() wherever it ends; feed the
 * server's queue-status and queue-help in; solving() / solved(ok) around
 * the queue-self-resolve call.
 */
export const createWaitHelp = (o: WaitHelpOptions) => {
  const setTimer = o.setTimer || ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = o.clearTimer || ((t: Timer) => clearTimeout(t as ReturnType<typeof setTimeout>));
  let timer: Timer | null = null;
  // The server keeps a queue: it picks the help itself, ours stays out.
  let serverSeen = false;
  let helpKey = '';
  let done = false;
  let opened: HelpItem | null = null;
  let card: HelpCardState | null = null;
  let key = 0;

  const set = (next: HelpCardState | null) => {
    card = next;
    o.onChange(card);
  };
  const cancel = () => {
    if (timer) clearTimer(timer);
    timer = null;
  };
  const mount = (items: HelpItem[], solvable: boolean) => {
    if (!items.length) return;
    opened = null;
    key += 1;
    set({ key, items, solvable, settled: false, busy: false, done: false });
  };

  const showServerHelp = (data: any) => {
    const items = helpItemsOf(data);
    const k = items.map((i) => i.id).join(',');
    if (done || !items.length || k === helpKey) return;
    helpKey = k;
    mount(items, true);
  };

  return {
    /** A wait for a person began: after WAIT_BEFORE_MS, the articles for their question. */
    startWait: () => {
      cancel();
      // A new wait: the server's pick and "That solved it" start over (web _wireQueue).
      helpKey = '';
      done = false;
      timer = setTimer(() => {
        timer = null;
        const question = o.question();
        if (!question || serverSeen) return;
        if (o.joined()) return;
        const kb = o.articles();
        mount(waitArticlesFor(o.customizations(), question, kb.categories, kb.recentArticles), false);
      }, WAIT_BEFORE_MS);
    },
    /** The wait ended (a person, nobody, left, ended): no card yet to come; one drawn stays as history. */
    endWait: () => {
      cancel();
      if (card && !card.settled) set({ ...card, settled: true, solvable: card.done ? card.solvable : false, busy: false });
    },
    /** queue-status (event or answer): a waiting status means the server picks the help. */
    queueStatus: (data: any) => {
      if (done || !data || data.status !== 'waiting') return;
      serverSeen = true;
      if (data.help) showServerHelp(data.help);
    },
    /** queue-help: the server's pick for this wait. */
    queueHelp: (data: any) => {
      serverSeen = true;
      showServerHelp(data);
    },
    /** A row was opened (it is the article "That solved it" names). */
    open: (id: string) => {
      opened = card?.items.find((i) => i.id === id) || null;
    },
    /** "That solved it" pressed: the article to send, or null when it cannot go now. */
    solving: (): HelpItem | null => {
      if (!card || !card.solvable || card.busy || card.done || card.settled) return null;
      set({ ...card, busy: true });
      return opened || card.items[0] || null;
    },
    /** The server's answer: ok leaves the queue ("Glad that helped."), else the button comes back. */
    solved: (ok: boolean) => {
      if (!card) return;
      if (!ok) {
        set({ ...card, busy: false });
        return;
      }
      done = true;
      cancel();
      set({ ...card, busy: false, done: true });
    },
    /** Left the queue another way (queue-left from another device): no more server cards. */
    left: () => {
      done = true;
      cancel();
    },
    card: () => card,
    /** A new conversation. */
    reset: () => {
      cancel();
      serverSeen = false;
      helpKey = '';
      done = false;
      opened = null;
      if (card) set(null);
    },
  };
};

export type WaitHelp = ReturnType<typeof createWaitHelp>;
