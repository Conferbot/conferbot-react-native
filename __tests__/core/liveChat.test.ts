import {
  surveyRatingPayload,
  backAtLabel,
  csatConfigOf,
  fileNameOf,
  fileUrlOf,
  handoverWaitingOf,
  isEmail,
  isImageUrl,
  latestAgentMessageId,
  ordinal,
  queueLine,
  queueStatusOf,
  ratingPayload,
  receiptMarksOf,
  resolveMediaUrl,
  translationLabels,
  visitorReceiptOf,
  visitorUploadsOn,
  agentTranslationOf,
  knownEmail,
  lastQuestion,
} from '../../src/core/liveChat';

describe('liveChat', () => {
  describe('queue', () => {
    it('reads a waiting status and drops "none"', () => {
      expect(queueStatusOf({ status: 'none' })).toBeNull();
      expect(queueStatusOf(null)).toBeNull();
      expect(queueStatusOf({ status: 'waiting', position: 2, ahead: 1, agentsOnline: 3, estimate: { label: ' 2 min ' } })).toEqual({
        status: 'waiting',
        position: 2,
        ahead: 1,
        agentsOnline: 3,
        estimateLabel: '2 min',
      });
    });

    it('says where the visitor stands', () => {
      expect(queueLine({ status: 'waiting', position: 1 } as any)).toBe("You're next in line");
      expect(queueLine({ status: 'waiting', position: 3 } as any)).toBe("You're 3rd in line");
      expect(queueLine({ status: 'busy', position: null } as any)).toBe('Connecting you to the team');
    });

    it('writes ordinals', () => {
      expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal)).toEqual([
        '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st', '111th',
      ]);
    });
  });

  it('reads handover-waiting', () => {
    expect(handoverWaitingOf({ offline: true, reason: 'offline', backAt: '2026-10-15T09:00:00Z', askEmail: true })).toEqual({
      offline: true,
      reason: 'offline',
      backAt: '2026-10-15T09:00:00Z',
      askEmail: true,
      email: null,
    });
    expect(handoverWaitingOf({ email: 'a@b.co' })?.reason).toBe('busy');
  });

  it('labels back-at times, null when unknown', () => {
    expect(backAtLabel(null)).toBeNull();
    expect(backAtLabel('nope')).toBeNull();
    const now = new Date('2026-10-14T10:00:00');
    expect(backAtLabel(new Date('2026-10-14T15:30:00').toISOString(), now)).not.toMatch(/day/);
    expect(backAtLabel(new Date('2026-10-16T09:00:00').toISOString(), now)).toMatch(/Friday/);
  });

  it('keeps a translation only with an original', () => {
    expect(agentTranslationOf({ translation: { from: 'en', to: 'es', original: 'Hi' } })).toEqual({ from: 'en', to: 'es', original: 'Hi' });
    expect(agentTranslationOf({ translation: { to: 'es', original: ' ' } })).toBeNull();
    expect(translationLabels('es-MX')).toEqual(['Ver original', 'Ver traducción']);
    expect(translationLabels('xx')).toEqual(['See original', 'See translation']);
  });

  describe('receipts', () => {
    const record = [
      { _id: 'a1', type: 'agent-message' },
      { _id: 'v1', shape: 'user-live-message' },
      { _id: 'v2', shape: 'user-live-message' },
    ];
    it('marks the latest visitor message sent, delivered or seen', () => {
      expect(visitorReceiptOf(record, receiptMarksOf({}))).toEqual({ id: 'v2', state: 'sent' });
      expect(visitorReceiptOf(record, receiptMarksOf({ deliveredMessageId: 'v2' }))).toEqual({ id: 'v2', state: 'delivered' });
      expect(visitorReceiptOf(record, receiptMarksOf({ deliveredMessageId: 'v2', seenMessageId: 'v2' }))).toEqual({ id: 'v2', state: 'seen' });
      // Seen an earlier message only: the latest is not seen yet.
      expect(visitorReceiptOf(record, receiptMarksOf({ seenMessageId: 'v1' }))).toEqual({ id: 'v2', state: 'sent' });
    });
    it('goes away once the agent replies', () => {
      expect(visitorReceiptOf([...record, { _id: 'a2', type: 'agent-message' }], receiptMarksOf({}))).toBeNull();
    });
    it('finds the latest agent message', () => {
      expect(latestAgentMessageId([...record, { id: 'f1', shape: 'agent-message-file' }, { _id: 'v3', shape: 'user-live-message' }])).toBe('f1');
      expect(latestAgentMessageId([])).toBe('');
    });
  });

  it('checks emails', () => {
    expect(isEmail(' a@b.co ')).toBe(true);
    expect(isEmail('a@b')).toBe(false);
    expect(isEmail('')).toBe(false);
  });

  it('keeps visitor uploads on unless turned off', () => {
    expect(visitorUploadsOn(null)).toBe(true);
    expect(visitorUploadsOn({})).toBe(true);
    expect(visitorUploadsOn({ enableVisitorFileUpload: false })).toBe(false);
  });

  describe('csat', () => {
    it('is off unless enabled', () => {
      expect(csatConfigOf(undefined)).toBeNull();
      expect(csatConfigOf({})).toBeNull();
      expect(csatConfigOf({ enabled: false, ratingType: 'stars' })).toBeNull();
    });
    it('fills the web defaults', () => {
      expect(csatConfigOf({ enabled: true, ratingType: 'bogus' })).toEqual({
        ratingType: 'stars',
        titleText: 'How was your experience?',
        subtitleText: 'Your feedback helps us improve',
        thankYouText: 'Thank you for your feedback!',
        showFeedbackInput: true,
        // The web's placeholder (i18n csat.placeholder).
        feedbackPlaceholder: 'Tell us more (optional)',
      });
    });
    it('builds the rating payload per type', () => {
      expect(ratingPayload('s1', 'stars', 4, ' great ')).toEqual({ chatSessionId: 's1', source: 'post_chat_survey', csatScore: 4, feedback: 'great' });
      expect(ratingPayload('s1', 'thumbs', false)).toEqual({ chatSessionId: 's1', source: 'post_chat_survey', thumbsUp: false });
      expect(ratingPayload('s1', 'nps', 9, '  ')).toEqual({ chatSessionId: 's1', source: 'post_chat_survey', npsScore: 9 });
    });
  });

  describe('files', () => {
    it('finds the file a message carries', () => {
      expect(fileUrlOf({ shape: 'agent-message-file', file: '/media/1' })).toBe('/media/1');
      expect(fileUrlOf({ shape: 'user-live-message-file', url: 'https://x/a.png' })).toBe('https://x/a.png');
      expect(fileUrlOf({ type: 'bot-message', url: 'https://x/a.png' })).toBeNull();
    });
    it('resolves the /media proxy and refuses script urls', () => {
      expect(resolveMediaUrl('/api/v1/media/1', 'https://api.example.com/')).toBe('https://api.example.com/api/v1/media/1');
      expect(resolveMediaUrl('java\nscript:alert(1)', 'https://a')).toBeNull();
      expect(resolveMediaUrl('https://cdn/x.pdf', 'https://a')).toBe('https://cdn/x.pdf');
    });
    it('tells images and names files', () => {
      expect(isImageUrl('https://x/a.JPG?x=1')).toBe(true);
      expect(isImageUrl('/media/abc', 'image/png')).toBe(true);
      expect(isImageUrl('/media/abc')).toBe(false);
      expect(fileNameOf({ fileName: 'Invoice.pdf' }, '/media/1')).toBe('Invoice.pdf');
      expect(fileNameOf({}, 'https://x/My%20File.pdf?sig=1')).toBe('My File.pdf');
    });
  });

  it('prefills leave a message as the web widget does', () => {
    expect(knownEmail('jo@example.com', [])).toBe('jo@example.com');
    expect(knownEmail('', [{ key: 'email', value: 'old@a.co' }, { key: 'e2', value: 'new@a.co' }])).toBe('new@a.co');
    expect(knownEmail(undefined, { email: { value: 'x@y.co' } })).toBe('x@y.co');
    expect(knownEmail('', [])).toBe('');
    expect(lastQuestion([{ shape: 'user-live-message', text: 'Do you ship to <b>Oman</b>?' }, { shape: 'user-input-response', text: 'Jo' }])).toBe('Do you ship to Oman ?');
    expect(lastQuestion([{ shape: 'user-live-message', text: 'jo@example.com' }])).toBe('');
  });
});

describe('surveyRatingPayload (handover survey as submit-chat-rating)', () => {
  it('maps each rating style to the server fields', () => {
    expect(surveyRatingPayload('s', 'stars', { rating: 5, comment: ' ok ' })).toEqual({ chatSessionId: 's', source: 'post_chat_survey', csatScore: 5, feedback: 'ok' });
    expect(surveyRatingPayload('s', 'thumbs', { rating: 1 })).toEqual({ chatSessionId: 's', source: 'post_chat_survey', thumbsUp: true });
    expect(surveyRatingPayload('s', 'thumbs', { rating: 0 })).toEqual({ chatSessionId: 's', source: 'post_chat_survey', thumbsUp: false });
    expect(surveyRatingPayload('s', 'numbers', { rating: 9 })).toEqual({ chatSessionId: 's', source: 'post_chat_survey', npsScore: 9 });
    expect(surveyRatingPayload('s', 'stars', {})).toBeNull();
    expect(surveyRatingPayload('', 'stars', { rating: 3 })).toBeNull();
  });
});
