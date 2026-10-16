/**
 * The home screen: what the visitor sees when the chat opens, before they
 * have said anything, and the shortest path from there to an answer.
 * Ported from the web widget (all under conferbot-widget/src/):
 *
 *   ts/home/firstImpression.ts  enhanceHome, buildHelpCard: what shows and in what order
 *   ts/home/homeCopy.ts          honest words for early bots' placeholder copy
 *   ts/home/homeUtils.ts         salutation, topCategories, isLight, homeBrand, homeCardAvatar
 *   ts/home/askBox.ts            "Ask anything": askBoxOn, askPlaceholder, the list as rows
 *   ts/home/trust.ts             the team's faces, the rating, the customer logos
 *   ts/home/visitorMemory.ts     "Welcome back, Jamie", "Pick up where you left off"
 *   ts/home/requests/card.ts     "Your requests" on the home screen
 *   ts/chat/replyTimeView.ts     decorateHomeReply: the card's status line
 *   core/helpCentre.ts           showsRecentArticles, publishedArticles
 *   templates/shared.ts          generateInitialPage: the template the above decorate
 *   core/customizations.ts       enableInitialPage, initialPageCardButtonText, homeAskBox...
 *   ts/i18n/en.ts                home.*, trust.*, requests.* (English)
 *
 * The home exists only when the owner turned it on (`enableInitialPage`);
 * with it off the chat opens straight on the conversation, as the web's
 * templates and core/state.ts decide.
 *
 * Not in an app, on purpose: the page-aware parts (ts/home/pageAware.ts -
 * "For this page" articles and a greeting page rule's own questions; an app
 * has no page address or title, so the agent's own questions are used), the
 * help card's own search's "For this page", and the floating panel's
 * three-article cap (wider than 500px only). The web's home draws no mascot
 * (it appears on the launcher, the greeting card, the typing bubble and the
 * idle call); `HomeModel.mascot` is the owner's, for an app's own
 * `<HomeScreen renderMascot>` (components/Mascot `<Mascot>`).
 *
 * Pure: everything the view needs comes out of `homeModel`.
 */
import { t, localized, ownerTextOr, stockText } from './i18n';
import { mascotLookOf, type MascotLook } from './mascotArt';
import { answersFor, flattenArticles, helpCentreOn, isRealQuestion, keywordsOf, searchArticles, tokenize, type HelpArticle } from './waitArticles';
import { homePeople, STRINGS as REPLY, type Tone } from './replyTime';
import { isNewReply, ordered, rowLine, stateOf, requestsAccent, ON_HOME, type RequestState, type RequestSummary } from './requests';

// ------------------------------------------------------------ words (web ts/i18n home.*, trust.*, requests.*)

const homeWords = Object.assign(
  localized({
    title: 'home.title',
    description: 'home.description',
    onlineNow: 'home.onlineNow',
    support: 'home.support',
    chatWithUs: 'home.chatWithUs',
    ourAssistant: 'home.ourAssistant',
    resume: 'home.resume',
    continueConversation: 'home.continueConversation',
    askAgain: 'home.askAgain',
    helpCentre: 'home.helpCentre',
    recentArticles: 'home.recentArticles',
    seeAll: 'home.seeAll',
    searchPlaceholder: 'home.searchPlaceholder',
    searchLabel: 'kb.searchLabel',
    askInstead: 'home.askInstead',
    chatInstead: 'home.chatInstead',
    askPlaceholder: 'home.askPlaceholder',
    wellHelp: 'home.wellHelp',
    articles: 'tabs.articles',
    goodMorning: 'home.goodMorning',
    goodAfternoon: 'home.goodAfternoon',
    goodEvening: 'home.goodEvening',
    hello: 'home.hello',
    welcomeBack: 'home.welcomeBack',
    requestsTitle: 'requests.title',
    review: 'trust.review',
    reviews: 'trust.reviews',
    ourTeam: 'trust.ourTeam',
    customerLogo: 'trust.customerLogo',
    close: 'common.close',
    back: 'common.back',
  }),
  {
    noMatch: (query: string): string => t('kb.noMatch', { query }),
    askLabel: (name: string): string => t('home.askLabel', { name }),
    answersRightAway: (name: string): string => t('home.answersRightAway', { name }),
    welcomeBackName: (name: string): string => t('home.welcomeBackName', { name }),
    requestsSeeAll: (n: number): string => t('requests.seeAll', { n }),
    rated: (avg: string, count: number, reviews: string): string => t('trust.rated', { avg, count, reviews }),
  }
);

