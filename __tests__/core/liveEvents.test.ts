import {
  CLOSED_TEXT,
  blockedText,
  closedStateOf,
  endedSinceLastLive,
  isBlockedError,
  liveEventId,
  requeuedEntry,
  requeuedText,
  transferEntry,
} from '../../src/core/liveEvents';

describe('back in the queue (web liveTakeover.ts)', () => {
  it('says which team, or another agent', () => {
    expect(requeuedText()).toBe('Connecting you to another agent...');
    expect(requeuedText('  Sales <b> ')).toBe('Connecting you to Sales b...');
    expect(requeuedText(42)).toBe('Connecting you to another agent...');
    expect(requeuedText('x'.repeat(80))).toBe(`Connecting you to ${'x'.repeat(60)}...`);
  });

  it('is its own record entry', () => {
    const e = requeuedEntry({ teamName: 'Billing' }, '2026-10-16T10:00:00.000Z');
    expect(e).toMatchObject({ type: 'live-chat-requeued', text: 'Connecting you to Billing...', time: '2026-10-16T10:00:00.000Z' });
    expect(e.id).toMatch(/^requeued-\d+-/);
    expect(e._id).toBe(e.id);
    expect(liveEventId('x', 5, 'abc')).toBe('x-5-abc');
  });
});

describe('transferred (web live-chat-transferred)', () => {
  it('keeps the server\'s entry as it wrote it', () => {
    expect(transferEntry({ entry: { id: 'transfer-1', text: 'Transferred from Maya to Sales', time: 't', kind: 'team' } })).toEqual({
      id: 'transfer-1',
      _id: 'transfer-1',
      shape: 'live-chat-transfer',
      type: 'live-chat-transfer',
      time: 't',
      text: 'Transferred from Maya to Sales',
      kind: 'team',
    });
    expect(transferEntry({ entry: { id: 'x', text: 'y'.repeat(300) } })!.text).toHaveLength(200);
    expect(transferEntry({ entry: { id: 1, text: 'x' } })).toBeNull();
    expect(transferEntry({})).toBeNull();
  });
});

describe('the same end again (web endedSinceLastLive)', () => {
  it('is true only while nothing live came after the end', () => {
    expect(endedSinceLastLive([])).toBe(false);
    expect(endedSinceLastLive(null)).toBe(false);
    expect(endedSinceLastLive([{ type: 'agent-message' }, { type: 'agent-chat-ended' }])).toBe(true);
    expect(endedSinceLastLive([{ type: 'agent-chat-ended' }, { type: 'bot-message' }])).toBe(true);
    expect(endedSinceLastLive([{ type: 'agent-chat-ended' }, { type: 'agent-joined-message' }])).toBe(false);
    expect(endedSinceLastLive([{ type: 'agent-chat-ended' }, { shape: 'user-live-message' }])).toBe(false);
  });
});

describe('blocked and closed (web closedState.ts, _applyVisitorBlock)', () => {
  it('reads the handshake refusal and the event', () => {
    expect(isBlockedError(new Error('visitor_blocked'))).toBe(true);
    expect(isBlockedError(new Error('timeout'))).toBe(false);
    expect(blockedText({ message: 'This conversation has been closed.' })).toBe(CLOSED_TEXT);
    expect(blockedText({})).toBe(CLOSED_TEXT);
  });

  it('a blocked visitor gets the closed line, no input and no new chat', () => {
    expect(closedStateOf([], { blocked: CLOSED_TEXT })).toEqual({ kind: 'blocked', text: CLOSED_TEXT, newChat: false, inputOff: true });
  });

  it('an ended chat offers a new one once nothing is going on', () => {
    const ended = [{ type: 'agent-message' }, { type: 'agent-chat-ended' }];
    expect(closedStateOf(ended)).toEqual({ kind: 'ended', text: 'Chat ended', newChat: true, inputOff: true });
    expect(closedStateOf(ended, { stepWaiting: true })).toBeNull();
    expect(closedStateOf(ended, { live: true })).toBeNull();
    expect(closedStateOf([{ type: 'agent-message' }])).toBeNull();
  });
});
