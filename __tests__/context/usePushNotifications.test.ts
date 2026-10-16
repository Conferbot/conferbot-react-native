/**
 * Push notifications wired (context/hooks/usePushNotifications.ts): the
 * token registered with each conversation, unregistered on logout, a
 * Conferbot notification opening its conversation. The API is mocked.
 */
import { renderHook, act } from '@testing-library/react-native';
import { usePushNotifications, PUSH_RETRY_DEBOUNCE_MS } from '../../src/context/hooks/usePushNotifications';

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

const push = (over: any = {}) => ({
  source: 'conferbot',
  type: 'conferbot_message',
  botId: 'bot1',
  chatSessionId: 's1',
  messageId: 'm1',
  senderType: 'bot',
  senderName: 'Pip',
  body: 'Hi',
  ...over,
});

const setup = (over: any = {}, answers: any[] = []) => {
  const calls: string[] = [];
  const bodies: any[] = [];
  const unregistered: string[] = [];
  const api = {
    registerPushToken: jest.fn(async (body: any) => {
      bodies.push(body);
      return answers.length ? answers.shift() : { ok: true };
    }),
    unregisterPushToken: jest.fn(async (t: string) => (unregistered.push(t), true)),
  };
  const props: any = {
    botId: 'bot1',
    api: () => api,
    chatSessionId: undefined,
    recordLength: 0,
    userId: 'u1',
    isInitialized: true,
    isOpen: false,
    chatVisible: true,
    openChat: () => calls.push('openChat'),
    showChat: () => calls.push('showChat'),
    openRequests: (id?: string) => calls.push(`openRequests:${id}`),
    bumpUnread: () => calls.push('unread'),
    ...over,
  };
  const hook = renderHook((p: any) => usePushNotifications(p), { initialProps: props });
  const rerender = async (more: any) => {
    Object.assign(props, more);
    await act(async () => {
      hook.rerender({ ...props });
      await flush();
    });
  };
  return { hook, calls, bodies, unregistered, rerender, api };
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('registration', () => {
  it('nothing is sent until the app passes a token', async () => {
    const t = setup({ chatSessionId: 's1' });
    await t.rerender({ recordLength: 3 });
    await act(async () => {
      jest.advanceTimersByTime(PUSH_RETRY_DEBOUNCE_MS);
      await flush();
    });
    expect(t.api.registerPushToken).not.toHaveBeenCalled();
  });

  it('registers with the conversation (chatSessionId and tokenType), and again for a new one', async () => {
    const t = setup({ chatSessionId: 's1' });
    await act(async () => {
      await t.hook.result.current.setPushToken('fcm:token-abcdefghijklmnop', 'fcm');
    });
    expect(t.bodies).toEqual([{ token: 'fcm:token-abcdefghijklmnop', chatSessionId: 's1', tokenType: 'fcm' }]);
    await t.rerender({ chatSessionId: 's2' });
    expect(t.bodies.map((b) => b.chatSessionId)).toEqual(['s1', 's2']);
  });

  it('tries again as the conversation goes on while the server does not have it yet', async () => {
    const t = setup({ chatSessionId: 's1' }, [{ ok: false, error: 'SESSION_NOT_FOUND' }]);
    await act(async () => {
      await t.hook.result.current.setPushToken('fcm:token-abcdefghijklmnop');
    });
    await t.rerender({ recordLength: 2 });
    await act(async () => {
      jest.advanceTimersByTime(PUSH_RETRY_DEBOUNCE_MS);
      await flush();
    });
    expect(t.bodies).toHaveLength(2);
    expect(t.hook.result.current.registrar.registered()).toEqual({ token: 'fcm:token-abcdefghijklmnop', chatSessionId: 's1' });
  });

  it('unregisters when the user logs out', async () => {
    const t = setup({ chatSessionId: 's1' });
    await act(async () => {
      await t.hook.result.current.setPushToken('fcm:token-abcdefghijklmnop');
    });
    await t.rerender({ userId: undefined });
    expect(t.unregistered).toEqual(['fcm:token-abcdefghijklmnop']);
  });

  it('unregisterPush stops it', async () => {
    const t = setup({ chatSessionId: 's1' });
    await act(async () => {
      await t.hook.result.current.setPushToken('fcm:token-abcdefghijklmnop');
      await t.hook.result.current.unregisterPush();
    });
    expect(t.unregistered).toEqual(['fcm:token-abcdefghijklmnop']);
  });
});

describe('a notification', () => {
  it('not a Conferbot one, or another bot\'s: false, nothing opened', () => {
    const t = setup({ chatSessionId: 's1' });
    expect(t.hook.result.current.handlePushNotification({ data: { foo: 'bar' } })).toBe(false);
    expect(t.hook.result.current.handlePushNotification(push({ botId: 'other' }))).toBe(false);
    expect(t.calls).toEqual([]);
  });

  it('tapped: opens the chat on its conversation', () => {
    const t = setup({ chatSessionId: 's1' });
    let r = false;
    act(() => {
      r = t.hook.result.current.handlePushNotification({ data: push() });
    });
    expect(r).toBe(true);
    expect(t.calls).toEqual(['openChat', 'showChat']);
  });

  it('another of the visitor\'s conversations: that one in "Your requests"', () => {
    const t = setup({ chatSessionId: 's1' });
    act(() => {
      t.hook.result.current.handlePushNotification(push({ chatSessionId: 'old' }));
    });
    expect(t.calls).toEqual(['openChat', 'openRequests:old']);
  });

  it('before the SDK is ready (the app started from the tap): opened once it is', async () => {
    const t = setup({ isInitialized: false });
    act(() => {
      expect(t.hook.result.current.handlePushNotification(push())).toBe(true);
    });
    expect(t.calls).toEqual([]);
    await t.rerender({ isInitialized: true, chatSessionId: 's1' });
    expect(t.calls).toEqual(['openChat', 'showChat']);
  });

  it('{ open: false }: counted unread, unless that conversation is on screen', () => {
    const t = setup({ chatSessionId: 's1' });
    act(() => {
      t.hook.result.current.handlePushNotification(push(), { open: false });
    });
    expect(t.calls).toEqual(['unread']);
    const v = setup({ chatSessionId: 's1', isOpen: true, chatVisible: true });
    act(() => {
      expect(v.hook.result.current.handlePushNotification(push(), { open: false })).toBe(true);
    });
    expect(v.calls).toEqual([]);
  });
});
