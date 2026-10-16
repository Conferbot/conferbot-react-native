/**
 * Live chat events beyond the handover line (core/handoverState.ts): the
 * chat going back to the queue, a transfer, the same end again, a blocked
 * visitor and the closed chat. Ported from the web widget:
 *
 *   ts/chat/liveTakeover.ts   live-chat-requeued ("Connecting you to another
 *                             agent..." / "Connecting you to Sales..."),
 *                             live-chat-transferred (kept in the record)
 *   utils/recordIds.ts        endedSinceLastLive: a repeated chat-ended is
 *                             the same end, and draws nothing
 *   ts/chat/closedState.ts    the closed chat ("This conversation has been
 *                             closed."), index.ts _applyVisitorBlock
 *
 * Pure.
 */

/** Its own id per event entry: two in the same millisecond must not merge (web liveEventId). */
import { t, localized } from './i18n';

export const liveEventId = (kind: string, now: number = Date.now(), rand: string = Math.random().toString(36).slice(2, 9)): string =>
  `${kind}-${now}-${rand}`;

// ---------------------------------------------------------------------------
// Back in the queue (live-chat-requeued)
// ---------------------------------------------------------------------------

/** The record entry's English text (the web's en takeover.requeued); drawn with `requeuedText`. */
export const REQUEUED_TEXT = 'Connecting you to another agent...';

/** What the visitor reads when the chat goes back to the queue (web requeuedText). */
export const requeuedText = (teamName?: unknown): string => {
  const team = typeof teamName === 'string' ? teamName.replace(/[<>]/g, '').trim().slice(0, 60) : '';
  return team ? t('takeover.requeuedTeam', { team }) : t('takeover.requeued');
};

/** The requeued line's record entry (web: id, type, time, text). */
export const requeuedEntry = (data: any, time: string = new Date().toISOString()) => {
  const id = liveEventId('requeued');
  return { id, _id: id, type: 'live-chat-requeued', shape: 'live-chat-requeued', time, text: requeuedText(data?.teamName) };
};

// ---------------------------------------------------------------------------
// Transferred (live-chat-transferred)
// ---------------------------------------------------------------------------

/**
 * The transfer line the server wrote into the record, as the widget keeps it
 * in its own copy (so the next write keeps it). Null when malformed. The web
 * does not draw it: the requeued line or the next agent's join says what
 * happened.
 */
export const transferEntry = (data: any) => {
  const e = data?.entry;
  if (!e || typeof e.id !== 'string' || typeof e.text !== 'string') return null;
  return {
    id: e.id,
    _id: e.id,
    shape: 'live-chat-transfer',
    type: 'live-chat-transfer',
    time: e.time || new Date().toISOString(),
    text: e.text.slice(0, 200),
    ...(e.kind ? { kind: String(e.kind) } : {}),
  };
};

// ---------------------------------------------------------------------------
// The same end again (chat-ended)
// ---------------------------------------------------------------------------

// A live chat going on again: someone joined, the AI came back, or a
// message went either way (web recordIds.ts LIVE_AGAIN).
export const LIVE_AGAIN = [
  'agent-joined-message',
  'agent-joined',
  'ai-agent-resumed',
  'agent-message',
  'agent-message-file',
  'agent-message-audio',
  'agent-message-rich',
  'user-live-message',
  'user-live-message-file',
];

/**
 * Has the live chat already ended, with nothing live since? A repeated
 * chat-ended is then the same end again: no second "Chat ended" line, no
 * second survey (web endedSinceLastLive).
 */
export const endedSinceLastLive = (record: readonly any[] | null | undefined): boolean => {
  const list = Array.isArray(record) ? record : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const kind = list[i]?.type || list[i]?.shape;
    if (kind === 'agent-chat-ended') return true;
    if (LIVE_AGAIN.includes(kind) || LIVE_AGAIN.includes(list[i]?.shape)) return false;
  }
  return false;
};

// ---------------------------------------------------------------------------
// Blocked, and the closed chat
// ---------------------------------------------------------------------------

/** The neutral line a blocked visitor sees (embed-server visitorBlock CLOSED_TEXT, web system.closed). */
export const CLOSED_TEXT = 'This conversation has been closed.';
export const CHAT_ENDED_TEXT = 'Chat ended';
export const NEW_CHAT_TEXT = 'Start a new chat';

/**
 * The same words in the active language (web system.closed,
 * system.chatEnded; "Start a new chat" is the SDK's own button). The
 * English constants above stay as what the record and the server say.
 */
export const LIVE_TEXT = localized({
  closed: 'system.closed',
  chatEnded: 'system.chatEnded',
  newChat: 'sdk.live.newChat',
});

/** The handshake refused a blocked visitor (connect_error "visitor_blocked"). */
export const isBlockedError = (err: any): boolean => err?.message === 'visitor_blocked';

/** The visitor-blocked event's line: the server's words, else ours. */
export const blockedText = (data: any): string => {
  const m = typeof data?.message === 'string' ? data.message.trim().slice(0, 200) : '';
  return m || LIVE_TEXT.closed;
};

export interface ClosedState {
  kind: 'blocked' | 'ended';
  text: string;
  /** Offer "Start a new chat" (never to a blocked visitor: the server refuses them). */
  newChat: boolean;
  /** The composer takes no more input. */
  inputOff: boolean;
}

/**
 * The chat's closed state, or null while it is open:
 *   blocked  the workspace blocked the visitor: the neutral line, no input,
 *            no new chat.
 *   ended    the live chat ended and nothing is going on (no step waiting,
 *            no person, nothing live since the end): "Chat ended" and a
 *            button to start a new chat. The composer is off, as the web
 *            turns it off on chat-ended.
 */
export const closedStateOf = (
  record: readonly any[] | null | undefined,
  o: { blocked?: string | null; stepWaiting?: boolean; live?: boolean } = {}
): ClosedState | null => {
  if (o.blocked) return { kind: 'blocked', text: o.blocked, newChat: false, inputOff: true };
  if (o.stepWaiting || o.live) return null;
  if (!endedSinceLastLive(record)) return null;
  return { kind: 'ended', text: LIVE_TEXT.chatEnded, newChat: true, inputOff: true };
};
