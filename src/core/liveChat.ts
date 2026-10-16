/**
 * Live chat around a person or the AI, as the web widget shows it: where the
 * visitor stands in the queue, the "Sent / Delivered / Seen" line under
 * their latest message, an agent's translated message, and the small cards
 * that keep a conversation going when nobody can join (leave a message, an
 * email for the reply). The shapes are the embed-server's (queueService,
 * readReceipts, liveTranslation, aiFallback, handoverHandler). Pure.
 */
import { t, ownerTextOr, I18nKey } from './i18n';

export interface QueueStatus {
  status: 'waiting' | 'none' | 'busy';
  position: number | null;
  ahead: number | null;
  agentsOnline: number | null;
  estimateLabel: string | null;
  /** The server's estimate bucket (under_minute, about_1 ... longer), worded here. */
  estimateBucket: string | null;
  /** The routed team's usual first reply (embed-server replyTimeService). */
  typical: { bucket?: string | null; phrase?: string | null; wait?: string | null } | null;
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
  const bucket = typeof raw.estimate?.bucket === 'string' ? raw.estimate.bucket : null;
  const typical = raw.typical && typeof raw.typical === 'object' ? raw.typical : null;
  return { status, position: num(raw.position), ahead: num(raw.ahead), agentsOnline: num(raw.agentsOnline), estimateLabel: label, estimateBucket: bucket, typical };
};

// The server's estimate buckets (embed-server liveChat/queueService), worded here (web queueCard.ts ESTIMATE_WORDS).
const ESTIMATE_WORDS: Record<string, I18nKey> = {
  under_minute: 'queue.estimate.underMinute',
  about_1: 'queue.estimate.about1',
  about_2: 'queue.estimate.about2',
  about_3: 'queue.estimate.about3',
  few: 'queue.estimate.few',
  longer: 'queue.estimate.longer',
};

/**
 * The wait card's lines under the headline (web queueCard.ts estimateText
 * and the card's third line): the live estimate in the visitor's language,
 * else the usual wait ("Typical wait: a few minutes", core/replyTime.ts
 * typicalWait), else a calm promise; then the usual wait again under a
 * live estimate, when it says something else.
 */
export const waitCardLines = (q: QueueStatus | null | undefined, typical: string | null): { estimate: string; typical: string } => {
  let estimate: string;
  if (q && q.status === 'waiting' && q.estimateLabel) {
    const key = q.estimateBucket ? ESTIMATE_WORDS[q.estimateBucket] : undefined;
    estimate = key ? t(key) : q.estimateLabel;
  } else {
    estimate = typical || t('queue.soon');
  }
  return { estimate, typical: typical && estimate !== typical ? typical : '' };
};

/** "1st", "2nd", "3rd", "11th" */
export const ordinal = (n: number): string => {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] || 'th'}`;
};

/** The queue line: "You're next in line", "You're 3rd in line", "Connecting you to the team". */
export const queueLine = (q: QueueStatus): string => {
  // In the active language (web queueCard.ts positionText: queue.*; {ord} is English's "3rd").
  if (q.position === 1) return t('queue.next');
  if (q.position && q.position > 1) return t('queue.position', { n: q.position, ord: ordinal(q.position) });
  return t('queue.connecting');
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
  // The owner's words, else the web's (postChatRating.ts csat.*) in the visitor's language.
  const s = (v: unknown, key: I18nKey, stock: string[] = []) => ownerTextOr(typeof v === 'string' ? v.trim() : v, key, stock);
  return {
    ratingType: type,
    titleText: s(raw.titleText, 'csat.title'),
    subtitleText: s(raw.subtitleText, 'csat.subtitle'),
    thankYouText: s(raw.thankYouText, 'csat.thanks'),
    showFeedbackInput: raw.showFeedbackInput !== false,
    feedbackPlaceholder: s(raw.feedbackPlaceholder, 'csat.placeholder', ['Tell us more...']),
  };
};

/** submit-chat-rating payload for a rating of the given type. */
export const ratingPayload = (chatSessionId: string, type: CsatConfig['ratingType'], value: number | boolean, feedback?: string) => ({
  chatSessionId,
  source: 'post_chat_survey',
  ...(type === 'thumbs' ? { thumbsUp: value === true } : type === 'nps' ? { npsScore: Number(value) } : { csatScore: Number(value) }),
  ...(feedback && feedback.trim() ? { feedback: feedback.trim().slice(0, 1000) } : {}),
});

/**
 * The handover step's own post-chat survey as submit-chat-rating (the
 * server has no handover:survey): thumbs up is 1, numbers are an NPS 0-10,
 * stars and emojis a 1-5 score. null when there is no rating to send.
 */
export const surveyRatingPayload = (
  chatSessionId: string,
  style: string | undefined,
  response: { rating?: number; feedback?: string; comment?: string } | null | undefined
) => {
  const rating = Number(response?.rating);
  if (!chatSessionId || !Number.isFinite(rating)) return null;
  const feedback = response?.feedback ?? response?.comment;
  if (style === 'thumbs') return ratingPayload(chatSessionId, 'thumbs', rating === 1, feedback);
  if (style === 'numbers') return ratingPayload(chatSessionId, 'nps', rating, feedback);
  return ratingPayload(chatSessionId, 'stars', rating, feedback);
};

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

/** The visitor's email for leave a message: their own, else the latest email they answered. */
export const knownEmail = (visitorEmail: unknown, answerVariables: unknown): string => {
  if (isEmail(String(visitorEmail || ''))) return String(visitorEmail).trim();
  const values: unknown[] = Array.isArray(answerVariables)
    ? answerVariables.map((v: any) => v?.value)
    : answerVariables && typeof answerVariables === 'object'
      ? Object.values(answerVariables as any).map((v: any) => (v && typeof v === 'object' ? v.value : v))
      : [];
  for (let i = values.length - 1; i >= 0; i--) if (isEmail(String(values[i] ?? ''))) return String(values[i]).trim();
  return '';
};

/** What they last asked in their own words: the newest typed visitor message, not a button tap. */
export const lastQuestion = (record: unknown): string => {
  const list = Array.isArray(record) ? record : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const r: any = list[i];
    const kind = String(r?.shape || r?.type || '');
    if (kind === 'user-live-message' || kind === 'user-input' || kind === 'user-message' || kind === 'ask-question-answer') {
      const text = String(r?.text ?? r?.userInput ?? r?.value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text && !isEmail(text)) return text.slice(0, 2000);
    }
  }
  return '';
};
