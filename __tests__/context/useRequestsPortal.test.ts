/**
 * "Your requests" in the provider (context/hooks/useRequestsPortal.ts; web
 * conferbot-widget src/ts/home/requests/card.ts, store.ts and index.ts
 * rememberSession): what the device keeps, when the list is read, the
 * unread count.
 */
import { act, renderHook } from '@testing-library/react-native';
import { useRequestsPortal } from '../../src/context/hooks/useRequestsPortal';

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

const fakeSocket = (answers: Record<string, any>) => {
  const handlers: Record<string, Array<(d?: any) => void>> = {};
  return {
    isConnected: () => true,
    emitWithAck: jest.fn(async (event: string) => answers[event] ?? null),
    emitToServer: jest.fn(),
    on: jest.fn((event: string, fn: any) => {
      (handlers[event] = handlers[event] || []).push(fn);
      return () => (handlers[event] = handlers[event].filter((f) => f !== fn));
    }),
    getVisitorId: () => 'v_1',
    fire: (event: string, d?: any) => (handlers[event] || []).forEach((f) => f(d)),
  };
};

const fakeStorage = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  return {
    data,
    getItem: jest.fn(async (k: string) => data[k] ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      data[k] = v;
    }),
    removeItem: jest.fn(),
    multiGet: jest.fn(),
    multiSet: jest.fn(),
    multiRemove: jest.fn(),
    getAllKeys: jest.fn(),
  };
};

const KEY = '@conferbot:requests:bot1';
const team = { id: 'mobile_1_abcdef', title: 'Invoice', status: 'open', lastAt: new Date(Date.now() - 60000).toISOString(), lastFrom: 'team', lastText: 'Done', teamName: 'Ada' };

const mount = (o: { socket: any; storage: any; record?: any[]; chatSessionId?: string; user?: any; isConnected?: boolean }) =>
  renderHook((p: any) =>
    useRequestsPortal({
      botId: 'bot1',
      socketClient: { current: o.socket },
      isConnected: p.isConnected,
      isOpen: false,
      chatSessionId: p.chatSessionId,
      record: p.record,
      user: o.user,
      visitorId: () => 'v_1',
      storage: o.storage,
      openChat: jest.fn(),
    }),
  { initialProps: { isConnected: o.isConnected ?? true, record: o.record || [], chatSessionId: o.chatSessionId } });

describe('useRequestsPortal', () => {
  it('a first-time visitor: nothing is asked', async () => {
    const socket = fakeSocket({});
    const { result } = mount({ socket, storage: fakeStorage() });
    await act(flush);
    expect(socket.emitWithAck).not.toHaveBeenCalled();
    expect(result.current.requests).toBeNull();
  });

  it('a chat the visitor wrote in is remembered; then the list is read with it, and the unread counted', async () => {
    const socket = fakeSocket({ 'my-requests': { ok: true, requests: [team] } });
    const storage = fakeStorage();
    const view = mount({ socket, storage, chatSessionId: 'mobile_1_abcdef', record: [{ type: 'bot-message' }] });
    await act(flush);
    expect(storage.setItem).not.toHaveBeenCalled();
    view.rerender({ isConnected: true, chatSessionId: 'mobile_1_abcdef', record: [{ type: 'bot-message' }, { type: 'user-message' }] });
    await act(flush);
    expect(JSON.parse(storage.data[KEY]).sessions).toEqual(['mobile_1_abcdef']);
    await act(async () => {
      await view.result.current.refreshRequests(true);
    });
    expect(socket.emitWithAck).toHaveBeenCalledWith('my-requests', { visitorId: 'v_1', sessions: ['mobile_1_abcdef'] }, 10000);
    expect(view.result.current.requests).toEqual([team]);
    expect(view.result.current.requestsUnread).toBe(1);
  });

  it('read on the device: opening it marks it read and the count drops', async () => {
    const socket = fakeSocket({
      'my-requests': { ok: true, requests: [team] },
      'my-request-open': { ok: true, request: { ...team, messages: [] } },
    });
    const storage = fakeStorage({ [KEY]: JSON.stringify({ sessions: ['mobile_1_abcdef'], seen: {} }) });
    const { result } = mount({ socket, storage });
    await act(flush);
    expect(result.current.requestsUnread).toBe(1);
    await act(async () => {
      result.current.openRequests('mobile_1_abcdef');
      await flush();
    });
    expect(result.current.requestsOpen).toBe(true);
    expect(result.current.requestsUnread).toBe(0);
    expect(JSON.parse(storage.data[KEY]).seen.mobile_1_abcdef).toBeGreaterThan(0);
    await act(async () => {
      result.current.closeRequests();
      await flush();
    });
    expect(result.current.requestsOpen).toBe(false);
    expect(socket.emitToServer).toHaveBeenCalledWith('my-request-close', { chatSessionId: 'mobile_1_abcdef' });
  });

  it('a signed-in user is asked about with only the checked fields', async () => {
    const socket = fakeSocket({ 'my-requests': { ok: true, requests: [] } });
    mount({ socket, storage: null, user: { id: 'u1', email: 'a@b.co', hash: 'h', name: 'Ada' } });
    await act(flush);
    expect(socket.emitWithAck).toHaveBeenCalledWith('my-requests', { visitorId: 'v_1', sessions: [], user: { id: 'u1', email: 'a@b.co', hash: 'h' } }, 10000);
  });

  it('a request changed while the portal is closed: the list is read again', async () => {
    const socket = fakeSocket({ 'my-requests': { ok: true, requests: [] } });
    mount({ socket, storage: fakeStorage({ [KEY]: JSON.stringify({ sessions: ['mobile_1_abcdef'], seen: {} }) }) });
    await act(flush);
    expect(socket.emitWithAck).toHaveBeenCalledTimes(1);
    await act(async () => {
      socket.fire('my-request-update', { chatSessionId: 'mobile_1_abcdef' });
      await flush();
    });
    expect(socket.emitWithAck).toHaveBeenCalledTimes(2);
  });
});