/** The home screen's words, read in the active language when drawn. */
export const HOME_TEXT = homeWords as typeof homeWords & {
  /** "Ask" before the bold query (see askQueryParts for languages that put it after). */
  readonly askQuery: string;
};

/**
 * "Ask “<query>”": the words around the query, which is drawn bold (web
 * home.askQuery "Ask {query}"): ["Ask ", ""] in English.
 */
export const askQueryParts = (): [string, string] => {
  const [before, after = ''] = t('home.askQuery').split('{query}');
  return [before, after];
};
Object.defineProperty(HOME_TEXT, 'askQuery', { enumerable: true, get: () => askQueryParts()[0].trim() });

// ------------------------------------------------------------ on or off

/**
 * Is there a home screen at all? The web's templates draw it when
 * `enableInitialPage` is truthy (core/customizations.ts keeps
 * `c.enableInitialPage || false`), and the panel opens on it.
 */
export const homeOn = (c: any): boolean => !!c && !!c.enableInitialPage;

/** A view that cannot be shown falls back (web core/helpCentre.ts safeView). */
export type HomeView = 'home' | 'chat' | 'help';
export const safeHomeView = (c: any, view: HomeView | null | undefined): HomeView => {
  const home = homeOn(c);
  if (view === 'help') return helpCentreOn(c) ? 'help' : home ? 'home' : 'chat';
  if (view === 'home') return home ? 'home' : 'chat';
  if (view === 'chat') return 'chat';
  return home ? 'home' : 'chat';
};

// ------------------------------------------------------------ the help centre's articles

/** Drafts never show (web core/helpCentre.ts publishedArticles). */
export const publishedArticles = <T extends { _id?: string; reviewStatus?: string }>(list: T[] | null | undefined): T[] =>
  (Array.isArray(list) ? list : []).filter(
    (a) => !!a && typeof a === 'object' && !!a._id && (a.reviewStatus === undefined || a.reviewStatus === 'published')
  );

const publishedCategories = (categories: any[] | null | undefined): any[] =>
  (Array.isArray(categories) ? categories : []).map((c) => (c && Array.isArray(c.articles) ? { ...c, articles: publishedArticles(c.articles) } : c));

/**
 * The help centre counts as on: the owner's switch, and at least one
 * published article (web index.ts: a help centre with no published
 * articles is a blank screen and counts as off).
 */
export const helpOn = (c: any, categories: any[] | null | undefined, recent: any[] | null | undefined): boolean => {
  if (!helpCentreOn(c)) return false;
  const inCategories = publishedCategories(categories).some((cat) => Array.isArray(cat?.articles) && cat.articles.length);
  return inCategories || publishedArticles(recent).length > 0;
};

/**
 * ChatWidgetWithKB's help centre (its tab, header button and modal):
 * follows the owner's switch, as the web does (core/helpCentre.ts rule 1).
 * Precedence: the host's `enableKnowledgeBase` prop when it is set (true or
 * false: an explicit override), else the owner's `enableKnowledgeBase`
 * (on only when true), else off - also before the bot's settings arrive.
 */
export const kbWidgetOn = (override: boolean | null | undefined, c: any): boolean =>
  typeof override === 'boolean' ? override : helpCentreOn(c);

/**
 * The categories ChatWidgetWithKB browses: the host's `kbCategories` when it
 * passes any, else the bot's help centre (fetched-chatbot-data
 * knowledgeBaseData), drafts left out and empty topics dropped.
 */
export const kbWidgetCategories = (hostCategories: any[] | null | undefined, kbCategories: any[] | null | undefined): any[] => {
  if (Array.isArray(hostCategories) && hostCategories.length) return hostCategories;
  return publishedCategories(kbCategories).filter((cat) => cat && Array.isArray(cat.articles) && cat.articles.length);
};

/** The home screen's Recent articles list (web core/helpCentre.ts showsRecentArticles). */
export const showsRecentArticles = (c: any, articles: any[] | null | undefined): boolean =>
  !!c && c.enableInitialPage === true && helpCentreOn(c) && c.hideRecentArticles !== true && publishedArticles(articles).length > 0;

