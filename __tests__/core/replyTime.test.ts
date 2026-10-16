/**
 * The header's status (src/core/replyTime.ts), the header cases of the web
 * widget's tests/replyTime.test.js, plus a person in the chat (web
 * headerPresence.ts markHeaderLive).
 */
import { backWhen, headerLine, headerStatus } from '../../src/core/replyTime';

const online = (bucket: string | null) => ({ mode: 'auto' as const, handover: true, state: 'online' as const, bucket, leaveMessage: true });
const opts = { locale: 'en-US' };

describe('headerLine (web replyTime.ts)', () => {
  it('a bucket reads as an honest phrase', () => {
    expect(headerLine(online('few_minutes'), opts)).toEqual({ text: 'Typically replies in a few minutes', tone: 'online' });
    expect(headerLine(online('day'), opts)!.text).toBe('Typically replies within a day');
  });

  it('no data, an older server, or no handover: Online stays', () => {
    expect(headerLine(online(null), opts)).toBeNull();
    expect(headerLine(null, opts)).toBeNull();
    expect(headerLine({ ...online('few_minutes'), handover: false }, opts)).toBeNull();
  });

  it('away: Online, and when the team is back in the visitor\'s time', () => {
    const now = new Date(2026, 9, 3, 20, 0);
    const backAt = new Date(2026, 9, 5, 9, 0).toISOString();
    const rt = { ...online('few_minutes'), state: 'away' as const, backAt };
    expect(headerLine(rt, { ...opts, now })).toEqual({ text: 'Online · team back Monday 9 AM', tone: 'online' });
    expect(headerLine({ ...rt, backAt: null }, { ...opts, now })).toEqual({ text: 'Online · team replies by email', tone: 'online' });
    expect(backWhen(new Date(2026, 9, 4, 9, 30).toISOString(), now, 'en-US')).toBe('tomorrow 9:30 AM');
    expect(backWhen(new Date(2026, 9, 3, 22, 0).toISOString(), now, 'en-US')).toBe('at 10 PM');
  });

  it('offline: email only when leave-a-message is on', () => {
    const rt = { ...online('few_minutes'), state: 'offline' as const };
    expect(headerLine(rt, opts)).toEqual({ text: 'Online · team replies by email', tone: 'online' });
    expect(headerLine({ ...rt, leaveMessage: false }, opts)).toEqual({ text: 'Online · team away right now', tone: 'online' });
  });

  it('the owner\'s fixed words, or nothing; an AI agent bot shows none', () => {
    expect(headerLine({ ...online(null), mode: 'fixed', text: 'We reply within 2 hours' }, opts)!.text).toBe('We reply within 2 hours');
    expect(headerLine({ mode: 'hide', handover: true }, opts)).toBeNull();
    expect(headerLine(online('few_minutes'), { ...opts, agent: true })).toBeNull();
  });
});

describe('headerStatus', () => {
  it('the reply time before anyone joins, plain Online once a person is in the chat', () => {
    const rt = { ...online('few_minutes'), state: 'offline' as const };
    expect(headerStatus(rt, opts)!.text).toBe('Online · team replies by email');
    expect(headerStatus(rt, { ...opts, personInChat: true })).toEqual({ text: 'Online', tone: 'online' });
    expect(headerStatus(null, opts)).toEqual({ text: 'Online', tone: 'online' });
    expect(headerStatus(rt, { ...opts, hidden: true })).toBeNull();
  });
});

// The web's home card cases (tests/replyTime.test.js homeLine, homePeople).
describe('homeLine / homePeople (web replyTime.ts)', () => {
  const { homeLine, homePeople } = require('../../src/core/replyTime');

  it('the card line for each case', () => {
    expect(homeLine(online('few_minutes'), opts)).toEqual({ text: 'The team typically replies in a few minutes', tone: 'online' });
    expect(homeLine(online(null), opts)).toBeNull();
    expect(homeLine(null, opts)).toBeNull();
    const now = new Date(2026, 9, 3, 20, 0);
    const backAt = new Date(2026, 9, 5, 9, 0).toISOString();
    expect(homeLine({ ...online('few_minutes'), state: 'away', backAt }, { ...opts, now })).toEqual({ text: "We're away right now · back Monday 9 AM", tone: 'away' });
    expect(homeLine({ ...online('few_minutes'), state: 'offline' }, opts)).toEqual({ text: "The team is offline · we'll reply by email", tone: 'away' });
    expect(homeLine({ ...online('few_minutes'), state: 'offline', leaveMessage: false }, opts).text).toBe('The team is offline right now');
    expect(homeLine({ mode: 'hide', handover: true }, opts)).toEqual({ hide: true });
    const agent = { ...opts, agent: true };
    expect(homeLine(online('few_minutes'), agent)).toEqual({ text: 'Answers instantly · team replies in a few minutes', tone: 'online' });
    expect(homeLine({ ...online('few_minutes'), state: 'away', backAt }, { ...agent, now }).text).toBe('Answers instantly · team back Monday 9 AM');
    expect(homeLine({ mode: 'hide', handover: true }, agent)).toBeNull();
  });

  it("the home card's promise: plain words, never a speed promise when nobody is there", () => {
    const now = new Date(2026, 9, 8, 22, 0);
    const p = (rt: any, o: any = {}) => homePeople(rt, { ...opts, now, ...o });
    expect(p(online('few_minutes'))).toEqual({ text: 'Usually replies in a few minutes', tone: 'online' });
    expect(p({ ...online('few_minutes'), mode: 'fixed', text: 'We reply within 2 hours' })).toEqual({ text: 'We reply within 2 hours', tone: 'online' });
    expect(p(online(null))).toEqual({ text: 'Usually replies instantly', tone: 'online' });
    expect(p(null)).toEqual({ text: 'Answers instantly, day or night', tone: 'online' });
    expect(p({ ...online('few_minutes'), handover: false })).toEqual({ text: 'Answers instantly, day or night', tone: 'online' });
    expect(p({ ...online('few_minutes'), state: 'offline' }).text).toBe('Team replies by email');
    expect(p({ ...online('few_minutes'), state: 'offline', backAt: new Date(2026, 9, 9, 9, 0).toISOString() }).text).toBe('Team back tomorrow 9 AM');
    expect(p({ ...online('few_minutes'), state: 'away', backAt: new Date(2026, 9, 9, 9, 0).toISOString() }).text).toBe('Team back tomorrow 9 AM');
    expect(p({ ...online('few_minutes'), state: 'away', leaveMessage: false }).text).toBe('Team away right now');
    expect(p({ mode: 'hide', handover: true }).text).toBe('');
    expect(p(null, { agent: true })).toEqual({ text: 'Answers instantly, day or night', tone: 'online' });
    expect(p({ ...online('few_minutes'), state: 'offline' }, { agent: true })).toEqual({ text: 'Answers instantly, day or night', tone: 'online' });
    expect(p({ mode: 'hide', handover: true }, { agent: true }).text).toBe('Answers instantly, day or night');
  });
});
