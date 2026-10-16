/**
 * The post-chat rating at the flow's end (#76; web index.ts: the end of a
 * path that is not a sub-flow's shows the rating 1.5 s later), once per
 * conversation and remembered across restarts, and the post-chat redirect
 * waiting for it (useLiveChatExtras ratingPending into usePostChatRedirect).
 */
import { renderHook, act } from '@testing-library/react-native';
import { AppState } from 'react-native';
import {
  useLiveChatExtras,
  FLOW_END_RATING_MS,
  RATING_OFFERED_KEY_PREFIX,
} from '../../src/context/hooks/useLiveChatExtras';
import { usePostChatRedirect, REDIRECT_SETTLE_MS } from '../../src/context/hooks/usePostChatRedirect';

const memoryStore = (seed: Record<string, string> = {}) => {
  const m = new Map<string, string>(Object.entries(seed));
  return { getItem: async (k: string) => m.get(k) ?? null, setItem: async (k: string, v: string) => void m.set(k, v), m };
};

const fakeSocket = () => {
  const handlers: Record<string, (d: any) => void> = {};
  return {
    chatSessionId: 's1',
    on: jest.fn((event: string, fn: any) => {
      handlers[event] = fn;
    }),
    isConnected: () => true,
    emitWithAck: jest.fn().mockResolvedValue({ ok: true }),
    emitToServer: jest.fn(),
    sendResponseRecord: jest.fn(),
    fire(event: string, data?: any) {
      handlers[event]?.(data);
    },
  };
};

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

const setup = ({ rating = true, store = memoryStore() as any } = {}) => {
  const socket = fakeSocket();
  const state = { sessionId: 's1', addRecord: jest.fn(), getRecord: () => [], getVariable: () => 'v1', setUserMetadata: jest.fn(), setAnswer: jest.fn(), buildResponseData: () => ({}) };
  const went: string[] = [];
  const hook = renderHook(() => {
    const live = useLiveChatExtras({
      socketClient: { current: socket as any },
      chatStateRef: { current: state as any },
      record: [],
      setRecord: jest.fn(),
      isOpen: true,
      waitingForPerson: false,
      store,
    } as any);
    const redirect = usePostChatRedirect({
      redirectUrl: 'https://example.com/thanks',
      chatSessionId: 's1',
      chatVisible: true,
      blocked: !!live.blocked,
      live: false,
      ratingPending: live.ratingPending,
      store: memoryStore(),
      open: (u: string) => (went.push(u), true),
    });
    return { live, redirect };
  });
  act(() => hook.result.current.live.setupLiveChatListeners());
  if (rating) act(() => hook.result.current.live.setChatbotData({ csatConfig: { enabled: true, ratingType: 'stars' } }));
  const wait = async (ms: number) => {
    await act(async () => {
      jest.advanceTimersByTime(ms);
      await flush();
    });
  };
  /** The flow's end, as the provider wires it: the rating, then the redirect. */
  const flowEnd = async () => {
    await act(async () => {
      hook.result.current.live.flowEnded();
      hook.result.current.redirect.conversationEnded();
      await flush();
    });
  };
  return { hook, socket, store, went, wait, flowEnd, x: () => hook.result.current.live, line: () => hook.result.current.redirect.line };
};

beforeEach(() => {
  jest.useFakeTimers();
  (AppState as any).currentState = 'active';
});
afterEach(() => jest.useRealTimers());

