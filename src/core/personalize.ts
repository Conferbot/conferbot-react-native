/**
 * Personalised texts: "Hi {{first_name|there}} 👋" -> "Hi Sam 👋" (or
 * "Hi there 👋"). Ported from the web widget: conferbot-widget
 * src/ts/layout/ownerLayout.ts (visitorVars, personalize,
 * PERSONALIZED_KEYS, personalizeCustomizations), applied in index.ts right
 * after the bot's data arrives. This is the dashboard's "Greet by name"
 * (Customize > Welcome).
 *
 * One difference, on purpose: the web HTML-escapes the values because it
 * draws these texts as markup; React Native draws them as text, so they
 * stay as typed. Pure.
 */

const firstString = (...values: unknown[]): string => {
  for (const v of values) if (typeof v === 'string' && v.trim()) return v.trim();
  return '';
};

/**
 * What a visitor is known by: the app's user (`<ConferBotProvider user>`:
 * its name and metadata, as the web's identify data) and a name the chat
 * already asked for.
 */
export const visitorVars = (context: Record<string, any> | null | undefined, name?: unknown): Record<string, string> => {
  const c = context || {};
  const full = firstString(c.name, c.fullName, c.full_name, name, [c.firstName || c.first_name, c.lastName || c.last_name].filter(Boolean).join(' '));
  return {
    name: full,
    first_name: firstString(c.firstName, c.first_name, full.split(/\s+/)[0]),
    company: firstString(c.company, c.companyName, c.company_name, c.organization),
  };
};

const TOKEN = /\{\{\s*([a-z_]+)\s*(?:\|([^}]*))?\}\}/gi;

/**
 * Fill the tokens. A token with no value and no fallback is dropped along
 * with the space before it ("Hi {{name}}!" -> "Hi!"); the fallback is the
 * owner's own text. Anything that is not a string comes back as it was.
 */
export const personalize = <T>(text: T, vars: Record<string, string>): T => {
  if (typeof text !== 'string' || !text.includes('{{')) return text;
  return text
    .replace(TOKEN, (_m, key: string, fallback?: string) => {
      const k = key.toLowerCase() === 'firstname' ? 'first_name' : key.toLowerCase();
      const v = vars[k];
      if (v) return v;
      return fallback !== undefined ? fallback.trim() : '\u0000';
    })
    .replace(/[ \t]*\u0000/g, '')
    .replace(/[ \t]{2,}/g, ' ') as unknown as T;
};

/** The visitor-facing texts that take {{name}} / {{first_name}} / {{company}}. */
export const PERSONALIZED_KEYS = ['chatIconCtaText', 'initialPageTitle', 'initialPageDescription', 'initialPageCardButtonText'] as const;

/** The bot's settings with those texts (and each greeting rule's text) filled in. */
export const personalizeCustomizations = <T extends Record<string, any> | null | undefined>(c: T, vars: Record<string, string>): T => {
  if (!c) return c;
  const out: any = { ...c };
  PERSONALIZED_KEYS.forEach((k) => {
    if (typeof out[k] === 'string') out[k] = personalize(out[k], vars);
  });
  if (Array.isArray(out.greetingRules)) {
    out.greetingRules = out.greetingRules.map((r: any) =>
      r && typeof r.text === 'string' && r.text.includes('{{') ? { ...r, text: personalize(r.text, vars) } : r
    );
  }
  return out;
};
