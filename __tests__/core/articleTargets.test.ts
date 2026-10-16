/**
 * Where an AI reply's sources and the agent's rich article card open
 * (src/core/agentBot.ts), as the web widget's agentSources.ts chip and
 * agentRich.ts: a help article in the app when the help centre can show
 * it, else its public page.
 */
import { normalizeAgentSources, richArticleTarget, safeRich, sourceTarget } from '../../src/core/agentBot';

const ID = '64b7f0c2a1b2c3d4e5f60718';

describe('sourceTarget', () => {
  it('an article opens in the app when it can', () => {
    expect(sourceTarget({ title: 'Refunds', articleId: ID }, true)).toEqual({ kind: 'article', id: ID, title: 'Refunds' });
  });
  it('in the app before its public page', () => {
    expect(sourceTarget({ title: 'Refunds', articleId: ID, url: 'https://help.example.com/refunds' }, true)).toEqual({ kind: 'article', id: ID, title: 'Refunds' });
  });
  it('help centre off: its public page, else nowhere', () => {
    expect(sourceTarget({ title: 'Refunds', articleId: ID, url: 'https://help.example.com/refunds' }, false)).toEqual({ kind: 'url', url: 'https://help.example.com/refunds' });
    expect(sourceTarget({ title: 'Refunds', articleId: ID }, false)).toBeNull();
  });
  it('a page opens its url', () => {
    expect(sourceTarget({ title: 'Pricing', url: 'https://example.com/pricing' }, true)).toEqual({ kind: 'url', url: 'https://example.com/pricing' });
  });
  it('a bad id or url opens nothing', () => {
    expect(sourceTarget({ title: 'x', articleId: 'nope' }, true)).toBeNull();
    expect(sourceTarget({ title: 'x', url: 'javascript:alert(1)' }, true)).toBeNull();
    expect(sourceTarget(null, true)).toBeNull();
  });
  it('the server\'s sources, as normalized', () => {
    const [s] = normalizeAgentSources([{ title: 'Refunds', articleId: ID, url: null }]);
    expect(sourceTarget(s, true)).toEqual({ kind: 'article', id: ID, title: 'Refunds' });
  });
});

describe('richArticleTarget', () => {
  it('its public page first', () => {
    const rich = safeRich({ kind: 'article', articleId: ID, title: 'Refunds', url: 'https://help.example.com/refunds' });
    expect(richArticleTarget(rich, true)).toEqual({ kind: 'url', url: 'https://help.example.com/refunds' });
  });
  it('no public page: the article in the app', () => {
    const rich = safeRich({ kind: 'article', articleId: ID, title: 'Refunds', url: null });
    expect(richArticleTarget(rich, true)).toEqual({ kind: 'article', id: ID, title: 'Refunds' });
  });
  it('no public page and the help centre off: nothing', () => {
    const rich = safeRich({ kind: 'article', articleId: ID, title: 'Refunds' });
    expect(richArticleTarget(rich, false)).toBeNull();
  });
  it('not an article card', () => {
    expect(richArticleTarget({ kind: 'card', title: 'x' }, true)).toBeNull();
    expect(richArticleTarget(null, true)).toBeNull();
  });
});
