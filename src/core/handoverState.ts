/**
 * Where a live-chat handover stands, read from the record, and the
 * "Connecting you with the team…" line that marks it. Ported from the web
 * widget: conferbot-widget src/ts/chat/handoverState.ts (the record
 * reading), src/core/events/agentListeners.ts (agent-left reasons,
 * agent-accepted), src/ts/chat/handlers/special.ts (_handleHandoverAccepted,
 * the queue's leave) and src/index.ts (the restore path,
 * _applyRestoredLiveChatState / _restoreAgentBotHandover).
 *
 *   bot / AI  ->  connecting (an AI agent passed the visitor on: the line
 *                 with its typing dots)  ->  one of
 *     joined       a person accepted              "Connected with the team"
 *     unavailable  nobody could (the AI took the  "The team couldn't join just now"
 *                  chat back, or the node's
 *                  fallback ran)
 *     cancelled    the visitor left the queue     "You left the queue"
 *     ended        the chat ended first           "Chat ended before the team joined"
 *
 * The dots only run while the wait is real: every way a wait ends settles
 * the line in place, and a restore draws the settled line from the record.
 * The same reading decides whether "Talk to a person" is offered: never
 * while a handover is pending or a person is in the chat.
 *
 * Pure: no React, no socket. Unlike the web (which mutates the record), the
 * functions that change entries return a new list and new entries, and
 * leave the input alone.
 */

export type HandoverOutcome = 'joined' | 'unavailable' | 'cancelled' | 'ended';
export type HandoverPhase = 'none' | 'connecting' | 'joined';

/** The web's English strings (ts/i18n/en.ts handover.*, system.*). */
export const HANDOVER_TEXT = {
  pending: 'Connecting you with the team…',
  joined: 'Connected with the team',
  unavailable: "The team couldn't join just now",
  cancelled: 'You left the queue',
  ended: 'Chat ended before the team joined',
} as const;

/** The note under a person's join after an AI handed the visitor on. */
export const HANDED_OVER_NOTE = 'They can see your conversation so far';

export const isHandoverOutcome = (v: unknown): v is HandoverOutcome =>
  v === 'joined' || v === 'unavailable' || v === 'cancelled' || v === 'ended';

/** The line's words: pending, or how the wait ended. */
export const handoverLineText = (outcome?: HandoverOutcome | null): string =>
  isHandoverOutcome(outcome) ? HANDOVER_TEXT[outcome] : HANDOVER_TEXT.pending;

/** "<name> joined the chat" (web agentJoinedDivider.ts). */
export const joinedText = (name?: string | null): string => `${String(name || '').trim() || 'An agent'} joined the chat`;

/** "<name> left the chat", or the pending line for a handover (web agentLeftDivider.ts). */
export const agentLeftText = (name: string | null | undefined, handover: boolean): string =>
  handover ? handoverLineText(null) : `${String(name || '').trim() || 'The agent'} left the chat`;

// ---------- reading the record ----------

const typeOf = (r: any): string => String(r?.type || r?.shape || '');
const isJoin = (t: string) => t === 'agent-joined-message' || t === 'agent-joined';

/** An AI agent's join (recorded by a flow bot's visible AI handover). */
export const isAIJoin = (r: any): boolean => r?.ai === true || /^ai-agent-/.test(String(r?.agentId ?? ''));

/** Things that close a live-chat episode for good. */
export const CLOSERS = ['agent-chat-ended', 'agent-declined-message', 'queue-self-resolved', 'ai-agent-inactive-close'];

/** An agent-left entry that is an AI handing the visitor to the team. */
export const isHandoverLeft = (r: any): boolean => typeOf(r) === 'agent-left-chat' && r?.handover === true;

/**
 * Where the latest live episode stands:
 *   joined      a person (not the AI) joined and has not left;
 *   connecting  an AI handed the visitor to the team and no person has
 *               joined yet;
 *   none        anything else (bot only, the person left, the chat ended).
 */
export const handoverPhase = (record: readonly any[] | null | undefined): HandoverPhase => {
  const list = Array.isArray(record) ? record : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const r = list[i];
    const t = typeOf(r);
    if (CLOSERS.includes(t)) return 'none';
    if (isJoin(t)) {
      if (isAIJoin(r)) continue;
      return 'joined';
    }
    if (t === 'agent-left-chat') return r?.handover === true ? 'connecting' : 'none';
  }
  return 'none';
};

