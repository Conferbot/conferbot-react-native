/**
 * Sensitive details visitors type, masked before anything is stored or sent:
 * payment cards (Luhn), bank accounts (IBAN, mod-97), government ids,
 * passwords and one-time codes said in a sentence, secret keys. Emails and
 * phone numbers are never masked.
 *
 * A port of the web widget's conferbot-widget/src/ts/chat/privacy/redact.ts
 * and privacy/index.ts (maskRecordEntry, maskValue). The web applies it to
 * the answer variables (index.ts _setAnswerVariable / _setAnswerVariableByKey)
 * and to the visitor's own record entries (index.ts _pushDataToRecord), and
 * the visitor's bubble shows the masked text. The transcript keeps what was
 * typed. Owners switch it off with customizations.redactSensitive === false.
 * The embed server runs the same rules as a backstop - keep the three in step.
 */

export const luhnOk = (digits: string): boolean => {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
};

export const ibanOk = (raw: string): boolean => {
  const s = raw.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
  const moved = s.slice(4) + s.slice(0, 4);
  let rem = 0;
  for (const ch of moved) {
    const v = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const c of v) rem = (rem * 10 + (c.charCodeAt(0) - 48)) % 97;
  }
  return rem === 1;
};

interface Rule {
  kind: string;
  re: RegExp;
  test?: (m: string) => boolean;
  label: (m: string, ...g: string[]) => string;
}

/** Rules in order: each replaces what it finds with a short label. */
const RULES: Rule[] = [
  // Payment cards: 13-19 digits, optionally in groups, passing Luhn.
  {
    kind: 'card',
    re: /\b(?:\d[ -]?){12,18}\d\b/g,
    test: (m) => {
      const d = m.replace(/\D/g, '');
      return d.length >= 13 && d.length <= 19 && luhnOk(d) && !/^(\d)\1+$/.test(d);
    },
    label: (m) => `[card •••• ${m.replace(/\D/g, '').slice(-4)}]`,
  },
  // Bank accounts (IBAN), with or without spaces.
  {
    kind: 'iban',
    re: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,4})?\b/gi,
    test: (m) => ibanOk(m),
    label: () => '[bank account hidden]',
  },
  // CVV / security code said with its name.
  { kind: 'cvv', re: /\b(cvv2?|cvc2?|security code)\s*(?:is|:|=|-)?\s*\d{3,4}\b/gi, label: (_m, name) => `${name} [hidden]` },
  // Passwords and PINs said in a sentence: "my password is hunter2".
  {
    kind: 'password',
    re: /\b(password|passcode|passwd|pwd|pin)\b(\s*(?:is|was|:|=|-)\s*)("[^"]{3,64}"|'[^']{3,64}'|\S{2,63}[^\s.,;:!?)])/gi,
    label: (_m, name, sep) => `${name}${sep}[hidden]`,
  },
  // One-time codes said in a sentence: "the code is 482913".
  {
    kind: 'code',
    re: /\b((?:verification|one[- ]time|otp|2fa|login|security)\s+code|otp)\b(\s*(?:is|:|=|-)?\s*)(\d{4,8})\b/gi,
    label: (_m, name, sep) => `${name}${sep}[hidden]`,
  },
  // US social security number.
  { kind: 'id', re: /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g, label: () => '[id hidden]' },
  // UAE Emirates ID: 784-YYYY-NNNNNNN-N.
  { kind: 'id', re: /\b784[- ]?\d{4}[- ]?\d{7}[- ]?\d\b/g, label: () => '[id hidden]' },
  // India Aadhaar: 12 digits in groups of 4 (first digit 2-9).
  { kind: 'id', re: /\b[2-9]\d{3}[ -]\d{4}[ -]\d{4}\b/g, label: () => '[id hidden]' },
  // Secret keys and tokens people paste by mistake.
  {
    kind: 'secret',
    re: /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b|\bsk-[A-Za-z0-9_-]{20,}\b|\bAKIA[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{30,}\b|\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,
    label: () => '[secret key hidden]',
  },
];

// Email addresses are left whole: digits in one ("name+1791557018838@...")
// are not a card number.
const EMAIL_SPLIT = /([A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/;

const maskPart = (part: string, found: string[]): string => {
  let out = part;
  for (const rule of RULES) {
    out = out.replace(rule.re, (...args: any[]) => {
      const m = args[0];
      const groups = args.slice(1, -2);
      if (rule.test && !rule.test(m)) return m;
      found.push(rule.kind);
      return rule.label(m, ...groups);
    });
  }
  return out;
};

/** Mask what is sensitive in `text`: { text, found } where found lists the kinds masked. */
export const redactText = (text: string): { text: string; found: string[] } => {
  if (typeof text !== 'string' || !text) return { text, found: [] };
  const found: string[] = [];
  const out = text
    .split(EMAIL_SPLIT)
    .map((part, i) => (i % 2 ? part : maskPart(part, found)))
    .join('');
  return { text: out, found: [...new Set(found)] };
};

const TEXT_FIELDS = ['text', 'message', 'userInput', 'value', 'display', 'answer'];

const isVisitorEntry = (entry: any): boolean => String(entry?.shape || entry?.type || '').startsWith('user-');

/** The visitor's own record entry with its text fields masked; other entries untouched. */
export const maskRecordEntry = <T>(entry: T): T => {
  const e: any = entry;
  if (!e || typeof e !== 'object' || !isVisitorEntry(e)) return entry;
  let found: string[] = [];
  for (const f of TEXT_FIELDS) {
    if (typeof e[f] !== 'string') continue;
    const r = redactText(e[f]);
    if (r.found.length) {
      e[f] = r.text;
      found = found.concat(r.found);
    }
  }
  if (found.length) e.redacted = Array.from(new Set([...(e.redacted || []), ...found]));
  return entry;
};

/** A value saved from an answer, masked when it is a string. */
export const maskValue = (value: any): any => (typeof value === 'string' ? redactText(value).text : value);
