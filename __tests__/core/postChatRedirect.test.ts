/**
 * Post-chat redirect (src/core/postChatRedirect.ts), ported from the web
 * widget's tests/postChatRedirect.test.js: which URLs are followed, the
 * 10-second line with Cancel, once per conversation (also after a restart
 * restores it), the app's hook first, and a "Continue to" button when the
 * system cannot open the URL.
 */
import {
  PostChatRedirect,
  REDIRECT_DONE_KEY_PREFIX,
  redirectAlreadyOffered,
  redirectHost,
  safeRedirectUrl,
  type RedirectLine,
} from '../../src/core/postChatRedirect';
import { setWidgetLanguage, tFor } from '../../src/core/i18n';

const memoryStore = () => {
  const m = new Map<string, string>();
  return { getItem: async (k: string) => (m.has(k) ? (m.get(k) as string) : null), setItem: async (k: string, v: string) => void m.set(k, String(v)), m };
};

const setup = (over: { open?: (u: string) => any; store?: any } = {}) => {
  const lines: (RedirectLine | null)[] = [];
  const went: string[] = [];
  const store = over.store === undefined ? memoryStore() : over.store;
  const ctl = new PostChatRedirect({
    onChange: (l) => lines.push(l),
    open: over.open || ((u) => (went.push(u), true)),
    store,
  });
  return { ctl, lines, went, store, last: () => lines[lines.length - 1] };
};

const tick = async (n = 1) => {
  for (let i = 0; i < n; i++) {
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    await Promise.resolve();
  }
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  setWidgetLanguage('en');
});

describe('safeRedirectUrl', () => {
  it('only plain http(s) addresses are followed', () => {
    expect(safeRedirectUrl('https://example.com/thanks')).toBe('https://example.com/thanks');
    expect(safeRedirectUrl('  http://example.com  ')).toBe('http://example.com/');
    expect(safeRedirectUrl('HTTPS://Example.com/a?b=1#c')).toBe('https://example.com/a?b=1#c');
    for (const bad of [
      'javascript:alert(1)',
      ' JavaScript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'mailto:a@b.co',
      '//example.com',
      'example.com',
      'ftp://example.com',
      'https://user:pass@example.com',
      'https://',
      '',
      null,
      undefined,
      42,
      'https://example.com/' + 'a'.repeat(3000),
    ]) {
      expect(safeRedirectUrl(bad)).toBeNull();
    }
  });

  it('writes the address as a browser does', () => {
    expect(safeRedirectUrl('https://example.com?x=1')).toBe('https://example.com/?x=1');
    expect(safeRedirectUrl('https://example.com:443/a')).toBe('https://example.com/a');
    expect(safeRedirectUrl('http://example.com:8080/a')).toBe('http://example.com:8080/a');
    expect(safeRedirectUrl('https://[::1]/a')).toBe('https://[::1]/a');
    expect(safeRedirectUrl('https://user@example.com')).toBeNull();
    expect(safeRedirectUrl('https://exa mple.com')).toBeNull();
    expect(safeRedirectUrl('https://example.com:99999')).toBeNull();
    expect(safeRedirectUrl('https://example.com:abc')).toBeNull();
  });
});

it('the line names the site without www', () => {
  expect(redirectHost('https://www.example.com/x')).toBe('example.com');
  expect(redirectHost('https://shop.example.co.uk/')).toBe('shop.example.co.uk');
});

it('counts down 10 seconds, then opens the URL outside the chat', async () => {
  const s = setup();
  expect(await s.ctl.start({ redirectUrl: 'https://www.example.com/thanks', chatSessionId: 'a' })).toBe('counting');
  expect(s.last()?.text).toBe(tFor('en', 'redirect.countdown', { host: 'example.com', n: 10 }));
  expect(s.last()?.text).toBe('Taking you to example.com in 10s');
  expect(s.last()?.cancelText).toBe('Cancel');
  expect(s.last()?.cancelLabel).toBe('Cancel going to example.com');
  await tick(3);
  expect(s.last()?.text).toBe('Taking you to example.com in 7s');
  // Said once, not every second.
  expect(s.last()?.said).toBe('Taking you to example.com in 10s');
  await tick(6);
  expect(s.went).toEqual([]);
  await tick(1);
  expect(s.went).toEqual(['https://www.example.com/thanks']);
  expect(s.last()?.phase).toBe('going');
  expect(s.last()?.text).toBe('Taking you to example.com…');
  await tick(5);
  expect(s.went.length).toBe(1);
});

it('Cancel stops it and takes the line away', async () => {
  const s = setup();
  await s.ctl.start({ redirectUrl: 'https://example.com', chatSessionId: 'a' });
  s.ctl.cancel();
  expect(s.last()).toBeNull();
  await tick(20);
  expect(s.went).toEqual([]);
});