it('the flow\'s end opens the rating 1.5 s later; the redirect waits until it is sent', async () => {
  const s = setup();
  expect(s.x().ratingPending).toBe(false);
  await s.flowEnd();
  // Due: the redirect already waits, the card is not up yet.
  expect(s.x().csatOpen).toBe(false);
  expect(s.x().ratingPending).toBe(true);
  await s.wait(FLOW_END_RATING_MS - 1);
  expect(s.x().csatOpen).toBe(false);
  await s.wait(1);
  expect(s.x().csatOpen).toBe(true);
  expect(s.x().csatDue).toBe(false);
  expect(s.x().ratingPending).toBe(true);
  // Long after: still no countdown while the rating is up.
  await s.wait(10000);
  expect(s.line()).toBeNull();
  act(() => s.x().submitRating(5, ''));
  expect(s.socket.emitToServer).toHaveBeenCalledWith('submit-chat-rating', expect.objectContaining({ chatSessionId: 's1', csatScore: 5 }));
  expect(s.x().ratingPending).toBe(false);
  await s.wait(REDIRECT_SETTLE_MS);
  expect(s.line()?.text).toBe('Taking you to example.com in 10s');
});

it('put away (skipped or closed): the redirect goes on', async () => {
  const s = setup();
  await s.flowEnd();
  await s.wait(FLOW_END_RATING_MS);
  expect(s.x().csatOpen).toBe(true);
  act(() => s.x().dismissCsat());
  expect(s.x().ratingPending).toBe(false);
  await s.wait(REDIRECT_SETTLE_MS);
  expect(s.line()?.text).toBe('Taking you to example.com in 10s');
});

it('once per conversation: a second end asks no second time', async () => {
  const s = setup();
  await s.flowEnd();
  await s.wait(FLOW_END_RATING_MS);
  act(() => s.x().dismissCsat());
  await s.flowEnd();
  expect(s.x().csatDue).toBe(false);
  await s.wait(FLOW_END_RATING_MS);
  expect(s.x().csatOpen).toBe(false);
});

it('remembered in storage, so a restart does not ask again', async () => {
  const s = setup();
  await s.flowEnd();
  expect(s.store.m.get(RATING_OFFERED_KEY_PREFIX + 's1')).toBe('1');
  // A restart: the same conversation, the store says it was asked.
  const again = setup({ store: memoryStore({ [RATING_OFFERED_KEY_PREFIX + 's1']: '1' }) });
  await again.flowEnd();
  await again.wait(FLOW_END_RATING_MS);
  expect(again.x().csatOpen).toBe(false);
  expect(again.x().ratingPending).toBe(false);
  // And the redirect does not wait for a rating that will not come.
  expect(again.line()?.text).toMatch(/^Taking you to example\.com in \d+s$/);
});

it('no rating when the owner has it off: the redirect goes at once', async () => {
  const s = setup({ rating: false });
  await s.flowEnd();
  expect(s.x().ratingPending).toBe(false);
  await s.wait(FLOW_END_RATING_MS);
  expect(s.x().csatOpen).toBe(false);
  expect(s.line()?.text).toBe('Taking you to example.com in 10s');
});

it('not after an agent\'s end already asked, nor once sent', async () => {
  const s = setup();
  act(() => s.socket.fire('chat-ended', {}));
  expect(s.x().csatOpen).toBe(true);
  act(() => s.x().dismissCsat());
  await s.flowEnd();
  await s.wait(FLOW_END_RATING_MS);
  expect(s.x().csatOpen).toBe(false);

  const sent = setup();
  act(() => sent.socket.fire('chat-ended', {}));
  act(() => sent.x().submitRating(4, ''));
  await sent.flowEnd();
  expect(sent.x().csatDue).toBe(false);
});

it('blocked before it shows: no rating', async () => {
  const s = setup();
  await s.flowEnd();
  act(() => s.socket.fire('visitor-blocked', { message: 'Closed' }));
  expect(s.x().csatDue).toBe(false);
  await s.wait(FLOW_END_RATING_MS);
  expect(s.x().csatOpen).toBe(false);
});

it('a new conversation forgets the last one\'s due rating', async () => {
  const s = setup();
  await s.flowEnd();
  act(() => s.x().resetLiveChatExtras());
  expect(s.x().ratingPending).toBe(false);
  await s.wait(FLOW_END_RATING_MS);
  expect(s.x().csatOpen).toBe(false);
});
