/**
 * "Your requests" (web conferbot-widget src/ts/home/requests/): a visitor's
 * own conversations with the team, where each one stands in plain words,
 * and a reply box that reaches the team. A reply to a solved request opens
 * it again.
 *
 * Pure: the words (web words.ts), what the device remembers (web store.ts,
 * as values in and out; the provider keeps them in AsyncStorage), which
 * visitor is asking (web api.ts `who`) and the socket calls with an answer
 * (web api.ts, embed-server socket/handlers/visitorRequestsHandler.js and
 * services/chatbot/visitorRequests.js). The screens are
 * core/requestsPortal.ts.
 *
 * Whose requests: the server lists a conversation only when its id is one
 * this device started AND its visitor id matches (the ids are random and
 * shown nowhere else), or when the app signed its user in (`user.hash`,
 * identity verification) - then their verified conversations on this bot
 * from any device. Only conversations a person on the team handles are
 * requests; a chat the AI answered alone is not one.
 *
 * English only for now (the web's i18n `requests.*`, `when.*` keys).
 */

// ------------------------------------------------------------ types

/** As the server sends them (visitorRequests.js `summary`). */
export interface RequestSummary {
  id: string;
  title: string;
  status: 'open' | 'solved';
  startedAt?: string;
  lastAt?: string;
  lastFrom: 'you' | 'team';
  lastText: string;
  teamName: string;
}

/** visitorRequests.js `messagesOf`. */
export interface RequestMessage {
  id: string;
  from: 'you' | 'team';
  name: string;
  text: string;
  at: string | null;
}

export interface RequestDetail extends RequestSummary {
  messages: RequestMessage[];
}

export type RequestState = 'replied' | 'waiting' | 'solved';

// ------------------------------------------------------------ the words

/** The web's English strings (i18n en `requests.*`, `common.*`, `transcript.you`). */
export const REQUESTS_TEXT = {
  title: 'Your requests',
  one: 'Your request',
  back: 'Back',
  loading: 'Loading...',
  loadFailed: "We couldn't load this just now.",
  tryAgain: 'Try again',
  empty: 'Nothing here yet. When you ask us something, you can follow it here.',
  you: 'You',
  supportTeam: 'Support team',
  replyPlaceholder: 'Write your reply...',
  reopenPlaceholder: 'Write here to open it again...',
  yourReply: 'Your reply',
  send: 'Send',
  sending: 'Sending...',
  notSent: 'Not sent.',
  locked: 'This conversation is closed for replies.',
  newReply: 'New reply',
  newReplyFrom: (name: string) => `New reply from ${name}`,
  seeAll: (n: number) => `See all (${n})`,
  /** The chat menu's item (RN; the web has the home card instead). */
  menu: (unread: number) => (unread > 0 ? `Your requests · ${REQUESTS_TEXT.newReply}` : REQUESTS_TEXT.title),
} as const;

/** Each state in a few plain words, never a ticket status (web words.ts STATE_WORDS). */
export const STATE_WORDS: Record<RequestState, { label: string; detail: string }> = {
  replied: { label: 'We replied', detail: 'Read it below. If you need anything else, just write back.' },
  waiting: { label: "We're on it", detail: "We'll reply right here. You can close this - your message is safe with us." },
  solved: { label: 'Solved', detail: "Still need help with this? Write below and we'll pick it up again." },
};

const ms = (v?: string | number | null): number => {
  const t = v ? new Date(v).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
};

/** A reply from the team on an open request, not read on this device yet (web isNewReply). */
export const isNewReply = (r: RequestSummary, seen: Record<string, number>): boolean =>
  // A solved one is done: its last word is "Solved", not a reply to read.
  r.status !== 'solved' && r.lastFrom === 'team' && ms(r.lastAt) > (seen[r.id] || 0);

