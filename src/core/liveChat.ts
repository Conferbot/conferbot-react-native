/**
 * Live chat around a person or the AI, as the web widget shows it: where the
 * visitor stands in the queue, the "Sent / Delivered / Seen" line under
 * their latest message, an agent's translated message, and the small cards
 * that keep a conversation going when nobody can join (leave a message, an
 * email for the reply). The shapes are the embed-server's (queueService,
 * readReceipts, liveTranslation, aiFallback, handoverHandler). Pure.
 */

export interface QueueStatus {
  status: 'waiting' | 'none' | 'busy';
  position: number | null;
  ahead: number | null;
  agentsOnline: number | null;
  estimateLabel: string | null;
}

export interface HandoverWaiting {
  offline: boolean;
  reason: 'offline' | 'busy';
  backAt: string | null;
  askEmail: boolean;
  email: string | null;
}

export interface AgentTranslation {
  from: string;
  to: string;
  original: string;
}

export type ReceiptState = 'sent' | 'delivered' | 'seen';

export interface ReceiptMarks {
  deliveredMessageId: string;
  seenMessageId: string;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** queue-status as the visitor sees it, or null when they are not waiting. */
export const queueStatusOf = (raw: any): QueueStatus | null => {
  if (!raw || typeof raw !== 'object') return null;
  const status = raw.status === 'waiting' || raw.status === 'busy' ? raw.status : 'none';
  if (status === 'none') return null;
  const label = typeof raw.estimate?.label === 'string' && raw.estimate.label.trim() ? raw.estimate.label.trim() : null;
  return { status, position: num(raw.position), ahead: num(raw.ahead), agentsOnline: num(raw.agentsOnline), estimateLabel: label };
};

/** "1st", "2nd", "3rd", "11th" */
export const ordinal = (n: number): string => {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] || 'th'}`;
};

/** The queue line: "You're next in line", "You're 3rd in line", "Connecting you to the team". */
export const queueLine = (q: QueueStatus): string => {
  if (q.position === 1) return "You're next in line";
  if (q.position && q.position > 1) return `You're ${ordinal(q.position)} in line`;
  return 'Connecting you to the team';
};

/** handover-waiting: nobody could take the chat (the AI took it back). */
export const handoverWaitingOf = (raw: any): HandoverWaiting | null => {
  if (!raw || typeof raw !== 'object') return null;
  return {
    offline: raw.offline === true,
    reason: raw.reason === 'offline' ? 'offline' : 'busy',
    backAt: typeof raw.backAt === 'string' ? raw.backAt : null,
    askEmail: raw.askEmail === true,
    email: typeof raw.email === 'string' && raw.email ? raw.email : null,
  };
};

/** An agent message sent in the visitor's language: the original kept. */
export const agentTranslationOf = (data: any): AgentTranslation | null => {
  const t = data?.translation;
  if (!t || typeof t.original !== 'string' || !t.original.trim() || typeof t.to !== 'string') return null;
  return { from: String(t.from || ''), to: t.to, original: t.original };
};

export const receiptMarksOf = (raw: any): ReceiptMarks => ({
  deliveredMessageId: String(raw?.deliveredMessageId || ''),
  seenMessageId: String(raw?.seenMessageId || ''),
});

const isVisitorLive = (r: any) => r?.shape === 'user-live-message' || r?.shape === 'user-live-message-file';
const isAgentReply = (r: any) =>
  ['agent-message', 'agent-message-file', 'agent-message-audio', 'agent-message-rich'].includes(r?.shape || r?.type);

/**
 * The line under the visitor's latest live message while it is the newest
 * thing in the chat (an agent reply takes it away): its id and state, or
 * null. Only while a person is on the other end - an AI answers at once.
 */
export const visitorReceiptOf = (record: any[], marks: ReceiptMarks): { id: string; state: ReceiptState } | null => {
  const list = Array.isArray(record) ? record : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const r = list[i];
    if (isAgentReply(r)) return null;
    if (isVisitorLive(r)) {
      const id = String(r._id || r.id || '');
      if (!id) return null;
      const order = (target: string) => list.findIndex((x: any) => String(x?._id || x?.id || '') === target);
      const at = i;
      const seenAt = marks.seenMessageId ? order(marks.seenMessageId) : -1;
      const deliveredAt = marks.deliveredMessageId ? order(marks.deliveredMessageId) : -1;
      const state: ReceiptState = seenAt >= at ? 'seen' : deliveredAt >= at ? 'delivered' : 'sent';
      return { id, state };
    }
  }
  return null;
};

/** The newest agent message id: what the visitor reports delivered / seen. */
export const latestAgentMessageId = (record: any[]): string => {
  const list = Array.isArray(record) ? record : [];
  for (let i = list.length - 1; i >= 0; i--) {
    if (isAgentReply(list[i])) return String(list[i]._id || list[i].id || '');
  }
  return '';
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isEmail = (v: string): boolean => EMAIL.test(String(v || '').trim());

/** "back around 9:00" from an ISO time, in the device's clock; null when unknown. */
export const backAtLabel = (iso: string | null, now = new Date()): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? time : `${d.toLocaleDateString(undefined, { weekday: 'long' })} ${time}`;
};

