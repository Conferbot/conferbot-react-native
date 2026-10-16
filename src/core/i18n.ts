/**
 * The SDK's own words, in the visitor's language. A port of the web
 * widget's conferbot-widget/src/ts/i18n.ts; the tables are generated from
 * its ts/i18n/{en,nl,fr,de,es}.ts (scripts/parity/i18n/gen.js), with the
 * words only the SDK draws added in all five (sdk-strings.json).
 *
 *   t(key, vars?)          the active language's string, {name} filled in
 *   tFor(lang, key, vars)  the same for a given language (pure, for tests)
 *   tPlural(base, n)       `base.one` for 1, else `base.other`
 *   resolveLanguage(setting, deviceLanguages)
 *                          "auto" (or absent, or unknown) picks the first
 *                          supported device language, else English
 *   setWidgetLanguage(setting) when the bot's settings arrive, before the
 *                          chat is drawn (the provider does it)
 *
 * In an app "auto" means the phone's languages, most preferred first (the
 * web reads navigator.languages). Only the SDK's chrome lives here; what
 * the owner wrote (greetings, starters, bot messages) is shown as written.
 *
 * A key missing from a language falls back to English, then to the key
 * itself, so a half-finished translation never shows a blank.
 */
import { en, I18nKey } from './i18n/en.data';
import { nl } from './i18n/nl.data';
import { fr } from './i18n/fr.data';
import { de } from './i18n/de.data';
import { es } from './i18n/es.data';
import { nativeLocaleSources, normalizeLocale, LocaleSources } from './deviceLanguage';

export type { I18nKey };
export type WidgetLanguage = 'en' | 'nl' | 'fr' | 'de' | 'es';
export type WidgetLanguageSetting = 'auto' | WidgetLanguage;
export type I18nVars = Record<string, string | number | null | undefined>;

export const SUPPORTED_LANGUAGES: WidgetLanguage[] = ['en', 'nl', 'fr', 'de', 'es'];

/** Each language's own name, for pickers. */
export const LANGUAGE_NAMES: Record<WidgetLanguage, string> = {
  en: 'English',
  nl: 'Nederlands',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
};

export const DICTIONARIES: Record<WidgetLanguage, Partial<Record<I18nKey, string>>> = { en, nl, fr, de, es };

const isSupported = (v: unknown): v is WidgetLanguage =>
  typeof v === 'string' && (SUPPORTED_LANGUAGES as string[]).includes(v);

/** A stored setting: a supported code, else "auto" (old bots have none). */
export const normalizeWidgetLanguage = (raw: unknown): WidgetLanguageSetting => {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return isSupported(v) ? v : 'auto';
};

/** "nl-BE" -> "nl"; anything unsupported -> null. */
export const baseLanguageOf = (tag: unknown): WidgetLanguage | null => {
  if (typeof tag !== 'string') return null;
  const base = tag.trim().toLowerCase().split(/[-_]/)[0];
  return isSupported(base) ? base : null;
};

/** The language to draw in: the owner's choice, or the first supported device language, or English. */
export const resolveLanguage = (setting: unknown, deviceLanguages?: readonly string[] | null): WidgetLanguage => {
  const chosen = normalizeWidgetLanguage(setting);
  if (chosen !== 'auto') return chosen;
  for (const tag of deviceLanguages || []) {
    const base = baseLanguageOf(tag);
    if (base) return base;
  }
  return 'en';
};

/**
 * The phone's languages, most preferred first, as BCP 47 (the web's
 * navigator.languages): iOS's whole AppleLanguages list, then its region
 * locale, Android's locale, the JS engine's. Repeats dropped.
 */
