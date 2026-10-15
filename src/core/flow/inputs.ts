/**
 * Checks on what the visitor types or picks, ported from the web widget
 * (conferbot-widget/src/ts/chat/nodeKit.ts, nodeLogic.ts, utils/emailTypos.ts)
 * with its English messages (ts/i18n/en.ts).
 */
import { plainText } from './text';

/** English texts the steps say (web i18n en.ts). */
export const EN = {
  emailInvalid: 'Please enter a valid email address',
  emailTypo: (email: string) => `Did you mean ${email}? Press Enter to send it, or edit it.`,
  phoneInvalid: 'Please enter a valid phone number',
  numberLike: 'Please enter a number, like 42',
  numberBetween: (min: any, max: any) => `Please enter a number between ${min} and ${max}`,
  numberMin: (min: any) => `Please enter ${min} or more`,
  numberMax: (max: any) => `Please enter ${max} or less`,
  link: 'Please enter a link, like example.com',
  uploadOverSize: (mb: number) => `That file is over ${mb} MB - choose a smaller one.`,
  uploadNotAllowed: (types: string) => `That file can't be sent here - choose ${types}.`,
  uploadRetry: "That didn't upload - tap to try again.",
  skipped: 'Skipped',
  done: 'Done',
  somethingWrong: 'Something went wrong. Please try again.',
};

/**
 * The owner's own error text, or the default when they left it empty or kept
 * the stock English (web i18n ownerTextOr).
 */
export const ownerTextOr = (value: unknown, fallback: string, stockEnglish: string[] = []): string => {
  const v = typeof value === 'string' ? plainText(value) : '';
  if (!v || [fallback, ...stockEnglish].some((s) => plainText(s) === v)) return fallback;
  return value as string;
};

const EMAIL_RE =
  /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

export const isValidEmail = (value: any): boolean => EMAIL_RE.test(String(value ?? '').trim().toLowerCase());

/** "+1 (555) 123-4567" -> "+15551234567"; a leading "00" becomes "+". */
export const normalizePhone = (value: any): string => {
  const raw = String(value ?? '').trim();
  const plus = raw.startsWith('+') || raw.startsWith('00') ? '+' : '';
  let digits = raw.replace(/[\s().\-/\u00a0]/g, '').replace(/^\+/, '');
  if (plus && digits.startsWith('00')) digits = digits.slice(2);
  return plus + digits;
};

export const isValidPhone = (value: any): boolean => /^\+?\d{6,15}$/.test(normalizePhone(value));

/** "1,200" -> 1200, "3,5" -> 3.5; anything else null. */
export const parseNumberInput = (value: any): number | null => {
  const raw = String(value ?? '').trim().replace(/[\s_'\u00a0]/g, '');
  if (!/^[-+]?(\d+|\d{1,3}(,\d{3})+)?([.,]\d+)?$/.test(raw) || !/\d/.test(raw)) return null;
  const normalized = /^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw) ? raw.replace(/,/g, '') : raw.replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

/** A link people would type: no spaces, a dot, a 2+ letter ending. */
export const isValidLink = (value: any): boolean => {
  const raw = String(value ?? '').trim();
  if (!raw || /\s/.test(raw)) return false;
  const host = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split(/[/?#]/)[0];
  return /^[^.@]+(\.[^.]+)*\.[a-z]{2,}(:\d+)?$/i.test(host.replace(/^[^@]*@/, ''));
};

/** "conferbot.com" -> "https://conferbot.com"; mailto/tel kept; other schemes refused. */
export const linkHref = (value: any): string => {
  const raw = String(value ?? '').trim();
  if (!raw || /\s/.test(raw)) return '';
  if (/^(https?:\/\/|mailto:|tel:)/i.test(raw)) return raw;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) return '';
  return isValidLink(raw) ? `https://${raw}` : '';
};

const numOrNull = (v: any): number | null =>
  v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v);

/** ask-number-node: the refusal message, or null when the answer is fine. */
export const numberProblem = (value: any, data: any): string | null => {
  const n = parseNumberInput(value);
  const min = numOrNull(data?.enableConditions?.minVal);
  const max = numOrNull(data?.enableConditions?.maxVal);
  let message: string | null = null;
  if (n === null) message = EN.numberLike;
  else if (min !== null && max !== null && (n < min || n > max)) message = EN.numberBetween(min, max);
  else if (min !== null && n < min) message = EN.numberMin(min);
  else if (max !== null && n > max) message = EN.numberMax(max);
  if (message === null) return null;
  const custom = String(data?.invalidNumberResponse ?? '').replace(/<\/?[^>]+(>|$)/g, '').trim();
  if (!custom) return message;
  const cond = data?.enableConditions || {};
  const show = (v: any) => (v === undefined || v === null || v === '' ? '' : String(v));
  return custom.replace(/\{min\}/g, show(cond.minVal)).replace(/\{max\}/g, show(cond.maxVal));
};

/** The owner's phone error (new or older field name), or the default. */
export const phoneErrorText = (data: any): string => {
  const textOf = (v: any) => String(v ?? '').replace(/<\/?[^>]+(>|$)/g, '').trim();
  return ownerTextOr(textOf(data?.invalidPhoneResponse) || textOf(data?.incorrectPhoneNumberResponse), EN.phoneInvalid);
};

// ----- e-mail typos (utils/emailTypos.ts) -----
const DOMAINS = [
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'gmx.de', 'web.de', 'yandex.com', 'mail.com', 'zoho.com',
];
const TLD_FIXES: Record<string, string> = { con: 'com', cmo: 'com', ocm: 'com', comm: 'com', nt: 'net', orgg: 'org' };

const distance = (a: string, b: string): number => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length];
};

