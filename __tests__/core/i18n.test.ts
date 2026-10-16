/**
 * The SDK's own words in five languages (core/i18n.ts, a port of the web's
 * conferbot-widget/src/ts/i18n.ts): how the language is chosen, the
 * fallbacks, {name} and plurals, and every key in every language.
 */
import { execFileSync } from 'child_process';
import * as path from 'path';
import {
  t,
  tFor,
  tPlural,
  setWidgetLanguage,
  widgetLanguage,
  widgetLocale,
  resolveLanguage,
  normalizeWidgetLanguage,
  baseLanguageOf,
  deviceLanguagesOf,
  onWidgetLanguage,
  ownerTextOr,
  stockText,
  localized,
  weekdayNames,
  monthNames,
  DICTIONARIES,
  SUPPORTED_LANGUAGES,
  I18nKey,
} from '../../src/core/i18n';
import { en } from '../../src/core/i18n/en.data';

const keys = Object.keys(en) as I18nKey[];
const placeholders = (s: string) => (s.match(/\{\w+\}/g) || []).sort().join(',');

afterEach(() => {
  setWidgetLanguage('en', []);
});

describe('which language', () => {
  it('the owner\'s choice wins over the phone', () => {
    expect(resolveLanguage('de', ['fr-FR'])).toBe('de');
    expect(resolveLanguage(' NL ', ['fr-FR'])).toBe('nl');
  });

  it('"auto", absent or unknown follows the first supported phone language', () => {
    expect(resolveLanguage('auto', ['ja-JP', 'es-MX', 'de-DE'])).toBe('es');
    expect(resolveLanguage(undefined, ['fr_CA'])).toBe('fr');
    expect(resolveLanguage('klingon', ['nl-BE'])).toBe('nl');
    expect(resolveLanguage(null, ['de'])).toBe('de');
  });

  it('English when nothing fits', () => {
    expect(resolveLanguage('auto', ['ja-JP', 'pt-BR'])).toBe('en');
    expect(resolveLanguage('auto', [])).toBe('en');
    expect(resolveLanguage('auto', null)).toBe('en');
  });

  it('a stored setting is a supported code or "auto"', () => {
    expect(normalizeWidgetLanguage('es')).toBe('es');
    expect(normalizeWidgetLanguage('pt')).toBe('auto');
    expect(normalizeWidgetLanguage(42)).toBe('auto');
    expect(baseLanguageOf('nl-BE')).toBe('nl');
    expect(baseLanguageOf('pt-PT')).toBeNull();
  });

  it('the phone\'s languages: iOS\'s whole list first, then the locales, BCP 47, no repeats', () => {
    expect(
      deviceLanguagesOf({
        appleLanguages: ['ja-JP', 'de-AT'],
        appleLocale: 'de_AT',
        androidLocale: undefined,
        intlLocale: 'en-US',
      })
    ).toEqual(['ja-JP', 'de-AT', 'en-US']);
    expect(deviceLanguagesOf({ androidLocale: 'fr_FR', intlLocale: 'fr-FR' })).toEqual(['fr-FR']);
    expect(resolveLanguage('auto', deviceLanguagesOf({ androidLocale: 'es_ES' }))).toBe('es');
  });

  it('setWidgetLanguage keeps a regional tag for dates and tells listeners once', () => {
    const heard: string[] = [];
    const off = onWidgetLanguage((l) => heard.push(l));
    expect(setWidgetLanguage('auto', ['nl-BE', 'en-GB'])).toBe('nl');
    expect(widgetLanguage()).toBe('nl');
    expect(widgetLocale()).toBe('nl-BE');
    setWidgetLanguage('nl', ['nl-BE']);
    setWidgetLanguage('de', ['nl-BE']);
    expect(widgetLocale()).toBe('de');
    off();
    setWidgetLanguage('en', []);
    expect(heard).toEqual(['nl', 'de']);
  });
});

