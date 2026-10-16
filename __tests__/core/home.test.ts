/**
 * The home screen's decisions (src/core/home.ts): the web's cases
 * (conferbot-widget tests/homeCopy.test.js, homeUtils.test.js,
 * askBox.test.js, trust.test.js, visitorMemory.test.js) and what
 * firstImpression.ts enhanceHome shows, in what order.
 */
import {
  HIDDEN_WHILE_ASKING,
  HOME_TEXT,
  askBoxOn,
  askDefault,
  askPlaceholder,
  askRows,
  canResume,
  compactCount,
  helpSearch,
  highlightRuns,
  homeBrand,
  homeCardAvatar,
  homeCopy,
  homeModel,
  homeOn,
  homePalette,
  CLASSIC_HOME_PALETTE,
  isLight,
  parseColor,
  parseHomeMemory,
  ratingLine,
  remoteQueryFor,
  safeHomeView,
  salutation,
  showsRecentArticles,
  topCategories,
  trustImages,
  welcomeBack,
  withMessage,
  withName,
  LIVE_CHAT_MS,
} from '../../src/core/home';

const NOW = 1_800_000_000_000;
const art = (id: string, title: string, description = '', content = '', extra: any = {}) => ({ _id: id, title, description, content, ...extra });
const CATS = [
  { _id: 'c1', name: 'Billing', articles: [art('3', 'Changing your plan', 'Upgrade, downgrade or cancel at any time.'), art('4', 'Downloading invoices', 'Find every invoice in one place.')] },
  { _id: 'c2', name: 'Getting started', articles: [art('1', 'How to build your first bot', 'A step by step guide.')] },
];
const RECENT = [art('2', 'Embedding the widget on your website', 'Copy one script tag into your site.'), art('9', 'A draft', '', '', { reviewStatus: 'draft' })];
const HOME = { enableInitialPage: true, initialPageTitle: 'Hi there 👋', logo: 'https://cdn.x/logo.png', logoText: 'Acme' };

describe('on or off (web templates, core/helpCentre.ts safeView)', () => {
  it('only when the owner turned it on', () => {
    expect(homeOn({ enableInitialPage: true })).toBe(true);
    expect(homeOn({ enableInitialPage: false })).toBe(false);
    expect(homeOn({})).toBe(false);
    expect(homeOn(null)).toBe(false);
    expect(homeModel({ c: { enableInitialPage: false } })).toBeNull();
    expect(homeModel({ c: null })).toBeNull();
  });

  it('a view that cannot show falls back', () => {
    expect(safeHomeView({ enableInitialPage: true }, null)).toBe('home');
    expect(safeHomeView({}, null)).toBe('chat');
    expect(safeHomeView({}, 'home')).toBe('chat');
    expect(safeHomeView({ enableInitialPage: true }, 'help')).toBe('home');
    expect(safeHomeView({ enableInitialPage: true, enableKnowledgeBase: true }, 'help')).toBe('help');
    expect(safeHomeView({}, 'help')).toBe('chat');
  });
});

