/**
 * What a step handler may use besides the chat state: the bot's server
 * endpoints, the socket, timers, the flow's edges. The engine passes one
 * as `node.ctx`; a handler called on its own (tests, custom engines) gets
 * a default built from the node's socket client and the global clock.
 */
import { getApiOrigin } from '../../config/constants';
import type { ChatState } from '../state/ChatState';

export interface ApiReply {
  ok: boolean;
  status: number;
  body: any;
  /** "network" when the server could not be reached, "timeout" when it took too long. */
  error?: string;
}

export interface UploadFile {
  uri?: string;
  name?: string;
  type?: string;
  size?: number;
  /** Raw content for a generated file (a signature PNG as a data URL). */
  dataUrl?: string;
}

export interface FlowEdgeLike {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
}

export interface FlowContext {
  botId: string;
  sessionId: string;
  /** POST JSON to {api}/api/v1/bot/:botId/<path>. Never throws. */
  api(path: string, body: any, options?: { timeoutMs?: number }): Promise<ApiReply>;
  /** Upload a file to {api}/api/v1/bot/:botId/media; ok with the file's url. */
  upload(file: UploadFile): Promise<{ ok: boolean; url?: string; error?: string }>;
  /** A socket event to the server. */
  emit(event: string, payload: any): boolean;
  /** Listen to a socket event; returns the unsubscribe. */
  on(event: string, listener: (payload: any) => void): () => void;
  /** Typing dots for `ms`, then resolves. */
  typing(ms: number): Promise<void>;
  delay(ms: number): Promise<void>;
  /** The edges that leave this step, in flow order. */
  edges(): FlowEdgeLike[];
  /** The edges that leave another step, in flow order. */
  edgesOf(nodeId: string): FlowEdgeLike[];
  /** Whether an edge leaves this step by exactly this handle. */
  wired(handle: string): boolean;
  /** The step's place in the conversation (0 = the welcome). */
  stepIndex?: number;
  /** How this step was reached: "start", "edge:<h>", "port:<h>" or "jump". */
  via: string;
  random(): number;
  now(): Date;
  customizations: Record<string, any>;
  /** The visitor's IANA time zone (the device's unless configured). */
  visitorTimeZone: string;
  /** The page the chat runs on, when the host app supplies one (hidden-fields). */
  page?: { url?: string; referrer?: string };
  /** Give the waiting step an answer from outside (a socket event). */
  respond(response: any): void;
  /** The step's content is on screen now (for a step that speaks before it returns). */
  shown(): void;
  /** True once the flow has moved past this step. */
  isStale(): boolean;
  /** A node of the flow by id. */
  node(id: string): { id: string; type: string; data?: any } | undefined;
}

const defaultTimers = {
  delay: (ms: number) => new Promise<void>((r) => setTimeout(r, Math.max(0, ms))),
};

/** POST JSON to the bot API with an optional client timeout. */
export const postBotApi = async (
  apiOrigin: string,
  botId: string,
  path: string,
  body: any,
  timeoutMs?: number
): Promise<ApiReply> => {
  const url = `${apiOrigin}/api/v1/bot/${encodeURIComponent(botId)}/${path}`;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const request = fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    }).then(async (res: any) => {
      let json: any = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      return { ok: !!res.ok, status: Number(res.status) || 0, body: json } as ApiReply;
    });
    const raced = timeoutMs
      ? Promise.race([
          request,
          new Promise<ApiReply>((resolve) => {
            timer = setTimeout(() => resolve({ ok: false, status: 0, body: null, error: 'timeout' }), timeoutMs);
          }),
        ])
      : request;
    return await raced;
  } catch {
    return { ok: false, status: 0, body: null, error: 'network' };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

/** Upload a file to the bot's media endpoint (multipart "file"). */
export const uploadBotMedia = async (
  apiOrigin: string,
  botId: string,
  sessionId: string,
  visitorId: string,
  file: UploadFile
): Promise<{ ok: boolean; url?: string; error?: string }> => {
  const query = `?chatSessionId=${encodeURIComponent(sessionId)}&visitorId=${encodeURIComponent(visitorId)}`;
  const url = `${apiOrigin}/api/v1/bot/${encodeURIComponent(botId)}/media${query}`;
  try {
    const form: any = typeof FormData !== 'undefined' ? new FormData() : null;
    if (form) {
      form.append('file', file.dataUrl ? { uri: file.dataUrl, name: file.name, type: file.type } : { uri: file.uri, name: file.name, type: file.type } as any);
    }
    const res: any = await fetch(url, { method: 'POST', body: form });
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    // Only a 2xx answer that carries the file's URL is an upload (web nodeLogic.uploadSucceeded)
    if (res.ok && typeof json?.url === 'string' && json.url.trim() !== '') return { ok: true, url: json.url };
    return { ok: false, error: `HTTP ${res.status}` };
  } catch {
    return { ok: false, error: 'network' };
  }
};

/** The context the engine gave the handler, or a stand-alone default. */
export const ctxOf = (node: Record<string, any>, state: ChatState): FlowContext => {
  if (node?.ctx) return node.ctx as FlowContext;
  const socket: any = node?.data?.socketClient;
  const origin = getApiOrigin();
  const listeners: Array<[string, any]> = [];
  return {
    botId: state.botId,
    sessionId: state.sessionId,
    api: (path, body, options) => postBotApi(origin, state.botId, path, body, options?.timeoutMs),
    upload: (file) => uploadBotMedia(origin, state.botId, state.sessionId, String(state.getVariable('_visitorId') || state.sessionId), file),
    emit: (event, payload) => {
      if (!socket) return false;
      if (typeof socket.emitToServer === 'function') socket.emitToServer(event, payload);
      else if (typeof socket.emit === 'function') socket.emit(event, payload);
      else return false;
      return true;
    },
    on: (event, listener) => {
      if (!socket?.on) return () => {};
      const off = socket.on(event, listener);
      listeners.push([event, listener]);
      return typeof off === 'function' ? off : () => socket.off?.(event, listener);
    },
    typing: defaultTimers.delay,
    delay: defaultTimers.delay,
    edges: () => [],
    edgesOf: () => [],
    wired: () => false,
    via: 'edge',
    random: () => Math.random(),
    now: () => new Date(),
    customizations: {},
    visitorTimeZone: (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      } catch {
        return 'UTC';
      }
    })(),
    respond: () => {},
    shown: () => {},
    isStale: () => false,
    node: () => undefined,
  };
};
