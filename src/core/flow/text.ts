/**
 * Text helpers the flow steps share, ported from the web widget
 * (conferbot-widget/src/ts/chat/nodeLogic.ts, richNodes.ts plainText,
 * utils/helpers.ts _stripHtmlAndDecodeEntities). Pure: no state.
 *
 * The flow-node spec (scripts/parity/flows/nodes.spec.json, engine.interpolation)
 * is the reference: {x}, ${x}, {{x}}, ${ANSWERS.x} and $${x} fill from the
 * answers; an unknown, null or "" value shows nothing and the gap it leaves
 * is tidied; values are HTML-escaped.
 */

export type VariableLookup = (key: string) => any;

const plainScalar = (v: any) => v === null || typeof v !== 'object';
const plainList = (v: any) => Array.isArray(v) && v.every(plainScalar);

/**
 * A saved value as text: a list reads "a, b"; a matrix answer
 * ({ row: column } or a list of columns per row) "Row: Col · Row2: Col2";
 * any other object is JSON.
 */
export const variableText = (value: any): string => {
  if (plainList(value)) return value.join(', ');
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value);
    if (entries.length && entries.every(([, v]) => plainScalar(v) || plainList(v))) {
      return entries.map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ');
    }
  }
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
};

/** Text made safe inside HTML. */
export const escapeHtmlText = (value: any): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** {x}, ${x}, $${x}, {{x}} and ${ANSWERS.x}: group 1/3 the "$" prefix, 2/4 the key. */
const PLACEHOLDER = /(\$\$|\$)?\{\{\s*((?:ANSWERS\.)?\w+)\s*\}\}|(\$\$|\$)?\{\s*((?:ANSWERS\.)?\w+)\s*\}/g;
const GAP = '\u0000';

/** A gap left by an empty placeholder, tidied ("Hey ${name}, welcome" -> "Hey, welcome"). */
// The gap marker is a NUL: no owner text contains one.
/* eslint-disable no-control-regex */
const closeGaps = (text: string): string =>
  text.indexOf(GAP) === -1
    ? text
    : text
        .replace(/(^|>)[ \t ]*\u0000+[ \t ]*[,;:]?[ \t ]*/g, '$1')
        .replace(/[ \t ]*\u0000+(?=[ \t ]*([,.!?;:)]|<|$))/g, '')
        .replace(/([ \t ])\u0000+[ \t ]+/g, '$1')
        .replace(/\u0000/g, '');
/* eslint-enable no-control-regex */

export interface FillOptions {
  /** "html" (default) escapes the values; "raw" leaves them as they are. */
  mode?: 'html' | 'raw';
}

const lookupKey = (lookup: VariableLookup, key: string): any => {
  let value = lookup(key);
  if ((value === null || value === undefined) && key.startsWith('ANSWERS.')) value = lookup(key.slice(8));
  return value;
};

/** Fill the placeholders in owner text from the answers (web nodeLogic.fillVariables). */
export const fillVariables = (text: any, lookup: VariableLookup, options: FillOptions = {}): string => {
  const raw = options.mode === 'raw';
  const filled = String(text ?? '').replace(PLACEHOLDER, (_match, p1, k1, p2, k2) => {
    const prefix = p1 ?? p2;
    const key: string = k1 ?? k2;
    const value = lookupKey(lookup, key);
    if (value === null || value === undefined || value === '') return GAP;
    const shown = raw ? variableText(value) : escapeHtmlText(variableText(value));
    return prefix === '$$' ? `$${shown}` : shown;
  });
  return closeGaps(filled);
};

/**
 * Fill the variables in a link: a value in the query or hash is URL-encoded,
 * one before it goes in as is; an unknown one stays as written.
 */
