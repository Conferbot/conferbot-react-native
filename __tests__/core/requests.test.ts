/**
 * "Your requests" (core/requests.ts): the web's words.ts, store.ts and
 * api.ts (conferbot-widget src/ts/home/requests/), against the payloads of
 * embed-server socket/handlers/visitorRequestsHandler.js.
 */
import {
  REQUESTS_TEXT,
  STATE_WORDS,
  canAskForRequests,
  emptyMemory,
  hasVisitorEntry,
  isNewReply,
  linkRuns,
  ordered,
  parseMemory,
  replyEntryId,
  requestsAccent,
  requestsApi,
  requestsStorageKey,
  requestsWho,
  rowLine,
  seenAt,
  serializeMemory,
  stateOf,
  unreadCount,
  whenWords,
  withSeen,
  withSession,
  type RequestSummary,
} from '../../src/core/requests';

const NOW = new Date(2026, 9, 16, 15, 0, 0).getTime(); // Fri 16 Oct 2026, 15:00 local
const req = (o: Partial<RequestSummary> = {}): RequestSummary => ({
  id: 'mobile_1_abcdef',
  title: 'My invoice is wrong',
  status: 'open',
  lastAt: new Date(NOW - 2 * 3600000).toISOString(),
  lastFrom: 'team',
  lastText: 'Fixed it',
  teamName: 'Ada',
  ...o,
});

describe('the words (web words.ts)', () => {
  it('where it stands: replied, waiting, solved', () => {
    expect(stateOf(req())).toBe('replied');
    expect(stateOf(req({ lastFrom: 'you' }))).toBe('waiting');
    expect(stateOf(req({ status: 'solved' }))).toBe('solved');
    expect(STATE_WORDS.replied.label).toBe('We replied');
    expect(STATE_WORDS.waiting.label).toBe("We're on it");
    expect(STATE_WORDS.solved.detail).toBe("Still need help with this? Write below and we'll pick it up again.");
  });

  it('a new reply: from the team, on an open request, after it was last read here', () => {
    const r = req();
    expect(isNewReply(r, {})).toBe(true);
    expect(isNewReply(r, { [r.id]: NOW })).toBe(false);
    expect(isNewReply(req({ status: 'solved' }), {})).toBe(false);
    expect(isNewReply(req({ lastFrom: 'you' }), {})).toBe(false);
    expect(unreadCount([r, req({ id: 'other_123', lastFrom: 'you' })], {})).toBe(1);
    expect(unreadCount(null, {})).toBe(0);
  });

  it('when, in words', () => {
    expect(whenWords(NOW - 20000, NOW)).toBe('Just now');
    expect(whenWords(NOW - 5 * 60000, NOW)).toBe('5 min ago');
    expect(whenWords(NOW - 70 * 60000, NOW)).toBe('1 hour ago');
    expect(whenWords(NOW - 3 * 3600000, NOW)).toBe('3 hours ago');
    expect(whenWords(new Date(2026, 9, 15, 20).getTime(), NOW)).toBe('Yesterday');
    expect(whenWords(new Date(2026, 9, 12, 9).getTime(), NOW)).toBe('Monday');
    expect(whenWords(new Date(2026, 9, 3, 9).getTime(), NOW)).toBe('3 Oct');
    expect(whenWords(new Date(2025, 11, 24, 9).getTime(), NOW)).toBe('24 Dec 2025');
    expect(whenWords(null, NOW)).toBe('');
    expect(whenWords('nonsense', NOW)).toBe('');
  });

  it("a row's line: New reply from the person, else where it stands", () => {
    expect(rowLine(req(), {}, NOW)).toBe('New reply from Ada · 2 hours ago');
    expect(rowLine(req({ teamName: '' }), {}, NOW)).toBe('New reply · 2 hours ago');
    expect(rowLine(req(), { mobile_1_abcdef: NOW }, NOW)).toBe('We replied · 2 hours ago');
    expect(rowLine(req({ lastFrom: 'you', lastAt: undefined }), {}, NOW)).toBe("We're on it");
  });

  it('newest replies first, then whatever moved last', () => {
    const a = req({ id: 'aaaaaa', lastFrom: 'you', lastAt: new Date(NOW - 1000).toISOString() });
    const b = req({ id: 'bbbbbb', lastAt: new Date(NOW - 9000).toISOString() });
    const c = req({ id: 'cccccc', lastFrom: 'you', lastAt: new Date(NOW - 5000).toISOString() });
    expect(ordered([a, b, c], {}).map((r) => r.id)).toEqual(['bbbbbb', 'aaaaaa', 'cccccc']);
    expect(ordered([a, b, c], { bbbbbb: NOW }).map((r) => r.id)).toEqual(['aaaaaa', 'cccccc', 'bbbbbb']);
  });

  it("read up to the newest message, by the server's clock when it runs ahead", () => {
    expect(seenAt({ lastAt: new Date(NOW + 60000).toISOString() }, NOW)).toBe(NOW + 60000);
    expect(seenAt({ lastAt: undefined }, NOW)).toBe(NOW);
  });

  it('links in a message are their own runs (web appendText)', () => {
    expect(linkRuns('See https://example.com/a?b=1. Thanks')).toEqual([
      { text: 'See ' },
      { text: 'https://example.com/a?b=1', url: 'https://example.com/a?b=1' },
      { text: '. Thanks' },
    ]);
    expect(linkRuns('no links')).toEqual([{ text: 'no links' }]);
    expect(linkRuns('')).toEqual([]);
  });

  it('the menu item says when a reply is new', () => {
    expect(REQUESTS_TEXT.menu(0)).toBe('Your requests');
    expect(REQUESTS_TEXT.menu(2)).toBe('Your requests · New reply');
  });
});