/** "jamie@gmial.com" -> "jamie@gmail.com"; null when the address looks right. */
export const suggestEmailFix = (email: string): string | null => {
  const m = String(email || '').trim().toLowerCase().match(/^([^\s@]+)@([^\s@]+)$/);
  if (!m) return null;
  const [, user, domain] = m;
  if (DOMAINS.includes(domain)) return null;
  let best: string | null = null;
  let bestD = 3;
  DOMAINS.forEach((d) => {
    const dist = distance(domain, d);
    if (dist < bestD && dist <= (d.length > 8 ? 2 : 1)) {
      bestD = dist;
      best = d;
    }
  });
  if (best) return `${user}@${best}`;
  const parts = domain.split('.');
  const tld = parts[parts.length - 1];
  if (parts.length >= 2 && TLD_FIXES[tld]) return `${user}@${[...parts.slice(0, -1), TLD_FIXES[tld]].join('.')}`;
  return null;
};

// ----- files -----
export const DEFAULT_MAX_FILE_MB = 5;

/** The allowed types in words: "PNG or IMAGE/JPEG", "images or PDF". */
export const fileTypesWords = (types: any): string => {
  const list = (Array.isArray(types) ? types : [])
    .map((t: any) => String(t).trim().toLowerCase())
    .filter(Boolean)
    .map((x: string) =>
      x.endsWith('/')
        ? x === 'image/'
          ? 'images'
          : x === 'video/'
          ? 'videos'
          : x.replace('/', '')
        : x.replace(/^\./, '').replace(/^application\//, '').toUpperCase()
    )
    .map((t: string) => (t === 'JPEG' ? 'JPG' : t));
  const unique = [...new Set(list)];
  if (!unique.length) return '';
  return unique.length === 1 ? unique[0] : `${unique.slice(0, -1).join(', ')} or ${unique[unique.length - 1]}`;
};

/** Why a picked file can't be sent, or null (web nodeLogic.fileUploadProblem). */
export const fileUploadProblem = (file: { name?: string; type?: string; size?: number }, data: any = {}): string | null => {
  const maxMb = Number(data?.maxFileSizeMB) > 0 ? Number(data.maxFileSizeMB) : DEFAULT_MAX_FILE_MB;
  if (Number(file?.size) > maxMb * 1024 * 1024) return EN.uploadOverSize(maxMb);
  const allowed: string[] = Array.isArray(data?.allowedFileTypes)
    ? data.allowedFileTypes.map((t: any) => String(t).trim().toLowerCase()).filter(Boolean)
    : [];
  if (allowed.length === 0) return null;
  const name = String(file?.name || '').toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop() || '' : '';
  const mime = String(file?.type || '').toLowerCase();
  const ok = allowed.some((t) =>
    t.includes('/') ? (t.endsWith('/') || t.endsWith('/*') ? mime.startsWith(t.replace(/\*$/, '')) : mime === t) : ext === t.replace(/^\./, '')
  );
  return ok ? null : EN.uploadNotAllowed(fileTypesWords(allowed) || allowed.join(', '));
};

/** Optional upload: flagged, or "(optional)" in the question. */
export const isOptionalUpload = (data: any): boolean => data?.optional === true || /\(optional\)/i.test(String(data?.questionText ?? ''));
