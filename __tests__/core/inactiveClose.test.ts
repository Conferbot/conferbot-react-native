/**
 * The AI letting an idle visitor go (src/core/liveEvents.ts), as the web
 * widget's agentListeners.ts ai-agent-inactive-close and the server's
 * aiInactivityHandler.js closeInactiveWebChat / resumeInactiveChat.
 */
import { inactiveCloseEntry, inactiveCloseLine, inactiveClosePlan } from '../../src/core/liveEvents';
import { setWidgetLanguage } from '../../src/core/i18n';

afterEach(() => setWidgetLanguage('en'));

describe('inactiveClosePlan', () => {
  it('continue_flow on a flow bot: ended, the flow carries on', () => {
    expect(inactiveClosePlan({ action: 'continue_flow' }, false)).toEqual({ paused: false, continueFlow: true });
  });
  it('any other action on a flow bot: only paused, the flow waits', () => {
    expect(inactiveClosePlan({ action: 'end_chat' }, false)).toEqual({ paused: true, continueFlow: false });
    expect(inactiveClosePlan({}, false)).toEqual({ paused: true, continueFlow: false });
    expect(inactiveClosePlan(null, false)).toEqual({ paused: true, continueFlow: false });
  });
  it('an agent bot is always paused (it has no flow to go on with)', () => {
    expect(inactiveClosePlan({ action: 'continue_flow' }, true)).toEqual({ paused: true, continueFlow: false });
  });
});

describe('inactiveCloseEntry', () => {
  it('keeps the action and whether it paused, under its own id', () => {
    const a = inactiveCloseEntry({ action: 'continue_flow' }, false, '2026-10-16T10:00:00.000Z');
    const b = inactiveCloseEntry({ action: 'continue_flow' }, false, '2026-10-16T10:00:00.000Z');
    expect(a).toMatchObject({ type: 'ai-agent-inactive-close', shape: 'ai-agent-inactive-close', action: 'continue_flow', paused: false, time: '2026-10-16T10:00:00.000Z' });
    expect(a.id).toBe(a._id);
    expect(a.id).toMatch(/^ai-agent-inactive-close-/);
    expect(a.id).not.toBe(b.id);
  });
  it('no action: no action field, paused', () => {
    const e = inactiveCloseEntry({}, false);
    expect(e).not.toHaveProperty('action');
    expect(e.paused).toBe(true);
  });
});

describe('inactiveCloseLine', () => {
  it('paused: "Chat paused" and how to pick it up', () => {
    expect(inactiveCloseLine({ paused: true })).toEqual({
      text: 'Chat paused',
      note: 'Send a message to pick up where you left off',
      paused: true,
    });
  });
  it('an older entry without the flag is a pause', () => {
    expect(inactiveCloseLine({ type: 'ai-agent-inactive-close' }).paused).toBe(true);
  });
  it('ended: "Chat ended", no note', () => {
    expect(inactiveCloseLine({ paused: false })).toEqual({ text: 'Chat ended', note: null, paused: false });
  });
  it('in the visitor\'s language', () => {
    setWidgetLanguage('de');
    const line = inactiveCloseLine({ paused: true });
    expect(line.text).not.toBe('Chat paused');
    expect(line.note).not.toBe('Send a message to pick up where you left off');
  });
});
