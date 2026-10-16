/**
 * "Your requests" screens as states (core/requestsPortal.ts; web
 * conferbot-widget src/ts/home/requests/view.ts mountRequestsView).
 */
import { createRequestsPortal } from '../../src/core/requestsPortal';
import type { RequestDetail, RequestSummary, RequestsApi, ReplyResult } from '../../src/core/requests';

const NOW = Date.UTC(2026, 9, 16, 12);
const summary = (o: Partial<RequestSummary> = {}): RequestSummary => ({
  id: 'mobile_1_abcdef',
  title: 'My invoice is wrong',
  status: 'open',
  lastAt: new Date(NOW - 60000).toISOString(),
  lastFrom: 'team',
  lastText: 'Fixed it',
  teamName: 'Ada',
  ...o,
});
const detail = (o: Partial<RequestDetail> = {}): RequestDetail => ({
  ...summary(),
  messages: [
    { id: 'm1', from: 'you', name: '', text: 'My invoice is wrong', at: new Date(NOW - 120000).toISOString() },
    { id: 'm2', from: 'team', name: 'Ada', text: 'Fixed it', at: new Date(NOW - 60000).toISOString() },
  ],
  ...o,
});

const deferred = <T>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

const setup = (o: { list?: any; open?: any; reply?: (id: string, text: string, entryId: string) => Promise<ReplyResult>; current?: string } = {}) => {
  let update: ((id: string) => void) | null = null;
  const api: RequestsApi & { [k: string]: jest.Mock } = {
    list: jest.fn(async () => (o.list !== undefined ? o.list : [summary()])),
    open: jest.fn(async () => (o.open !== undefined ? o.open : detail())),
    close: jest.fn(),
    reply: jest.fn(o.reply || (async () => ({ ok: true, request: detail({ lastFrom: 'you' }) }))),
    onUpdate: jest.fn((fn) => {
      update = fn;
      return () => (update = null);
    }),
  } as any;
  const seen: Record<string, number> = {};
  const markSeen = jest.fn((id: string, at: number) => (seen[id] = at));
  const openChat = jest.fn();
  const onChanged = jest.fn();
  const portal = createRequestsPortal({
    api,
    seen: () => seen,
    markSeen,
    isCurrentChat: (id) => id === o.current,
    openChat,
    onChanged,
    now: () => NOW,
    rand: () => 0.5,
  });
  return { api, portal, markSeen, openChat, onChanged, seen, fireUpdate: (id: string) => update?.(id) };
};

describe('the list', () => {
  it('loading, then the requests in order; Back leaves and the list is read again', async () => {
    const { portal, api, onChanged } = setup({ list: [summary({ id: 'old_aaaaaa', lastFrom: 'you' }), summary()] });
    const p = portal.openList();
    expect(portal.getState()).toMatchObject({ screen: 'list', title: 'Your requests', loading: true });
    await p;
    expect(portal.getState().loading).toBe(false);
    expect(portal.getState().list!.map((r) => r.id)).toEqual(['mobile_1_abcdef', 'old_aaaaaa']);
    portal.back();
    expect(portal.getState().screen).toBe('closed');
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(api.close).not.toHaveBeenCalled();
  });

  it('empty is an empty list (the view says "Nothing here yet")', async () => {
    const { portal } = setup({ list: [] });
    await portal.openList();
    expect(portal.getState().list).toEqual([]);
  });

  it("could not load: failed, and Try again reads it again", async () => {
    const { portal, api } = setup({ list: null });
    await portal.openList();
    expect(portal.getState()).toMatchObject({ failed: true, loading: false });
    api.list.mockResolvedValueOnce([summary()]);
    portal.reload();
    await flush();
    expect(portal.getState()).toMatchObject({ failed: false, list: [summary()] });
  });
});

describe('one request', () => {
  it('from the list: the banner, the messages, read here; Back to the list (and its live updates stop)', async () => {
    const { portal, api, markSeen } = setup();
    await portal.openList();
    await portal.pick('mobile_1_abcdef');
    const s = portal.getState();
    expect(s).toMatchObject({ screen: 'request', title: 'Your request', requestState: 'replied', placeholder: 'Write your reply...' });
    expect(s.banner!.label).toBe('We replied');
    expect(s.request!.messages).toHaveLength(2);
    expect(markSeen).toHaveBeenCalledWith('mobile_1_abcdef', NOW);
    portal.back();
    expect(api.close).toHaveBeenCalledWith('mobile_1_abcdef');
    expect(portal.getState().screen).toBe('list');
    await flush();
    portal.back();
    expect(portal.getState().screen).toBe('closed');
  });

  it('opened straight away: Back leaves', async () => {
    const { portal, api } = setup();
    await portal.openRequest('mobile_1_abcdef');
    portal.back();
    expect(portal.getState().screen).toBe('closed');
    expect(api.close).toHaveBeenCalledWith('mobile_1_abcdef');
  });

  it('a solved one says a reply opens it again', async () => {
    const { portal } = setup({ open: detail({ status: 'solved' }) });
    await portal.openRequest('mobile_1_abcdef');
    expect(portal.getState()).toMatchObject({ requestState: 'solved', placeholder: 'Write here to open it again...' });
    expect(portal.getState().banner!.detail).toMatch(/pick it up again/);
  });

  it('the chat on screen right now: that chat instead', async () => {
    const { portal, api, openChat } = setup({ current: 'mobile_1_abcdef' });
    await portal.openRequest('mobile_1_abcdef');
    expect(api.open).not.toHaveBeenCalled();
    expect(openChat).toHaveBeenCalled();
    expect(portal.getState().screen).toBe('closed');
  });

  it('not found: failed with Try again', async () => {
    const { portal } = setup({ open: null });
    await portal.openRequest('mobile_1_abcdef');
    expect(portal.getState()).toMatchObject({ screen: 'request', failed: true });
  });
});

