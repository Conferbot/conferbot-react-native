import {
  helpfulStart,
  helpfulStep,
  normalizeFeedback,
  ratedLabel,
  withFeedback,
  HELPFUL_TEXT,
  type HelpfulState,
} from '../../src/core/answerFeedback';

const play = (s: HelpfulState, ...taps: any[]) => {
  const sent: any[] = [];
  for (const tap of taps) {
    const r = helpfulStep(s, tap);
    if (r.send) sent.push(r.send);
    s = r.state;
  }
  return { s, sent };
};

describe('"Helpful?" (web answerFeedback.ts)', () => {
  it('sends a No at once, without waiting for a reason', () => {
    const r = helpfulStep(helpfulStart(), { kind: 'vote', helpful: false });
    expect(r.send).toEqual({ helpful: false });
    expect(r.state.view).toBe('down');
  });

  it('a reason, then a comment, each go as they are given', () => {
    const { s, sent } = play(
      helpfulStart(),
      { kind: 'vote', helpful: false },
      { kind: 'reason', reason: 'outdated' },
      { kind: 'comment', text: '  the   price changed \n' }
    );
    expect(sent).toEqual([
      { helpful: false },
      { helpful: false, reason: 'outdated' },
      { helpful: false, reason: 'outdated', comment: 'the price changed' },
    ]);
    expect(s.commented).toBe(true);
    expect(ratedLabel(s.current)).toBe('Not helpful · Outdated');
  });

  it('a comment without a reason, and an empty one sends nothing', () => {
    expect(play(helpfulStart(), { kind: 'vote', helpful: false }, { kind: 'comment', text: 'meh' }).sent[1]).toEqual({ helpful: false, comment: 'meh' });
    const { s, sent } = play(helpfulStart(), { kind: 'vote', helpful: false }, { kind: 'comment', text: '   ' });
    expect(sent).toEqual([{ helpful: false }]);
    expect(s.commented).toBe(true);
  });

  it('Yes thanks, then settles into the rated line', () => {
    const { s, sent } = play(helpfulStart(), { kind: 'vote', helpful: true });
    expect(sent).toEqual([{ helpful: true }]);
    expect(s.view).toBe('thanks');
    expect(helpfulStep(s, { kind: 'settle' }).state.view).toBe('rated');
  });

  it('the vote can change; the same thumb again sends nothing', () => {
    const start = helpfulStart({ helpful: true });
    expect(start.view).toBe('rated');
    expect(helpfulStep(start, { kind: 'vote', helpful: true }).send).toBeUndefined();
    const { s, sent } = play(start, { kind: 'vote', helpful: false });
    expect(sent).toEqual([{ helpful: false }]);
    expect(s.view).toBe('down');
    // A settle after switching to No does not hide the reasons.
    expect(helpfulStep(s, { kind: 'settle' }).state.view).toBe('down');
  });

  it('Talk to a person asks in the visitor\'s words; Ask another way focuses the composer', () => {
    const down = play(helpfulStart(), { kind: 'vote', helpful: false }).s;
    const human = helpfulStep(down, { kind: 'human' });
    expect(human.ask).toBe(HELPFUL_TEXT.talkToPersonAsk);
    expect(human.state.view).toBe('rated');
    const retry = helpfulStep(down, { kind: 'retry' });
    expect(retry.focus).toBe(true);
    expect(retry.state.view).toBe('rated');
  });

  it('reads a stored vote as the web does', () => {
    expect(normalizeFeedback(null)).toBeNull();
    expect(normalizeFeedback({ helpful: 'no' })).toBeNull();
    expect(normalizeFeedback({ helpful: true, reason: 'wrong', comment: 'x' })).toEqual({ helpful: true });
    expect(normalizeFeedback({ helpful: false, reason: 'bogus', comment: ' ok ' })).toEqual({ helpful: false, comment: 'ok' });
    expect(normalizeFeedback({ helpful: false, comment: 'a'.repeat(600) })!.comment).toHaveLength(500);
  });

  it('keeps the vote on the answer\'s record entry', () => {
    const record = [{ id: 'a1', shape: 'agent-message', text: 'x' }, { id: 'u1', shape: 'user-message' }];
    const out = withFeedback(record, 'a1', { helpful: false, reason: 'wrong' }, '2026-10-16T10:00:00.000Z');
    expect(out[0]).toEqual({ id: 'a1', shape: 'agent-message', text: 'x', feedback: { helpful: false, reason: 'wrong', at: '2026-10-16T10:00:00.000Z' } });
    expect(out[1]).toBe(record[1]);
    expect(withFeedback(record, 'nope', { helpful: true })).toBe(record);
  });
});
