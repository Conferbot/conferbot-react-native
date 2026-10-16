/** Typing preview (web ts/chat/typingPreview.ts and index.ts updateVisitorDraft). */
import { DRAFT_MAX, cleanDraft, createDraftSender, draftPreviewOn, isSensitiveField } from '../../src/core/typingPreview';

const clock = () => {
  let now = 0;
  const timers: Array<{ at: number; fn: () => void; id: number }> = [];
  let seq = 0;
  return {
    now: () => now,
    setTimer: (fn: () => void, ms: number) => {
      const id = ++seq;
      timers.push({ at: now + ms, fn, id });
      return id;
    },
    clearTimer: (id: number) => {
      const i = timers.findIndex((t) => t.id === id);
      if (i >= 0) timers.splice(i, 1);
    },
    advance(ms: number) {
      now += ms;
      timers.sort((a, b) => a.at - b.at);
      while (timers.length && timers[0].at <= now) timers.shift()!.fn();
    },
  };
};

describe('typing preview', () => {
  it('trims and caps a draft', () => {
    expect(cleanDraft('  hi  ')).toBe('hi');
    expect(cleanDraft('x'.repeat(DRAFT_MAX + 10))).toHaveLength(DRAFT_MAX);
    expect(cleanDraft(5)).toBe('');
  });

  it('sends at most every 300 ms, the latest text trailing, and one empty draft to clear', () => {
    const c = clock();
    const sent: string[] = [];
    const s = createDraftSender((d) => sent.push(d), c);
    s.update('h');
    s.update('he');
    s.update('hel');
    expect(sent).toEqual(['h']);
    c.advance(299);
    expect(sent).toEqual(['h']);
    c.advance(1);
    expect(sent).toEqual(['h', 'hel']);
    s.update('hel ');
    c.advance(300);
    expect(sent).toEqual(['h', 'hel']); // the same text after trimming: nothing new
    s.clear();
    s.clear();
    expect(sent).toEqual(['h', 'hel', '']);
    s.update('   ');
    expect(sent).toEqual(['h', 'hel', '']);
  });

  it('never previews a secret field', () => {
    expect(isSensitiveField({ secureTextEntry: true })).toBe(true);
    expect(isSensitiveField({ textContentType: 'oneTimeCode' })).toBe(true);
    expect(isSensitiveField({ textContentType: 'creditCardNumber' })).toBe(true);
    expect(isSensitiveField({ autoComplete: 'cc-number' })).toBe(true);
    expect(isSensitiveField({ autoComplete: 'sms-otp' })).toBe(true);
    expect(isSensitiveField({ autoComplete: 'email' })).toBe(false);
    expect(isSensitiveField(undefined)).toBe(false);
  });

  it('is on only with a person in the chat, unless the owner turned it off', () => {
    expect(draftPreviewOn({}, true)).toBe(true);
    expect(draftPreviewOn({ visitorDraftPreview: false }, true)).toBe(false);
    expect(draftPreviewOn({}, false)).toBe(false);
  });
});