describe('words (web homeCopy.ts, homeUtils.ts)', () => {
  it("early bots' placeholder copy is shown as what is true", () => {
    const c = {
      initialPageCardSubTitle: 'Our usual reply time',
      initialPageCardTagline: 'Later Today',
      initialPageDescription: 'Welcome to the Conferbot\nWe help your business to connect with your customer',
    };
    expect(homeCopy(c, 'Acme Support')).toEqual({ cardTitle: 'Acme Support', cardTagline: 'Online now', description: HOME_TEXT.description, online: true });
    expect(homeCopy({}, '').cardTitle).toBe('Support');
  });

  it("the owner's own words are kept exactly", () => {
    const c = { initialPageCardSubTitle: 'Sales team', initialPageCardTagline: 'Mon-Fri, 9-5', initialPageDescription: 'Hi! Questions about orders?' };
    expect(homeCopy(c, 'Acme')).toEqual({ cardTitle: 'Sales team', cardTagline: 'Mon-Fri, 9-5', description: 'Hi! Questions about orders?', online: false });
  });

  it('the salutation follows the clock', () => {
    expect(salutation(9)).toBe('Good morning');
    expect(salutation(14)).toBe('Good afternoon');
    expect(salutation(20)).toBe('Good evening');
    expect(salutation(2)).toBe('Hello');
    expect(salutation(NaN)).toBe('Good afternoon');
  });

  it('the brand is the header logo and name, nothing when hidden', () => {
    expect(homeBrand({ logo: 'https://cdn.x/l.png', logoText: ' Acme  Co ' })).toEqual({ logo: 'https://cdn.x/l.png', name: 'Acme Co' });
    expect(homeBrand({ logo: 'https://cdn.x/l.png' }, 'Bot')).toEqual({ logo: 'https://cdn.x/l.png', name: 'Bot' });
    expect(homeBrand({ logo: 'https://cdn.x/l.png', hideLogo: true })).toBeNull();
    expect(homeBrand({ logo: 'javascript:x' })).toBeNull();
  });

  it("the card's face: the owner's, the bot's avatar, its logo, then Conferbot's", () => {
    expect(homeCardAvatar({ initialPageAvatar: 'https://a/me.png', avatar: 'https://a/b.png' })).toBe('https://a/me.png');
    expect(homeCardAvatar({ avatar: 'https://a/b.png' })).toBe('https://a/b.png');
    expect(homeCardAvatar({ avatar: 'https://a/b.png', hideAvatar: true, logo: 'https://a/l.png' })).toBe('https://a/l.png');
    expect(homeCardAvatar({ logo: 'https://x/conferbot-logo.png' })).toMatch(/conferbot-logo-1710782074234/);
  });

  it('light colours take dark ink', () => {
    expect(isLight(parseColor('#ffffff'))).toBe(true);
    expect(isLight(parseColor('#0808EE'))).toBe(false);
    expect(isLight(parseColor('rgb(250, 240, 200)'))).toBe(true);
    expect(parseColor('teal')).toBeNull();
  });
});

describe('surfaces', () => {
  it("the theme's canvas and cards, else the classic widget's", () => {
    expect(homePalette(null)).toEqual(CLASSIC_HOME_PALETTE);
    const t = { bg2: '#101014', card: '#18181d', card2: '#222228', ink: '#f4f4f5', muted: '#a1a1aa', line: '#2a2a31' };
    expect(homePalette(t)).toEqual({ page: '#101014', card: '#18181d', soft: '#222228', ink: '#f4f4f5', muted: '#a1a1aa', line: '#2a2a31' });
  });
});

describe('the help centre (web core/helpCentre.ts, homeUtils.ts topCategories)', () => {
  it('recent articles show only with the home, the help centre, a published article and not hidden', () => {
    const c = { enableInitialPage: true, enableKnowledgeBase: true };
    expect(showsRecentArticles(c, RECENT)).toBe(true);
    expect(showsRecentArticles({ ...c, hideRecentArticles: true }, RECENT)).toBe(false);
    expect(showsRecentArticles({ ...c, enableKnowledgeBase: false }, RECENT)).toBe(false);
    expect(showsRecentArticles(c, [RECENT[1]])).toBe(false);
  });

  it('topics: named, not empty, most articles first', () => {
    const cats = [{ name: 'A', articles: [1] }, { name: '', articles: [1, 2] }, { name: 'B', articles: [1, 2] }, { name: 'C', articles: [] }];
    expect(topCategories(cats).map((c) => c.name)).toEqual(['B', 'A']);
  });
});

describe('trust (web trust.ts)', () => {
  it('only https images, once each, at most max', () => {
    const list = ['https://cdn.x/a.png', 'http://cdn.x/b.png', 'javascript:alert(1)', 'https://cdn.x/a.png', ' https://cdn.x/c.png ', 'https://x/"onerror=1', 42, 'https://cdn.x/d.png'];
    expect(trustImages(list, 6)).toEqual(['https://cdn.x/a.png', 'https://cdn.x/c.png', 'https://cdn.x/d.png']);
    expect(trustImages(list, 1)).toEqual(['https://cdn.x/a.png']);
    expect(trustImages(undefined, 3)).toEqual([]);
  });

  it('counts read as people say them', () => {
    expect(compactCount(7)).toBe('7');
    expect(compactCount(999)).toBe('999');
    expect(compactCount(1320)).toBe('1.3k');
    expect(compactCount(12900)).toBe('12k');
  });

  it('a rating line for a real average only', () => {
    expect(ratingLine({ average: 4.83, count: 120 })).toEqual({ average: '4.8', count: '120 reviews', fill: 96, label: 'Rated 4.8 out of 5 from 120 reviews' });
    expect(ratingLine({ average: 4.36, count: 1520 })).toEqual({ average: '4.4', count: '1.5k reviews', fill: 88, label: 'Rated 4.4 out of 5 from 1520 reviews' });
    expect(ratingLine({ average: 5, count: 1 })!.count).toBe('1 review');
    expect(ratingLine(null)).toBeNull();
    expect(ratingLine({ average: 6, count: 50 })).toBeNull();
    expect(ratingLine({ average: 4.5, count: 0 })).toBeNull();
    expect(ratingLine({ average: 'x', count: 30 })).toBeNull();
  });
});

