/**
 * Push notifications (core/push.ts; embed-server #189 docs/mobile-push.md):
 * the payload recognised, the request bodies, the server's answers, and the
 * registrar that keeps the token with the current conversation.
 */
import {
  PUSH_CHANNEL_ID,
  PUSH_REGISTER_PATH,
  PUSH_UNREGISTER_PATH,
  createPushRegistrar,
  isConferbotPush,
  parseConferbotPush,
  pushRegisterBody,
  pushRegisterResult,
  pushRetryable,
  pushTokenTypeOf,
} from '../../src/core/push';

const data = {
  source: 'conferbot',
  type: 'conferbot_message',
  botId: 'bot1',
  chatSessionId: 's1',
  messageId: 'm1',
  senderType: 'agent',
  senderName: 'Maya',
  body: 'Your order ships today',
};
const parsed = { botId: 'bot1', chatSessionId: 's1', messageId: 'm1', senderType: 'agent', senderName: 'Maya', body: 'Your order ships today' };

describe('the payload (FCM data / APNs custom keys)', () => {
  it('reads the flat data map', () => {
    expect(parseConferbotPush(data)).toEqual(parsed);
    expect(isConferbotPush(data)).toBe(true);
  });

  it('reads what the push libraries hand over', () => {
    // @react-native-firebase RemoteMessage
    expect(parseConferbotPush({ messageId: 'x', notification: { title: 'Maya' }, data })).toEqual(parsed);
    // Notifee press event detail
    expect(parseConferbotPush({ notification: { id: 'n', data } })).toEqual(parsed);
    // Expo notification and response
    expect(parseConferbotPush({ request: { content: { data } } })).toEqual(parsed);
    expect(parseConferbotPush({ notification: { request: { content: { data } } } })).toEqual(parsed);
    // APNs userInfo: the keys beside aps
    expect(parseConferbotPush({ aps: { alert: { title: 'Maya', body: 'x' }, 'thread-id': 's1' }, ...data })).toEqual(parsed);
    expect(parseConferbotPush({ userInfo: data })).toEqual(parsed);
  });

  it('is not another app\'s, another type, or without a conversation', () => {
    expect(parseConferbotPush({ ...data, source: 'other' })).toBeNull();
    expect(parseConferbotPush({ ...data, type: 'promo' })).toBeNull();
    expect(parseConferbotPush({ ...data, chatSessionId: '' })).toBeNull();
    expect(parseConferbotPush({ ...data, botId: undefined })).toBeNull();
    expect(parseConferbotPush(null)).toBeNull();
    expect(parseConferbotPush('conferbot')).toBeNull();
    expect(isConferbotPush({ data: { foo: 'bar' } })).toBe(false);
  });

  it('a missing messageId is "", an unknown sender the AI', () => {
    const p = parseConferbotPush({ ...data, messageId: undefined, senderType: 'x' })!;
    expect(p.messageId).toBe('');
    expect(p.senderType).toBe('bot');
  });

  it('names the server\'s Android channel', () => {
    expect(PUSH_CHANNEL_ID).toBe('conferbot_messages');
  });
});

describe('the requests', () => {
  it('posts to the mobile push paths', () => {
    expect(PUSH_REGISTER_PATH).toBe('/push/register');
    expect(PUSH_UNREGISTER_PATH).toBe('/push/unregister');
  });

  it('sends the token, the conversation and the token type', () => {
    expect(pushRegisterBody('tok', 's1', 'fcm')).toEqual({ token: 'tok', chatSessionId: 's1', tokenType: 'fcm' });
    expect(pushRegisterBody('tok', 's1', 'apns', { model: 'iPhone', osVersion: '18' })).toEqual({
      token: 'tok',
      chatSessionId: 's1',
      tokenType: 'apns',
      deviceInfo: { model: 'iPhone', osVersion: '18' },
    });
  });

  it('the token type: what the app said, else 64 hex is APNs', () => {
    const hex = 'a'.repeat(64);
    expect(pushTokenTypeOf(hex)).toBe('apns');
    expect(pushTokenTypeOf(hex, 'fcm')).toBe('fcm');
    expect(pushTokenTypeOf('fGx:APA91b-abc')).toBe('fcm');
    expect(pushTokenTypeOf('fGx:APA91b-abc', 'apns')).toBe('apns');
    expect(pushTokenTypeOf('x', 'weird')).toBe('fcm');
  });

  it('reads the server\'s answers', () => {
    expect(pushRegisterResult(200, { success: true, data: { id: 'p' } })).toEqual({ ok: true });
    expect(pushRegisterResult(400, { success: false, error: 'MISSING_SESSION' })).toEqual({ ok: false, error: 'MISSING_SESSION' });
    expect(pushRegisterResult(400, { success: false, error: 'INVALID_TOKEN' })).toEqual({ ok: false, error: 'INVALID_TOKEN' });
    expect(pushRegisterResult(403, { success: false, error: 'SESSION_FORBIDDEN' })).toEqual({ ok: false, error: 'SESSION_FORBIDDEN' });
    expect(pushRegisterResult(404, { success: false, error: 'SESSION_NOT_FOUND' })).toEqual({ ok: false, error: 'SESSION_NOT_FOUND' });
    expect(pushRegisterResult(404, 'Not Found')).toEqual({ ok: false, error: 'SESSION_NOT_FOUND' });
    expect(pushRegisterResult(500, { success: false, error: 'REGISTER_PUSH_FAILED' })).toEqual({ ok: false, error: 'SERVER' });
    expect(pushRegisterResult(200, { success: false })).toEqual({ ok: false, error: 'SERVER' });
  });

  it('tries again only when it may still work', () => {
    expect(pushRetryable('SESSION_NOT_FOUND')).toBe(true);
    expect(pushRetryable('NETWORK')).toBe(true);
    expect(pushRetryable('SERVER')).toBe(true);
    expect(pushRetryable('INVALID_TOKEN')).toBe(false);
    expect(pushRetryable('SESSION_FORBIDDEN')).toBe(false);
  });
});

