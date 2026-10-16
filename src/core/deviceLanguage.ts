/**
 * The visitor's language, sent with every response record as the web
 * widget's `visitorInsights.language.browser` (navigator.language,
 * conferbot-widget ts/visitors/insights.ts snapshot). The server reads it
 * (embed-server socket/handlers/messageHandler.js, `browserLanguage`) so the
 * AI answers a message too short to tell ("ok", "hi") in the visitor's own
 * language. An app has no page, so `language.page` and the browsing
 * history the web also sends are never set.
 *
 * Pure: the readers are passed in; `nativeLocaleSources()` below reads the
 * phone in React Native.
 */

/** Where a device locale can come from, first one set wins. */
export interface LocaleSources {
  /** iOS: the phone's preferred languages, most preferred first ("de-DE"). */
  appleLanguages?: unknown;
  /** iOS: the region format locale ("de_DE"). */
  appleLocale?: unknown;
  /** Android: the app's locale ("de_DE"). */
  androidLocale?: unknown;
  /** The JS engine's default locale (Intl). */
  intlLocale?: unknown;
}

// The web's own cut: whitespace collapsed, trimmed, at most 16 characters.
const cut = (v: unknown, n: number): string => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);

/**
 * A locale as the browser writes it: BCP 47 ("en-US"), not the platforms'
 * "en_US" or "en_US@calendar=..." / "en-US-u-ca-...".
 */
export const normalizeLocale = (raw: unknown): string => {
  const s = cut(raw, 64).split('@')[0].replace(/_/g, '-');
  if (!/^[A-Za-z]{2,3}(-|$)/.test(s)) return '';
  const unicodeExt = s.search(/-u-/i);
  return cut(unicodeExt > 0 ? s.slice(0, unicodeExt) : s, 16);
};

/** The device's language, or '' when nothing says. */
export const deviceLocaleOf = (src: LocaleSources): string => {
  const preferred = Array.isArray(src.appleLanguages) ? src.appleLanguages[0] : undefined;
  for (const candidate of [preferred, src.appleLocale, src.androidLocale, src.intlLocale]) {
    const locale = normalizeLocale(candidate);
    if (locale) return locale;
  }
  return '';
};

/**
 * The response record's `visitorInsights`: the web's snapshot shape with
 * only the language (the server keeps it once it has more than `v`).
 * Null when the language is unknown.
 */
export const visitorInsightsOf = (locale: string): { v: 1; language: { browser: string } } | null => {
  const browser = cut(locale, 16);
  return browser ? { v: 1, language: { browser } } : null;
};

/** The phone's locale sources in React Native (each read can be missing). */
export const nativeLocaleSources = (): LocaleSources => {
  const out: LocaleSources = {};
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { NativeModules } = require('react-native');
    const settings = NativeModules?.SettingsManager?.settings;
    out.appleLanguages = settings?.AppleLanguages;
    out.appleLocale = settings?.AppleLocale;
    out.androidLocale = NativeModules?.I18nManager?.localeIdentifier;
  } catch {
    /* not in React Native */
  }
  try {
    out.intlLocale = Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    /* no Intl */
  }
  return out;
};

let cached: string | null = null;

/** The device's language, read once per app run. */
export const deviceLocale = (): string => {
  if (cached === null) cached = deviceLocaleOf(nativeLocaleSources());
  return cached;
};

/** Tests: read the device again. */
export const resetDeviceLocale = (): void => {
  cached = null;
};