export const stateOf = (r: RequestSummary): RequestState =>
  r.status === 'solved' ? 'solved' : r.lastFrom === 'team' ? 'replied' : 'waiting';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "Just now", "5 min ago", "3 hours ago", "Yesterday", "Monday", "3 Oct" (web whenWords, English). */
export const whenWords = (v?: string | number | null, now = Date.now()): string => {
  const t = ms(v);
  if (!t) return '';
  const diff = Math.max(0, now - t);
  if (diff < 60 * 1000) return 'Just now';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} min ago`;
  const d = new Date(t);
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (t >= startOfToday) {
    const h = Math.floor(diff / 3600000);
    return h <= 1 ? '1 hour ago' : `${h} hours ago`;
  }
  if (t >= startOfToday - 86400000) return 'Yesterday';
  if (t >= startOfToday - 6 * 86400000) return DAYS[d.getDay()];
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== today.getFullYear() ? ` ${d.getFullYear()}` : ''}`;
};

/** The line under a request's title (web rowLine). */
export const rowLine = (r: RequestSummary, seen: Record<string, number>, now = Date.now()): string => {
  const when = whenWords(r.lastAt, now);
  const head = isNewReply(r, seen)
    ? r.teamName
      ? REQUESTS_TEXT.newReplyFrom(r.teamName)
      : REQUESTS_TEXT.newReply
    : STATE_WORDS[stateOf(r)].label;
  return when ? `${head} · ${when}` : head;
};

/** Newest replies first, then whatever moved last (web ordered). */
export const ordered = (list: RequestSummary[], seen: Record<string, number>): RequestSummary[] =>
  [...list].sort((a, b) => Number(isNewReply(b, seen)) - Number(isNewReply(a, seen)) || ms(b.lastAt) - ms(a.lastAt));

/** How many requests have a team reply not read here: the app's badge (RN). */
export const unreadCount = (list: RequestSummary[] | null | undefined, seen: Record<string, number>): number =>
  (list || []).filter((r) => isNewReply(r, seen)).length;

/** Read up to the newest message, by the server's clock too (web view.ts seenAt). */
export const seenAt = (r: Pick<RequestSummary, 'lastAt'>, now = Date.now()): number => Math.max(now, ms(r.lastAt));

/** The home card shows two; "See all" when there are more (web card.ts ON_HOME). */
export const ON_HOME = 2;
/** The list is read again at most this often when nothing forces it (web card.ts). */
export const REFRESH_GAP_MS = 15000;
/** The reply box's limit (web view.ts maxLength, the server's MAX_REPLY). */
export const MAX_REPLY = 4000;

// ------------------------------------------------------------ links in a message

const URL_RE = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/gi;

/** Text with its links as their own runs, everything else text (web view.ts appendText). */
export const linkRuns = (text: string): Array<{ text: string; url?: string }> => {
  const s = String(text || '');
  const out: Array<{ text: string; url?: string }> = [];
  let at = 0;
  s.replace(URL_RE, (url: string, offset: number) => {
    if (offset > at) out.push({ text: s.slice(at, offset) });
    out.push({ text: url, url });
    at = offset + url.length;
    return url;
  });
  if (at < s.length) out.push({ text: s.slice(at) });
  return out;
};

// ------------------------------------------------------------ what the device remembers

/** The ids of the chats this device started (newest first) and when each request was last read here. */
export interface RequestMemory {
  sessions: string[];
  /** Request id -> when it was last read here (ms). */
  seen: Record<string, number>;
}

export const MAX_SESSIONS = 30;
/** A conversation id the server accepts (visitorRequests.js SESSION). */
export const SESSION_RE = /^[\w-]{6,64}$/;
const SEEN_KEPT = 60;

/** Per bot, in AsyncStorage (the web keeps `cb_req_<botId>` in localStorage). */
export const requestsStorageKey = (botId: string) => `@conferbot:requests:${botId || 'default'}`;

export const emptyMemory = (): RequestMemory => ({ sessions: [], seen: {} });

