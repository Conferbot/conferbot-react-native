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