export const fillLinkVariables = (link: any, lookup: VariableLookup): string => {
  const text = String(link ?? '').trim();
  let out = '';
  let last = 0;
  text.replace(PLACEHOLDER, (match: string, p1: any, k1: any, p2: any, k2: any, offset: number) => {
    out += text.slice(last, offset);
    last = offset + match.length;
    const key: string = k1 ?? k2;
    const value = lookupKey(lookup, key);
    if (value === null || value === undefined) {
      out += match;
      return match;
    }
    const shown = variableText(value).trim();
    const inQuery = /[?#]/.test(out);
    out += ((p1 ?? p2) === '$$' ? '$' : '') + (inQuery ? encodeURIComponent(shown) : shown);
    return match;
  });
  return out + text.slice(last);
};

/** The visitor's first name, capitalised: "deepak gopal" -> "Deepak". */
export const firstNameOf = (value: any): string => {
  const first = String(value ?? '').trim().split(/\s+/)[0] || '';
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : '';
};

/** True when owner HTML shows nothing ("<p><br></p>"). */
export const isBlankHtml = (html: any): boolean => {
  const s = String(html ?? '');
  if (/<(img|iframe|video|audio|svg)\b/i.test(s)) return false;
  return (
    s
      .replace(/<\/?[^>]+(>|$)/g, '')
      .replace(/&nbsp;|&#160;| |\ufeff|&#xFEFF;/gi, '')
      .trim() === ''
  );
};

/**
 * The ask-name greeting by first name: none set at all is the default
 * "Nice to meet you, X"; one cleared in the builder is "" (no bubble).
 */
export const nameGreetingHtml = (template: any, name: any): string => {
  const first = escapeHtmlText(firstNameOf(name));
  if (template === undefined || template === null) return first ? `Nice to meet you, ${first}` : '';
  if (isBlankHtml(template)) return '';
  return closeGaps(String(template).replace(/\$?\{\{?\s*name\s*\}?\}/g, first || GAP));
};

/** Owner HTML as one line of plain text (web richNodes.plainText). */
export const plainText = (value: any): string =>
  String(value ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/** Tags stripped and entities decoded, trimmed (web helpers _stripHtmlAndDecodeEntities). */
export const stripHtmlAndDecode = (html: any): string => {
  if (!html) return '';
  return String(html)
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9A-Fa-f]+);/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
    .trim();
};

/**
 * Owner HTML as the text a native bubble shows: paragraphs and <br> keep
 * their line breaks, tags go, entities are decoded.
 */
export const bubbleText = (html: any): string =>
  String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/**
 * Owner HTML for the HTML step, made safe: no <script>, no on* handlers,
 * no javascript:/vbscript: URLs (web nodeLogic.sanitizeOwnerHtml).
 */
export const sanitizeOwnerHtml = (html: any): string =>
  String(html ?? '')
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script\b[^>]*\/?>/gi, '')
    .replace(/<(object|embed|base|meta|link)\b[^>]*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(
      /\s(href|src|action|formaction|xlink:href)\s*=\s*("|')?\s*(javascript|vbscript|data:text\/html)[^"'\s>]*("|')?/gi,
      ' $1="#"'
    );

/** The field holding the text a step shows, by type (web nodeLogic PROMPT_FIELD). */
export const PROMPT_FIELD: Record<string, string> = {
  'welcome-node': 'text',
  'message-node': 'text',
  'ask-name-node': 'questionText',
  'ask-email-node': 'questionText',
  'ask-phone-number-node': 'questionText',
  'ask-number-node': 'questionText',
  'ask-url-node': 'questionText',
  'ask-location-node': 'questionText',
  'ask-custom-question-node': 'questionText',
  'ask-file-node': 'questionText',
  'ask-multiple-questions-node': 'message',
  'calendar-node': 'calendarPrompt',
  'n-choices-node': 'choicePrompt',
  'n-select-option-node': 'selectPrompt',
  'n-check-options-node': 'checkOptionsPrompt',
  'image-choice-node': 'questionText',
  'carousel-node': 'questionText',
  'rating-choice-node': 'questionText',
  'yes-or-no-choice-node': 'questionText',
  'opinion-scale-choice-node': 'questionText',
  'user-redirect-node': 'redirectPrompt',
  'navigate-node': 'navigatePrompt',
  'quiz-node': 'quizPrompt',
  'human-handover-node': 'handoverMessage',
  'dynamic-choices-node': 'questionText',
  'consent-node': 'questionText',
  'product-card-node': 'questionText',
  'slider-node': 'questionText',
  'datetime-node': 'questionText',
  'ranking-node': 'questionText',
  'otp-node': 'questionText',
  'address-node': 'questionText',
  'matrix-node': 'questionText',
  'ai-extract-node': 'questionText',
  'ai-route-node': 'questionText',
  'kb-answer-node': 'questionText',
  'signature-node': 'questionText',
};

/** A step's own text with the variables filled in; undefined when it shows none. */
export const renderedTextFor = (node: any, lookup: VariableLookup): string | undefined => {
  const field = PROMPT_FIELD[node?.type];
  const raw = field ? node?.data?.[field] : undefined;
  if (typeof raw !== 'string' || raw.trim() === '') return undefined;
  return fillVariables(raw, lookup);
};

/** A message with no text or an image with no picture is skipped (no typing). */
export const isEmptyContentStep = (step: any): boolean => {
  if (step?.type === 'message-node') return isBlankHtml(step?.data?.text);
  if (step?.type === 'image-node') return String(step?.data?.image ?? '').trim() === '';
  return false;
};

/** Ticked options in list order, not click order. */
export const inListOrder = (picked: any[], list: any[]): any[] => {
  const order = (Array.isArray(list) ? list : []).map((v) => String(v));
  const rank = (v: any) => {
    const i = order.indexOf(String(v));
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return (Array.isArray(picked) ? picked : [])
    .map((v, i) => ({ v, i }))
    .sort((a, b) => rank(a.v) - rank(b.v) || a.i - b.i)
    .map((x) => x.v);
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** A step's length for pacing: its message or question, tags stripped. */
const wordsOf = (step: any): number => {
  const d = step?.data || {};
  const raw = d.text ?? d.questionText ?? d.calendarPrompt ?? d.message ?? '';
  return String(raw).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().length;
};

/**
 * How long the typing dots show before a bot step (web nodeLogic.paceFor):
 * after the visitor spoke, clamp(500 + len*12, 700, 1800); right after a
 * step that moved on by itself, time to read it, then a shorter beat.
 */
export const paceFor = (previous: any, next: any, followsBotStep: boolean): number => {
  const nextLen = wordsOf(next);
  if (!followsBotStep) return Math.round(clamp(500 + nextLen * 12, 700, 1800));
  const read = clamp(wordsOf(previous) * 22, 350, 2200);
  return Math.round(read + clamp(250 + nextLen * 6, 300, 900));
};

const AUTO_ADVANCE_TYPES = new Set([
  'welcome-node',
  'message-node',
  'image-node',
  'video-node',
  'audio-node',
  'file-node',
  'html-node',
  'user-redirect-node',
]);

/** True when the step before was a bot step that moved on by itself. */
export const followsAutoAdvanceStep = (previousType: any): boolean => AUTO_ADVANCE_TYPES.has(String(previousType || ''));