describe('visitor memory (web visitorMemory.ts)', () => {
  it("a conversation's first real question is what they came for", () => {
    let m = withMessage(null, 's1', 'hi', NOW);
    expect(m.topic).toBeUndefined();
    m = withMessage(m, 's1', 'Do you support Shopify stores?', NOW);
    m = withMessage(m, 's1', 'And what about WooCommerce?', NOW + 1000);
    expect(m.topic).toBe('Do you support Shopify stores?');
    m = withMessage(m, 's2', 'Can I cancel my plan anytime?', NOW + 5000);
    expect(m.topic).toBe('Can I cancel my plan anytime?');
    expect(m.session).toBe('s2');
    expect(m.at).toBe(NOW + 5000);
  });

  it('a first name only, and never something that is not a name', () => {
    const m = withName(null, 'jamie lee', NOW)!;
    expect(m.name).toBe('Jamie');
    expect(withName(m, 'x@y.com', NOW)).toBeNull();
    expect(withName(m, 'R2D2', NOW)).toBeNull();
  });

  it('welcome back once the last chat is over, not while it would be restored', () => {
    const m = { at: NOW, name: 'Jamie', topic: 'Do you support Shopify stores?' };
    expect(welcomeBack(m, NOW + LIVE_CHAT_MS - 1)).toBeNull();
    expect(welcomeBack(m, NOW + LIVE_CHAT_MS)).toEqual({ hello: 'Welcome back, Jamie', topic: 'Do you support Shopify stores?' });
    expect(welcomeBack({ at: NOW, topic: 'Do you support Shopify stores?' }, NOW + LIVE_CHAT_MS)).toEqual({ hello: 'Welcome back', topic: 'Do you support Shopify stores?' });
    expect(welcomeBack({ at: NOW }, NOW + LIVE_CHAT_MS)).toBeNull();
    expect(welcomeBack(null, NOW)).toBeNull();
  });

  it('forgotten after 60 days; broken storage is no memory', () => {
    const raw = JSON.stringify(withMessage(null, 's1', 'Do you support Shopify stores?', NOW));
    expect(parseHomeMemory(raw, NOW)!.topic).toBe('Do you support Shopify stores?');
    expect(parseHomeMemory(raw, NOW + 61 * 86400000)).toBeNull();
    expect(parseHomeMemory('{nope', NOW)).toBeNull();
    expect(parseHomeMemory(null, NOW)).toBeNull();
    // An old memory is started again, not added to.
    expect(withMessage(parseHomeMemory(raw, NOW), 's9', 'hello', NOW + 61 * 86400000).topic).toBeUndefined();
  });

  it('the card opens the conversation only when it is the one on the device', () => {
    const m = withMessage(null, 's1', 'Do you support Shopify stores?', NOW);
    expect(canResume(m, 's1')).toBe(true);
    expect(canResume(m, 's9')).toBe(false);
    expect(canResume(m, undefined)).toBe(false);
    expect(canResume(null, 's1')).toBe(false);
  });
});

