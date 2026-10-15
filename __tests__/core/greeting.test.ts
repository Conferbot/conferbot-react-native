import { decideGreeting, frequencyAllows, greetingHead, normalizeGreetingStyle, PAGE_COOLDOWN_SECONDS } from '../../src/core/greeting';

const NEW = { returning: false, signedIn: false };

describe('greeting card as the web decides it', () => {
  it('shows nothing when the greeting is off', () => {
    expect(decideGreeting({ chatIconCtaText: 'Hi' }, NEW)).toBeNull();
    expect(decideGreeting(null, NEW)).toBeNull();
  });

  it('shows the default message after 3s, opening the chat on a tap', () => {
    expect(decideGreeting({ chatIconCta: true, chatIconCtaText: ' Hi there ' }, NEW)).toMatchObject({ text: 'Hi there', delay: 3, click: 'open' });
    expect(decideGreeting({ chatIconCta: true, chatIconCtaText: 'Hi', greetingDelay: 9999, greetingClickAction: 'send' }, NEW)).toMatchObject({ delay: 3600, click: 'send' });
  });

  it('uses a rule for every page, never one for a given page', () => {
    const c = {
      chatIconCta: true,
      chatIconCtaText: 'Default',
      greetingRules: [
        { matchType: 'contains', pattern: '/pricing', text: 'Pricing help?' },
        { matchType: 'glob', pattern: '*', text: 'Everywhere', delay: 1, clickAction: 'send', starters: ['A', 'B'] },
      ],
    };
    expect(decideGreeting(c, NEW)).toMatchObject({ text: 'Everywhere', delay: 1, click: 'send', starters: ['A', 'B'] });
  });

  it('ranks rules by priority, and lets a show-nothing rule silence the card', () => {
    const rules = [
      { matchType: 'contains', pattern: '/', text: 'Low', priority: 10 },
      { matchType: 'contains', pattern: '/', text: 'High', priority: 90 },
    ];
    expect(decideGreeting({ chatIconCta: true, greetingRules: rules }, NEW)!.text).toBe('High');
    const silent = [...rules, { matchType: 'contains', pattern: '/', text: '', action: { type: 'none' }, signedIn: 'yes' }];
    expect(decideGreeting({ chatIconCta: true, greetingRules: silent }, { returning: false, signedIn: true })).toBeNull();
    expect(decideGreeting({ chatIconCta: true, greetingRules: silent }, NEW)!.text).toBe('High');
  });

  it('honours who and when; skips what only a browser knows', () => {
    const now = Date.parse('2026-10-15T12:00:00Z');
    const r = (extra: object) => ({ chatIconCta: true, chatIconCtaText: 'Default', greetingRules: [{ matchType: 'contains', pattern: '/', text: 'Rule', ...extra }] });
    expect(decideGreeting(r({ visitors: 'returning' }), NEW)!.text).toBe('Default');
    expect(decideGreeting(r({ visitors: 'returning' }), { returning: true, signedIn: false })!.text).toBe('Rule');
    expect(decideGreeting(r({ endsAt: '2026-10-01T00:00:00Z' }), { ...NEW, now })!.text).toBe('Default');
    expect(decideGreeting(r({ countries: ['GB'] }), NEW)!.text).toBe('Default');
    expect(decideGreeting(r({ source: { utmSource: 'ads' } }), NEW)!.text).toBe('Default');
    expect(decideGreeting(r({ patterns: ['pricing'] }), NEW)!.text).toBe('Default');
  });

  it('carries the old proactive teaser over as the web does', () => {
    expect(decideGreeting({ proactivePromptEnabled: true, proactivePromptText: 'Need help?' }, NEW)).toMatchObject({ text: 'Need help?', delay: 8, click: 'send' });
    expect(decideGreeting({ chatIconCta: true, chatIconCtaText: 'Hi', proactivePromptEnabled: true, proactivePromptText: 'Teaser' }, NEW)!.text).toBe('Teaser');
    expect(decideGreeting({ smartOnly: true }, NEW)).toBeNull();
  });

  it('follows the frequency: every launch with a rest after closing, once a session, once in N days', () => {
    const now = 1_000_000_000_000;
    expect(frequencyAllows({}, {}, now)).toBe(true);
    expect(frequencyAllows({}, { closedAt: now - 10_000 }, now)).toBe(false);
    expect(frequencyAllows({}, { closedAt: now - PAGE_COOLDOWN_SECONDS * 1000 }, now)).toBe(true);
    expect(frequencyAllows({ greetingFrequency: 'session' }, { shownThisSession: true }, now)).toBe(false);
    expect(frequencyAllows({ greetingFrequency: 'visitor', greetingFrequencyDays: 2 }, { shownAt: now - 86400000 }, now)).toBe(false);
    expect(frequencyAllows({ greetingFrequency: 'visitor', greetingFrequencyDays: 2 }, { shownAt: now - 3 * 86400000 }, now)).toBe(true);
  });

  it('heads the card with the avatar, name and Online', () => {
    expect(greetingHead({ avatar: 'a.png', logoText: 'Acme' })).toEqual({ avatar: 'a.png', name: 'Acme', online: true });
    expect(greetingHead({ hideAvatar: true, avatar: 'a.png', logo: 'l.png', hideOnlineStatus: true }, 'Bot')).toEqual({ avatar: 'l.png', name: 'Bot', online: false });
    expect(normalizeGreetingStyle('nope')).toBe('imessage');
    expect(normalizeGreetingStyle('sticky')).toBe('sticky');
  });

  it('reads the smart rules as the web: visits, chatted, limits, and customers kept quiet', () => {
    const smart = [
      { id: 'sgcust', matchType: 'contains', pattern: '/', text: '', signedIn: 'yes', action: { type: 'none' }, priority: 95 },
      { id: 'sgretn', matchType: 'contains', pattern: '/', text: 'Welcome back!', behavior: { minVisits: 2 }, priority: 24, limits: { maxShows: 1, windowDays: 3, quietDaysAfterDismiss: 14 } },
      { id: 'sgengd', matchType: 'contains', pattern: '/', text: 'Finding what you need?', behavior: { minPagesThisVisit: 3 }, priority: 22 },
    ];
    const c = { chatIconCta: true, chatIconCtaText: 'Default', greetingRules: smart };
    const now = Date.parse('2026-10-15T12:00:00Z');
    expect(decideGreeting(c, { returning: false, signedIn: false, visits: 1, now })!.text).toBe('Default');
    expect(decideGreeting(c, { returning: true, signedIn: false, visits: 2, now })!.text).toBe('Welcome back!');
    expect(decideGreeting(c, { returning: true, signedIn: false, visits: 2, shows: { sgretn: [now - 86400000] }, now })!.text).toBe('Default');
    expect(decideGreeting(c, { returning: true, signedIn: false, visits: 2, dismissed: { sgretn: now - 5 * 86400000 }, now })!.text).toBe('Default');
    // Signed-in customers: quiet, unless the owner has a rule of their own for them.
    expect(decideGreeting(c, { returning: false, signedIn: true, now })).toBeNull();
    const own = { ...c, greetingRules: [...smart, { matchType: 'contains', pattern: '/', text: 'Hi customer', signedIn: 'yes' }] };
    expect(decideGreeting(own, { returning: false, signedIn: true, now })!.text).toBe('Hi customer');
  });
});