/** What was stored, cleaned (web readRequests). Anything unreadable is nothing. */
export const parseMemory = (raw: string | null | undefined): RequestMemory => {
  try {
    const m = JSON.parse(raw || 'null');
    if (!m || typeof m !== 'object') return emptyMemory();
    const sessions = (Array.isArray(m.sessions) ? m.sessions : [])
      .filter((s: any) => typeof s === 'string' && SESSION_RE.test(s))
      .slice(0, MAX_SESSIONS);
    const seen: Record<string, number> = {};
    const src = m.seen && typeof m.seen === 'object' ? m.seen : {};
    Object.keys(src).forEach((k) => {
      if (!SESSION_RE.test(k)) return;
      const t = Number(src[k]);
      if (Number.isFinite(t)) seen[k] = t;
    });
    return { sessions, seen };
  } catch {
    return emptyMemory();
  }
};

/** What to store (web store.ts write): 30 sessions, the last 60 read marks. */
export const serializeMemory = (m: RequestMemory): string => {
  const seen: Record<string, number> = {};
  Object.keys(m.seen).slice(-SEEN_KEPT).forEach((k) => (seen[k] = m.seen[k]));
  return JSON.stringify({ sessions: m.sessions.slice(0, MAX_SESSIONS), seen });
};

/** A chat on this device was saved: it may become a request (web rememberSession). Null when nothing changes. */
export const withSession = (m: RequestMemory, session: string | null | undefined): RequestMemory | null => {
  const s = String(session || '');
  if (!SESSION_RE.test(s) || m.sessions[0] === s) return null;
  return { ...m, sessions: [s, ...m.sessions.filter((x) => x !== s)].slice(0, MAX_SESSIONS) };
};

/** They read this request up to `at` (web markSeen). Null when nothing changes. */
export const withSeen = (m: RequestMemory, id: string, at: number): RequestMemory | null => {
  if (!id || (m.seen[id] || 0) >= at) return null;
  // Re-inserted last, so the newest read marks are the ones kept.
  const seen = { ...m.seen };
  delete seen[id];
  seen[id] = at;
  return { ...m, seen };
};

/** The visitor wrote in this chat: remember it (web index.ts `_sendResponse`, a `user-` entry in the record). */
export const hasVisitorEntry = (record: readonly any[] | null | undefined): boolean =>
  (record || []).some((e) => String(e?.shape || e?.type || '').startsWith('user-'));

// ------------------------------------------------------------ who is asking

/** The app's signed-in user (ConferBotProvider `user`). */
export interface RequestsUser {
  id?: string;
  email?: string;
  hash?: string;
  [k: string]: any;
}

export interface RequestsWho {
  visitorId: string;
  sessions: string[];
  user?: { id?: string; email?: string; hash?: string };
}

/** Every call says which visitor this is (web api.ts `who`): only what the server checks. */
export const requestsWho = (visitorId: string | null | undefined, memory: RequestMemory, user?: RequestsUser | null): RequestsWho => ({
  visitorId: String(visitorId || ''),
  sessions: memory.sessions,
  ...(user && typeof user === 'object'
    ? { user: { id: user.id ?? user.user_id ?? user.userId, email: user.email, hash: user.hash ?? user.userHash ?? user.user_hash } }
    : {}),
});

/** Nothing on this device and nobody signed in: nothing to ask about (web card.ts refresh). */
export const canAskForRequests = (memory: RequestMemory, user?: RequestsUser | null): boolean =>
  memory.sessions.length > 0 || !!(user && (user.hash || user.userHash || user.user_hash));

// ------------------------------------------------------------ the server

/** What the SDK's socket offers (services/socket.ts). */
export interface RequestsSocket {
  emitWithAck: (event: string, payload: any, timeoutMs?: number) => Promise<any>;
  emitToServer: (event: string, payload: any) => void;
  on: (event: string, fn: (...args: any[]) => void) => () => void;
}

export type ReplyResult = { ok: boolean; request?: RequestDetail; reason?: string };