describe('"Ask anything" (web askBox.ts)', () => {
  const articles = [
    { _id: '1', title: 'How to build your first bot', description: 'A step by step guide to your first chatbot.', categoryName: '', _text: 'Open the builder.' },
    { _id: '3', title: 'Changing your plan', description: 'Upgrade, downgrade or cancel at any time.', categoryName: 'Billing', _text: '' },
    { _id: '4', title: 'Downloading invoices', description: 'Find every invoice in one place.', categoryName: 'Billing', _text: '' },
  ];

  it('the box asks for a question with an agent, a search without', () => {
    expect(askPlaceholder(true, false)).toBe('Ask a question…');
    expect(askPlaceholder(false, true)).toBe('Search for help');
  });

  it('it shows with an agent or articles, unless the owner turned it off', () => {
    expect(askBoxOn({}, true, false)).toBe(true);
    expect(askBoxOn({}, false, true)).toBe(true);
    expect(askBoxOn({ homeAskBox: false }, true, true)).toBe(false);
    expect(askBoxOn({}, false, false)).toBe(false);
  });

  it('an agent: "Ask" first (what Enter does), then the articles', () => {
    const rows = askRows('how do I change my plan', { agentName: 'Ava', articles });
    expect(rows.map((r) => r.kind)).toEqual(['ask', 'label', 'article']);
    expect(rows[0]).toMatchObject({ kind: 'ask', query: 'how do I change my plan', sub: 'Ava answers right away' });
    expect(rows[2]).toMatchObject({ kind: 'article', id: '3', sub: 'Upgrade, downgrade or cancel at any time.' });
    expect(askDefault(rows)!.kind).toBe('ask');
  });

  it('a flow bot: the articles, else "No articles match" and Chat with us', () => {
    const rows = askRows('invoice', { agentName: null, articles });
    expect(rows.map((r) => r.kind)).toEqual(['label', 'article']);
    expect(askDefault(rows)).toMatchObject({ kind: 'article', id: '4' });
    const none = askRows('do you ship to mars', { agentName: null, articles });
    expect(none).toEqual([
      { kind: 'none', key: 'none', text: 'No articles match “do you ship to mars”.' },
      { kind: 'chat', key: 'chat', title: 'Chat with us', sub: "We'll help you with it" },
    ]);
    expect(askDefault(none)!.kind).toBe('chat');
    // An agent with nothing found: only the ask.
    expect(askRows('do you ship to mars', { agentName: 'Ava', articles }).map((r) => r.kind)).toEqual(['ask']);
    expect(askRows('   ', { agentName: 'Ava', articles })).toEqual([]);
  });

  it("the server's matches inside article text come after the local ones, for the query asked", () => {
    const remote = { query: 'pdf vat', hits: [{ _id: '4', snippet: 'Each invoice is a PDF with your VAT number.' }, { _id: 'zz', snippet: 'not here' }] };
    const rows = askRows('PDF VAT', { agentName: null, articles, remote });
    expect(rows[1]).toMatchObject({ kind: 'article', id: '4', sub: 'Each invoice is a PDF with your VAT number.' });
    expect(askRows('other', { agentName: null, articles, remote }).some((r) => r.kind === 'article')).toBe(false);
  });

  it('asks the server with the two longest key words, only when a body is missing', () => {
    expect(remoteQueryFor('where is my vat number', [{ _id: '1' }])).toBe('number vat');
    expect(remoteQueryFor('where is my vat number', [{ _id: '1', content: '<p>x</p>' }])).toBeNull();
    expect(remoteQueryFor('how do I', [{ _id: '1' }])).toBeNull();
  });

  it('marks the words that matched', () => {
    expect(highlightRuns('Changing your plan', ['plan'])).toEqual([{ text: 'Changing your ' }, { text: 'plan', mark: true }]);
    expect(highlightRuns('Plain', [])).toEqual([{ text: 'Plain' }]);
  });

  it("the help card's own search: up to five, else ask or chat instead", () => {
    const found = helpSearch('billing', articles, false)!;
    expect(found.kind).toBe('results');
    expect((found as any).rows.map((r: any) => r.id)).toEqual(['3', '4']);
    expect(helpSearch('mars', articles, true)).toEqual({ kind: 'empty', text: 'No articles match “mars”.', action: 'Ask us instead', asks: true });
    expect(helpSearch('mars', articles, false)).toMatchObject({ action: 'Chat with us instead', asks: false });
    expect(helpSearch('', articles, false)).toBeNull();
  });
});

