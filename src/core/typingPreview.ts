/**
 * Typing preview ("sneak peek"): while a person is chatting with the
 * visitor, the agent sees what the visitor is typing before it is sent.
 * Ported from conferbot-widget src/ts/chat/typingPreview.ts (cleanDraft,
 * createDraftSender) and its wiring in src/index.ts (updateVisitorDraft:
 * off when the owner set visitorDraftPreview to false, never for a secret
 * field, only while a person is in the chat).
 *
 * The composer calls update() on every change; drafts go out as
 * `visitor-draft {chatSessionId, draft}` at most every DRAFT_THROTTLE_MS
 * (the latest text always follows, trailing), trimmed and capped at
 * DRAFT_MAX. clear() sends one empty draft on send, or when the field is
 * emptied, so the agent's preview goes away at once. The server relays
 * drafts only to the conversation's agents and never keeps them
 * (embed-server liveChat/visitorDraft). Pure.
 */

export const DRAFT_MAX = 500;
export const DRAFT_THROTTLE_MS = 300;

export const cleanDraft = (value: unknown): string => (typeof value === 'string' ? value.trim().slice(0, DRAFT_MAX) : '');

/** Never preview what looks like a secret or card data (a TextInput's props, as the web reads the field). */
export const isSensitiveField = (field: { secureTextEntry?: boolean; textContentType?: string; autoComplete?: string } | null | undefined): boolean => {
  if (!field) return false;
  if (field.secureTextEntry) return true;
  const type = String(field.textContentType || '').toLowerCase();
  if (type === 'password' || type === 'newpassword' || type === 'onetimecode' || type.startsWith('creditcard')) return true;
  const auto = String(field.autoComplete || '').toLowerCase();
  return auto.startsWith('cc-') || auto.includes('password') || auto === 'one-time-code' || auto === 'sms-otp';
};

/** Whether drafts go to the agent at all: the owner allows it and a person is in the chat. */
export const draftPreviewOn = (customizations: any, chattingWithPerson: boolean): boolean =>
  customizations?.visitorDraftPreview !== false && chattingWithPerson;

export interface DraftSender {
  update: (text: string) => void;
  clear: () => void;
}

export const createDraftSender = (
  send: (draft: string) => void,
  {
    intervalMs = DRAFT_THROTTLE_MS,
    now = () => Date.now(),
    setTimer = (fn: () => void, ms: number): any => setTimeout(fn, ms),
    clearTimer = (t: any) => clearTimeout(t),
  }: {
    intervalMs?: number;
    now?: () => number;
    setTimer?: (fn: () => void, ms: number) => any;
    clearTimer?: (t: any) => void;
  } = {}
): DraftSender => {
  let lastSent = '';
  let lastSentAt = -Infinity;
  let pending: string | null = null;
  let timer: any = null;

  const flush = () => {
    timer = null;
    if (pending === null) return;
    const draft = pending;
    pending = null;
    if (draft === lastSent) return;
    lastSent = draft;
    lastSentAt = now();
    send(draft);
  };

  const sender: DraftSender = {
    update(text: string) {
      const draft = cleanDraft(text);
      if (!draft) return sender.clear();
      pending = draft;
      if (timer) return;
      const wait = intervalMs - (now() - lastSentAt);
      if (wait <= 0) flush();
      else timer = setTimer(flush, wait);
    },
    clear() {
      if (timer) clearTimer(timer);
      timer = null;
      pending = null;
      if (lastSent === '') return;
      lastSent = '';
      lastSentAt = now();
      send('');
    },
  };
  return sender;
};