describe('a reply', () => {
  it('sent: shown as sending, then the answer replaces it and the draft is gone', async () => {
    const answer = deferred<ReplyResult>();
    const { portal, api } = setup({ reply: () => answer.promise });
    await portal.openRequest('mobile_1_abcdef');
    expect(portal.getState().canSend).toBe(false);
    portal.setDraft('  Thanks!  ');
    expect(portal.getState()).toMatchObject({ draft: '  Thanks!  ', canSend: true });
    portal.send();
    const [, text, entryId] = api.reply.mock.calls[0];
    expect(text).toBe('Thanks!');
    expect(entryId).toMatch(/^request-reply-/);
    expect(portal.getState().pending).toEqual([{ entryId, text: 'Thanks!', at: new Date(NOW).toISOString(), status: 'sending' }]);
    expect(portal.getState()).toMatchObject({ draft: '', canSend: false });
    const back = detail({ lastFrom: 'you', messages: [...detail().messages, { id: entryId, from: 'you', name: '', text: 'Thanks!', at: null }] });
    answer.resolve({ ok: true, request: back });
    await flush();
    expect(portal.getState().pending).toEqual([]);
    expect(portal.getState().request!.messages).toHaveLength(3);
    expect(portal.getState().requestState).toBe('waiting');
  });

  it('not sent: Try again sends the same entry; locked: no Try again', async () => {
    const { portal, api } = setup({ reply: async () => ({ ok: false, reason: 'offline' }) });
    await portal.openRequest('mobile_1_abcdef');
    portal.setDraft('Hello');
    portal.send();
    await flush();
    const [p] = portal.getState().pending;
    expect(p.status).toBe('failed');
    api.reply.mockResolvedValueOnce({ ok: false, reason: 'locked' });
    portal.retry(p.entryId);
    await flush();
    expect(api.reply.mock.calls[1][2]).toBe(p.entryId);
    expect(portal.getState().pending[0].status).toBe('locked');
    portal.retry(p.entryId);
    expect(api.reply).toHaveBeenCalledTimes(2);
  });

  it('an empty draft sends nothing; drafts are kept per request until reset', async () => {
    const { portal, api } = setup();
    await portal.openRequest('mobile_1_abcdef');
    portal.setDraft('   ');
    portal.send();
    expect(api.reply).not.toHaveBeenCalled();
    portal.setDraft('half written');
    portal.close();
    await portal.openRequest('mobile_1_abcdef');
    expect(portal.getState().draft).toBe('half written');
    portal.reset();
    portal.close();
    await portal.openRequest('mobile_1_abcdef');
    expect(portal.getState().draft).toBe('');
  });
});

describe('live updates (my-request-update)', () => {
  it('the open request is read again, keeping the draft and a reply that did not go', async () => {
    const { portal, api, fireUpdate } = setup({ reply: async () => ({ ok: false, reason: 'error' }) });
    await portal.openRequest('mobile_1_abcdef');
    portal.setDraft('one');
    portal.send();
    await flush();
    portal.setDraft('still typing');
    api.open.mockResolvedValueOnce(detail({ status: 'solved' }));
    fireUpdate('mobile_1_abcdef');
    await flush();
    expect(portal.getState()).toMatchObject({ requestState: 'solved', draft: 'still typing' });
    expect(portal.getState().pending.map((p) => p.status)).toEqual(['failed']);
  });

  it('another request, a closed portal or a reply on its way: nothing', async () => {
    const answer = deferred<ReplyResult>();
    const { portal, api, fireUpdate } = setup({ reply: () => answer.promise });
    fireUpdate('mobile_1_abcdef');
    await portal.openRequest('mobile_1_abcdef');
    fireUpdate('other_123456');
    await flush();
    expect(api.open).toHaveBeenCalledTimes(1);
    portal.setDraft('x');
    portal.send();
    api.open.mockResolvedValueOnce(detail({ status: 'solved' }));
    fireUpdate('mobile_1_abcdef');
    await flush();
    expect(portal.getState().requestState).toBe('replied');
  });

  it('a late answer for a screen that is gone is dropped', async () => {
    const opened = deferred<RequestDetail | null>();
    const { portal, api } = setup();
    api.open.mockReturnValueOnce(opened.promise);
    const p = portal.openRequest('mobile_1_abcdef');
    portal.close();
    opened.resolve(detail());
    await p;
    expect(portal.getState().screen).toBe('closed');
  });

  it('subscribers hear each change; destroy stops the updates', async () => {
    const { portal, api } = setup();
    const fn = jest.fn();
    const off = portal.subscribe(fn);
    await portal.openList();
    expect(fn).toHaveBeenCalled();
    off();
    portal.destroy();
    expect(api.onUpdate).toHaveBeenCalledTimes(1);
  });
});