describe('the home screen (web firstImpression.ts enhanceHome)', () => {
  const agent = { displayName: 'Ava', starters: ['Pricing?', 'Do you integrate with Shopify?', 'Refunds', 'Fourth'], avatar: null };

  it('a plain flow bot: the header and "Talk to us"', () => {
    const m = homeModel({ c: HOME, botName: 'Acme bot', now: NOW, hour: 9 })!;
    expect(m.hello).toBe('Good morning');
    expect(m.brand).toEqual({ logo: 'https://cdn.x/logo.png', name: 'Acme' });
    expect(m.title).toBe('Hi there 👋');
    expect(m.description).toBe(HOME_TEXT.description);
    expect(m.order).toEqual(['talk']);
    expect(m.ask).toBeNull();
    expect(m.help).toBeNull();
    expect(m.talk).toMatchObject({ title: 'Acme', tagline: null, status: 'Online · Answers instantly, day or night', dot: true, button: 'Chat with us', starters: [] });
    expect(m.light).toBe(false);
  });

  it("the owner's tagline is kept, the status line after it; status off takes Online and the dot", () => {
    const c = { ...HOME, initialPageCardTagline: 'Mon-Fri 9-5', hideOnlineStatus: true, replyTime: { mode: 'auto', handover: true, state: 'online', bucket: 'few_minutes' } };
    const m = homeModel({ c, now: NOW })!;
    expect(m.talk.tagline).toBe('Mon-Fri 9-5');
    expect(m.talk.status).toBe('Usually replies in a few minutes');
    expect(m.talk.dot).toBe(false);
    // Hide: no line at all.
    expect(homeModel({ c: { ...c, replyTime: { mode: 'hide', handover: true } }, now: NOW })!.talk.status).toBeNull();
  });

  it("the owner's button text, or the stock one", () => {
    expect(homeModel({ c: { ...HOME, initialPageCardButtonText: 'Message us' } })!.talk.button).toBe('Message us');
    expect(homeModel({ c: { ...HOME, initialPageCardButtonText: 'Chat with us' } })!.talk.button).toBe('Chat with us');
  });

  it('an agent: the ask box first, three of its questions on the card', () => {
    const m = homeModel({ c: HOME, agent, now: NOW })!;
    expect(m.order).toEqual(['ask', 'talk']);
    expect(m.ask).toEqual({ placeholder: 'Ask a question…', label: 'Ask Ava a question', agentName: 'Ava' });
    expect(m.talk.starters).toEqual(['Pricing?', 'Do you integrate with Shopify?', 'Refunds']);
    expect(m.talk.title).toBe('Ava');
    expect(homeModel({ c: { ...HOME, homeAskBox: false }, agent })!.ask).toBeNull();
  });

  it('the help centre: ask box over articles, recent list, topics and See all; drafts never', () => {
    const c = { ...HOME, enableKnowledgeBase: true };
    const m = homeModel({ c, categories: CATS, recentArticles: RECENT })!;
    expect(m.order).toEqual(['ask', 'talk', 'help']);
    expect(m.ask!.placeholder).toBe('Search for help');
    expect(m.help).toMatchObject({ title: 'Recent articles', seeAll: true, search: false });
    expect(m.help!.recent.map((r) => r.id)).toEqual(['2']);
    expect(m.help!.topics).toEqual([
      { id: 'c1', name: 'Billing', count: 2 },
      { id: 'c2', name: 'Getting started', count: 1 },
    ]);
    expect(m.articles.map((a) => a._id)).toEqual(['3', '4', '1', '2']);
  });

  it('recent articles hidden: the card is the help centre; the ask box off: the card searches', () => {
    const c = { ...HOME, enableKnowledgeBase: true, hideRecentArticles: true, homeAskBox: false };
    const m = homeModel({ c, categories: CATS, recentArticles: RECENT })!;
    expect(m.order).toEqual(['talk', 'help']);
    expect(m.help).toMatchObject({ title: 'Help centre', recent: [], search: true });
  });

  it('a help centre with no published article counts as off', () => {
    const m = homeModel({ c: { ...HOME, enableKnowledgeBase: true }, categories: [], recentArticles: [RECENT[1]] })!;
    expect(m.help).toBeNull();
    expect(m.ask).toBeNull();
    expect(m.articles).toEqual([]);
  });

  it('welcome back, and pick up where they left off for an agent bot', () => {
    const memory = { at: NOW - LIVE_CHAT_MS, name: 'Jamie', topic: 'Do you support Shopify stores?', session: 's1' };
    const m = homeModel({ c: HOME, agent, memory, chatSessionId: 's1', now: NOW })!;
    expect(m.hello).toBe('Welcome back, Jamie');
    expect(m.order).toEqual(['ask', 'resume', 'talk']);
    expect(m.resume).toEqual({ topic: 'Do you support Shopify stores?', resumable: true, line: 'Continue the conversation' });
    expect(homeModel({ c: HOME, agent, memory, chatSessionId: 's2', now: NOW })!.resume!.line).toBe("Ask it again - we'll answer right away");
    // A flow bot: welcomed back, nothing to pick up.
    const flow = homeModel({ c: HOME, memory, now: NOW })!;
    expect(flow.hello).toBe('Welcome back, Jamie');
    expect(flow.resume).toBeNull();
  });

  it('your requests: two rows and See all (n), below Talk to us, above it when a reply is new', () => {
    const req = (id: string, lastAt: number, lastFrom: 'team' | 'visitor', extra: any = {}) => ({ id, title: `Request ${id}`, status: 'open', lastFrom, lastAt: new Date(lastAt).toISOString(), lastName: 'Ada', ...extra });
    const requests = [req('a', NOW - 3000, 'visitor'), req('b', NOW - 2000, 'visitor'), req('c', NOW - 1000, 'visitor')];
    const m = homeModel({ c: HOME, requests, seen: {}, now: NOW })!;
    expect(m.order).toEqual(['talk', 'requests']);
    expect(m.requests!.rows.map((r) => r.id)).toEqual(['c', 'b']);
    expect(m.requests!.seeAll).toBe('See all (3)');
    expect(m.requests!.fresh).toBe(false);
    const replied = [req('a', NOW - 3000, 'team'), req('b', NOW - 2000, 'visitor')];
    const n = homeModel({ c: HOME, requests: replied, seen: {}, now: NOW })!;
    expect(n.order).toEqual(['requests', 'talk']);
    expect(n.requests!.rows[0]).toMatchObject({ id: 'a', fresh: true, state: 'replied' });
    expect(n.requests!.seeAll).toBeNull();
    // Read here since: no longer new.
    expect(homeModel({ c: HOME, requests: replied, seen: { a: NOW }, now: NOW })!.order).toEqual(['talk', 'requests']);
    // Nothing at all for a first-time visitor.
    expect(homeModel({ c: HOME, requests: null })!.requests).toBeNull();
    expect(homeModel({ c: HOME, requests: [] })!.requests).toBeNull();
  });

  it('trust: faces and the rating on the card, the logos with their line last', () => {
    const c = { ...HOME, homeTeamPhotos: ['https://cdn.x/1.png', 'https://cdn.x/2.png'], homeRating: { average: 4.83, count: 120 }, homeTrustLogos: ['https://cdn.x/l.png'], homeTrustLabel: ' Trusted by 2,000+ teams ' };
    const m = homeModel({ c })!;
    expect(m.talk.faces).toEqual(['https://cdn.x/1.png', 'https://cdn.x/2.png']);
    expect(m.talk.rating!.average).toBe('4.8');
    expect(m.trust).toEqual({ label: 'Trusted by 2,000+ teams', logos: ['https://cdn.x/l.png'] });
    expect(m.order).toEqual(['talk', 'trust']);
    // A label with no logo is a claim with no proof: nothing.
    expect(homeModel({ c: { ...HOME, homeTrustLabel: 'Trusted' } })!.trust).toBeNull();
  });

  it('the band is the launcher colours; light ones take dark ink', () => {
    expect(homeModel({ c: { ...HOME, widgetIconThemeType: 'Gradient', widgetGradientBgOne: '#0808EE', widgetGradientBgTwo: '#6366F1' } })!.band).toEqual(['#0808EE', '#6366F1']);
    const light = homeModel({ c: { ...HOME, widgetIconBgColor: '#ffffff' } })!;
    expect(light.light).toBe(true);
    expect(light.accent).toBe('#4F46E5');
  });

  it('while the visitor types, the list is the page', () => {
    expect(HIDDEN_WHILE_ASKING).toEqual(['resume', 'requests', 'talk', 'help']);
  });

  it('carries the owner\'s mascot for an app\'s own spot (the web\'s home draws none)', () => {
    expect(homeModel({ c: HOME })!.mascot.look).toEqual({ shape: 'blob', eyes: 'round', accessory: 'none', color: '', name: '' });
    expect(homeModel({ c: { ...HOME, mascotShape: 'owl', mascotName: 'Hoot', widgetIconBgColor: '#123456' } })!.mascot).toEqual({
      look: { shape: 'owl', eyes: 'round', accessory: 'none', color: '', name: 'Hoot' },
      accent: '#123456',
    });
  });
});