describe('what the device remembers (web store.ts)', () => {
  it('reads only clean ids and numbers', () => {
    const m = parseMemory(JSON.stringify({ sessions: ['mobile_1_abcdef', 'bad id!', 42, 'x'], seen: { mobile_1_abcdef: 5, 'no way': 3, other_123: 'x' } }));
    expect(m).toEqual({ sessions: ['mobile_1_abcdef'], seen: { mobile_1_abcdef: 5 } });
    expect(parseMemory(null)).toEqual(emptyMemory());
    expect(parseMemory('{nope')).toEqual(emptyMemory());
    expect(requestsStorageKey('bot1')).toBe('@conferbot:requests:bot1');
  });

  it('a chat goes first, once; 30 kept', () => {
    let m = emptyMemory();
    for (let i = 0; i < 35; i++) m = withSession(m, `mobile_${i}_abcdef`) || m;
    expect(m.sessions).toHaveLength(30);
    expect(m.sessions[0]).toBe('mobile_34_abcdef');
    expect(withSession(m, 'mobile_34_abcdef')).toBeNull();
    expect(withSession(m, 'short')).toBeNull();
    expect(withSession(m, 'mobile_3_abcdef')!.sessions[0]).toBe('mobile_3_abcdef');
  });

  it('read marks only move forward; the newest 60 are kept', () => {
    let m = emptyMemory();
    expect((m = withSeen(m, 'mobile_1_abcdef', 10)!).seen.mobile_1_abcdef).toBe(10);
    expect(withSeen(m, 'mobile_1_abcdef', 5)).toBeNull();
    for (let i = 0; i < 70; i++) m = withSeen(m, `mobile_${i}_zzzzzz`, i + 1)!;
    const back = parseMemory(serializeMemory(m));
    expect(Object.keys(back.seen)).toHaveLength(60);
    expect(back.seen.mobile_69_zzzzzz).toBe(70);
    expect(back.seen.mobile_1_abcdef).toBeUndefined();
  });

  it('a chat becomes one to remember once the visitor wrote in it', () => {
    expect(hasVisitorEntry([{ type: 'bot-message' }])).toBe(false);
    expect(hasVisitorEntry([{ type: 'bot-message' }, { type: 'user-message' }])).toBe(true);
    expect(hasVisitorEntry([{ shape: 'user-live-message' }])).toBe(true);
    expect(hasVisitorEntry(null)).toBe(false);
  });
});

describe('who is asking (web api.ts who)', () => {
  it("the visitor id, this device's chats and only the signed user's checked fields", () => {
    const m = { sessions: ['mobile_1_abcdef'], seen: {} };
    expect(requestsWho('v_1', m, null)).toEqual({ visitorId: 'v_1', sessions: ['mobile_1_abcdef'] });
    expect(requestsWho('v_1', m, { id: 'u1', email: 'a@b.co', hash: 'h', name: 'Ada', plan: 'pro' })).toEqual({
      visitorId: 'v_1',
      sessions: ['mobile_1_abcdef'],
      user: { id: 'u1', email: 'a@b.co', hash: 'h' },
    });
    expect(requestsWho(undefined, m, { user_id: 'u2', user_hash: 'h2' }).user).toEqual({ id: 'u2', email: undefined, hash: 'h2' });
  });

  it('asks only with a chat on this device or a signed-in user', () => {
    expect(canAskForRequests(emptyMemory(), null)).toBe(false);
    expect(canAskForRequests(emptyMemory(), { id: 'u1' })).toBe(false);
    expect(canAskForRequests(emptyMemory(), { id: 'u1', hash: 'h' })).toBe(true);
    expect(canAskForRequests({ sessions: ['mobile_1_abcdef'], seen: {} }, null)).toBe(true);
  });
});