export const deviceLanguagesOf = (src: LocaleSources): string[] => {
  const list = [
    ...(Array.isArray(src.appleLanguages) ? src.appleLanguages : []),
    src.appleLocale,
    src.androidLocale,
    src.intlLocale,
  ];
  const out: string[] = [];
  for (const raw of list) {
    const tag = normalizeLocale(raw);
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out;
};

/** The phone's languages (none outside React Native and Intl). */
export const deviceLanguages = (): string[] => {
  try {
    return deviceLanguagesOf(nativeLocaleSources());
  } catch {
    return [];
  }
};

const fill = (text: string, vars?: I18nVars): string =>
  vars
    ? text.replace(/\{(\w+)\}/g, (whole, name) =>
        vars[name] === undefined || vars[name] === null ? whole : String(vars[name])
      )
    : text;

/** A string in a given language, {name} placeholders filled. */
export const tFor = (lang: WidgetLanguage, key: I18nKey, vars?: I18nVars): string => {
  const text = DICTIONARIES[lang]?.[key] ?? (en as Record<string, string>)[key] ?? key;
  return fill(text, vars);
};

let active: WidgetLanguage = 'en';
let activeTag = 'en';
const listeners = new Set<(lang: WidgetLanguage) => void>();

/** Picks the language to draw in; returns it. */
export const setWidgetLanguage = (
  setting: unknown,
  languages: readonly string[] = deviceLanguages()
): WidgetLanguage => {
  const before = active;
  active = resolveLanguage(setting, languages);
  // A regional tag of the same language keeps its region for dates and
  // numbers (nl-BE writes dates the Belgian way).
  const regional = (languages || []).find((tag) => baseLanguageOf(tag) === active);
  activeTag = regional && /^[a-z]{2}[-_][a-z]{2}$/i.test(regional) ? regional.replace('_', '-') : active;
  if (before !== active) listeners.forEach((fn) => fn(active));
  return active;
};

/** The language being drawn in. */
export const widgetLanguage = (): WidgetLanguage => active;

/** A BCP 47 tag for Intl and toLocale*String (e.g. "nl-BE"). */
export const widgetLocale = (): string => activeTag;

/** Told when the language changes (the provider re-draws). Returns the unsubscribe. */
export const onWidgetLanguage = (fn: (lang: WidgetLanguage) => void): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/** A string in the active language. */
export const t = (key: I18nKey, vars?: I18nVars): string => tFor(active, key, vars);

/** "{n} thing" vs "{n} things": the `.one` key for 1, else `.other`. */
export const tPlural = (base: string, n: number, vars?: I18nVars): string =>
  t(`${base}.${n === 1 ? 'one' : 'other'}` as I18nKey, { n, ...(vars || {}) });

/**
 * The week's day names, Sunday first, in the widget's language: "long",
 * "short" (Sun, zo, dim.) or "narrow" (S, Z, D). English keeps the SDK's
 * own spellings for `english`.
 */
export const weekdayNames = (style: 'long' | 'short' | 'narrow' = 'short', english?: string[]): string[] => {
  if (active === 'en' && english) return english;
  try {
    const f = new Intl.DateTimeFormat(activeTag, { weekday: style, timeZone: 'UTC' });
    // 2023-01-01 was a Sunday.
    return Array.from({ length: 7 }, (_, i) => f.format(new Date(Date.UTC(2023, 0, 1 + i))));
  } catch {
    return english || ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  }
};

/** Month names, January first, in the widget's language ("short": Jan, janv.). */
export const monthNames = (style: 'long' | 'short' = 'short', english?: string[]): string[] => {
  if (active === 'en' && english) return english;
  try {
    const f = new Intl.DateTimeFormat(activeTag, { month: style, timeZone: 'UTC' });
    return Array.from({ length: 12 }, (_, i) => f.format(new Date(Date.UTC(2023, i, 1))));
  } catch {
    return english || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  }
};

/**
 * An owner field that may still hold the stock English default (stored by
 * an older dashboard): the default is shown in the visitor's language, a
 * value the owner wrote themselves as written.
 */
const plainText = (s: string) =>
  s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().replace(/[.!]$/, '').toLowerCase();

export const ownerTextOr = (value: unknown, key: I18nKey, stockEnglish: string[] = []): string => {
  const v = typeof value === 'string' ? plainText(value) : '';
  if (!v || [(en as Record<string, string>)[key], ...stockEnglish].some((s) => plainText(s) === v)) return t(key);
  return value as string;
};

/**
 * A field a new bot is created with in English ("Hi there 👋"): that exact
 * stock value is shown in the visitor's language. Empty stays empty, and
 * anything the owner wrote is theirs.
 */
export const stockText = (value: unknown, key: I18nKey, stockEnglish: string[] = []): string => {
  if (typeof value !== 'string' || !value.trim()) return typeof value === 'string' ? value : '';
  const v = plainText(value);
  return [(en as Record<string, string>)[key], ...stockEnglish].some((s) => plainText(s) === v) ? t(key) : value;
};

/**
 * A table of words read in the active language each time (SDK only): the
 * core modules keep their `HELPFUL_TEXT.ask` shape, and each read is
 * `t(key)` at that moment.
 */
export const localized = <K extends string>(keys: Record<K, I18nKey>): Readonly<Record<K, string>> => {
  const out = {} as Record<K, string>;
  for (const name of Object.keys(keys) as K[]) {
    Object.defineProperty(out, name, { enumerable: true, get: () => t(keys[name]) });
  }
  return out;
};
