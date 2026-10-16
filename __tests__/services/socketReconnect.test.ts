/**
 * Back in the chat's room after a reconnect (#83). socket.io v4 emits
 * 'reconnect' on the Manager, not the Socket, so the rejoin runs on the
 * Socket's 'connect', which fires on every connect including each reconnect.
 */
import { io } from 'socket.io-client';
import ConferBotSocket from '../../src/services/socket';

jest.mock('socket.io-client');

const mockSocket = () => {
  const handlers: Record<string, Function[]> = {};
  const managerHandlers: Record<string, Function[]> = {};
  const sock: any = {
    on: jest.fn((ev: string, fn: Function) => (handlers[ev] = [...(handlers[ev] || []), fn])),
    off: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    connected: false,
    id: 'sock',
    io: { on: jest.fn((ev: string, fn: Function) => (managerHandlers[ev] = [...(managerHandlers[ev] || []), fn])) },
  };
  const fire = (ev: string, ...a: any[]) => (handlers[ev] || []).forEach((fn) => fn(...a));
  const connect = () => {
    sock.connected = true;
    fire('connect');
  };
  const drop = () => {
    sock.connected = false;
    fire('disconnect', 'transport close');
  };
  return { sock, fire, connect, drop, handlers, managerHandlers };
};

const joins = (sock: any) => sock.emit.mock.calls.filter((c: any[]) => c[0] === 'join-chat-room-visitor');

const setup = (visitorId?: string) => {
  const m = mockSocket();
  (io as jest.Mock).mockReturnValue(m.sock);
  const client = new ConferBotSocket({ apiKey: 'k', botId: 'b', ...(visitorId ? { visitorId } : {}) });
  client.connect().catch(() => {});
  return { ...m, client };
};

describe('ConferBotSocket room rejoin on reconnect (#83)', () => {
  it('joins the room again after a disconnect and reconnect', () => {
    const { sock, client, connect, drop } = setup('v1');
    connect();
    client.joinChatRoomVisitor('s1');
    expect(joins(sock)).toEqual([['join-chat-room-visitor', { chatSessionId: 's1', visitorId: 'v1' }]]);
    drop();
    connect();
    expect(joins(sock)).toHaveLength(2);
    expect(joins(sock)[1]).toEqual(['join-chat-room-visitor', { chatSessionId: 's1', visitorId: 'v1' }]);
    drop();
    connect();
    expect(joins(sock)).toHaveLength(3);
  });

  it('joins nothing on connect before a chat is known', () => {
    const { sock, connect } = setup();
    connect();
    expect(joins(sock)).toHaveLength(0);
  });

  it('a join asked while offline is made on the next connect', () => {
    const { sock, client, connect } = setup();
    client.joinChatRoomVisitor('s2');
    expect(joins(sock)).toHaveLength(0);
    connect();
    expect(joins(sock)).toEqual([['join-chat-room-visitor', { chatSessionId: 's2' }]]);
  });

  it('a room left is not joined again on reconnect', () => {
    const { sock, client, connect, drop } = setup();
    connect();
    client.joinChatRoomVisitor('s3');
    client.leaveChatRoom('s3');
    drop();
    connect();
    expect(joins(sock)).toHaveLength(1);
  });

  it('a chat set directly (a restored session) is joined on reconnect', () => {
    const { sock, client, connect, drop } = setup();
    connect();
    client.chatSessionId = 's4';
    drop();
    connect();
    expect(joins(sock)).toEqual([['join-chat-room-visitor', { chatSessionId: 's4' }]]);
  });

  it('rejoins before telling its connect listeners (they may ask the room)', () => {
    const { sock, client, connect, drop } = setup();
    connect();
    client.joinChatRoomVisitor('s5');
    const order: string[] = [];
    sock.emit.mockImplementation((ev: string) => order.push(ev));
    client.on('connect', () => order.push('listener'));
    drop();
    connect();
    expect(order).toEqual(expect.arrayContaining(['join-chat-room-visitor', 'listener']));
    expect(order.indexOf('join-chat-room-visitor')).toBeLessThan(order.indexOf('listener'));
  });

  it("listens for 'reconnect' on the Manager, not the Socket", () => {
    const { handlers, managerHandlers } = setup();
    expect(handlers.reconnect).toBeUndefined();
    expect(managerHandlers.reconnect).toHaveLength(1);
  });
});