/** "Talk to a person" is offered only when nobody is coming or here (web quickActions.ts). */
export const talkToPersonAllowed = (record: readonly any[] | null | undefined): boolean => handoverPhase(record) === 'none';

/**
 * The same person joining again (a repeat agent-accepted after a reconnect
 * or from a second device): nothing new to announce.
 */
export const isRepeatJoin = (record: readonly any[] | null | undefined, agentId: unknown): boolean => {
  if (agentId === undefined || agentId === null || agentId === '') return false;
  const list = Array.isArray(record) ? record : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const r = list[i];
    const t = typeOf(r);
    if (isJoin(t)) return String(r?.agentId ?? '') === String(agentId);
    if (t === 'agent-left-chat' || CLOSERS.includes(t)) return false;
  }
  return false;
};

/**
 * How the handover line at `index` ended, from what the record says came
 * after it; null while it is still pending. A `settled` already written
 * (the AI taking the chat back leaves no record of its own) wins.
 */
export const handoverOutcomeAt = (record: readonly any[], index: number): HandoverOutcome | null => {
  const entry = record?.[index];
  if (isHandoverOutcome(entry?.settled)) return entry.settled;
  for (let i = index + 1; i < (record?.length || 0); i++) {
    const r = record[i];
    const t = typeOf(r);
    if (isJoin(t)) return isAIJoin(r) ? 'unavailable' : 'joined';
    if (t === 'agent-declined-message') return 'unavailable';
    if (t === 'queue-self-resolved') return 'cancelled';
    if (t === 'agent-chat-ended' || t === 'ai-agent-inactive-close') return 'ended';
    // Escalated again: this earlier wait was over one way or another.
    if (isHandoverLeft(r)) return 'unavailable';
  }
  return null;
};

/** Is a handover line still waiting (so a repeat escalation draws none)? */
export const hasPendingHandoverLine = (record: readonly any[] | null | undefined): boolean =>
  (Array.isArray(record) ? record : []).some((r) => isHandoverLeft(r) && !isHandoverOutcome(r?.settled));

/**
 * Settle every pending handover line: `settled` is written, and an entry
 * that carries display `text` gets the settled words. Returns the same list
 * when nothing was pending.
 */
export const settleHandoverEntries = <T>(record: readonly T[], outcome: HandoverOutcome): { record: T[]; settled: number } => {
  const list = Array.isArray(record) ? (record as T[]) : [];
  if (!isHandoverOutcome(outcome)) return { record: list, settled: 0 };
  let settled = 0;
  const next = list.map((r: any) => {
    if (!isHandoverLeft(r) || isHandoverOutcome(r.settled)) return r;
    settled++;
    return { ...r, settled: outcome, ...('text' in r ? { text: handoverLineText(outcome) } : {}) };
  });
  return { record: settled ? next : list, settled };
};

/**
 * Before a restored record is drawn: settle every handover line whose
 * outcome the record already knows, and mark a person's join that followed
 * an AI handover (it draws "They can see your conversation so far").
 */
export const annotateRestoredHandovers = <T>(record: readonly T[]): { record: T[]; changed: number } => {
  const list = Array.isArray(record) ? (record as T[]) : [];
  let changed = 0;
  let handedOver = false;
  const next = list.map((r: any, i) => {
    if (isHandoverLeft(r)) {
      handedOver = true;
      if (isHandoverOutcome(r.settled)) return r;
      const outcome = handoverOutcomeAt(list, i);
      if (!outcome) return r;
      changed++;
      return { ...r, settled: outcome, ...('text' in r ? { text: handoverLineText(outcome) } : {}) };
    }
    const t = typeOf(r);
    let out = r;
    if (isJoin(t) && handedOver && !isAIJoin(r) && r.afterAI !== true) {
      changed++;
      out = { ...r, afterAI: true, note: HANDED_OVER_NOTE };
    }
    if (CLOSERS.includes(t)) handedOver = false;
    return out;
  });
  return { record: changed ? next : list, changed };
};

/** Did an AI agent hand this chat to a person (so the person has read it)? */
export const aiHandedOver = (record: readonly any[] | null | undefined): boolean =>
  (Array.isArray(record) ? record : []).some(isHandoverLeft);

