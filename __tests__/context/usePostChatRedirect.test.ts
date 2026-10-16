/**
 * The post-chat redirect wired (context/hooks/usePostChatRedirect.ts; web
 * index.ts _afterPostChat): after the conversation ends and the rating is
 * done (or there is none), the countdown; the app's hook first; stopped by
 * a closed chat, a new conversation, a block or the app going to the
 * background.
 */
import { renderHook, act } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { usePostChatRedirect, REDIRECT_SETTLE_MS } from '../../src/context/hooks/usePostChatRedirect';

const memoryStore = () => {
  const m = new Map<string, string>();
  return { getItem: async (k: string) => m.get(k) ?? null, setItem: async (k: string, v: string) => void m.set(k, v), m };
};

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

const setup = (over: any = {}) => {
  const went: string[] = [];
  const props: any = {
    redirectUrl: 'https://www.example.com/thanks',
    chatSessionId: 's1',
    chatVisible: true,
    blocked: false,
    live: false,
    ratingPending: false,
    store: memoryStore(),
    open: (u: string) => (went.push(u), true),
    ...over,
  };
  const hook = renderHook((p: any) => usePostChatRedirect(p), { initialProps: props });
  const rerender = (more: any) => {
    Object.assign(props, more);
    hook.rerender({ ...props });
  };
  const wait = async (ms: number) => {
    await act(async () => {
      jest.advanceTimersByTime(ms);
      await flush();
    });
  };
  return { hook, went, rerender, wait, line: () => hook.result.current.line };
};

beforeEach(() => {
  jest.useFakeTimers();
  (AppState as any).currentState = 'active';
});
afterEach(() => jest.useRealTimers());

it('the conversation ends: the line after the rating\'s delay, then the browser', async () => {
  const s = setup();
  act(() => s.hook.result.current.conversationEnded());
  await s.wait(REDIRECT_SETTLE_MS - 1);
  expect(s.line()).toBeNull();
  await s.wait(1);
  expect(s.line()?.text).toBe('Taking you to example.com in 10s');
  await s.wait(10000);
  expect(s.went).toEqual(['https://www.example.com/thanks']);
});

it('waits for the rating to be sent or put away', async () => {
  const s = setup({ ratingPending: true });
  act(() => s.hook.result.current.conversationEnded());
  await s.wait(5000);
  expect(s.line()).toBeNull();
  s.rerender({ ratingPending: false });
  await s.wait(REDIRECT_SETTLE_MS);
  expect(s.line()?.phase).toBe('counting');
});

it('the app\'s hook takes it: no countdown', async () => {
  const onPostChatRedirect = jest.fn(() => true);
  const s = setup({ onPostChatRedirect });
  act(() => s.hook.result.current.conversationEnded());
  await s.wait(REDIRECT_SETTLE_MS);
  expect(onPostChatRedirect).toHaveBeenCalledWith('https://www.example.com/thanks');
  expect(s.line()).toBeNull();
  await s.wait(20000);
  expect(s.went).toEqual([]);
});

it('disablePostChatRedirect: never', async () => {
  const onPostChatRedirect = jest.fn();
  const s = setup({ disabled: true, onPostChatRedirect });
  act(() => s.hook.result.current.conversationEnded());
  await s.wait(20000);
  expect(s.line()).toBeNull();
  expect(onPostChatRedirect).not.toHaveBeenCalled();
});

it('Cancel, a closed chat, a new conversation or a block stops it', async () => {
  for (const change of [null, { chatVisible: false }, { chatSessionId: 's2' }, { blocked: true }, { live: true }]) {
    const s = setup();
    act(() => s.hook.result.current.conversationEnded());
    await s.wait(REDIRECT_SETTLE_MS + 2000);
    expect(s.line()?.phase).toBe('counting');
    if (change) s.rerender(change);
    else act(() => s.hook.result.current.cancel());
    await s.wait(20000);
    expect(s.line()).toBeNull();
    expect(s.went).toEqual([]);
  }
});

it('the app going to the background stops it', async () => {
  const s = setup();
  const listener = (AppState.addEventListener as jest.Mock).mock.calls.slice(-1)[0][1];
  act(() => s.hook.result.current.conversationEnded());
  await s.wait(REDIRECT_SETTLE_MS + 1000);
  expect(s.line()).not.toBeNull();
  act(() => {
    (AppState as any).currentState = 'background';
    listener('background');
  });
  await s.wait(20000);
  expect(s.line()).toBeNull();
  expect(s.went).toEqual([]);
});

it('a chat that ended off screen does not count down when opened later', async () => {
  const s = setup({ chatVisible: false });
  act(() => s.hook.result.current.conversationEnded());
  await s.wait(REDIRECT_SETTLE_MS);
  s.rerender({ chatVisible: true });
  await s.wait(20000);
  expect(s.line()).toBeNull();
  expect(s.went).toEqual([]);
});

it('a restart: the next conversation gets its own', async () => {
  const store = memoryStore();
  const s = setup({ store });
  act(() => s.hook.result.current.conversationEnded());
  await s.wait(REDIRECT_SETTLE_MS);
  act(() => s.hook.result.current.resetRedirect());
  expect(s.line()).toBeNull();
  s.rerender({ chatSessionId: 's2' });
  act(() => s.hook.result.current.conversationEnded());
  await s.wait(REDIRECT_SETTLE_MS);
  expect(s.line()?.phase).toBe('counting');
  expect(store.m.size).toBe(2);
});