/** The categories worth a shortcut: named, not empty, most articles first (ties keep order). */
export const topCategories = (categories: any[], max = 4): any[] =>
  (Array.isArray(categories) ? categories : [])
    .map((c, i) => ({ c, i, n: Array.isArray(c?.articles) ? c.articles.length : 0 }))
    .filter((x) => x.n > 0 && String(x.c?.name || '').trim())
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .slice(0, max)
    .map((x) => x.c);

// ------------------------------------------------------------ the header

/** "Good morning" / "Good afternoon" / "Good evening" by the visitor's clock. */
export const salutation = (hour: number): string => {
  const h = Number.isFinite(hour) ? ((Math.floor(hour) % 24) + 24) % 24 : 12;
  if (h >= 5 && h < 12) return HOME_TEXT.goodMorning;
  if (h >= 12 && h < 18) return HOME_TEXT.goodAfternoon;
  if (h >= 18 && h < 23) return HOME_TEXT.goodEvening;
  return HOME_TEXT.hello;
};

/**
 * Who the home screen is from: the logo and name the chat header shows.
 * Null when the owner hid the logo or there is no usable image.
 */
export const homeBrand = (c: any, fallbackName = ''): { logo: string; name: string } | null => {
  if (!c || c.hideLogo) return null;
  const logo = typeof c.logo === 'string' ? c.logo.trim() : '';
  if (!logo || !/^(https?:|data:image\/|blob:|\/)/i.test(logo)) return null;
  const name = String((typeof c.logoText === 'string' && c.logoText.trim()) || fallbackName || '').replace(/\s+/g, ' ').trim();
  return { logo, name };
};

const CONFERBOT_FACE = 'https://prd.media.cdn.conferbot.com/62829a1c49f355163dfdbfb2/conferbot-logo-1710782074234.png';
const ownImage = (v: unknown): string => (typeof v === 'string' && v.trim() && !/conferbot-logo/i.test(v) ? v.trim() : '');

/** The card's face when the owner set none: the bot's avatar, then its logo, then Conferbot's. */
export const homeCardAvatar = (c: any): string =>
  (typeof c?.initialPageAvatar === 'string' && c.initialPageAvatar.trim()) ||
  (!c?.hideAvatar ? ownImage(c?.avatar) : '') ||
  (!c?.hideLogo ? ownImage(c?.logo) : '') ||
  CONFERBOT_FACE;

// ------------------------------------------------------------ honest words (web homeCopy.ts)

const norm = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().toLowerCase() : '');
const LEGACY_TITLES = ['our usual reply time', 'our usual reply time is'];
const LEGACY_TAGLINES = ['later today', 'a few hours', 'within a day'];
const isLegacyDescription = (v: unknown) => {
  const n = norm(v);
  return !n || n.startsWith('welcome to the conferbot') || n === 'we help your business to connect with your customer';
};

export interface HomeCopy {
  /** Who answers: the owner's card title, else the bot's (or agent's) name. */
  cardTitle: string;
  cardTagline: string;
  description: string;
  /** Whether the tagline is ours (so the status line replaces it). */
  online: boolean;
}

export const homeCopy = (c: any, name: string): HomeCopy => {
  const title = norm(c?.initialPageCardSubTitle);
  const tagline = norm(c?.initialPageCardTagline);
  const ownTagline = !!tagline && !LEGACY_TAGLINES.includes(tagline);
  return {
    cardTitle: !title || LEGACY_TITLES.includes(title) ? name || HOME_TEXT.support : String(c.initialPageCardSubTitle).trim(),
    cardTagline: ownTagline ? String(c.initialPageCardTagline).trim() : HOME_TEXT.onlineNow,
    description: isLegacyDescription(c?.initialPageDescription) ? HOME_TEXT.description : String(c.initialPageDescription),
    online: !ownTagline,
  };
};

const plainText = (v: string) => v.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// ------------------------------------------------------------ colours

/** Parse "#abc", "#aabbcc" or "rgb(a, b, c)" to [r, g, b]; null for anything else. */
export const parseColor = (value: string): [number, number, number] | null => {
  const s = String(value || '').trim();
  const m = s.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) {
    let hex = m[1];
    if (hex.length === 3) hex = hex.split('').map((ch) => ch + ch).join('');
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = s.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
};

