/**
 * The connecting wait's signal (src/core/handoverWaiting.ts), the same
 * cases as the web widget's tests/waitingSignal.test.js, on a fake clock.
 */
import {
  CONNECTING_RECHECK_MS,
  CONNECTING_SIGNAL_MS,
  HUMAN_JOINED_EVENT,
  WAITING_FOR_HUMAN_EVENT,
  WAIT_OVER_EVENT,
  createConnectingSignal,
  createSignalBus,
  waitingDetail,
} from '../../src/core/handoverWaiting';

const clock = () => {
  let now = 0;
  let id = 0;
  const timers = new Map<number, { fn: () => void; at: number }>();
  return {
    set: (fn: () => void, ms: number) => (timers.set(++id, { fn, at: now + ms }), id),
    clear: (t: unknown) => timers.delete(t as number),
    tick(ms: number) {
      const until = now + ms;
      for (;;) {
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > until) break;
        timers.delete(next[0]);
        now = next[1].at;
        next[1].fn();
      }
      now = until;
    },
    size: () => timers.size,
  };
};

describe('createConnectingSignal (web handoverWaiting.ts)', () => {
  it('signals after 20s, once', () => {
    const c = clock();
    let fired = 0;
    const sig = createConnectingSignal(() => fired++, () => true, c.set, c.clear);
    expect(CONNECTING_SIGNAL_MS).toBe(20000);
    sig.start();
    sig.start();
    c.tick(19999);
    expect(fired).toBe(0);
    c.tick(1);
    expect(fired).toBe(1);
    expect(sig.pending()).toBe(false);
    c.tick(60000);
    expect(fired).toBe(1);
  });

  it('a join, nobody available, leaving the queue or the chat ending: no signal', () => {
    const c = clock();
    let fired = 0;
    const sig = createConnectingSignal(() => fired++, () => true, c.set, c.clear);
    sig.start();
    c.tick(10000);
    sig.end();
    c.tick(60000);
    expect(fired).toBe(0);
    expect(c.size()).toBe(0);
    sig.start();
    c.tick(20000);
    expect(fired).toBe(1);
  });

  it('due while the chat is closed: held until it opens', () => {
    const c = clock();
    let fired = 0;
    let open = false;
    const sig = createConnectingSignal(() => fired++, () => open, c.set, c.clear);
    sig.start();
    c.tick(30000);
    expect(fired).toBe(0);
    open = true;
    c.tick(CONNECTING_RECHECK_MS);
    expect(fired).toBe(1);
    open = false;
    sig.start();
    c.tick(25000);
    sig.end();
    open = true;
    c.tick(10000);
    expect(fired).toBe(1);
  });
});

describe('signals', () => {
  it('names as on the web; details carry no personal data', () => {
    expect(WAITING_FOR_HUMAN_EVENT).toBe('cb:waiting-for-human');
    expect(HUMAN_JOINED_EVENT).toBe('cb:human-joined');
    expect(WAIT_OVER_EVENT).toBe('cb:wait-over');
    expect(waitingDetail({ offline: false, reason: 'busy', email: 'a@b.co' })).toEqual({
      offline: false,
      reason: 'busy',
      backAt: null,
      emailCaptured: true,
    });
    expect(waitingDetail({ reason: 'offline', backAt: '2026-10-16T09:00:00Z' })).toEqual({
      offline: false,
      reason: 'offline',
      backAt: '2026-10-16T09:00:00Z',
      emailCaptured: false,
    });
  });

  it('the bus: listeners get the detail, unsubscribe works, a throwing listener is contained', () => {
    const bus = createSignalBus();
    const got: any[] = [];
    const off = bus.on(WAIT_OVER_EVENT, (d) => got.push(d));
    bus.on(WAIT_OVER_EVENT, () => {
      throw new Error('x');
    });
    expect(bus.emit(WAIT_OVER_EVENT, { reason: 'cancelled' })).toBe(1);
    expect(got).toEqual([{ reason: 'cancelled' }]);
    off();
    bus.emit(WAIT_OVER_EVENT, { reason: 'ended' });
    expect(got).toHaveLength(1);
    expect(bus.emit(HUMAN_JOINED_EVENT, { name: 'Sam' })).toBe(0);
  });
});