// ---------- socket events ----------

/**
 * What an agent-left means (web agentListeners.ts "agent-left"):
 *   ignore    an AI pausing an idle visitor (reason visitor_inactive): it
 *             has not left, the visitor's next message brings it back;
 *   handover  an AI passing the visitor to a person (reason escalated, or
 *             the leaver is an AI agent): the Connecting line;
 *   left      a person left: "<name> left the chat".
 */
export type AgentLeftKind = 'ignore' | 'handover' | 'left';
export const agentLeftKind = (data: any): AgentLeftKind => {
  if (data?.reason === 'visitor_inactive') return 'ignore';
  if (data?.reason === 'escalated' || data?.handover === true || data?.agentDetails?.isAIAgent === true) return 'handover';
  return 'left';
};

/** An agent-accepted from an AI agent (taking the chat, or taking it back). */
export const isAIAccept = (data: any): boolean =>
  data?.agentDetails?.isAIAgent === true || /^ai-agent-/.test(String(data?.agentDetails?._id ?? ''));

/**
 * agent-accepted, read against the record (web special.ts
 * _handleHandoverAccepted):
 *   outcome  how a pending Connecting line settles: a person joined, or the
 *            AI took the chat back because nobody could;
 *   announce draw the join line (not for the same person again);
 *   afterAI  the person follows an AI handover: the join line's note.
 */
export const acceptedPlan = (record: readonly any[] | null | undefined, data: any) => {
  const ai = isAIAccept(data);
  const repeat = isRepeatJoin(record, data?.agentDetails?._id);
  return {
    ai,
    outcome: (ai ? 'unavailable' : 'joined') as HandoverOutcome,
    announce: !repeat,
    afterAI: !ai && aiHandedOver(record),
    humanJoined: !ai && !repeat,
  };
};

// ---------- leaving the queue ----------

/** queue-self-resolve: the visitor leaves the queue (embed-server handoverHandler.js). */
export const queueSelfResolvePayload = (chatSessionId: string, articleId?: string | null) => ({
  chatSessionId,
  ...(articleId ? { articleId } : {}),
});

/**
 * The server's answer to queue-self-resolve: `leave` the wait (ok, nothing
 * waiting any more, or no answer), or `stay` because a person already
 * picked the chat up. The server says agent_joined only while the ticket is
 * still open; once a person accepted, the ticket is in progress and it
 * answers not_waiting - so on not_waiting ask live-chat-state and pass its
 * answer as `state`: live means a person has it.
 */
export const queueLeaveResult = (res: any, state?: any): 'leave' | 'stay' =>
  res?.reason === 'agent_joined' || (res?.ok !== true && state?.status === 'live') ? 'stay' : 'leave';

/** Ask live-chat-state before leaving on this answer to queue-self-resolve? */
export const queueLeaveNeedsState = (res: any): boolean => res?.ok !== true && res?.reason === 'not_waiting';

// ---------- restore (live-chat-state) ----------

const RESTORE_LIVE_TYPES = [
  'agent-joined-message',
  'agent-message',
  'agent-message-file',
  'agent-message-audio',
  'agent-message-rich',
  'user-live-message',
  'user-live-message-file',
  'agent-left-chat',
];
const EPISODE_CLOSERS = ['agent-declined-message', 'agent-chat-ended', 'queue-self-resolved'];

/**
 * A restored chat: should the server be asked where it stands
 * (live-chat-state)? Only the latest live episode counts - a takeover
 * handed back or a chat that ended earlier is over (web index.ts restore).
 * `atHandover`: the flow was waiting on its handover step.
 */
export const restoreNeedsLiveChatState = (record: readonly any[] | null | undefined, atHandover = false): boolean => {
  const list = Array.isArray(record) ? record : [];
  let start = 0;
  list.forEach((r, i) => {
    const t = String(r?.type || '');
    if ((t === 'agent-left-chat' && r?.takeover) || EPISODE_CLOSERS.includes(t)) start = i + 1;
  });
  const episode = list.slice(start);
  // Either field: the web's live entries carry `shape` only, this SDK's
  // on-screen entries a display `type` beside it.
  const ongoing = episode.some((r) => RESTORE_LIVE_TYPES.includes(String(r?.type || '')) || RESTORE_LIVE_TYPES.includes(String(r?.shape || '')));
  const ended = list.some((r) => EPISODE_CLOSERS.includes(String(r?.type || ''))) && !ongoing;
  return ongoing || (atHandover && !ended);
};