describe('the server (web api.ts, embed-server visitorRequestsHandler.js)', () => {
  const fakeSocket = (answers: Record<string, any>) => {
    const handlers: Record<string, Array<(...a: any[]) => void>> = {};
    const socket = {
      emitWithAck: jest.fn(async (event: string, _payload: any, _t?: number) => answers[event] ?? null),
      emitToServer: jest.fn(),
      on: jest.fn((event: string, fn: any) => {
        (handlers[event] = handlers[event] || []).push(fn);
        return () => (handlers[event] = handlers[event].filter((f) => f !== fn));
      }),
      fire: (event: string, data?: any) => (handlers[event] || []).forEach((f) => f(data)),
    };
    return socket;
  };
  const who = () => ({ visitorId: 'v_1', sessions: ['mobile_1_abcdef'] });

  it('my-requests: the list, or null when it did not come', async () => {
    const s = fakeSocket({ 'my-requests': { ok: true, requests: [req()] } });
    const api = requestsApi(s, who);
    expect(await api.list()).toEqual([req()]);
    expect(s.emitWithAck).toHaveBeenCalledWith('my-requests', who(), 10000);
    expect(await requestsApi(fakeSocket({ 'my-requests': { ok: false } }), who).list()).toBeNull();
    expect(await requestsApi(fakeSocket({}), who).list()).toBeNull();
  });

  it('my-request-open, my-request-close and my-request-reply carry the conversation', async () => {
    const detail = { ...req(), messages: [] };
    const s = fakeSocket({ 'my-request-open': { ok: true, request: detail }, 'my-request-reply': { ok: false, reason: 'locked' } });
    const api = requestsApi(s, who);
    expect(await api.open('mobile_1_abcdef')).toEqual(detail);
    expect(s.emitWithAck).toHaveBeenLastCalledWith('my-request-open', { ...who(), chatSessionId: 'mobile_1_abcdef' }, 10000);
    expect(await api.reply('mobile_1_abcdef', 'hi', 'request-reply-x')).toEqual({ ok: false, reason: 'locked' });
    expect(s.emitWithAck).toHaveBeenLastCalledWith('my-request-reply', { ...who(), chatSessionId: 'mobile_1_abcdef', text: 'hi', entryId: 'request-reply-x' }, 10000);
    api.close('mobile_1_abcdef');
    expect(s.emitToServer).toHaveBeenCalledWith('my-request-close', { chatSessionId: 'mobile_1_abcdef' });
    expect(await requestsApi(fakeSocket({}), who).reply('a', 'b', 'c')).toEqual({ ok: false, reason: 'offline' });
    expect(await requestsApi(fakeSocket({ 'my-request-open': { ok: false, reason: 'not_found' } }), who).open('x')).toBeNull();
  });

  it('my-request-update names the request; a reconnect reads the open one again', async () => {
    const s = fakeSocket({ 'my-request-open': { ok: true, request: { ...req(), messages: [] } } });
    const api = requestsApi(s, who);
    const seen: string[] = [];
    const off = api.onUpdate((id) => seen.push(id));
    s.fire('my-request-update', { chatSessionId: 'other_123' });
    s.fire('my-request-update', {});
    s.fire('connect');
    expect(seen).toEqual(['other_123']);
    await api.open('mobile_1_abcdef');
    s.fire('connect');
    expect(seen).toEqual(['other_123', 'mobile_1_abcdef']);
    api.close('mobile_1_abcdef');
    s.fire('connect');
    off();
    s.fire('my-request-update', { chatSessionId: 'other_123' });
    expect(seen).toEqual(['other_123', 'mobile_1_abcdef']);
  });

  it("a reply's id is one the server keeps (request-reply-[\\w-]{1,60})", () => {
    const id = replyEntryId(NOW, () => 0.123456789);
    expect(id).toMatch(/^request-reply-[\w-]{1,60}$/);
    expect(id.startsWith(`request-reply-${NOW.toString(36)}`)).toBe(true);
  });
});

describe('the accent (web accentFor)', () => {
  it('the brand colour, the header, the launcher, unless too light; then indigo', () => {
    expect(requestsAccent({ brandColor: '#0808EE', headerBgColor: '#ff0000' })).toBe('#0808EE');
    expect(requestsAccent({ brandColor: '#0808EE', _themePalette: true, headerBgColor: '#123456' })).toBe('#123456');
    expect(requestsAccent({ headerBgColor: '#ffffff', widgetIconBgColor: '#222222' })).toBe('#222222');
    expect(requestsAccent({ headerBgColor: '#fff' })).toBe('#4F46E5');
    expect(requestsAccent(null)).toBe('#4F46E5');
  });
});
