/**
 * The connection and the offline queue on useConferBot() (#80): online is
 * the socket and NetInfo, a message sent while offline waits and goes on
 * reconnect (once, in the conversation's latest record), failed sends can
 * be retried, and enableOfflineMode: false queues nothing.
 */
import { renderHook, act } from '@testing-library/react-native';
import { useConnection } from '../../src/context/hooks/useConnection';

const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

const fakeSocket = () => {
  const listeners: Record<string, Array<(...a: any[]) => void>> = {};
  const sock: any = {
    connected: false,
    sent: [] as any[],
    offline: null as any,
    isConnected: () => sock.connected,
    on: (ev: string, fn: any) => {
      (listeners[ev] = listeners[ev] || []).push(fn);
      return () => {};
    },
    fire: (ev: string, ...a: any[]) => (listeners[ev] || []).forEach((fn) => fn(...a)),
    setOfflineHandler: (fn: any) => (sock.offline = fn),
    sendResponseRecord: (data: any, meta?: any) => {
      if (!sock.connected) return sock.offline?.(data, meta);
      sock.sent.push(data);
    },
  };
  return sock;
};

const setup = (over: any = {}) => {
  const socket = fakeSocket();
  const connected: boolean[] = [];
  let netListener: any = null;
  const netInfo = { addEventListener: (fn: any) => ((netListener = fn), () => {}) };
  let records = 0;
  const props: any = {
    botId: 'bot1',
    socketClient: { current: socket },
    setIsConnected: (c: boolean) => connected.push(c),
    latestRecord: (sid: string) => (sid === 's1' ? { chatSessionId: 's1', record: [`r${++records}`] } : null),
    enabled: true,
    storage: null,
    netInfo,
    queueConfig: { initialRetryDelay: 1, maxRetries: 1 },
    ...over,
  };
  const hook = renderHook((p: any) => useConnection(p), { initialProps: props });
  act(() => hook.result.current.setupConnectionListeners());
  return { hook, socket, connected, net: (state: any) => netListener?.(state) };
};

describe('useConnection', () => {
  it('is online with the socket, and offline when NetInfo says so', async () => {
    const { hook, socket, connected, net } = setup();
    await act(flush);
    expect(hook.result.current.isOnline).toBe(false);
    socket.connected = true;
    await act(async () => {
      socket.fire('connect');
      await flush();
    });
    expect(hook.result.current.isOnline).toBe(true);
    expect(connected).toEqual([true]);
    await act(async () => {
      net({ isConnected: false, isInternetReachable: false });
      await flush();
    });
    expect(hook.result.current.isOnline).toBe(false);
    socket.connected = false;
    await act(async () => {
      socket.fire('disconnect', 'transport close');
      await flush();
    });
    expect(connected).toEqual([true, false]);
  });

  it('queues messages sent offline and sends the latest record once on reconnect', async () => {
    const { hook, socket } = setup();
    await act(flush);
    await act(async () => {
      socket.sendResponseRecord({ chatSessionId: 's1', record: ['a'] }, { messageId: 'm1' });
      socket.sendResponseRecord({ chatSessionId: 's1', record: ['a', 'b'] }, { messageId: 'm2' });
      await flush();
    });
    expect(hook.result.current.pendingMessageCount).toBe(2);
    expect(socket.sent).toEqual([]);
    socket.connected = true;
    await act(async () => {
      socket.fire('connect');
      await flush();
    });
    expect(socket.sent).toEqual([{ chatSessionId: 's1', record: ['r1'] }]);
    expect(hook.result.current.pendingMessageCount).toBe(0);
    expect(hook.result.current.failedMessageCount).toBe(0);
  });

  it('drops a send for a conversation that is gone', async () => {
    const { hook, socket } = setup();
    await act(flush);
    await act(async () => {
      socket.sendResponseRecord({ chatSessionId: 'old', record: [] });
      await flush();
    });
    socket.connected = true;
    await act(async () => {
      socket.fire('connect');
      await flush();
    });
    expect(socket.sent).toEqual([]);
    expect(hook.result.current.pendingMessageCount).toBe(0);
  });

  it('retries a failed send by its message id', async () => {
    const { hook, socket } = setup();
    await act(flush);
    await act(async () => {
      socket.sendResponseRecord({ chatSessionId: 's1', record: [] }, { messageId: 'm1' });
      await flush();
    });
    // Connected as the queue sees it, but the socket drops before the send.
    await act(async () => {
      socket.fire('connect');
      await flush();
    });
    expect(hook.result.current.failedMessageCount).toBe(1);
    expect(await hook.result.current.retryFailedMessage('nope')).toBe(false);
    socket.connected = true;
    let ok = false;
    await act(async () => {
      ok = await hook.result.current.retryFailedMessage('m1');
      await flush();
    });
    expect(ok).toBe(true);
    expect(socket.sent).toHaveLength(1);
    expect(hook.result.current.failedMessageCount).toBe(0);
  });

  it('clears failed sends', async () => {
    const { hook, socket } = setup();
    await act(flush);
    await act(async () => {
      socket.sendResponseRecord({ chatSessionId: 's1', record: [] }, { messageId: 'm1' });
      socket.fire('connect');
      await flush();
    });
    expect(hook.result.current.failedMessageCount).toBe(1);
    let n = 0;
    await act(async () => {
      n = await hook.result.current.clearFailedMessages();
    });
    expect(n).toBe(1);
    expect(hook.result.current.failedMessageCount).toBe(0);
  });

  it('queues nothing with enableOfflineMode false', async () => {
    const { hook, socket } = setup({ enabled: false });
    await act(flush);
    expect(socket.offline).toBeNull();
    expect(hook.result.current.pendingMessageCount).toBe(0);
    expect(await hook.result.current.retryAllFailedMessages()).toBe(0);
  });
});
