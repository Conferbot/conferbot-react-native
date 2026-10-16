/**
 * The greeting card by the closed launcher, as the web widget decides it
 * (conferbot-widget ts/visibility/nudges.ts greetingSettings / decideGreeting,
 * ts/home/firstImpression.ts upgradeGreeting, ts/home/greetingStyle.ts):
 * which message, after how long, what a tap does, how often, and how it is
 * dressed. Pure.
 *
 * An app has no page address, so it counts as the site's home page ("/"):
 * a rule for every page applies, a rule for a given page does not. Rules
 * that need what only a browser knows (where the visitor came from, pages
 * viewed, the visitor's country, page attributes) never apply here.
 */
import { stockText } from './i18n';

export type GreetingStyle =
  | 'card' | 'note' | 'imessage' | 'postcard' | 'sticky' | 'typewriter'
  | 'glass' | 'notification' | 'neon' | 'voice' | 'aurora';
export const GREETING_STYLES: GreetingStyle[] = ['card', 'note', 'imessage', 'postcard', 'sticky', 'typewriter', 'glass', 'notification', 'neon', 'voice', 'aurora'];
export const DEFAULT_GREETING_STYLE: GreetingStyle = 'imessage';
export type GreetingClick = 'open' | 'send' | 'link';
export type GreetingFrequency = 'page' | 'session' | 'visitor';

export const DEFAULT_GREETING_DELAY = 3;
export const DEFAULT_FREQUENCY_DAYS = 7;
/** Closing the card (or opening the chat) rests it this long on "every page". */
export const PAGE_COOLDOWN_SECONDS = 300;
const TEXT_MAX = 140;
const LEGACY_PROMPT_DELAY = 8;

export interface ResolvedGreeting {
  text: string;
  /** Seconds after the launcher shows. */
  delay: number;
  click: GreetingClick;
  linkUrl: string;
  /** The rule's own suggested questions, else none (the agent's are added by the caller). */
  starters: string[];
  /** Results key: the rule's id or its words. */
  key: string;
}

export interface GreetingFacts {
  /** This visitor has been here before (a previous app session). */
  returning: boolean;
  /** The app identified the visitor (ConferBotProvider user). */
  signedIn: boolean;
  /** App sessions so far, this one included (rules' "after N visits"). */
  visits?: number;
  /** The visitor has chatted before. */
  chatted?: boolean;
  /** Each rule's shows (ms) and last close, for its limits (nudges.ts limitsAllow). */
  shows?: Record<string, number[]>;
  dismissed?: Record<string, number>;
  now?: number;
}

/** A rule's results key: its id, else its words. */
export const ruleKey = (rule: any): string => str(rule?.id) || str(rule?.text).trim().slice(0, 40);

// The smart greetings' own ids (embed-server services/chatbot/greeting/smartGreetings.js).
const SMART_RULE_IDS = new Set(['sgpric', 'sgads0', 'sgretn', 'sgengd', 'sgcust', 'sgchko']);

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown, fallback: number, min: number, max: number): number => {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.round(n), min), max);
};

export const normalizeGreetingStyle = (v: unknown): GreetingStyle =>
  GREETING_STYLES.includes(v as GreetingStyle) ? (v as GreetingStyle) : DEFAULT_GREETING_STYLE;

/** A rule's address pattern, asked of the app's "/" (nudges.ts ruleMatches). */
const matchesHome = (rule: any): boolean => {
  if (Array.isArray(rule.patterns) && rule.patterns.length) return false; // a smart greeting's detected pages
  const p = str(rule.pattern).trim().toLowerCase();
  if (!p) return false;
  switch (rule.matchType) {
    case 'glob':
      return ['*', '**', '/*', '/**'].includes(p);
    case 'startsWith':
      return p === '/';
    case 'exact':
      return p === '/';
    default:
      return '/'.includes(p);
  }
};

const instant = (v: unknown): number | null => {
  const t = typeof v === 'string' && v ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : null;
};

/** Who and when (nudges.ts audienceMatches, scheduleMatches); what an app cannot know never matches. */
const applies = (rule: any, facts: GreetingFacts): boolean => {
  if (!matchesHome(rule)) return false;
  const visitors = rule.visitors || 'all';
  if (visitors === 'new' && facts.returning) return false;
  if (visitors === 'returning' && !facts.returning) return false;
  const signedIn = rule.signedIn || 'any';
  if (signedIn === 'yes' && !facts.signedIn) return false;
  if (signedIn === 'no' && facts.signedIn) return false;
  if (Array.isArray(rule.countries) && rule.countries.length) return false;
  const now = facts.now ?? Date.now();
  const start = instant(rule.startsAt);
  const end = instant(rule.endsAt);
  if (start !== null && now < start) return false;
  if (end !== null && now > end) return false;
  if (rule.source && Object.keys(rule.source).length) return false;
  const b = rule.behavior;
  if (b) {
    // Pages, time and paths are a browser's; visits and "chatted" an app has.
    if (Object.keys(b).some((k) => k !== 'minVisits' && k !== 'chatted' && b[k] !== undefined && b[k] !== 0 && !(Array.isArray(b[k]) && !b[k].length))) return false;
    if (b.minVisits && (facts.visits || 1) < b.minVisits) return false;
    if (b.chatted === 'yes' && !facts.chatted) return false;
    if (b.chatted === 'no' && facts.chatted) return false;
  }
  if (Array.isArray(rule.attributes) && rule.attributes.length) return false;
  // Its own limits: at most N shows in a window, quiet for days after a close.
  const l = rule.limits;
  if (l) {
    const key = ruleKey(rule);
    if (l.maxShows) {
      const since = now - (l.windowDays || DEFAULT_FREQUENCY_DAYS) * 86400000;
      if ((facts.shows?.[key] || []).filter((t) => t > since).length >= l.maxShows) return false;
    }
    const d = facts.dismissed?.[key];
    if (l.quietDaysAfterDismiss && d && now - d < l.quietDaysAfterDismiss * 86400000) return false;
  }
  return true;
};

