/**
 * Post-chat redirect (Customize > Conversations > Post-chat redirect, the
 * bot's redirectUrl), as the web widget's ts/chat/postChatRedirect.ts and
 * docs/redirect-after-chat.md. When a conversation ends - the flow reaches
 * its end, or an agent ends a chat they took over - and the post-chat
 * rating is done or skipped (or there is none), a quiet line counts down 10
 * seconds with Cancel, then the owner's URL opens outside the chat.
 *
 *   - only http(s) URLs with a host, checked here: javascript:, data:,
 *     mailto:, a bare domain and anything with a user:password@ part are
 *     ignored
 *   - the app's onPostChatRedirect(url) is asked first: true means the app
 *     handled it (or wants none), and no countdown is shown
 *   - once per conversation: remembered when the countdown starts, so a
 *     cancelled one, an agent ending the chat again or a restored ended
 *     chat does not count down a second time
 *   - when the system cannot open it, the line becomes "Continue to
 *     example.com" the visitor can tap
 *
 * Pure: no React Native here. The hook (context/hooks/usePostChatRedirect)
 * opens it with Linking and stops it when the chat closes or the app goes
 * to the background.
 */
import { t } from './i18n';

export const REDIRECT_SECONDS = 10;
const MAX_URL_LENGTH = 2048;
export const REDIRECT_DONE_KEY_PREFIX = 'conferbot_redirect_done_';