export interface RequestsApi {
  list: () => Promise<RequestSummary[] | null>;
  open: (id: string) => Promise<RequestDetail | null>;
  /** No more live updates for it. */
  close: (id: string) => void;
  reply: (id: string, text: string, entryId: string) => Promise<ReplyResult>;
  /** A request changed on the server (a team reply, solved). Returns the unsubscribe. */
  onUpdate: (fn: (id: string) => void) => () => void;
}

/** web api.ts TIMEOUT_MS */
export const REQUESTS_TIMEOUT_MS = 10000;

/** The socket events (embed-server visitorRequestsHandler.js). */
export const REQUEST_EVENTS = {
  list: 'my-requests',
  open: 'my-request-open',
  close: 'my-request-close',
  reply: 'my-request-reply',
  update: 'my-request-update',
} as const;

/**
 * The calls (web api.ts requestsApi). `who` is read at each call. The
 * socket's local 'connect' fires on every connect: the server forgets a
 * request's live updates when the connection drops, so the open one is
 * read (and joined) again.
 */
export const requestsApi = (socket: RequestsSocket, who: () => RequestsWho): RequestsApi => {
  let current: string | null = null;
  const call = async (event: string, payload: any): Promise<any> => {
    try {
      return (await socket.emitWithAck(event, payload, REQUESTS_TIMEOUT_MS)) || null;
    } catch {
      return null;
    }
  };
  return {
    list: async () => {
      const a = await call(REQUEST_EVENTS.list, who());
      return a?.ok && Array.isArray(a.requests) ? a.requests : null;
    },
    open: async (id) => {
      current = id;
      const a = await call(REQUEST_EVENTS.open, { ...who(), chatSessionId: id });
      return a?.ok && a.request ? a.request : null;
    },
    close: (id) => {
      if (current === id) current = null;
      try {
        socket.emitToServer(REQUEST_EVENTS.close, { chatSessionId: id });
      } catch {
        /* nothing to stop */
      }
    },
    reply: async (id, text, entryId) => {
      const a = await call(REQUEST_EVENTS.reply, { ...who(), chatSessionId: id, text, entryId });
      return a || { ok: false, reason: 'offline' };
    },
    onUpdate: (fn) => {
      const offUpdate = socket.on(REQUEST_EVENTS.update, (data: any) => {
        if (typeof data?.chatSessionId === 'string') fn(data.chatSessionId);
      });
      const offConnect = socket.on('connect', () => {
        if (current) fn(current);
      });
      return () => {
        offUpdate();
        offConnect();
      };
    },
  };
};

/** A reply's id, so a retry is one message on the server (web view.ts; the server accepts `request-reply-[\w-]{1,60}`). */
export const replyEntryId = (now = Date.now(), rand = Math.random): string =>
  `request-reply-${now.toString(36)}${rand().toString(36).slice(2, 8)}`;

// ------------------------------------------------------------ the look

const hex = (v: any): string | null => (typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim()) ? v.trim() : null);

const lightness = (h: string): number => {
  let s = h.slice(1);
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * The accent for the Back link, the visitor's bubbles and Send (web
 * firstImpression.ts accentFor, brand/brand.ts brandColorOf): the brand
 * colour, the header colour, the launcher's, unless too light to read
 * (homeUtils.ts isLight, luminance over 0.55), then indigo.
 */
export const requestsAccent = (c: any): string => {
  const brand = (!c?._themePalette && hex(c?.brandColor)) || c?.headerBgColor;
  const launcher =
    c?.widgetIconThemeType === 'Gradient' && c?.widgetGradientBgOne && c?.widgetGradientBgTwo
      ? [c.widgetGradientBgOne, c.widgetGradientBgTwo]
      : [c?.widgetIconBgColor || c?.headerBgColor];
  for (const v of [brand, c?.headerBgColor, ...launcher]) {
    const h = hex(v);
    if (h && lightness(h) <= 0.55) return h;
  }
  return '#4F46E5';
};