/** Visitor uploads in a live chat: on unless the owner turned them off. */
export const visitorUploadsOn = (customizations: any): boolean => customizations?.enableVisitorFileUpload !== false;

/** Post-chat rating: from the bot's csatConfig; an explicit enabled:false turns it off. */
export interface CsatConfig {
  ratingType: 'stars' | 'thumbs' | 'emoji' | 'nps';
  titleText: string;
  subtitleText: string;
  thankYouText: string;
  showFeedbackInput: boolean;
  feedbackPlaceholder: string;
}

export const csatConfigOf = (raw: any): CsatConfig | null => {
  if (!raw || typeof raw !== 'object' || raw.enabled === false || raw.enabled !== true) return null;
  const type = ['stars', 'thumbs', 'emoji', 'nps'].includes(raw.ratingType) ? raw.ratingType : 'stars';
  const s = (v: unknown, d: string) => (typeof v === 'string' && v.trim() ? v.trim() : d);
  return {
    ratingType: type,
    titleText: s(raw.titleText, 'How was your experience?'),
    subtitleText: s(raw.subtitleText, 'Your feedback helps us improve'),
    thankYouText: s(raw.thankYouText, 'Thank you for your feedback!'),
    showFeedbackInput: raw.showFeedbackInput !== false,
    feedbackPlaceholder: s(raw.feedbackPlaceholder, 'Tell us more...'),
  };
};

/** submit-chat-rating payload for a rating of the given type. */
export const ratingPayload = (chatSessionId: string, type: CsatConfig['ratingType'], value: number | boolean, feedback?: string) => ({
  chatSessionId,
  source: 'post_chat_survey',
  ...(type === 'thumbs' ? { thumbsUp: value === true } : type === 'nps' ? { npsScore: Number(value) } : { csatScore: Number(value) }),
  ...(feedback && feedback.trim() ? { feedback: feedback.trim().slice(0, 1000) } : {}),
});

// "See original" / "See translation" in the visitor's language (they are
// reading a translation, so an English label would be the one untranslated
// line). The web widget's list (ts/chat/translatedMessage.ts).
const TRANSLATION_LABELS: Record<string, [string, string]> = {
  en: ['See original', 'See translation'],
  es: ['Ver original', 'Ver traducción'],
  fr: ["Voir l'original", 'Voir la traduction'],
  de: ['Original anzeigen', 'Übersetzung anzeigen'],
  pt: ['Ver original', 'Ver tradução'],
  it: ['Vedi originale', 'Vedi traduzione'],
  nl: ['Origineel bekijken', 'Vertaling bekijken'],
  pl: ['Zobacz oryginał', 'Zobacz tłumaczenie'],
  tr: ['Orijinali gör', 'Çeviriyi gör'],
  ru: ['Показать оригинал', 'Показать перевод'],
  uk: ['Показати оригінал', 'Показати переклад'],
  ar: ['عرض النص الأصلي', 'عرض الترجمة'],
  hi: ['मूल देखें', 'अनुवाद देखें'],
  ja: ['原文を表示', '翻訳を表示'],
  ko: ['원문 보기', '번역 보기'],
  zh: ['查看原文', '查看翻译'],
  id: ['Lihat asli', 'Lihat terjemahan'],
  vi: ['Xem bản gốc', 'Xem bản dịch'],
  th: ['ดูต้นฉบับ', 'ดูคำแปล'],
  sv: ['Visa original', 'Visa översättning'],
};

export const translationLabels = (lang: unknown): [string, string] => {
  const key = String(lang || '').toLowerCase().split(/[-_]/)[0];
  return TRANSLATION_LABELS[key] || TRANSLATION_LABELS.en;
};

const FILE_SHAPES = ['agent-message-file', 'user-live-message-file', 'user-file-upload'];

/** The file a message carries (an agent's file, the visitor's upload), or null. */
export const fileUrlOf = (message: any): string | null => {
  if (!message) return null;
  const isFile = FILE_SHAPES.includes(message.shape) || FILE_SHAPES.includes(message.type);
  const url = message.file || (isFile ? message.url : null);
  return typeof url === 'string' && url.trim() ? url.trim() : null;
};

/** A file URL ready to open: the relative /media proxy path on the API origin; never script / data URLs. */
export const resolveMediaUrl = (url: string, origin: string): string | null => {
  const raw = String(url || '').trim();
  if (!raw || /^(?:javascript|vbscript|data):/i.test(raw.replace(/\s/g, ''))) return null;
  if (raw.startsWith('/')) return `${String(origin || '').replace(/\/+$/, '')}${raw}`;
  return raw;
};

export const isImageUrl = (url: string, mimeType?: string): boolean =>
  /^image\//.test(String(mimeType || '')) || /\.(png|jpe?g|gif|webp|heic|bmp)(\?|#|$)/i.test(String(url || ''));

/** The name shown on a file row: the record's own, or the URL's last part. */
export const fileNameOf = (message: any, url: string): string => {
  const own = String(message?.fileName || '').trim();
  if (own) return own;
  const last = decodeURIComponent(String(url).split(/[?#]/)[0].split('/').pop() || '');
  return last || 'File';
};
