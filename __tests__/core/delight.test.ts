/**
 * The conversation's human touches (web ts/chat/delight/rules.ts, index.ts,
 * stallNudge.ts, celebrate.ts, ratingFx.ts).
 */
import {
  CONFETTI_PIECES,
  STALL_AFTER_MS,
  STALL_QUIET_MS,
  canChangeAnswer,
  celebrationFor,
  confettiPieces,
  createStallWatch,
  isSafeToUndo,
  nudgesWhileWaiting,
  ratingSparks,
  reactionFor,
  reactionLabel,
  scoreShare,
  scoreText,
  showChangeFor,
  stallHintFor,
  touchOn,
  touchesFor,
  waitsForAnswer,
} from '../../src/core/delight';
import { setWidgetLanguage } from '../../src/core/i18n';

describe('delight rules', () => {
  afterEach(() => setWidgetLanguage('en'));

  it('is on unless the owner set it to false', () => {
    expect(touchOn({}, 'celebrations')).toBe(true);
    expect(touchOn(undefined, 'botReactions')).toBe(true);
    expect(touchOn({ celebrations: false }, 'celebrations')).toBe(false);
    expect(touchOn({ stallNudges: 0 }, 'stallNudges')).toBe(true);
  });

  it('lets questions be changed while only safe steps ran since', () => {
    expect(canChangeAnswer('ask-email-node', [])).toBe(true);
    expect(canChangeAnswer('ask-email-node', ['message-node', 'condition-node', 'delay-node', 'ask-name-node'])).toBe(true);
    expect(canChangeAnswer('ask-email-node', ['calendar-node'])).toBe(false);
    expect(canChangeAnswer('ask-email-node', ['webhook-node'])).toBe(false);
    expect(canChangeAnswer('ask-email-node', ['agent'])).toBe(false);
    expect(canChangeAnswer('calendar-node', [])).toBe(false);
    expect(isSafeToUndo('welcome-node')).toBe(false);
    expect(waitsForAnswer('payment-node')).toBe(true);
    expect(waitsForAnswer('message-node')).toBe(false);
  });

  it('shows "Edit" only on the latest answer, when the bot is quiet and nothing locks the chat', () => {
    const base = { customizations: {}, locked: false, botBusy: false, isLatestAnswer: true, questionType: 'ask-name-node', typesSince: [] };
    expect(showChangeFor(base)).toBe(true);
    expect(showChangeFor({ ...base, customizations: { allowChangeAnswer: false } })).toBe(false);
    expect(showChangeFor({ ...base, locked: true })).toBe(false);
    expect(showChangeFor({ ...base, botBusy: true })).toBe(false);
    expect(showChangeFor({ ...base, isLatestAnswer: false })).toBe(false);
  });

  it('reads a score from the answer text', () => {
    expect(scoreShare('★★★★ Good')).toBeCloseTo(0.8);
    expect(scoreShare('⭐⭐⭐⭐⭐')).toBe(1);
    expect(scoreShare('8/10')).toBeCloseTo(0.8);
    expect(scoreShare('7 / 10')).toBeCloseTo(0.7);
    expect(scoreShare('hello')).toBeNull();
    expect(scoreText('rating-choice-node', 4, 5)).toBe('4/5');
    expect(scoreText('ask-name-node', 4, 5)).toBe('');
  });

  it('reacts as a person would: a wave, a party, a heart, a thumbs up, a thank-you', () => {
    expect(reactionFor('ask-name-node', 'Jamie')).toBe('👋');
    expect(reactionFor('calendar-node', 'Tue 10:00')).toBe('🎉');
    expect(reactionFor('payment-node', 'Paid')).toBe('🎉');
    expect(reactionFor('rating-choice-node', '5/5')).toBe('❤️');
    expect(reactionFor('opinion-scale-choice-node', '6/10')).toBe('👍');
    expect(reactionFor('user-rating-node', '2/5')).toBe('🙏');
    expect(reactionFor('rating-choice-node', 'great')).toBeNull();
    expect(reactionFor('ask-email-node', 'a@b.co')).toBeNull();
    expect(reactionLabel('👋')).toBe('The bot waved');
    expect(reactionLabel('🦄')).toBe('The bot reacted');
  });

  it('celebrates a booking, a payment, a perfect score (not the rating card, which sparks)', () => {
    expect(celebrationFor('calendar-node', '')).toBe('big');
    expect(celebrationFor('payment-node', '')).toBe('big');
    expect(celebrationFor('opinion-scale-choice-node', '10/10')).toBe('big');
    expect(celebrationFor('opinion-scale-choice-node', '9/10')).toBeNull();
    expect(celebrationFor('rating-choice-node', '5/5')).toBeNull();
    expect(celebrationFor('ask-email-node', '')).toBeNull();
  });

  it('follows the owner\'s switches and reduced motion', () => {
    expect(touchesFor({}, 'calendar-node', '', false)).toEqual({ reaction: '🎉', celebrate: true });
    expect(touchesFor({}, 'calendar-node', '', true)).toEqual({ reaction: '🎉', celebrate: false });
    expect(touchesFor({ celebrations: false }, 'calendar-node', '', false)).toEqual({ reaction: '🎉', celebrate: false });
    expect(touchesFor({ botReactions: false }, 'ask-name-node', 'Jo', false)).toEqual({ reaction: null, celebrate: false });
  });

  it('draws the web\'s confetti fan and rating sparks', () => {
    let i = 0;
    const seq = [0.5, 0.5, 0.5, 0.5, 0.5];
    const pieces = confettiPieces(() => seq[i++ % seq.length]);
    expect(pieces).toHaveLength(CONFETTI_PIECES);
    // The first piece at -160 degrees (no jitter at 0.5), 86 px out.
    expect(pieces[0]).toMatchObject({ dx: Math.round(Math.cos((-160 * Math.PI) / 180) * 86), dy: Math.round(Math.sin((-160 * Math.PI) / 180) * 86), fall: 41, rot: 0, delay: 45, tone: 0, round: true });
    // The fan opens up: every piece flies upward.
    pieces.forEach((p) => expect(p.dy).toBeLessThan(0));
    expect(pieces.map((p) => p.tone).slice(0, 5)).toEqual([0, 1, 2, 3, 0]);
    expect(ratingSparks(false)).toEqual([20, 65, 110, 155, 200, 245, 290, 335]);
    expect(ratingSparks(true)).toHaveLength(12);
  });

  it('words the nudge for typing or picking, in the visitor\'s language', () => {
    expect(stallHintFor('ask-email-node')).toBe("No rush - type your answer below whenever you're ready.");
    expect(stallHintFor('n-choices-node')).toBe("No rush - pick whichever fits when you're ready.");
    setWidgetLanguage('de');
    expect(stallHintFor('n-choices-node')).not.toMatch(/No rush/);
    expect(nudgesWhileWaiting('calendar-node')).toBe(true);
    expect(nudgesWhileWaiting('ask-file-node')).toBe(false);
  });
});

