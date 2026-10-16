/**
 * Waiting for a person, and the signals other app code can listen to.
 * Ported from the web widget: conferbot-widget src/ts/chat/handoverWaiting.ts
 * (createConnectingSignal, the signal names and details). The web
 * dispatches the signals on its window; here they go through a small bus
 * (createSignalBus) that the provider exposes as onWidgetSignal.
 *
 *   cb:waiting-for-human  the visitor now waits for a person. detail:
 *                         { offline, reason, backAt, emailCaptured }. From
 *                         the server's handover-waiting, or the widget's own
 *                         connecting wait after CONNECTING_SIGNAL_MS.
 *   cb:human-joined       a person (never the AI) joined. detail: { name }.
 *   cb:wait-over          the wait ended without a person. detail:
 *                         { reason: unavailable | cancelled | ended }.
 *
 * No personal data (the visitor's email) is ever put in a detail. Pure.
 */

export const WAITING_FOR_HUMAN_EVENT = 'cb:waiting-for-human';
export const HUMAN_JOINED_EVENT = 'cb:human-joined';
export const WAIT_OVER_EVENT = 'cb:wait-over';

export type WidgetSignalName = typeof WAITING_FOR_HUMAN_EVENT | typeof HUMAN_JOINED_EVENT | typeof WAIT_OVER_EVENT;

/** A connecting wait with nobody yet after this long counts as waiting for a person. */
export const CONNECTING_SIGNAL_MS = 20 * 1000;
/** Chat closed when it was due: checked again this often until it opens. */
export const CONNECTING_RECHECK_MS = 2000;

export interface WaitingForHumanDetail {
  offline: boolean;
  reason: 'offline' | 'busy';
  backAt: string | null;
  emailCaptured: boolean;
}

export interface HumanJoinedDetail {
  name: string | null;
}

export interface WaitOverDetail {
  reason: 'unavailable' | 'cancelled' | 'ended';
}

export type WidgetSignalDetail = WaitingForHumanDetail | HumanJoinedDetail | WaitOverDetail;

/** The server's handover-waiting payload as a signal detail. */
export const waitingDetail = (data: any, emailCaptured = false): WaitingForHumanDetail => ({
  offline: data?.offline === true,
  reason: data?.offline === true || data?.reason === 'offline' ? 'offline' : 'busy',
  backAt: typeof data?.backAt === 'string' ? data.backAt : null,
  emailCaptured: emailCaptured || (typeof data?.email === 'string' && !!data.email),
});

type Timer = unknown;

/**
 * The connecting wait's own cb:waiting-for-human, once per wait.
 *
 *   start()   a wait for a person began (or a restore re-entered one): fire
 *             after CONNECTING_SIGNAL_MS unless it ends first. A second
 *             start() during the same wait changes nothing.
 *   end()     a person joined, nobody could, the visitor left the queue,
 *             the chat ended - or the server sent its own handover-waiting
 *             (which already fired the signal): never fire for this wait.
 *
 * Due while the chat is closed (canFire false), it waits for the chat to
 * open rather than offering something nobody can see.
 */
export const createConnectingSignal = (
  fire: () => void,
  canFire: () => boolean = () => true,
  setTimer: (fn: () => void, ms: number) => Timer = (fn, ms) => setTimeout(fn, ms),
  clearTimer: (t: Timer) => void = (t) => clearTimeout(t as ReturnType<typeof setTimeout>)
) => {
  let timer: Timer | null = null;
  let active = false;
  const cancel = () => {
    if (timer) clearTimer(timer);
    timer = null;
  };
  const due = () => {
    timer = null;
    if (!active) return;
    if (!canFire()) {
      timer = setTimer(due, CONNECTING_RECHECK_MS);
      return;
    }
    active = false;
    fire();
  };
  return {
    start: () => {
      // Already counting for this wait: once per wait, not once per event.
      if (active) return;
      active = true;
      cancel();
      timer = setTimer(due, CONNECTING_SIGNAL_MS);
    },
    end: () => {
      active = false;
      cancel();
    },
    pending: () => active,
  };
};

