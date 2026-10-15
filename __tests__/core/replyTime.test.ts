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