it('once per conversation, also after a restart restores it', async () => {
  const store = memoryStore();
  let s = setup({ store });
  await s.ctl.start({ redirectUrl: 'https://example.com', chatSessionId: 'a' });
  s.ctl.cancel();
  // The agent ends it again, or the ended chat is restored after a restart.
  expect(await s.ctl.start({ redirectUrl: 'https://example.com', chatSessionId: 'a' })).toBe('none');
  s = setup({ store });
  expect(await redirectAlreadyOffered('a', store)).toBe(true);
  expect(store.m.get(REDIRECT_DONE_KEY_PREFIX + 'a')).toBe('1');
  expect(await s.ctl.start({ redirectUrl: 'https://example.com', chatSessionId: 'a' })).toBe('none');
  // A new conversation gets its own.
  expect(await s.ctl.start({ redirectUrl: 'https://example.com', chatSessionId: 'b' })).toBe('counting');
});

it('without storage, once per conversation while the app runs', async () => {
  const s = setup({ store: null });
  await s.ctl.start({ redirectUrl: 'https://example.com', chatSessionId: 'a' });
  s.ctl.cancel();
  expect(await s.ctl.start({ redirectUrl: 'https://example.com', chatSessionId: 'a' })).toBe('none');
});

it('nothing for a bad URL, no URL, or the app turning it off', async () => {
  const s = setup();
  expect(await s.ctl.start({ redirectUrl: 'javascript:alert(1)', chatSessionId: 'a' })).toBe('none');
  expect(await s.ctl.start({ redirectUrl: '', chatSessionId: 'a' })).toBe('none');
  expect(await s.ctl.start({ redirectUrl: 'https://example.com', chatSessionId: 'a', disabled: true })).toBe('none');
  expect(s.lines).toEqual([]);
  expect(s.store.m.size).toBe(0);
});

it('the app\'s hook gets the URL first: true means no countdown', async () => {
  const s = setup();
  const hook = jest.fn(() => true);
  expect(await s.ctl.start({ redirectUrl: 'https://example.com/next', chatSessionId: 'a', onPostChatRedirect: hook })).toBe('handled');
  expect(hook).toHaveBeenCalledWith('https://example.com/next');
  expect(s.lines).toEqual([]);
  await tick(20);
  expect(s.went).toEqual([]);
  // Remembered: not offered again.
  expect(await s.ctl.start({ redirectUrl: 'https://example.com/next', chatSessionId: 'a', onPostChatRedirect: hook })).toBe('none');
  expect(hook).toHaveBeenCalledTimes(1);

  // Anything but true (or a throw): the SDK counts down.
  for (const [id, fn] of [['b', () => undefined], ['c', () => false], ['d', () => { throw new Error('x'); }]] as const) {
    expect(await s.ctl.start({ redirectUrl: 'https://example.com', chatSessionId: id, onPostChatRedirect: fn as any })).toBe('counting');
    s.ctl.cancel();
  }
});

it('a restart, a closed chat or a new conversation stops it', async () => {
  let s = setup();
  let ok = true;
  await s.ctl.start({ redirectUrl: 'https://example.com', chatSessionId: 'b', canGo: () => ok });
  await tick(4);
  ok = false;
  await tick(20);
  expect(s.went).toEqual([]);
  expect(s.last()).toBeNull();

  // Already no longer on screen when it would start: not remembered.
  s = setup();
  expect(await s.ctl.start({ redirectUrl: 'https://example.com', chatSessionId: 'd', canGo: () => false })).toBe('none');
  expect(s.store.m.size).toBe(0);
});

it('one at a time', async () => {
  const s = setup();
  await s.ctl.start({ redirectUrl: 'https://example.com', chatSessionId: 'a' });
  expect(await s.ctl.start({ redirectUrl: 'https://example.com', chatSessionId: 'b' })).toBe('none');
});

it('when the system cannot open it, a Continue button to tap', async () => {
  let refuse = true;
  const went: string[] = [];
  const s = setup({ open: (u) => (refuse ? Promise.reject(new Error('no browser')) : (went.push(u), true)) });
  await s.ctl.start({ redirectUrl: 'https://example.com/next', chatSessionId: 'a' });
  await tick(10);
  expect(s.last()?.phase).toBe('continue');
  expect(s.last()?.text).toBe('Continue to example.com');
  expect(s.last()?.href).toBe('https://example.com/next');
  refuse = false;
  expect(await s.ctl.continueNow()).toBe(true);
  expect(went).toEqual(['https://example.com/next']);
  expect(s.last()).toBeNull();
});

it('translated in every widget language', () => {
  const en = (key: any) => tFor('en', key, { host: 'example.com', n: 10 });
  for (const lang of ['nl', 'fr', 'de', 'es'] as const) {
    for (const key of ['redirect.countdown', 'redirect.cancel', 'redirect.going', 'redirect.continue'] as const) {
      const s = tFor(lang, key, { host: 'example.com', n: 10 });
      expect(s).not.toBe(en(key));
      expect(s).toMatch(/example\.com/);
    }
    expect(tFor(lang, 'redirect.countdown', { host: 'x.io', n: 7 })).toMatch(/7/);
  }
});
