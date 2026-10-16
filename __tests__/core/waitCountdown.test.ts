/**
 * The wait card's max-wait countdown (src/core/liveChat.ts), as the web
 * widget's queueCard.ts clock / setRemaining and special.ts
 * _attachHandoverWait (remainingSeconds after a reload).
 */
import { clock, maxWaitText, secondsLeft, waitDeadline } from '../../src/core/liveChat';
import { setWidgetLanguage } from '../../src/core/i18n';

afterEach(() => setWidgetLanguage('en'));

describe('clock', () => {
  it('m:ss', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(5)).toBe('0:05');
    expect(clock(65)).toBe('1:05');
    expect(clock(600)).toBe('10:00');
    expect(clock(59.6)).toBe('1:00');
  });
  it('never below 0:00', () => {
    expect(clock(-3)).toBe('0:00');
    expect(clock(NaN)).toBe('0:00');
  });
});

describe('maxWaitText', () => {
  it('"Max wait 1:05"', () => {
    expect(maxWaitText(65)).toBe('Max wait 1:05');
  });
  it('in the visitor\'s language', () => {
    setWidgetLanguage('de');
    expect(maxWaitText(65)).toBe('Max. Wartezeit 1:05');
    setWidgetLanguage('es');
    expect(maxWaitText(120)).toBe('Espera máx. 2:00');
  });
});

describe('waitDeadline', () => {
  const now = 1_000_000;
  it('the step\'s max wait from now', () => {
    expect(waitDeadline(5, null, now)).toBe(now + 5 * 60000);
    expect(waitDeadline('3', undefined, now)).toBe(now + 3 * 60000);
  });
  it('2 minutes when unset', () => {
    expect(waitDeadline(undefined, null, now)).toBe(now + 2 * 60000);
    expect(waitDeadline(0, null, now)).toBe(now + 2 * 60000);
  });
  it('a restored wait: the server\'s seconds left', () => {
    expect(waitDeadline(5, 42, now)).toBe(now + 42000);
    expect(waitDeadline(5, 0, now)).toBe(now);
  });
  it('a bad remaining is ignored', () => {
    expect(waitDeadline(5, NaN, now)).toBe(now + 5 * 60000);
    expect(waitDeadline(5, -1, now)).toBe(now + 5 * 60000);
  });
});

describe('secondsLeft', () => {
  it('whole seconds, rounded up, 0 once past', () => {
    expect(secondsLeft(10000, 0)).toBe(10);
    expect(secondsLeft(10000, 500)).toBe(10);
    expect(secondsLeft(10000, 1000)).toBe(9);
    expect(secondsLeft(10000, 10000)).toBe(0);
    expect(secondsLeft(10000, 20000)).toBe(0);
  });
});
