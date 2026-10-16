/**
 * services/api.ts push methods: the mobile push routes with the bot's
 * headers (embed-server POST /api/v1/mobile/push/register, /unregister).
 * axios is mocked: nothing leaves the test.
 */
const post = jest.fn();
jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => ({
      post,
      get: jest.fn(),
      interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    })),
  },
}));

import axios from 'axios';
import ConferBotAPI from '../../src/services/api';

beforeEach(() => post.mockReset());

describe('push API', () => {
  it('sends the bot headers', () => {
    new ConferBotAPI('conf_key', 'bot1');
    const cfg = (axios.create as jest.Mock).mock.calls[0][0];
    expect(cfg.headers['X-Bot-ID']).toBe('bot1');
    expect(cfg.headers['X-Platform']).toBeTruthy();
  });

  it('registers with chatSessionId and tokenType', async () => {
    post.mockResolvedValue({ status: 200, data: { success: true, data: { id: 'p1' } } });
    const api = new ConferBotAPI('conf_key', 'bot1');
    const r = await api.registerPushToken({ token: 'fcm:tok', chatSessionId: 's1', tokenType: 'fcm' });
    expect(r).toEqual({ ok: true });
    expect(post).toHaveBeenCalledWith('/push/register', { token: 'fcm:tok', chatSessionId: 's1', tokenType: 'fcm' }, expect.any(Object));
  });

  it('reads the server\'s refusal, never throws', async () => {
    const api = new ConferBotAPI('conf_key', 'bot1');
    post.mockResolvedValue({ status: 400, data: { success: false, error: 'MISSING_SESSION' } });
    expect(await api.registerPushToken({ token: 't', chatSessionId: '', tokenType: 'fcm' })).toEqual({ ok: false, error: 'MISSING_SESSION' });
    post.mockRejectedValue(new Error('Network Error'));
    expect(await api.registerPushToken({ token: 't', chatSessionId: 's', tokenType: 'fcm' })).toEqual({ ok: false, error: 'NETWORK' });
  });

  it('unregisters the token', async () => {
    const api = new ConferBotAPI('conf_key', 'bot1');
    post.mockResolvedValue({ status: 200, data: { success: true } });
    expect(await api.unregisterPushToken('fcm:tok')).toBe(true);
    expect(post).toHaveBeenCalledWith('/push/unregister', { token: 'fcm:tok' }, expect.any(Object));
    post.mockRejectedValue(new Error('x'));
    expect(await api.unregisterPushToken('fcm:tok')).toBe(false);
  });
});
