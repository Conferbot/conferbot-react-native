/**
 * "Email me this chat" (web ts/chat/emailTranscript.ts): the visitor gets
 * the whole conversation in their inbox, and the address they give is kept
 * on the conversation like any email they leave.
 *
 * Sent by the embed server, only ever to the address typed here and
 * rate-limited (5 per 15 minutes per IP, shared with the web route). The web posts to
 * /api/v1/chat/transcript-email with the botId in the body; an app posts
 * to the mobile base path, /api/v1/mobile/chat/transcript-email, and the
 * bot comes from its X-Bot-ID header (embed-server #193).
 *
 * Pure: the request's path and body, and how its answer reads.
 */

/** The web's address check (emailTranscript.ts EMAIL_RE). */
export const TRANSCRIPT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const isTranscriptEmail = (email: unknown): boolean => TRANSCRIPT_EMAIL_RE.test(String(email ?? '').trim());

/** Under the mobile API base (ConferBotEndpoints.apiBaseUrl, ".../api/v1/mobile"). */
export const TRANSCRIPT_EMAIL_PATH = '/chat/transcript-email';

export const transcriptEmailBody = (chatSessionId: string, email: string) => ({ chatSessionId, email: String(email).trim() });

/** The web's English strings (i18n en: chat.menu.emailChat, mailchat.*, form.*). */
export const MAILCHAT_TEXT = {
  menu: 'Email me this chat',
  title: 'Email me this chat',
  sub: "We'll send the whole conversation to your inbox.",
  placeholder: 'you@company.com',
  label: 'Your email',
  send: 'Send',
  sending: 'Sending…',
  cancel: 'Cancel',
  checkEmail: 'Please check the email address.',
  sendFailed: "We couldn't send it just now. Please try again.",
  sent: (email: string) => `Sent! Check your inbox at ${email}`,
} as const;

export interface TranscriptEmailResult {
  ok: boolean;
  message?: string;
}

/**
 * The server's answer read as the web reads it: sent only on a 2xx with
 * `success: true`; otherwise its message, if it gave one (an invalid
 * address is a 400, an unknown session a 200 with success false, the rate
 * limit a 429 with `message`).
 */
export const transcriptEmailResult = (status: number, data: any): TranscriptEmailResult => {
  const ok = status >= 200 && status < 300 && data?.success === true;
  const message = typeof data?.message === 'string' && data.message.trim() ? data.message.trim().slice(0, 200) : undefined;
  return ok ? { ok: true } : { ok: false, ...(message ? { message } : {}) };
};

/**
 * What the card says when it did not go: the server's words (it words them
 * in English, as the SDK is), else ours.
 */
export const transcriptEmailError = (r: TranscriptEmailResult | null | undefined): string =>
  (r && !r.ok && r.message) || MAILCHAT_TEXT.sendFailed;