/** True when white text would not read on this colour (relative luminance above ~0.55). */
export const isLight = (rgb: [number, number, number] | null): boolean => {
  if (!rgb) return false;
  const lin = (ch: number) => {
    const s = ch / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]) > 0.55;
};

/** The band's two colours: the launcher's gradient, else its solid colour (firstImpression.ts brandColors). */
export const brandColors = (c: any): [string, string] => {
  if (c?.widgetIconThemeType === 'Gradient' && c?.widgetGradientBgOne && c?.widgetGradientBgTwo) return [c.widgetGradientBgOne, c.widgetGradientBgTwo];
  const solid = c?.widgetIconBgColor || c?.headerBgColor || '#4f46e5';
  return [solid, solid];
};

/**
 * The home screen's surfaces: the widget theme's canvas, cards, quiet fills
 * and text (core/widgetTheme.ts tokens: bg2 is "home screen, help
 * centre"), else the classic widget's (web polish.css / polish-home.css:
 * page #f6f7fb, white cards, #0f172a ink, #64748b muted, #f1f5f9 fills).
 */
export interface HomePalette {
  page: string;
  card: string;
  soft: string;
  ink: string;
  muted: string;
  line: string;
}
export const CLASSIC_HOME_PALETTE: HomePalette = { page: '#f6f7fb', card: '#ffffff', soft: '#f1f5f9', ink: '#0f172a', muted: '#64748b', line: '#f1f5f9' };
export const homePalette = (tokens: { bg2?: string; card?: string; card2?: string; ink?: string; muted?: string; line?: string } | null | undefined): HomePalette =>
  tokens && tokens.bg2 && tokens.card && tokens.ink
    ? { page: tokens.bg2, card: tokens.card, soft: tokens.card2 || tokens.bg2, ink: tokens.ink, muted: tokens.muted || tokens.ink, line: tokens.line || tokens.card2 || tokens.bg2 }
    : CLASSIC_HOME_PALETTE;

// ------------------------------------------------------------ trust (web trust.ts)

export interface HomeRating {
  average: number;
  count: number;
}

