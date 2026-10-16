/**
 * Push notifications (embed-server #189, docs/mobile-push.md).
 *
 * When an agent or the AI replies and the visitor has no live socket in
 * that chat, embed-server sends a push (FCM on Android, APNs on iOS) to the
 * tokens registered for that conversation. The SDK has no push library of
 * its own: the app gets the token (e.g. @react-native-firebase/messaging),
 * hands it to `setPushToken`, and forwards notifications it receives or the
 * visitor taps to `handlePushNotification`.
 *
 * Pure: the payload's shape, the request bodies, how the server's answers
 * read, and the registrar that keeps one token registered with the current
 * conversation (registered again for each new one, unregistered on logout).
 */

/** `data.source` of every Conferbot push. */
export const PUSH_SOURCE = 'conferbot';
/** `data.type` of a new message. */
export const PUSH_TYPE_MESSAGE = 'conferbot_message';
/** The Android channel the server names (`android.notification.channel_id`). */
export const PUSH_CHANNEL_ID = 'conferbot_messages';

/** Under the mobile API base (ConferBotEndpoints.apiBaseUrl, ".../api/v1/mobile"). */
export const PUSH_REGISTER_PATH = '/push/register';
export const PUSH_UNREGISTER_PATH = '/push/unregister';

export type PushTokenType = 'fcm' | 'apns';

