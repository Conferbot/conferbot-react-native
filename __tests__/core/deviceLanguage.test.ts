import {
  deviceLocaleOf,
  normalizeLocale,
  visitorInsightsOf,
  resetDeviceLocale,
} from '../../src/core/deviceLanguage';
import { ChatState } from '../../src/core/state/ChatState';

describe('the device language (web visitorInsights.language.browser)', () => {
  it('writes locales as the browser does', () => {
    expect(normalizeLocale('de_DE')).toBe('de-DE');
    expect(normalizeLocale('en_US@calendar=gregorian')).toBe('en-US');
    expect(normalizeLocale('ja-JP-u-ca-japanese')).toBe('ja-JP');
    expect(normalizeLocale('zh-Hant-TW')).toBe('zh-Hant-TW');
    expect(normalizeLocale(' fr ')).toBe('fr');
    expect(normalizeLocale('')).toBe('');
    expect(normalizeLocale(null)).toBe('');
    expect(normalizeLocale('123')).toBe('');
    // The web cuts at 16 characters.
    expect(normalizeLocale('sr-Latn-RS-x-private-long')).toHaveLength(16);
  });

  it('prefers the phone language, then the region format, Android, Intl', () => {
    expect(deviceLocaleOf({ appleLanguages: ['es-MX', 'en-US'], appleLocale: 'en_US', intlLocale: 'en-US' })).toBe('es-MX');
    expect(deviceLocaleOf({ appleLanguages: [], appleLocale: 'nl_NL', intlLocale: 'en-US' })).toBe('nl-NL');
    expect(deviceLocaleOf({ androidLocale: 'pt_BR', intlLocale: 'en-US' })).toBe('pt-BR');
    expect(deviceLocaleOf({ intlLocale: 'it-IT' })).toBe('it-IT');
    expect(deviceLocaleOf({})).toBe('');
  });

  it('is the web snapshot with only the language', () => {
    expect(visitorInsightsOf('de-DE')).toEqual({ v: 1, language: { browser: 'de-DE' } });
    expect(visitorInsightsOf('')).toBeNull();
  });

  it('goes with every response record', () => {
    resetDeviceLocale();
    const data = new ChatState('s-1', 'b-1').buildResponseData();
    const expected = Intl.DateTimeFormat().resolvedOptions().locale;
    expect(data.visitorInsights).toEqual({ v: 1, language: { browser: normalizeLocale(expected) } });
  });
});
