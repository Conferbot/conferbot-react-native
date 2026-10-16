/**
 * While you wait for a person (src/core/waitArticles.ts): the articles for
 * the visitor's question (web tests/waitArticles.test.js), the server's
 * queue-help card and "That solved it" (web special.ts _wireQueue), on a
 * fake clock.
 */
import {
  WAIT_BEFORE_MS,
  answersFor,
  createWaitHelp,
  findArticle,
  flattenArticles,
  helpItemsOf,
  isRealQuestion,
  keywordsOf,
  waitArticlesFor,
  waitQuestion,
  type HelpCardState,
} from '../../src/core/waitArticles';

const clock = () => {
  let now = 0;
  let id = 0;
  const timers = new Map<number, { fn: () => void; at: number }>();
  return {
    set: (fn: () => void, ms: number) => (timers.set(++id, { fn, at: now + ms }), id),
    clear: (t: unknown) => timers.delete(t as number),
    tick(ms: number) {
      const until = now + ms;
      for (;;) {
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > until) break;
        timers.delete(next[0]);
        now = next[1].at;
        next[1].fn();
      }
      now = until;
    },
    size: () => timers.size,
  };
};

const CATS = [
  {
    name: 'Billing',
    articles: [
      { _id: '1', title: 'Downloading invoices', description: 'Find every invoice in one place.' },
      { _id: '2', title: 'Changing your plan', description: 'Upgrade, downgrade or cancel at any time.' },
    ],
  },
];
const ON = { enableKnowledgeBase: true };

describe('waitArticlesFor (web waitArticles.ts)', () => {
  it('the articles that may answer their question, at most two', () => {
    expect(waitArticlesFor(ON, 'Where can I download my invoices?', CATS, []).map((a) => a.id)).toEqual(['1']);
    expect(waitArticlesFor(ON, 'Where can I download my invoices?', CATS, [])[0]).toEqual({
      kind: 'article',
      id: '1',
      title: 'Downloading invoices',
      description: 'Find every invoice in one place.',
    });
    expect(waitArticlesFor(ON, 'billing', CATS, []).length).toBeLessThanOrEqual(2);
    expect(waitArticlesFor(ON, 'how do I change my plan', CATS, []).map((a) => a.id)).toEqual(['2']);
  });

  it('nothing with the help centre off, no question, or nothing that fits', () => {
    expect(waitArticlesFor({ enableKnowledgeBase: false }, 'download my invoices', CATS, [])).toEqual([]);
    expect(waitArticlesFor({}, 'download my invoices', CATS, [])).toEqual([]);
    expect(waitArticlesFor(ON, '', CATS, [])).toEqual([]);
    expect(waitArticlesFor(ON, 'do you ship to mars', CATS, [])).toEqual([]);
  });

  it('the help centre once each, categories first, recent articles after', () => {
    const all = flattenArticles(CATS, [{ _id: '1', title: 'dup' }, { _id: '9', title: ' Recent ', content: '<p>Hi&amp;there</p>', category: { name: 'X' } }, { title: 'no id' }]);
    expect(all.map((a) => [a._id, a.title, a.categoryName])).toEqual([
      ['1', 'Downloading invoices', 'Billing'],
      ['2', 'Changing your plan', 'Billing'],
      ['9', 'Recent', 'X'],
    ]);
    expect(all[2]._text).toBe('Hi there');
    expect(findArticle('2', CATS, [])?.title).toBe('Changing your plan');
    expect(findArticle('9', CATS, [{ _id: '9', title: 'R' }])?.title).toBe('R');
    expect(findArticle('nope', CATS, [])).toBeNull();
    expect(keywordsOf('How do I change my plan?')).toEqual(['change', 'plan']);
    expect(answersFor(all, 'invoices', 4).map((a) => a._id)).toEqual(['1']);
  });
});

describe('the question (web special.ts lastVisitorText)', () => {
  it('the newest real question, not "hi" and not an ask for a person', () => {
    expect(isRealQuestion('hi')).toBe(false);
    expect(isRealQuestion('Where can I download my invoices?')).toBe(true);
    expect(isRealQuestion('me@example.com')).toBe(false);
    const record = [
      { type: 'user-message', text: 'Where can I download my invoices?' },
      { type: 'bot-message', text: 'Let me check that for you right now.' },
      { type: 'user-message', text: 'Can I talk to a real person please' },
      { type: 'user-message', text: 'thanks' },
    ];
    expect(waitQuestion(record)).toBe('Where can I download my invoices?');
    expect(waitQuestion([])).toBe('');
    expect(waitQuestion(null)).toBe('');
  });
});

describe('helpItemsOf (embed-server queueHelp.js payload)', () => {
  it('articles and pages, an id and a title each; a page only with an http address', () => {
    expect(
      helpItemsOf({
        chatSessionId: 's',
        offer: 1,
        items: [
          { kind: 'article', id: 'a1', title: 'Invoices', description: 'Find them', score: 0.8 },
          { kind: 'page', id: 'p1', title: 'Pricing', url: 'https://example.com/pricing', description: '' },
          { kind: 'page', id: 'p2', title: 'Bad', url: 'javascript:alert(1)' },
          { id: 'x', title: '  ' },
          null,
        ],
      })
    ).toEqual([
      { kind: 'article', id: 'a1', title: 'Invoices', description: 'Find them' },
      { kind: 'page', id: 'p1', title: 'Pricing', url: 'https://example.com/pricing' },
      { kind: 'page', id: 'p2', title: 'Bad' },
    ]);
    expect(helpItemsOf(undefined)).toEqual([]);
  });
});