/** A Conferbot notification's data (all strings, as the server sends them). */
export interface ConferbotPush {
  botId: string;
  chatSessionId: string;
  /** The reply's id, may be "". */
  messageId: string;
  /** "agent" (a person) or "bot" (the AI). */
  senderType: 'agent' | 'bot';
  senderName: string;
  body: string;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

const isObject = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object';

/**
 * The data map from whatever the app's push library hands over: the flat
 * data (FCM `data`, or APNs userInfo with the keys beside `aps`), a
 * @react-native-firebase RemoteMessage (`.data`), a Notifee notification
 * (`.notification.data`) or an Expo notification / response
 * (`.request.content.data`, `.notification.request.content.data`).
 */
export const pushDataOf = (input: unknown): Record<string, any> | null => {
  if (!isObject(input)) return null;
  const candidates = [
    input,
    input.data,
    input.notification?.data,
    input.request?.content?.data,
    input.notification?.request?.content?.data,
    input.userInfo,
  ];
  for (const c of candidates) if (isObject(c) && c.source === PUSH_SOURCE) return c;
  return null;
};

/** The Conferbot notification in `input`, or null when it is not one (another library's, another type, no conversation). */
export const parseConferbotPush = (input: unknown): ConferbotPush | null => {
  const d = pushDataOf(input);
  if (!d || d.type !== PUSH_TYPE_MESSAGE) return null;
  const botId = str(d.botId).trim();
  const chatSessionId = str(d.chatSessionId).trim();
  if (!botId || !chatSessionId) return null;
  return {
    botId,
    chatSessionId,
    messageId: str(d.messageId),
    senderType: d.senderType === 'agent' ? 'agent' : 'bot',
    senderName: str(d.senderName),
    body: str(d.body),
  };
};

export const isConferbotPush = (input: unknown): boolean => parseConferbotPush(input) !== null;

/** As the server decides when the SDK does not say: a 64-character hex token is APNs, anything else FCM. */
export const pushTokenTypeOf = (token: string, type?: string | null): PushTokenType => {
  if (type === 'fcm' || type === 'apns') return type;
  return /^[0-9a-f]{64}$/i.test(token) ? 'apns' : 'fcm';
};

export interface PushDeviceInfo {
  model?: string;
  osVersion?: string;
  appVersion?: string;
  sdkVersion?: string;
}

export const pushRegisterBody = (
  token: string,
  chatSessionId: string,
  tokenType: PushTokenType,
  deviceInfo?: PushDeviceInfo
) => ({
  token,
  chatSessionId,
  tokenType,
  ...(deviceInfo && Object.keys(deviceInfo).length ? { deviceInfo } : {}),
});

export const pushUnregisterBody = (token: string) => ({ token });

/** The server's refusals (embed-server REGISTER_PUSH_FAILURES). */
export type PushRegisterError =
  | 'MISSING_TOKEN'
  | 'INVALID_TOKEN'
  | 'MISSING_SESSION'
  | 'SESSION_FORBIDDEN'
  | 'SESSION_NOT_FOUND'
  | 'NETWORK'
  | 'SERVER';

export interface PushRegisterResult {
  ok: boolean;
  error?: PushRegisterError;
}

const KNOWN: PushRegisterError[] = ['MISSING_TOKEN', 'INVALID_TOKEN', 'MISSING_SESSION', 'SESSION_FORBIDDEN', 'SESSION_NOT_FOUND'];

/** Registered only on a 2xx with `success: true`; else the server's error code. */
export const pushRegisterResult = (status: number, data: any): PushRegisterResult => {
  if (status >= 200 && status < 300 && data?.success === true) return { ok: true };
  const code = typeof data?.error === 'string' ? data.error : '';
  if ((KNOWN as string[]).includes(code)) return { ok: false, error: code as PushRegisterError };
  if (status === 404) return { ok: false, error: 'SESSION_NOT_FOUND' };
  return { ok: false, error: 'SERVER' };
};

/**
 * Worth trying again for the same token and conversation: the conversation
 * is not on the server yet (a new chat is stored when the visitor first
 * answers), or the network or server failed. A refused token or a
 * conversation of another visitor is not.
 */
export const pushRetryable = (error?: PushRegisterError): boolean =>
  error === 'SESSION_NOT_FOUND' || error === 'NETWORK' || error === 'SERVER';

export interface PushRegistrarDeps {
  register: (body: ReturnType<typeof pushRegisterBody>) => Promise<PushRegisterResult>;
  unregister: (token: string) => Promise<boolean>;
  deviceInfo?: () => PushDeviceInfo | undefined;
}

export interface PushRegistrar {
  /** The app's token (null clears it: unregistered with the server). */
  setToken: (token: string | null, type?: PushTokenType) => Promise<void>;
  /** The conversation now on screen (undefined: none yet). */
  setSession: (chatSessionId: string | undefined) => Promise<void>;
  /** Something happened in the conversation: a registration that waits for it to reach the server tries again. */
  poke: () => Promise<void>;
  /** Logout / the visitor cleared: unregister, keep the token for the next conversation. */
  unregister: () => Promise<void>;
  /** The token and conversation registered last, if any. */
  registered: () => { token: string; chatSessionId: string } | null;
  token: () => string | null;
}

/**
 * One token registered with the current conversation: again for every new
 * conversation, once per (token, conversation) pair, and again on the next
 * `poke` while the server does not have the conversation yet.
 */
export const createPushRegistrar = (deps: PushRegistrarDeps): PushRegistrar => {
  let token: string | null = null;
  let type: PushTokenType = 'fcm';
  let session: string | undefined;
  let done: { token: string; chatSessionId: string } | null = null;
  // A pair the server refused for good (bad token, another visitor's chat).
  let refused: string | null = null;
  let inFlight: Promise<void> | null = null;
  let again = false;

  const key = () => `${token}\u0000${session}`;

  const attempt = async (): Promise<void> => {
    if (!token || !session) return;
    if (done && done.token === token && done.chatSessionId === session) return;
    if (refused === key()) return;
    const t = token;
    const s = session;
    let r: PushRegisterResult;
    try {
      r = await deps.register(pushRegisterBody(t, s, type, deps.deviceInfo?.()));
    } catch {
      r = { ok: false, error: 'NETWORK' };
    }
    if (t !== token || s !== session) return; // moved on meanwhile: the next run has it
    if (r.ok) done = { token: t, chatSessionId: s };
    else if (!pushRetryable(r.error)) refused = key();
  };

  const run = (): Promise<void> => {
    if (inFlight) {
      again = true;
      return inFlight;
    }
    inFlight = (async () => {
      do {
        again = false;
        await attempt();
      } while (again);
    })().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  const unregister = async (): Promise<void> => {
    const t = done?.token || token;
    done = null;
    // Not registered with this conversation again until a new one or a new setToken.
    refused = token && session ? key() : null;
    if (!t) return;
    try {
      await deps.unregister(t);
    } catch {
      // Best effort: the server deactivates dead tokens on its own.
    }
  };

  return {
    setToken: async (next, nextType) => {
      const clean = typeof next === 'string' ? next.trim() : '';
      if (!clean) {
        await unregister();
        token = null;
        return;
      }
      const old = done?.token;
      token = clean;
      refused = null;
      type = pushTokenTypeOf(clean, nextType);
      // A refreshed token: the old one goes.
      if (old && old !== clean) {
        done = null;
        try {
          await deps.unregister(old);
        } catch {
          /* best effort */
        }
      }
      await run();
    },
    setSession: async (id) => {
      session = id || undefined;
      await run();
    },
    poke: () => run(),
    unregister,
    registered: () => done,
    token: () => token,
  };
};
