import {
  MAILCHAT_TEXT,
  TRANSCRIPT_EMAIL_PATH,
  isTranscriptEmail,
  transcriptEmailBody,
  transcriptEmailError,
  transcriptEmailResult,
} from '../../src/core/emailTranscript';

describe('Email me this chat (web emailTranscript.ts)', () => {
  it('checks the address as the web does', () => {
    expect(isTranscriptEmail('ada@example.com')).toBe(true);
    expect(isTranscriptEmail('  ada@example.co ')).toBe(true);
    expect(isTranscriptEmail('ada@example.c')).toBe(false);
    expect(isTranscriptEmail('ada@example')).toBe(false);
    expect(isTranscriptEmail('a da@example.com')).toBe(false);
    expect(isTranscriptEmail('')).toBe(false);
  });

  it('posts the session and the address to the mobile path (the bot is the header\'s)', () => {
    expect(TRANSCRIPT_EMAIL_PATH).toBe('/chat/transcript-email');
    expect(transcriptEmailBody('s-1', ' ada@example.com ')).toEqual({ chatSessionId: 's-1', email: 'ada@example.com' });
  });

  it('reads the answer: sent only on success true', () => {
    expect(transcriptEmailResult(200, { success: true })).toEqual({ ok: true });
    expect(transcriptEmailResult(200, { success: false, message: "We couldn't email the transcript. Please try again later." })).toEqual({
      ok: false,
      message: "We couldn't email the transcript. Please try again later.",
    });
    expect(transcriptEmailResult(400, { success: false, message: 'Please enter a valid email address.' }).message).toBe('Please enter a valid email address.');
    expect(transcriptEmailResult(429, { error: true, message: 'Too many requests. Please try again later.' })).toEqual({
      ok: false,
      message: 'Too many requests. Please try again later.',
    });
    expect(transcriptEmailResult(500, { success: false })).toEqual({ ok: false });
    expect(transcriptEmailResult(201, { success: 'yes' })).toEqual({ ok: false });
  });

  it('says the server\'s reason, else ours', () => {
    expect(transcriptEmailError({ ok: false, message: 'Too many requests. Please try again later.' })).toBe('Too many requests. Please try again later.');
    expect(transcriptEmailError({ ok: false })).toBe(MAILCHAT_TEXT.sendFailed);
    expect(transcriptEmailError(null)).toBe(MAILCHAT_TEXT.sendFailed);
    expect(MAILCHAT_TEXT.sent('ada@example.com')).toBe('Sent! Check your inbox at ada@example.com');
  });
});
