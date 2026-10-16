/**
 * The socket's reconnection options from the provider's config (#81), the
 * disconnect told to the provider, and a record sent while offline handed
 * to the offline queue instead of dropped (#80).
 */
import { io } from 'socket.io-client';
import ConferBotSocket from '../../src/services/socket';
import { ConferBotNetworkConfig } from '../../src/config/constants';

jest.mock('socket.io-client');

const mockSocket = () => ({
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
  connected: false,
  id: 'sock',
});

const handler = (sock: any, name: string) => sock.on.mock.calls.find((c: any[]) => c[0] === name)?.[1];

describe('ConferBotSocket offline and reconnection', () => {
  it('passes reconnectionAttempts and reconnectionDelay to socket.io', () => {
    const sock = mockSocket();
    (io as jest.Mock).mockReturnValue(sock);
    new ConferBotSocket({ apiKey: 'k', botId: 'b', reconnectionAttempts: 2, reconnectionDelay: 250 }).connect().catch(() => {});
    expect(io).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ reconnectionAttempts: 2, reconnectionDelay: 250 }));
  });

  it('falls back to ConferBotNetworkConfig without them', () => {
    const sock = mockSocket();
    (io as jest.Mock).mockReturnValue(sock);
    new ConferBotSocket({ apiKey: 'k', botId: 'b' }).connect().catch(() => {});
    expect(io).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({
        reconnectionAttempts: ConferBotNetworkConfig.reconnectionAttempts,
        reconnectionDelay: ConferBotNetworkConfig.reconnectionDelay,
      })
    );
  });

  it('tells its listeners of a disconnect', () => {
    const sock = mockSocket();
    (io as jest.Mock).mockReturnValue(sock);
    const client = new ConferBotSocket({ apiKey: 'k', botId: 'b' });
    const seen: string[] = [];
    client.on('disconnect', (reason: string) => seen.push(reason));
    client.connect().catch(() => {});
    handler(sock, 'disconnect')('transport close');
    expect(seen).toEqual(['transport close']);
  });

  it('hands a record sent while offline to the offline handler, with its message id', () => {
    const sock = mockSocket();
    (io as jest.Mock).mockReturnValue(sock);
    const client = new ConferBotSocket({ apiKey: 'k', botId: 'b' });
    client.connect().catch(() => {});
    const got: any[] = [];
    client.setOfflineHandler((data, meta) => got.push({ data, meta }));
    client.sendResponseRecord({ chatSessionId: 's1', record: [] }, { messageId: 'm1' });
    expect(sock.emit).not.toHaveBeenCalled();
    expect(got).toEqual([{ data: { chatSessionId: 's1', record: [], botId: 'b' }, meta: { messageId: 'm1' } }]);
  });

  it('sends as before when connected, and drops when offline without a handler', () => {
    const sock = mockSocket();
    (io as jest.Mock).mockReturnValue(sock);
    const client = new ConferBotSocket({ apiKey: 'k', botId: 'b' });
    client.connect().catch(() => {});
    client.sendResponseRecord({ chatSessionId: 's1', record: [] });
    expect(sock.emit).not.toHaveBeenCalled();
    sock.connected = true;
    client.sendResponseRecord({ chatSessionId: 's1', record: [] });
    expect(sock.emit).toHaveBeenCalledWith('response-record', { chatSessionId: 's1', record: [], botId: 'b' });
  });
});