export type ConnectingSignal = ReturnType<typeof createConnectingSignal>;

/** A listener bus for the widget signals. emit never throws. */
export const createSignalBus = () => {
  const listeners = new Map<string, Set<(detail: WidgetSignalDetail) => void>>();
  return {
    on: (name: WidgetSignalName, fn: (detail: WidgetSignalDetail) => void): (() => void) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name)!.add(fn);
      return () => {
        listeners.get(name)?.delete(fn);
      };
    },
    emit: (name: WidgetSignalName, detail: WidgetSignalDetail): number => {
      let n = 0;
      listeners.get(name)?.forEach((fn) => {
        try {
          fn(detail);
          n++;
        } catch {
          /* a listener's error is its own */
        }
      });
      return n;
    },
  };
};

export type SignalBus = ReturnType<typeof createSignalBus>;

// ---------------------------------------------------------------------------
// The AI escalation's max wait (web handoverWaiting.ts armAIEscalationNudge,
// special.ts _handleAIEscalationWait)
// ---------------------------------------------------------------------------

/** After an AI escalation's max wait, how much longer the server is given before it is nudged. */
export const SERVER_GRACE_MS = 30 * 1000;

/** The handover step's max wait (minutes; 2 when unset) plus the grace, in ms. */
export const aiEscalationNudgeMs = (maxWaitTimeMinutes: unknown): number => {
  const minutes = Number(maxWaitTimeMinutes) > 0 ? Number(maxWaitTimeMinutes) : 2;
  return minutes * 60 * 1000 + SERVER_GRACE_MS;
};

/**
 * Does this agent-left start the escalation's wait? Only an AI agent handing
 * the visitor on: a person leaving is not an escalation, and an inactivity
 * close ends the chat (ai-agent-inactive-close).
 */
export const startsEscalationWait = (data: any): boolean =>
  data?.agentDetails?.isAIAgent === true && data?.reason !== 'visitor_inactive';

/**
 * The handover step an escalation waits on: the flow's current handover
 * step, else (an agent bot, whose silent handover is not a flow step) the
 * latest handover step in the record.
 */
export const escalationHandoverData = (
  stepData: Record<string, any> | null | undefined,
  record: readonly any[] | null | undefined
): Record<string, any> | undefined => {
  if (stepData) return stepData;
  const list = Array.isArray(record) ? record : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const r = list[i];
    if ((r?.type === 'human-handover-node' || r?.shape === 'human-handover-node') && r?.data && typeof r.data === 'object') return r.data;
  }
  return undefined;
};

/**
 * After the AI escalates, the server owns the wait: it hands the chat back
 * to the AI and says so (handover-waiting), or sends no-agents-available.
 * This timer never draws anything; it only nudges (handover-timeout) a
 * server that lost its own timer, the step's max wait plus 30s after the
 * AI left.
 *
 *   arm(maxWait)  the AI escalated: (re)start the timer (one per chat).
 *   clear()       someone accepted, the server's handover-waiting or
 *                 no-agents-available came, the visitor left the queue, the
 *                 chat ended or closed for inactivity, the visitor was
 *                 blocked.
 */
export const createEscalationNudge = (
  nudge: () => void,
  setTimer: (fn: () => void, ms: number) => Timer = (fn, ms) => setTimeout(fn, ms),
  clearTimer: (t: Timer) => void = (t) => clearTimeout(t as ReturnType<typeof setTimeout>)
) => {
  let timer: Timer | null = null;
  const clear = () => {
    if (timer) clearTimer(timer);
    timer = null;
  };
  return {
    arm: (maxWaitTimeMinutes: unknown) => {
      clear();
      timer = setTimer(() => {
        timer = null;
        nudge();
      }, aiEscalationNudgeMs(maxWaitTimeMinutes));
    },
    clear,
    pending: () => timer !== null,
  };
};

export type EscalationNudge = ReturnType<typeof createEscalationNudge>;