describe('the registrar', () => {
  const setup = (answers: any[] = []) => {
    const registered: any[] = [];
    const unregistered: string[] = [];
    const r = createPushRegistrar({
      register: async (body) => {
        registered.push(body);
        const a = answers.length ? answers.shift() : { ok: true };
        if (a instanceof Error) throw a;
        return a;
      },
      unregister: async (t) => (unregistered.push(t), true),
    });
    return { r, registered, unregistered };
  };

  it('nothing without a token (opt-in) or without a conversation', async () => {
    const { r, registered } = setup();
    await r.setSession('s1');
    expect(registered).toEqual([]);
    const b = setup();
    await b.r.setToken('fcm-token-123456789012345');
    expect(b.registered).toEqual([]);
  });

  it('registers the token with the conversation, once, and again for each new one', async () => {
    const { r, registered } = setup();
    await r.setToken('fcm-token-123456789012345', 'fcm');
    await r.setSession('s1');
    await r.poke();
    await r.setSession('s1');
    expect(registered).toEqual([{ token: 'fcm-token-123456789012345', chatSessionId: 's1', tokenType: 'fcm' }]);
    await r.setSession('s2');
    expect(registered.map((b) => b.chatSessionId)).toEqual(['s1', 's2']);
    expect(r.registered()).toEqual({ token: 'fcm-token-123456789012345', chatSessionId: 's2' });
  });

  it('waits for the conversation to reach the server, then registers', async () => {
    const { r, registered } = setup([{ ok: false, error: 'SESSION_NOT_FOUND' }, new Error('offline'), { ok: true }]);
    await r.setSession('s1');
    await r.setToken('a'.repeat(64));
    expect(r.registered()).toBeNull();
    await r.poke();
    await r.poke();
    expect(r.registered()).toEqual({ token: 'a'.repeat(64), chatSessionId: 's1' });
    expect(registered[0].tokenType).toBe('apns');
    await r.poke();
    expect(registered).toHaveLength(3);
  });

  it('a refused token or another visitor\'s conversation is not tried again', async () => {
    const { r, registered } = setup([{ ok: false, error: 'SESSION_FORBIDDEN' }]);
    await r.setSession('s1');
    await r.setToken('fcm-token-123456789012345');
    await r.poke();
    await r.poke();
    expect(registered).toHaveLength(1);
    // A new conversation is.
    await r.setSession('s2');
    expect(registered).toHaveLength(2);
  });

  it('unregisters on logout and does not register that conversation again', async () => {
    const { r, registered, unregistered } = setup();
    await r.setToken('fcm-token-123456789012345');
    await r.setSession('s1');
    await r.unregister();
    expect(unregistered).toEqual(['fcm-token-123456789012345']);
    expect(r.registered()).toBeNull();
    await r.poke();
    expect(registered).toHaveLength(1);
    // The next conversation registers again.
    await r.setSession('s2');
    expect(registered).toHaveLength(2);
  });

  it('a refreshed token replaces the old one; null unregisters', async () => {
    const { r, registered, unregistered } = setup();
    await r.setSession('s1');
    await r.setToken('old-token-1234567890123456');
    await r.setToken('new-token-1234567890123456');
    expect(unregistered).toEqual(['old-token-1234567890123456']);
    expect(registered.map((b) => b.token)).toEqual(['old-token-1234567890123456', 'new-token-1234567890123456']);
    await r.setToken(null);
    expect(unregistered).toEqual(['old-token-1234567890123456', 'new-token-1234567890123456']);
    expect(r.token()).toBeNull();
    await r.setSession('s2');
    expect(registered).toHaveLength(2);
  });

  it('one request at a time; a change meanwhile is registered after it', async () => {
    let release: () => void = () => {};
    const bodies: any[] = [];
    const r = createPushRegistrar({
      register: (body) => {
        bodies.push(body);
        return bodies.length === 1 ? new Promise((res) => (release = () => res({ ok: true }))) : Promise.resolve({ ok: true });
      },
      unregister: async () => true,
    });
    await r.setToken('fcm-token-123456789012345');
    const first = r.setSession('s1');
    const second = r.setSession('s2');
    expect(bodies).toHaveLength(1);
    release();
    await first;
    await second;
    expect(bodies.map((b) => b.chatSessionId)).toEqual(['s1', 's2']);
    expect(r.registered()?.chatSessionId).toBe('s2');
  });
});
