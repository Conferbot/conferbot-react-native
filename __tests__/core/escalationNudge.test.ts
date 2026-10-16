/**
 * The AI escalation's max wait (src/core/handoverWaiting.ts), as the web
 * widget's handoverWaiting.ts armAIEscalationNudge and special.ts
 * _handleAIEscalationWait: the step's max wait plus 30s, then
 * handover-timeout, nothing drawn.
 */
import {
  SERVER_GRACE_MS,
  aiEscalationNudgeMs,
  createEscalationNudge,
  escalationHandoverData,
  startsEscalationWait,
} from '../../src/core/handoverWaiting';

const fakeClock = () => {
  let now = 0;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    set: (fn: () => void, ms: number) => {
      const id = ++seq;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clear: (id: any) => timers.delete(id),
    advance: (ms: number) => {
      now += ms;
      for (const [id, t] of [...timers]) {
        if (t.at <= now) {
          timers.delete(id);
          t.fn();
        }
      }
    },
    count: () => timers.size,
  };
};

describe('aiEscalationNudgeMs', () => {
  it('the max wait in minutes plus 30s of grace', () => {
    expect(SERVER_GRACE_MS).toBe(30000);
    expect(aiEscalationNudgeMs(5)).toBe(5 * 60000 + 30000);
    expect(aiEscalationNudgeMs('3')).toBe(3 * 60000 + 30000);
  });
  it('2 minutes when unset or not a positive number', () => {
    for (const v of [undefined, null, 0, -1, 'x']) expect(aiEscalationNudgeMs(v)).toBe(2 * 60000 + 30000);
  });
});

describe('startsEscalationWait', () => {
  it('only an AI agent handing on', () => {
    expect(startsEscalationWait({ agentDetails: { isAIAgent: true } })).toBe(true);
    expect(startsEscalationWait({ agentDetails: { isAIAgent: true }, reason: 'escalated' })).toBe(true);
  });
  it('not an inactivity close, not a person, not nothing', () => {
    expect(startsEscalationWait({ agentDetails: { isAIAgent: true }, reason: 'visitor_inactive' })).toBe(false);
    expect(startsEscalationWait({ agentDetails: { name: 'Sam' } })).toBe(false);
    expect(startsEscalationWait(null)).toBe(false);
  });
});

describe('escalationHandoverData', () => {
  it('the flow step first', () => {
    expect(escalationHandoverData({ maxWaitTime: 4 }, [{ type: 'human-handover-node', data: { maxWaitTime: 9 } }])).toEqual({ maxWaitTime: 4 });
  });
  it('else the latest handover step in the record (an agent bot)', () => {
    const record = [
      { type: 'human-handover-node', data: { maxWaitTime: 1 } },
      { type: 'user-live-message' },
      { type: 'human-handover-node', data: { maxWaitTime: 7 } },
      { type: 'agent-message' },
    ];
    expect(escalationHandoverData(undefined, record)).toEqual({ maxWaitTime: 7 });
  });
  it('none', () => {
    expect(escalationHandoverData(undefined, [{ type: 'agent-message' }])).toBeUndefined();
    expect(escalationHandoverData(null, null)).toBeUndefined();
  });
});

describe('createEscalationNudge', () => {
  it('nudges once, the max wait plus the grace after the AI left', () => {
    const c = fakeClock();
    const nudge = jest.fn();
    const n = createEscalationNudge(nudge, c.set, c.clear);
    n.arm(1);
    expect(n.pending()).toBe(true);
    c.advance(60000);
    expect(nudge).not.toHaveBeenCalled();
    c.advance(29999);
    expect(nudge).not.toHaveBeenCalled();
    c.advance(1);
    expect(nudge).toHaveBeenCalledTimes(1);
    expect(n.pending()).toBe(false);
    c.advance(10 * 60000);
    expect(nudge).toHaveBeenCalledTimes(1);
  });
  it('cleared (someone accepted, the server decided, the chat ended): never', () => {
    const c = fakeClock();
    const nudge = jest.fn();
    const n = createEscalationNudge(nudge, c.set, c.clear);
    n.arm(2);
    c.advance(60000);
    n.clear();
    c.advance(10 * 60000);
    expect(nudge).not.toHaveBeenCalled();
    expect(c.count()).toBe(0);
  });
  it('a second escalation restarts the one timer', () => {
    const c = fakeClock();
    const nudge = jest.fn();
    const n = createEscalationNudge(nudge, c.set, c.clear);
    n.arm(1);
    c.advance(80000);
    n.arm(1);
    expect(c.count()).toBe(1);
    c.advance(80000);
    expect(nudge).not.toHaveBeenCalled();
    c.advance(10000);
    expect(nudge).toHaveBeenCalledTimes(1);
  });
});