describe('createWaitHelp', () => {
  const setup = (o: { question?: string; c?: any; joined?: boolean } = {}) => {
    const k = clock();
    const cards: (HelpCardState | null)[] = [];
    const help = createWaitHelp({
      customizations: () => o.c ?? ON,
      question: () => o.question ?? 'Where can I download my invoices?',
      articles: () => ({ categories: CATS, recentArticles: [] }),
      joined: () => !!o.joined,
      onChange: (c) => cards.push(c),
      setTimer: k.set,
      clearTimer: k.clear,
    });
    return { k, help, cards, card: () => help.card() };
  };

  it('WAIT_BEFORE_MS into a wait: the articles for their question, no "That solved it"', () => {
    const { k, help, card } = setup();
    help.startWait();
    k.tick(WAIT_BEFORE_MS - 1);
    expect(card()).toBeNull();
    k.tick(1);
    expect(card()).toMatchObject({ key: 1, solvable: false, settled: false, items: [{ id: '1', title: 'Downloading invoices' }] });
    expect(help.solving()).toBeNull();
  });

  it('nothing when the wait ends first, a person is here, nothing fits or there is no question', () => {
    const a = setup();
    a.help.startWait();
    a.k.tick(3000);
    a.help.endWait();
    a.k.tick(10000);
    expect(a.card()).toBeNull();
    for (const o of [{ joined: true }, { question: 'do you ship to mars' }, { question: '' }, { c: {} }]) {
      const s = setup(o);
      s.help.startWait();
      s.k.tick(WAIT_BEFORE_MS);
      expect(s.card()).toBeNull();
    }
  });

  it('the server keeps a queue: its pick only, ours stays out', () => {
    const { k, help, card } = setup();
    help.startWait();
    help.queueStatus({ status: 'waiting', position: 1 });
    k.tick(WAIT_BEFORE_MS);
    expect(card()).toBeNull();
    // A reload: queue-status carries the help it was offered.
    help.queueStatus({ status: 'waiting', help: { items: [{ kind: 'article', id: 'a1', title: 'Invoices' }], offer: 1 } });
    expect(card()).toMatchObject({ solvable: true, items: [{ id: 'a1' }] });
    help.queueStatus({ status: 'none', help: { items: [{ id: 'zz', title: 'Other' }] } });
    expect(card()!.items[0].id).toBe('a1');
  });

  it('queue-help: the card, replaced only by new items', () => {
    const { help, card, cards } = setup();
    help.startWait();
    help.queueHelp({ items: [{ kind: 'article', id: 'a1', title: 'Invoices' }], offer: 1 });
    expect(card()).toMatchObject({ key: 1, solvable: true });
    help.queueHelp({ items: [{ kind: 'article', id: 'a1', title: 'Invoices' }], offer: 1 });
    expect(cards).toHaveLength(1);
    help.queueHelp({ items: [{ kind: 'article', id: 'a2', title: 'Plans' }], offer: 2 });
    expect(card()).toMatchObject({ key: 2, items: [{ id: 'a2' }] });
    help.queueHelp({ items: [] });
    expect(card()!.key).toBe(2);
  });

  it('That solved it: the opened row (else the first) goes; ok leaves, else the button comes back', () => {
    const { help, card } = setup();
    help.startWait();
    help.queueHelp({ items: [{ id: 'a1', title: 'One' }, { id: 'a2', title: 'Two' }] });
    help.open('a2');
    expect(help.solving()?.id).toBe('a2');
    expect(card()!.busy).toBe(true);
    // Busy: a second press sends nothing.
    expect(help.solving()).toBeNull();
    help.solved(false);
    expect(card()).toMatchObject({ busy: false, done: false });
    expect(help.solving()?.id).toBe('a2');
    help.solved(true);
    expect(card()).toMatchObject({ busy: false, done: true });
    // Done: no more server cards for this wait.
    help.queueHelp({ items: [{ id: 'a3', title: 'Three' }] });
    expect(card()!.items[0].id).toBe('a1');
    // The wait settling keeps the done line.
    help.endWait();
    expect(card()).toMatchObject({ settled: true, done: true });
  });

  it('the wait over: the card stays as history, without the button; a new wait gets new cards', () => {
    const { help, card } = setup();
    help.startWait();
    help.queueHelp({ items: [{ id: 'a1', title: 'One' }] });
    help.endWait();
    expect(card()).toMatchObject({ settled: true, solvable: false });
    expect(help.solving()).toBeNull();
    help.startWait();
    help.queueHelp({ items: [{ id: 'a1', title: 'One' }] });
    expect(card()).toMatchObject({ key: 2, settled: false, solvable: true });
  });

  it('reset: no card, and our own articles again', () => {
    const { k, help, card } = setup();
    help.queueHelp({ items: [{ id: 'a1', title: 'One' }] });
    help.reset();
    expect(card()).toBeNull();
    help.startWait();
    k.tick(WAIT_BEFORE_MS);
    expect(card()).toMatchObject({ solvable: false });
  });
});