// A host may not hold these (WHATWG forbidden host code points).
const FORBIDDEN_HOST = /[\s#%/:<>?@[\\\]^|\u0000-\u001f\u007f]/;
const DEFAULT_PORT: Record<string, string> = { http: '80', https: '443' };

const parse = (href: string): { scheme: string; host: string; port: string; rest: string } | null => {
  const m = /^(https?):\/\/([^/?#\\]*)([\s\S]*)$/i.exec(href);
  if (!m) return null;
  const scheme = m[1].toLowerCase();
  const authority = m[2];
  // A user:password@ (or any user@) part.
  if (authority.includes('@')) return null;
  let host = authority;
  let port = '';
  const v6 = /^(\[[0-9a-f:.]+\])(?::(\d*))?$/i.exec(authority);
  if (v6) {
    host = v6[1];
    port = v6[2] || '';
  } else {
    const at = authority.lastIndexOf(':');
    if (at >= 0) {
      port = authority.slice(at + 1);
      host = authority.slice(0, at);
      if (!/^\d*$/.test(port)) return null;
    }
    if (!host || FORBIDDEN_HOST.test(host) || /^\.+$/.test(host)) return null;
  }
  if (port && Number(port) > 65535) return null;
  host = host.toLowerCase();
  port = port.replace(/^0+(?=\d)/, '');
  if (port === DEFAULT_PORT[scheme]) port = '';
  // The path, query and fragment as a browser writes them.
  let rest = m[3].replace(/\\/g, '/').replace(/[\u0000-\u001f\u007f]/g, '').replace(/ /g, '%20');
  if (!rest || rest[0] !== '/') rest = '/' + rest;
  return { scheme, host, port, rest };
};

/** The owner's URL when it is a plain http(s) address, else null. */
export const safeRedirectUrl = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value || value.length > MAX_URL_LENGTH) return null;
  const u = parse(value);
  if (!u) return null;
  return `${u.scheme}://${u.host}${u.port ? `:${u.port}` : ''}${u.rest}`;
};

/** "www.example.com" -> "example.com", for the line the visitor reads. */
export const redirectHost = (href: string): string => {
  const u = typeof href === 'string' ? parse(href.trim()) : null;
  return u ? u.host.replace(/^www\./i, '') : '';
};

/** Where the SDK remembers a conversation that was offered its redirect (AsyncStorage). */
export interface RedirectStore {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
}

/** This conversation already counted down (or was cancelled, or the app took it). */
export const redirectAlreadyOffered = async (chatSessionId: string, store?: RedirectStore | null): Promise<boolean> => {
  if (!chatSessionId || !store) return false;
  try {
    return (await store.getItem(REDIRECT_DONE_KEY_PREFIX + chatSessionId)) === '1';
  } catch {
    return false;
  }
};

const markOffered = async (chatSessionId: string, store?: RedirectStore | null) => {
  if (!chatSessionId || !store) return;
  try {
    await store.setItem(REDIRECT_DONE_KEY_PREFIX + chatSessionId, '1');
  } catch {
    /* storage refused: the in-memory guard still holds while the app runs */
  }
};

/** The line under the conversation. */
export interface RedirectLine {
  href: string;
  host: string;
  /** counting: "Taking you to x in Ns" + Cancel; going: "Taking you to x…"; continue: a "Continue to x" button. */
  phase: 'counting' | 'going' | 'continue';
  secondsLeft: number;
  /** What the line shows now. */
  text: string;
  /** What a screen reader hears: the first sentence, said once (not every tick). */
  said: string;
  /** The Cancel button: its text and its accessible label. */
  cancelText: string;
  cancelLabel: string;
}

export interface PostChatRedirectStart {
  redirectUrl: unknown;
  chatSessionId: string;
  /** The app's config: never redirect. */
  disabled?: boolean;
  /** The app's hook, asked first: true = handled, no countdown. */
  onPostChatRedirect?: ((url: string) => boolean | void) | null;
  /** Still the same ended conversation, and the visitor can see the chat. */
  canGo?: () => boolean;
}

export interface PostChatRedirectDeps {
  /** The line changed (null: gone). */
  onChange: (line: RedirectLine | null) => void;
  /** Open the URL outside the chat; false (or a rejection) when the system refused. */
  open: (href: string) => Promise<boolean> | boolean;
  store?: RedirectStore | null;
  /** Seconds before going (tests). */
  seconds?: number;
}

export type PostChatRedirectResult = 'none' | 'handled' | 'counting';

/** One per chat: the countdown, the conversations already offered, the line. */
export class PostChatRedirect {
  private deps: PostChatRedirectDeps;
  private offeredHere = new Set<string>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private line: RedirectLine | null = null;
  private session: string | null = null;
  private canGo: (() => boolean) | undefined;

  constructor(deps: PostChatRedirectDeps) {
    this.deps = deps;
  }

  /** The line on screen now (null: none). */
  get current(): RedirectLine | null {
    return this.line;
  }

  /** A countdown runs (or the line is up) for this conversation. */
  get activeSession(): string | null {
    return this.session;
  }

  private set(line: RedirectLine | null) {
    this.line = line;
    this.deps.onChange(line);
  }

  private clearTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Stop a countdown and take the line away (Cancel, a restart, the chat closed, the app in the background). */
  cancel(): void {
    this.clearTimer();
    this.session = null;
    this.canGo = undefined;
    if (this.line) this.set(null);
  }

  /** Forget the conversations offered while the app runs (tests). */
  reset(): void {
    this.cancel();
    this.offeredHere = new Set<string>();
  }

  /**
   * The conversation ended and the rating is done: the app's hook, else the
   * countdown. 'none' when there is nothing to do (no valid URL, turned off,
   * already offered, not on screen).
   */
  async start(o: PostChatRedirectStart): Promise<PostChatRedirectResult> {
    const href = safeRedirectUrl(o.redirectUrl);
    if (!href || o.disabled) return 'none';
    const session = o.chatSessionId || '';
    if (this.offeredHere.has(session) || this.session !== null) return 'none';
    // Held while the store is read, so a second end in the meantime does nothing.
    this.offeredHere.add(session);
    const store = this.deps.store;
    if (await redirectAlreadyOffered(session, store)) return 'none';
    if (o.canGo && !o.canGo()) {
      this.offeredHere.delete(session);
      return 'none';
    }
    await markOffered(session, store);

    let handled = false;
    if (o.onPostChatRedirect) {
      try {
        handled = o.onPostChatRedirect(href) === true;
      } catch {
        handled = false;
      }
    }
    if (handled) return 'handled';
    // The visitor left in the meantime (closed the chat, a new conversation).
    if (o.canGo && !o.canGo()) return 'none';

    const host = redirectHost(href);
    let left = Math.max(1, Math.round(this.deps.seconds ?? REDIRECT_SECONDS));
    const said = t('redirect.countdown', { host, n: left });
    const counting = (n: number): RedirectLine => ({
      href,
      host,
      phase: 'counting',
      secondsLeft: n,
      text: t('redirect.countdown', { host, n }),
      said,
      cancelText: t('common.cancel'),
      cancelLabel: t('redirect.cancel', { host }),
    });
    this.session = session;
    this.canGo = o.canGo;
    this.set(counting(left));

    this.timer = setInterval(() => {
      if (this.session !== session) return this.clearTimer();
      if (this.canGo && !this.canGo()) return this.cancel();
      left -= 1;
      if (left > 0) {
        this.set(counting(left));
        return;
      }
      this.clearTimer();
      void this.go(href, host, session);
    }, 1000);
    return 'counting';
  }

  private async go(href: string, host: string, session: string) {
    let opened = false;
    try {
      opened = (await this.deps.open(href)) !== false;
    } catch {
      opened = false;
    }
    if (this.session !== session) return;
    const going = t('redirect.going', { host });
    if (opened) {
      this.set({ ...(this.line as RedirectLine), phase: 'going', secondsLeft: 0, text: going, said: going });
    } else {
      this.offerContinue(href, host);
    }
  }

  private offerContinue(href: string, host: string) {
    const text = t('redirect.continue', { host });
    this.set({ ...(this.line as RedirectLine), href, host, phase: 'continue', secondsLeft: 0, text, said: text });
  }

  /** "Continue to example.com" tapped: open it now. */
  async continueNow(): Promise<boolean> {
    const line = this.line;
    if (!line || line.phase !== 'continue') return false;
    let opened = false;
    try {
      opened = (await this.deps.open(line.href)) !== false;
    } catch {
      opened = false;
    }
    if (opened && this.line === line) this.cancel();
    return opened;
  }
}