/**
 * The greeting to show, or null: the highest-priority rule that applies
 * (a "show nothing" rule that applies silences it), else the default
 * message when the greeting is on.
 */
export function decideGreeting(c: Record<string, any> | null | undefined, facts: GreetingFacts): ResolvedGreeting | null {
  const raw = c || {};
  let on = raw.chatIconCta === true;
  // The stock "Hi👋, how can I help?" in the visitor's language; the owner's own words as written (web core/customizations.ts stockText).
  let text = stockText(str(raw.chatIconCtaText).trim(), 'greeting.stock', ['Hi 👋, how can I help?']);
  let delay = num(raw.greetingDelay, DEFAULT_GREETING_DELAY, 0, 3600);
  let click: GreetingClick = raw.greetingClickAction === 'send' || raw.greetingClickAction === 'link' ? raw.greetingClickAction : 'open';
  // Smart greetings with the owner's own greeting off: no default message.
  if (raw.smartOnly === true && !on) {
    on = true;
    text = '';
  }
  const rules = (Array.isArray(raw.greetingRules) ? raw.greetingRules : []).filter((r: any) => r && typeof r === 'object');
  // The old proactive teaser, carried over as the web does: its page rules
  // (never the app's "/"), and its every-page message as the default message,
  // or as a rule when the greeting already has one.
  const legacyText = raw.proactivePromptEnabled === true ? str(raw.proactivePromptText).trim() : '';
  const legacyRules = (Array.isArray(raw.proactivePromptRules) ? raw.proactivePromptRules : []).filter((r: any) => r && str(r.text).trim() && str(r.urlPattern).trim());
  if (legacyRules.length || legacyText) {
    if (!on) text = '';
    if (legacyText) {
      const legacyDelay = num(raw.proactivePromptDelay, LEGACY_PROMPT_DELAY, 0, 3600);
      if (text) rules.push({ matchType: 'contains', pattern: '/', text: legacyText, delay: legacyDelay, clickAction: 'send' });
      else {
        text = legacyText;
        delay = legacyDelay;
        click = 'send';
      }
    }
    on = true;
  }
  if (!on) return null;
  // "Show nothing" wins for the visitors it fits - a smart one yields to the
  // owner's own talking rule for the same visitor.
  const ownTalks = rules.some((r: any) => !SMART_RULE_IDS.has(str(r.id)) && r.action?.type !== 'none' && str(r.text).trim() && applies(r, facts));
  if (rules.some((r: any) => r.action?.type === 'none' && applies(r, facts) && !(SMART_RULE_IDS.has(str(r.id)) && ownTalks))) return null;
  const ranked = rules
    .map((rule: any, index: number) => ({ rule, index, p: typeof rule.priority === 'number' ? rule.priority : 50 }))
    .sort((a: any, b: any) => b.p - a.p || a.index - b.index);
  for (const { rule } of ranked) {
    const ruleText = str(rule.text).trim();
    if (!ruleText || rule.action?.type === 'none' || !applies(rule, facts)) continue;
    const ruleClick = rule.clickAction === 'send' || rule.clickAction === 'open' || rule.clickAction === 'link' ? rule.clickAction : click;
    return {
      text: ruleText.slice(0, TEXT_MAX),
      delay: typeof rule.delay === 'number' ? num(rule.delay, delay, 0, 3600) : delay,
      click: ruleClick,
      linkUrl: ruleClick === 'link' ? str(rule.linkUrl) : '',
      starters: (Array.isArray(rule.starters) ? rule.starters : []).filter((s: unknown) => typeof s === 'string' && s.trim()).slice(0, 3),
      key: ruleKey(rule),
    };
  }
  if (!text) return null;
  return { text: text.slice(0, TEXT_MAX), delay, click: click === 'link' ? 'open' : click, linkUrl: '', starters: [], key: text.slice(0, 40) };
}

export interface SeenState {
  /** When the card last showed (ms). */
  shownAt?: number;
  /** When it was last closed or the chat opened from it (ms). */
  closedAt?: number;
  /** Shown in this app session already. */
  shownThisSession?: boolean;
}

/** Whether the frequency lets the card show now (nudges.ts frequencyAllows). */
export function frequencyAllows(c: Record<string, any> | null | undefined, st: SeenState, now = Date.now()): boolean {
  const frequency: GreetingFrequency = c?.greetingFrequency === 'session' || c?.greetingFrequency === 'visitor' ? c.greetingFrequency : 'page';
  const days = num(c?.greetingFrequencyDays, DEFAULT_FREQUENCY_DAYS, 1, 365);
  if (frequency === 'session') return !st.shownThisSession;
  if (frequency === 'visitor') return !st.shownAt || now - st.shownAt >= days * 86400000;
  // Every page (each launch in an app): a close rests it a few minutes.
  return !st.closedAt || now - st.closedAt >= PAGE_COOLDOWN_SECONDS * 1000;
}

/** The card's header: the agent or bot's avatar and name, and "Online" unless the owner hid it. */
export function greetingHead(c: Record<string, any> | null | undefined, botName = ''): { avatar: string | null; name: string; online: boolean } {
  const x = c || {};
  const avatar = (!x.hideAvatar && str(x.avatar)) || str(x.initialPageAvatar) || (!x.hideLogo && str(x.logo)) || null;
  return { avatar, name: str(x.logoText) || botName || 'Support', online: x.hideOnlineStatus !== true };
}