describe('the stall watch', () => {
  const harness = (o: { visible?: () => boolean; composer?: () => string } = {}) => {
    let now = 0;
    const timers: Array<{ at: number; fn: () => void; id: number }> = [];
    let seq = 0;
    const shown: string[] = [];
    let hidden = 0;
    const watch = createStallWatch({
      isVisible: o.visible || (() => true),
      composerValue: o.composer || (() => ''),
      show: (h) => shown.push(h),
      hide: () => hidden++,
      now: () => now,
      setTimer: (fn, ms) => {
        timers.push({ at: now + ms, fn, id: ++seq });
        return seq;
      },
      clearTimer: (id) => {
        const i = timers.findIndex((t) => t.id === id);
        if (i >= 0) timers.splice(i, 1);
      },
    });
    const advance = (ms: number) => {
      const end = now + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        if (!timers.length || timers[0].at > end) break;
        const t = timers.shift()!;
        now = t.at;
        t.fn();
      }
      now = end;
    };
    return { watch, advance, shown, hidden: () => hidden, setNow: (n: number) => (now = n), get now() { return now; } };
  };

  it('nudges once, 40 s into a question nobody touched', () => {
    const h = harness();
    h.advance(STALL_QUIET_MS); // quiet since it started
    h.watch.arm('n-choices-node');
    h.advance(STALL_AFTER_MS - 1);
    expect(h.shown).toEqual([]);
    h.advance(1);
    expect(h.shown).toEqual(["No rush - pick whichever fits when you're ready."]);
    h.watch.arm('n-choices-node');
    h.advance(STALL_AFTER_MS * 2);
    expect(h.shown).toHaveLength(1);
    h.watch.disarm();
    expect(h.hidden()).toBe(1);
  });

  it('waits while the visitor is busy, away or typing', () => {
    let visible = false;
    let typed = 'hel';
    const h = harness({ visible: () => visible, composer: () => typed });
    h.advance(STALL_QUIET_MS);
    h.watch.arm('ask-name-node');
    h.advance(STALL_AFTER_MS);
    expect(h.shown).toEqual([]);
    visible = true;
    h.advance(STALL_QUIET_MS);
    expect(h.shown).toEqual([]); // still typing
    typed = '';
    h.watch.touch();
    h.advance(STALL_QUIET_MS - 1);
    expect(h.shown).toEqual([]);
    h.advance(STALL_QUIET_MS);
    expect(h.shown).toHaveLength(1);
  });

  it('goes quietly when answered before the nudge', () => {
    const h = harness();
    h.advance(STALL_QUIET_MS);
    h.watch.arm('ask-name-node');
    h.advance(1000);
    h.watch.disarm();
    h.advance(STALL_AFTER_MS);
    expect(h.shown).toEqual([]);
    expect(h.hidden()).toBe(0);
  });
});