export interface RestoredLiveChat {
  /**
   * live: a person has it; waiting: still in the queue; fallback: nobody
   * joined in time; ended: the chat ended; none: no handover on the server.
   */
  status: 'live' | 'waiting' | 'fallback' | 'ended' | 'none';
  /** The person on the chat (live only). */
  agent: { id: string; name: string; email?: string } | null;
  /** How a pending Connecting line settles now; null leaves it pending. */
  settle: HandoverOutcome | null;
  /** Draw the join line the closed app missed. */
  drawJoin: boolean;
  /** That join follows an AI handover (its note). */
  afterAI: boolean;
  /** Seconds left of the handover's max wait (waiting only). */
  remainingSeconds: number | null;
}

/**
 * The server's live-chat-state (embed-server liveChatSession
 * getLiveChatState: { status: live | waiting | fallback | ended | none,
 * agentDetails, waitEndsAt, takeover }) applied to a restored record (web
 * index.ts _applyRestoredLiveChatState / _restoreAgentBotHandover).
 */
export const restoredLiveChat = (state: any, record: readonly any[] | null | undefined, now = Date.now()): RestoredLiveChat => {
  const raw = String(state?.status || 'none');
  const details = state?.agentDetails;
  const person = details && details.isAIAgent !== true ? details : null;
  if (raw === 'live' && person) {
    const joined = handoverPhase(record) === 'joined';
    return {
      status: 'live',
      agent: { id: String(person._id || ''), name: String(person.name || ''), ...(person.email ? { email: String(person.email) } : {}) },
      settle: 'joined',
      drawJoin: !joined,
      afterAI: aiHandedOver(record),
      remainingSeconds: null,
    };
  }
  if (raw === 'waiting') {
    const ends = Number(state?.waitEndsAt);
    return {
      status: 'waiting',
      agent: null,
      settle: null,
      drawJoin: false,
      afterAI: false,
      remainingSeconds: Number.isFinite(ends) && ends > 0 ? Math.max(5, Math.round((ends - now) / 1000)) : null,
    };
  }
  if (raw === 'ended') return { status: 'ended', agent: null, settle: 'ended', drawJoin: false, afterAI: false, remainingSeconds: null };
  if (raw === 'fallback') return { status: 'fallback', agent: null, settle: 'unavailable', drawJoin: false, afterAI: false, remainingSeconds: null };
  // Live with nobody in it (every agent left), or no handover at all.
  return {
    status: 'none',
    agent: null,
    settle: hasPendingHandoverLine(record) ? 'unavailable' : null,
    drawJoin: false,
    afterAI: false,
    remainingSeconds: null,
  };
};

/**
 * What a restored chat does next, from the server's answer:
 *   live      a person (or, still waiting after an AI escalation, the AI)
 *             has the chat: live mode, the flow is not run again;
 *   wait      still in the queue at the flow's handover step: back on that
 *             step's wait, without asking for a person a second time;
 *   continue  the wait or the live chat is over: the flow carries on from
 *             its handover step;
 *   ask       the flow was at its handover step but the request never went
 *             out: run the step again;
 *   start     nothing live to rejoin: as for any restored chat.
 * `atHandover`: the flow was on its human-handover step.
 */
export type RestoreStep = 'live' | 'wait' | 'continue' | 'ask' | 'start';
export const restoreStep = (r: RestoredLiveChat, atHandover: boolean, record?: readonly any[] | null): RestoreStep => {
  if (r.status === 'live') return 'live';
  if (r.status === 'waiting') return atHandover ? 'wait' : 'live';
  if (!atHandover) return 'start';
  const list = Array.isArray(record) ? record : [];
  const asked = list.some((x) => RESTORE_LIVE_TYPES.includes(String(x?.type || '')) || RESTORE_LIVE_TYPES.includes(String(x?.shape || '')));
  return r.status === 'none' && !asked && !hasPendingHandoverLine(list) ? 'ask' : 'continue';
};