describe('the words', () => {
  it('t() draws the active language', () => {
    expect(t('chat.composer.send')).toBe('Send');
    setWidgetLanguage('de', []);
    expect(t('chat.composer.send')).toBe(DICTIONARIES.de['chat.composer.send']);
    expect(t('chat.composer.send')).not.toBe('Send');
  });

  it('{name} is filled; a missing value keeps its braces', () => {
    expect(tFor('en', 'rating.outOf', { n: 3, max: 5 })).toBe('3 out of 5');
    expect(tFor('en', 'rating.outOf', { n: 3 })).toBe('3 out of {max}');
    expect(tFor('fr', 'mailchat.sent', { email: 'a@b.co' })).toContain('a@b.co');
  });

  it('plurals: .one for 1, .other otherwise, n filled', () => {
    expect(tPlural('otp.wrongLeft', 1)).toBe("That code isn't right. 1 try left.");
    expect(tPlural('otp.wrongLeft', 2)).toBe("That code isn't right. 2 tries left.");
    expect(tPlural('otp.wrongLeft', 0)).toBe("That code isn't right. 0 tries left.");
    setWidgetLanguage('es', []);
    expect(tPlural('otp.wrongLeft', 1)).toBe(DICTIONARIES.es['otp.wrongLeft.one']!.replace('{n}', '1'));
  });

  it('a key a language lacks falls back to English, then to the key', () => {
    const de = DICTIONARIES.de as Record<string, string>;
    const saved = de['common.close'];
    delete de['common.close'];
    try {
      expect(tFor('de', 'common.close')).toBe('Close');
    } finally {
      de['common.close'] = saved;
    }
    expect(tFor('de', 'no.such.key' as I18nKey)).toBe('no.such.key');
  });

  it('owner fields: the stock English shows translated, the owner\'s own words as written', () => {
    setWidgetLanguage('de', []);
    expect(ownerTextOr('', 'common.close')).toBe(t('common.close'));
    expect(ownerTextOr('Close.', 'common.close')).toBe(t('common.close'));
    expect(ownerTextOr('Schließen bitte', 'common.close')).toBe('Schließen bitte');
    expect(stockText('', 'common.close')).toBe('');
    expect(stockText('close', 'common.close')).toBe(t('common.close'));
    expect(stockText('Bye', 'common.close')).toBe('Bye');
  });

  it('localized() tables read the language at each read', () => {
    const words = localized({ send: 'chat.composer.send' });
    expect(words.send).toBe('Send');
    setWidgetLanguage('nl', []);
    expect(words.send).toBe(DICTIONARIES.nl['chat.composer.send']);
    expect(Object.keys(words)).toEqual(['send']);
  });

  it('day and month names in the language (English keeps its own)', () => {
    expect(weekdayNames('short', ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])[1]).toBe('Mon');
    expect(monthNames('short', ['Jan'])[0]).toBe('Jan');
    setWidgetLanguage('de', []);
    expect(weekdayNames('long')).toHaveLength(7);
    expect(monthNames('long')).toHaveLength(12);
  });
});

describe('the tables', () => {
  it('every key is in all five languages, none empty', () => {
    expect(keys.length).toBeGreaterThan(800);
    for (const lang of SUPPORTED_LANGUAGES) {
      const dict = DICTIONARIES[lang] as Record<string, string>;
      const missing = keys.filter((k) => typeof dict[k] !== 'string' || !dict[k].trim());
      expect({ lang, missing }).toEqual({ lang, missing: [] });
      expect(Object.keys(dict).filter((k) => !(k in en))).toEqual([]);
    }
  });

  it('each translation has the same {placeholders} as the English', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      const dict = DICTIONARIES[lang] as Record<string, string>;
      // queue.position: the web passes both {n} and {ord} (ts/chat/queueCard.ts),
      // English says "{ord}", the others "{n}".
      const off = keys.filter(
        (k) => k !== 'queue.position' && placeholders(dict[k]) !== placeholders((en as Record<string, string>)[k])
      );
      expect({ lang, off }).toEqual({ lang, off: [] });
    }
  });

  it('every .one has its .other', () => {
    const ones = keys.filter((k) => k.endsWith('.one'));
    // Labels, not plurals: "sources.one" ("Source", with "sources.count"),
    // "requests.one" ("Your request").
    const lonely = ones.filter((k) => !(k.replace(/\.one$/, '.other') in en) && !['sources.one', 'requests.one'].includes(k));
    expect(lonely).toEqual([]);
  });

  it('the data files match the widget\'s i18n files (gen.js --check)', () => {
    const gen = path.resolve(__dirname, '../../scripts/parity/i18n/gen.js');
    const widget = path.resolve(__dirname, '../../../../conferbot-widget/src/ts/i18n/en.ts');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    if (!require('fs').existsSync(widget)) return; // the widget is not checked out beside the SDK
    expect(() => execFileSync('node', [gen, '--check'], { stdio: 'pipe' })).not.toThrow();
  });
});
