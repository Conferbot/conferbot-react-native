/**
 * ChatWidgetWithKB follows the owner's help centre switch (src/core/home.ts
 * kbWidgetOn), as the web's core/helpCentre.ts helpCentreOn; the host's
 * enableKnowledgeBase prop is only an explicit override.
 */
import { kbWidgetCategories, kbWidgetOn } from '../../src/core/home';

describe('kbWidgetOn', () => {
  it('no prop: the owner\'s enableKnowledgeBase', () => {
    expect(kbWidgetOn(undefined, { enableKnowledgeBase: true })).toBe(true);
    expect(kbWidgetOn(undefined, { enableKnowledgeBase: false })).toBe(false);
    expect(kbWidgetOn(undefined, {})).toBe(false);
    expect(kbWidgetOn(null, { enableKnowledgeBase: 'yes' })).toBe(false);
  });
  it('off until the bot\'s settings arrive', () => {
    expect(kbWidgetOn(undefined, null)).toBe(false);
  });
  it('the prop wins either way', () => {
    expect(kbWidgetOn(true, { enableKnowledgeBase: false })).toBe(true);
    expect(kbWidgetOn(true, null)).toBe(true);
    expect(kbWidgetOn(false, { enableKnowledgeBase: true })).toBe(false);
  });
});

describe('kbWidgetCategories', () => {
  const server = [
    { _id: 'c1', name: 'Billing', articles: [{ _id: 'a1', title: 'Refunds' }, { _id: 'a2', title: 'Draft', reviewStatus: 'draft' }] },
    { _id: 'c2', name: 'Empty', articles: [] },
    { _id: 'c3', name: 'Only drafts', articles: [{ _id: 'a3', reviewStatus: 'draft' }] },
  ];
  it('the host\'s categories when it passes any', () => {
    const host = [{ _id: 'h', name: 'Host', articles: [] }];
    expect(kbWidgetCategories(host, server)).toBe(host);
  });
  it('else the bot\'s help centre, published articles only, no empty topics', () => {
    const out = kbWidgetCategories([], server);
    expect(out.map((c) => c._id)).toEqual(['c1']);
    expect(out[0].articles.map((a: any) => a._id)).toEqual(['a1']);
    expect(kbWidgetCategories(undefined, null)).toEqual([]);
  });
});