const SAFE_IMAGE = /^https:\/\/[^\s"'<>]+$/i;

/** The owner's images, https only, once each, at most `max`. */
export const trustImages = (list: unknown, max: number): string[] =>
  (Array.isArray(list) ? list : [])
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((url, i, all) => SAFE_IMAGE.test(url) && all.indexOf(url) === i)
    .slice(0, max);

/** A count as people say it: 120, 1.2k, 12k. */
export const compactCount = (n: number): string => {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  if (v < 1000) return String(v);
  const k = v / 1000;
  return `${k < 10 ? Math.floor(k * 10) / 10 : Math.floor(k)}k`;
};

/** The rating to show (the server's average of real post-chat scores), or null. */
export const ratingLine = (r: any): { average: string; count: string; fill: number; label: string } | null => {
  const average = Number(r?.average);
  const count = Math.floor(Number(r?.count));
  if (!Number.isFinite(average) || average < 1 || average > 5 || !Number.isFinite(count) || count < 1) return null;
  const avg = average.toFixed(1);
  const many = count === 1 ? HOME_TEXT.review : HOME_TEXT.reviews;
  return {
    average: avg,
    count: `${compactCount(count)} ${many}`,
    // The stars fill to the average shown, so they agree with the number.
    fill: Math.round((Number(avg) / 5) * 1000) / 10,
    label: HOME_TEXT.rated(avg, count, many),
  };
};

// ------------------------------------------------------------ visitor memory (web visitorMemory.ts)

/** Per bot, on the device only (web localStorage `cb_mem_<botId>`). */
export const homeMemoryKey = (botId: string) => `@conferbot:memory:${botId || 'default'}`;
const FORGET_AFTER_MS = 60 * 24 * 60 * 60 * 1000;
/** The web restores a live chat this long after its last message (BOT_STATE_EXPIRY). */
export const LIVE_CHAT_MS = 30 * 60 * 1000;

export interface VisitorMemory {
  name?: string;
  /** The first real question of their latest conversation. */
  topic?: string;
  /** The conversation that question came from. */
  session?: string;
  /** Last time they wrote. */
  at: number;
}

export { isRealQuestion };

/** What the device remembers, or null (none, broken, or older than 60 days). */
export const parseHomeMemory = (raw: string | null | undefined, now = Date.now()): VisitorMemory | null => {
  try {
    const m = JSON.parse(raw || 'null');
    if (!m || typeof m !== 'object' || typeof m.at !== 'number' || now - m.at > FORGET_AFTER_MS) return null;
    return {
      at: m.at,
      name: typeof m.name === 'string' ? m.name.slice(0, 40) : undefined,
      topic: typeof m.topic === 'string' ? m.topic.slice(0, 160) : undefined,
      session: typeof m.session === 'string' ? m.session : undefined,
    };
  } catch {
    return null;
  }
};

const fresh = (m: VisitorMemory | null, now: number): VisitorMemory | null => (m && now - m.at <= FORGET_AFTER_MS ? m : null);

/** They wrote `text` in conversation `session` (web rememberMessage). */
export const withMessage = (m: VisitorMemory | null, session: string | null | undefined, text: string, now = Date.now()): VisitorMemory => {
  const next: VisitorMemory = { ...(fresh(m, now) || { at: now }) };
  next.at = now;
  // A new conversation's first real question becomes what they came for.
  if (session && next.session !== session && isRealQuestion(text)) {
    next.topic = String(text).replace(/\s+/g, ' ').trim().slice(0, 160);
    next.session = session;
  }
  return next;
};

/** They told us their name (web rememberName): a first name, or null when it is not one. */
export const withName = (m: VisitorMemory | null, name: string, now = Date.now()): VisitorMemory | null => {
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  if (!first || first.length > 40 || /[@\d<>]/.test(first)) return null;
  const next: VisitorMemory = { ...(fresh(m, now) || { at: now }) };
  next.name = first.charAt(0).toUpperCase() + first.slice(1);
  return next;
};

/**
 * "Welcome back[, Name]" once their last chat is over (not while the web
 * would still restore it), and the question to pick up. null for a first visit.
 */
export const welcomeBack = (m: VisitorMemory | null, now = Date.now()): { hello: string; topic: string | null } | null => {
  if (!m || now - m.at < LIVE_CHAT_MS) return null;
  if (!m.topic && !m.name) return null;
  return { hello: m.name ? HOME_TEXT.welcomeBackName(m.name) : HOME_TEXT.welcomeBack, topic: m.topic || null };
};

/** The remembered conversation is the one on the device, so the card can open it (web canResume). */
export const canResume = (m: VisitorMemory | null, chatSessionId: string | null | undefined): boolean =>
  !!(m?.session && chatSessionId && m.session === chatSessionId);

// ------------------------------------------------------------ "Ask anything" (web askBox.ts)

/** Whether the box shows at all: the owner's switch (on unless off), and an agent or an article to find. */
export const askBoxOn = (c: any, hasAgent: boolean, hasArticles: boolean): boolean => c?.homeAskBox !== false && (hasAgent || hasArticles);

/** The box's words: a question for an agent, a search for articles alone. */
export const askPlaceholder = (hasAgent: boolean, hasArticles: boolean): string =>
  hasAgent ? HOME_TEXT.askPlaceholder : hasArticles ? HOME_TEXT.searchPlaceholder : '';

/** A run of text, marked where it matches the question (web kbUtils.ts highlight). */
export interface TextRun {
  text: string;
  mark?: boolean;
}
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const highlightRuns = (text: string, tokens: string[]): TextRun[] => {
  const source = String(text || '');
  const words = tokens.filter(Boolean).sort((a, b) => b.length - a.length);
  if (!words.length || !source) return [{ text: source }];
  const re = new RegExp(`(${words.map(escapeRegExp).join('|')})`, 'gi');
  const out: TextRun[] = [];
  let last = 0;
  source.replace(re, (match: string, _g: string, offset: number) => {
    if (offset > last) out.push({ text: source.slice(last, offset) });
    out.push({ text: match, mark: true });
    last = offset + match.length;
    return match;
  });
  if (last < source.length) out.push({ text: source.slice(last) });
  return out;
};

export type AskRow =
  /** Ask the agent this question: the chat opens and asks. */
  | { kind: 'ask'; key: string; query: string; sub: string }
  | { kind: 'label'; key: string; text: string }
  | { kind: 'article'; key: string; id: string; title: TextRun[]; sub: string }
  | { kind: 'none'; key: string; text: string }
  /** A flow bot with nothing found: open the chat. */
  | { kind: 'chat'; key: string; title: string; sub: string };

/** Matches inside article text from the server, for the query they were asked for. */
export interface RemoteHits {
  query: string;
  hits: Array<{ _id: string; snippet: string }>;
}

/**
 * The list under the box as the visitor types (web askBox.ts render): for
 * an agent first "Ask “...”"; the articles that answer it (best first, at
 * most 4, the server's body matches after the local ones); for a flow bot
 * with nothing found, "No articles match" and "Chat with us". Empty while
 * the box is empty. The first row that does something is what Enter picks.
 */
export const askRows = (query: string, o: { agentName: string | null; articles: HelpArticle[]; remote?: RemoteHits | null }): AskRow[] => {
  const q = String(query || '').trim();
  if (!q) return [];
  const words = keywordsOf(q);
  const tokens = words.length ? words : tokenize(q);
  const found: HelpArticle[] = answersFor(o.articles, q, 4).slice();
  if (o.remote && o.remote.query === q.toLowerCase()) {
    const byId = new Map(o.articles.map((a) => [a._id, a]));
    o.remote.hits
      .filter((h) => byId.has(h._id) && !found.some((a) => a._id === h._id))
      .slice(0, Math.max(0, 4 - found.length))
      .forEach((h) => found.push({ ...(byId.get(h._id) as HelpArticle), description: h.snippet }));
  }
  const rows: AskRow[] = [];
  if (o.agentName) rows.push({ kind: 'ask', key: 'ask', query: q, sub: HOME_TEXT.answersRightAway(o.agentName) });
  if (found.length) {
    rows.push({ kind: 'label', key: 'label', text: HOME_TEXT.articles });
    found.forEach((a) => rows.push({ kind: 'article', key: `a-${a._id}`, id: a._id, title: highlightRuns(a.title, tokens), sub: a.description || a.categoryName }));
  } else if (!o.agentName) {
    rows.push({ kind: 'none', key: 'none', text: HOME_TEXT.noMatch(q) });
    rows.push({ kind: 'chat', key: 'chat', title: HOME_TEXT.chatWithUs, sub: HOME_TEXT.wellHelp });
  }
  return rows;
};

/** What Enter does: the first row that does something. */
export const askDefault = (rows: AskRow[]): AskRow | null => rows.find((r) => r.kind === 'ask' || r.kind === 'article' || r.kind === 'chat') || null;

/**
 * What to ask the server for matches inside article bodies (web
 * askBox.ts askRemote): the question's two longest key words, or null when
 * there is nothing to ask or no article lacks its body.
 */
export const remoteQueryFor = (query: string, articles: any[]): string | null => {
  if (!(Array.isArray(articles) ? articles : []).some((a) => a && typeof a.content !== 'string')) return null;
  const words = keywordsOf(String(query || '').trim());
  if (!words.length) return null;
  const key = words.sort((a, b) => b.length - a.length).slice(0, 2).join(' ');
  return key.length < 2 ? null : key;
};

/** The help card's own search, when the ask box is off (web buildHelpCard render). */
export type HelpSearch =
  | { kind: 'results'; rows: Array<{ id: string; title: TextRun[]; sub: string }> }
  | { kind: 'empty'; text: string; action: string; asks: boolean };
export const helpSearch = (query: string, articles: HelpArticle[], hasAgent: boolean): HelpSearch | null => {
  const q = String(query || '').trim();
  if (!q) return null;
  const tokens = tokenize(q);
  const found = searchArticles(articles, q).slice(0, 5);
  if (found.length) return { kind: 'results', rows: found.map((a) => ({ id: a._id, title: highlightRuns(a.title, tokens), sub: a.categoryName || a.description })) };
  return { kind: 'empty', text: HOME_TEXT.noMatch(q), action: hasAgent ? HOME_TEXT.askInstead : HOME_TEXT.chatInstead, asks: hasAgent };
};

// ------------------------------------------------------------ the model

export interface HomeAgent {
  displayName?: string;
  starters?: string[];
  avatar?: string | null;
}

export interface HomeInput {
  /** The bot's settings (themed and personalised, as the chat uses them). */
  c: any;
  botName?: string | null;
  /** The bot's AI agent (a no-flow agent bot), else null. */
  agent?: HomeAgent | null;
  categories?: any[];
  recentArticles?: any[];
  memory?: VisitorMemory | null;
  /** The conversation on the device. */
  chatSessionId?: string | null;
  /** The visitor's requests (null until read) and when each was last read here. */
  requests?: RequestSummary[] | null;
  seen?: Record<string, number>;
  now?: number;
  /** The visitor's hour (0-23), for the salutation. */
  hour?: number;
}

export interface HomeArticleRow {
  id: string;
  title: string;
  description: string;
  /** The cover image, when it has one (else the document icon). */
  image: string | null;
}

export interface HomeRequestRow {
  id: string;
  title: string;
  line: string;
  state: RequestState;
  fresh: boolean;
}

export type HomeSection = 'ask' | 'resume' | 'requests' | 'talk' | 'help' | 'trust';

export interface HomeModel {
  /** "Good afternoon", or "Welcome back, Jamie". */
  hello: string;
  brand: { logo: string; name: string } | null;
  /** The owner's title (may be empty, as the web prints it). */
  title: string;
  description: string;
  /** The owner's line above the card (initialPageMessage), or "". */
  message: string;
  /** The band behind the top: the launcher's colours; light means dark ink on it. */
  band: [string, string];
  light: boolean;
  /** Chips, links and the ask box's ring (web --cb-accent). */
  accent: string;
  talk: {
    avatar: string;
    title: string;
    /** The owner's own tagline (kept), else null (the status line takes its place). */
    tagline: string | null;
    /** "Online · Usually replies in a few minutes"; null when there is nothing to say. */
    status: string | null;
    tone: Tone;
    /** The green dot on the avatar (off with hideOnlineStatus). */
    dot: boolean;
    button: string;
    /** An AI agent's suggested questions: one tap opens the chat and asks. */
    starters: string[];
    /** The team's photos, a small stack at the end of the name row. */
    faces: string[];
    rating: { average: string; count: string; fill: number; label: string } | null;
  };
  ask: { placeholder: string; label: string; agentName: string | null } | null;
  resume: { topic: string; line: string; resumable: boolean } | null;
  requests: { rows: HomeRequestRow[]; total: number; seeAll: string | null; fresh: boolean } | null;
  help: {
    title: string;
    recent: HomeArticleRow[];
    seeAll: boolean;
    topics: Array<{ id: string; name: string; count: number }>;
    /** The card's own search (only when the ask box is not there). */
    search: boolean;
  } | null;
  trust: { label: string; logos: string[] } | null;
  /** The cards from the top down. */
  order: HomeSection[];
  /** Every article the ask box and the help card search. */
  articles: HelpArticle[];
  /** The owner's mascot (art3d mascotLookOf) and its colour, for an app that draws it on its home (renderMascot); the web's home has none. */
  mascot: { look: MascotLook; accent: string };
}

const truncate = (text: unknown, max: number): string => {
  const s = String(text ?? '');
  return s.length > max ? `${s.slice(0, max)}...` : s;
};

/** What the home screen shows, from the owner's settings and what the device knows. */
export const homeModel = (input: HomeInput): HomeModel | null => {
  const c = input.c || {};
  if (!homeOn(c)) return null;
  const now = input.now ?? Date.now();
  const agent = input.agent || null;
  const categories = publishedCategories(input.categories);
  const recent = publishedArticles(input.recentArticles);
  const kbOn = helpOn(c, categories, recent);
  const name = agent?.displayName || c.logoText || input.botName || '';

  // The header: salutation (or welcome back), the brand, the owner's words.
  const back = welcomeBack(input.memory || null, now);
  const copy = homeCopy(c, name);
  const [a, b] = brandColors(c);

  // "Talk to us": the status line replaces our own tagline (replyTimeView.ts decorateHomeReply).
  const hideStatus = c.hideOnlineStatus === true;
  const people = homePeople(c.replyTime, { agent: !!agent, now: new Date(now) });
  const status = [hideStatus ? '' : REPLY.statusOnline, people.text].filter(Boolean).join(REPLY.sep) || null;
  const talk = {
    avatar: homeCardAvatar(c),
    title: copy.cardTitle,
    tagline: copy.online ? null : copy.cardTagline,
    status,
    tone: people.tone,
    dot: !hideStatus,
    // The owner's words, or the stock ones in the visitor's language (web core/customizations.ts ownerTextOr).
    button: ownerTextOr(c.initialPageCardButtonText, 'home.chatWithUs'),
    starters: agent ? (Array.isArray(agent.starters) ? agent.starters : []).filter((s) => typeof s === 'string' && s.trim()).slice(0, 3) : [],
    faces: trustImages(c.homeTeamPhotos, 3),
    rating: ratingLine(c.homeRating),
  };

  // Search first.
  const articles = kbOn ? flattenArticles(categories, recent) : [];
  const agentName = agent ? agent.displayName || c.logoText || input.botName || HOME_TEXT.ourAssistant : null;
  const ask = askBoxOn(c, !!agent, articles.length > 0)
    ? { placeholder: askPlaceholder(!!agent, articles.length > 0), label: agentName ? HOME_TEXT.askLabel(agentName) : HOME_TEXT.searchLabel, agentName }
    : null;

  // Pick up where they left off: an agent bot only.
  const resumable = canResume(input.memory || null, input.chatSessionId);
  const resume =
    back?.topic && agent ? { topic: back.topic, resumable, line: resumable ? HOME_TEXT.continueConversation : HOME_TEXT.askAgain } : null;

  // Their requests: up to two, "See all (n)" when there are more; a new reply puts it above "Talk to us".
  const seen = input.seen || {};
  const list = Array.isArray(input.requests) ? ordered(input.requests, seen) : [];
  const requests = list.length
    ? {
        rows: list.slice(0, ON_HOME).map((r) => ({ id: r.id, title: r.title, line: rowLine(r, seen, now), state: stateOf(r), fresh: isNewReply(r, seen) })),
        total: list.length,
        seeAll: list.length > ON_HOME ? HOME_TEXT.requestsSeeAll(list.length) : null,
        fresh: list.some((r) => isNewReply(r, seen)),
      }
    : null;

  // The help card: the recent list (unless hidden), the topics, See all.
  let help: HomeModel['help'] = null;
  if (kbOn) {
    const topics = topCategories(categories, 6);
    const withList = showsRecentArticles(c, recent);
    if (articles.length || topics.length) {
      help = {
        title: withList ? HOME_TEXT.recentArticles : HOME_TEXT.helpCentre,
        recent: withList
          ? recent.map((r: any) => ({
              id: String(r._id),
              title: truncate(r.title, 100),
              description: truncate(r.description, 120),
              image: typeof r.coverImage === 'string' && r.coverImage.trim() ? r.coverImage.trim() : null,
            }))
          : [],
        seeAll: topics.length > 0,
        topics: topics.map((t: any) => ({ id: String(t._id ?? t.id ?? t.name), name: String(t.name), count: t.articles.length })),
        search: !ask,
      };
    }
  }

  // The owner's customer logos with their line, last.
  const logos = trustImages(c.homeTrustLogos, 6);
  const trust = logos.length ? { label: String(c.homeTrustLabel || '').trim(), logos } : null;

  const order: HomeSection[] = [];
  if (ask) order.push('ask');
  if (resume) order.push('resume');
  if (requests?.fresh) order.push('requests');
  order.push('talk');
  if (requests && !requests.fresh) order.push('requests');
  if (help) order.push('help');
  if (trust) order.push('trust');

  return {
    hello: back ? back.hello : salutation(input.hour ?? new Date(now).getHours()),
    brand: homeBrand(c, agent?.displayName || input.botName || ''),
    // The stock "Hi there 👋" in the visitor's language (web core/customizations.ts stockText).
    title: stockText(typeof c.initialPageTitle === 'string' ? c.initialPageTitle.trim() : '', 'home.title'),
    description: copy.description,
    message: typeof c.initialPageMessage === 'string' ? plainText(c.initialPageMessage) : '',
    band: [a, b],
    light: isLight(parseColor(a)) && isLight(parseColor(b)),
    accent: requestsAccent(c),
    talk,
    ask,
    resume,
    requests,
    help,
    trust,
    order,
    articles,
    mascot: { look: mascotLookOf(c), accent: (typeof c.widgetIconBgColor === 'string' && c.widgetIconBgColor.trim()) || (typeof c.headerBgColor === 'string' && c.headerBgColor.trim()) || '#4f46e5' },
  };
};

/** While the visitor types in the ask box, the list is the page: these go (web cb-home--asking). */
export const HIDDEN_WHILE_ASKING: HomeSection[] = ['resume', 'requests', 'talk', 'help'];
