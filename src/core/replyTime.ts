/**
 * The chat header's status under the bot name: "Online", the team's reply
 * time, or when the team is back. Ported from the web widget:
 * conferbot-widget src/ts/chat/replyTime.ts (headerLine, backWhen, the
 * English words from ts/i18n/en.ts reply.*) and src/ts/chat/headerPresence.ts
 * (markHeaderLive: a person in the chat puts it back to a plain "Online").
 *
 * The server works the reply time out (embed-server
 * liveChat/replyTimeService) and sends it with the bot data as
 * customizations.replyTime. The bot itself is always Online; the words say
 * when people answer. The header never changes to the agent: it keeps the
 * bot's name. Pure.
 */

import { t, localized, widgetLocale, I18nKey } from './i18n';

export interface ReplyTime {
  mode?: 'auto' | 'fixed' | 'hide';
  handover?: boolean;
  state?: 'online' | 'away' | 'offline';
  bucket?: string | null;
  phrase?: string | null;
  wait?: string | null;
  text?: string;
  backAt?: string | null;
  leaveMessage?: boolean;
}

export type Tone = 'online' | 'away';

export interface ReplyLine {
  text: string;
  tone: Tone;
}

const BUCKETS = ['under_minute', 'few_minutes', 'under_15_minutes', 'under_hour', 'few_hours', 'day', 'few_days'] as const;

/** "The team typically replies <phrase>", per bucket, in the active language (web reply.phrase.*). */
export const PHRASES: Record<string, string> = localized(
  BUCKETS.reduce((out, b) => ({ ...out, [b]: `reply.phrase.${b}` as I18nKey }), {} as Record<string, I18nKey>)
);

/** The header's words, read when drawn (web replyTime.ts STRINGS). */
export const STRINGS = {
  get statusOnline() {
    return t('status.online');
  },
  typicallyShort: (phrase: string) => t('reply.typicallyShort', { phrase }),
  teamBack: (when: string) => t('reply.teamBack', { when }),
  get teamByEmail() {
    return t('reply.teamByEmail');
  },
  get teamAwayNow() {
    return t('reply.teamAwayNow');
  },
  atTime: (time: string) => t('reply.atTime', { time }),
  get tomorrow() {
    return t('reply.tomorrow');
  },
  sep: ' · ',
};

const live = (rt: ReplyTime | null | undefined): rt is ReplyTime => !!rt && typeof rt === 'object' && rt.mode !== 'hide';
const fixedOf = (rt: ReplyTime): string => (rt.mode === 'fixed' && typeof rt.text === 'string' ? rt.text.trim() : '');
const phraseOf = (rt: ReplyTime): string => (rt.bucket && PHRASES[rt.bucket]) || rt.phrase || '';

const fmt = (locale: string, d: Date, o: Intl.DateTimeFormatOptions, fallback: () => string): string => {
  try {
    return new Intl.DateTimeFormat(locale, o).format(d);
  } catch {
    return fallback();
  }
};

/**
 * When the team is back, in the visitor's time: "at 9 AM" (today),
 * "tomorrow 9 AM", "Monday 9:30 AM", "Mon, Oct 12 9 AM".
 */
export const backWhen = (backAt: string | null | undefined, now: Date = new Date(), locale?: string): string => {
  if (!backAt) return '';
  const d = new Date(backAt);
  if (Number.isNaN(d.getTime())) return '';
  // The visitor's language and region (web: locale || widgetLocale() || "en-US").
  locale = locale || (widgetLocale() === 'en' ? 'en-US' : widgetLocale()) || 'en-US';
  const time = fmt(locale, d, d.getMinutes() ? { hour: 'numeric', minute: '2-digit' } : { hour: 'numeric' }, () => d.toLocaleTimeString());
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(d) - day(now)) / 86400000);
  if (days <= 0) return STRINGS.atTime(time);
  if (days === 1) {
    let tomorrow = STRINGS.tomorrow;
    try {
      // "morgen", "demain" (web: Intl.RelativeTimeFormat when there is one).
      const rtf = (Intl as any).RelativeTimeFormat;
      if (rtf) tomorrow = new rtf(locale, { numeric: 'auto' }).format(1, 'day');
    } catch {
      /* the table's word */
    }
    return `${tomorrow} ${time}`;
  }
  if (days < 7) return `${fmt(locale, d, { weekday: 'long' }, () => d.toDateString())} ${time}`;
  return `${fmt(locale, d, { weekday: 'short', month: 'short', day: 'numeric' }, () => d.toDateString())} ${time}`;
};

/**
 * The header's status from the server's reply time; null keeps "Online".
 * The bot stays Online when the team is away or offline ("Online · team
 * back at 9 AM", "Online · team replies by email"). `agent`: an AI agent
 * bot, which answers itself whatever the hour (no line).
 */
export const headerLine = (
  rt: ReplyTime | null | undefined,
  { agent = false, now = new Date(), locale }: { agent?: boolean; now?: Date; locale?: string } = {}
): ReplyLine | null => {
  if (!live(rt) || !rt.handover || agent) return null;
  if (rt.state === 'away' || rt.state === 'offline') {
    const when = backWhen(rt.backAt, now, locale);
    const words = when ? STRINGS.teamBack(when) : rt.leaveMessage === false ? STRINGS.teamAwayNow : STRINGS.teamByEmail;
    return { text: STRINGS.statusOnline + STRINGS.sep + words, tone: 'online' };
  }
  if (fixedOf(rt)) return { text: fixedOf(rt), tone: 'online' };
  const words = phraseOf(rt);
  return words ? { text: STRINGS.typicallyShort(words), tone: 'online' } : null;
};

/**
 * What the header shows under the bot name: the reply-time line, or plain
 * "Online" once a person is in the chat (the snapshot about an away team is
 * no longer true), or no status at all when the owner turned it off.
 */
export const headerStatus = (
  rt: ReplyTime | null | undefined,
  { personInChat = false, agentBot = false, hidden = false, now = new Date(), locale }:
    { personInChat?: boolean; agentBot?: boolean; hidden?: boolean; now?: Date; locale?: string } = {}
): ReplyLine | null => {
  if (hidden) return null;
  if (personInChat) return { text: STRINGS.statusOnline, tone: 'online' };
  return headerLine(rt, { agent: agentBot, now, locale }) || { text: STRINGS.statusOnline, tone: 'online' };
};

// ------------------------------------------------------------ the home card (web homeLine, homePeople)

/** The home card's words (web replyTime.ts STRINGS, reply.*), read when drawn. */
export const HOME_STRINGS = {
  typically: (phrase: string) => t('reply.typically', { phrase }),
  teamReplies: (phrase: string) => t('reply.teamReplies', { phrase }),
  get answersInstantly() {
    return t('reply.answersInstantly');
  },
  get answersAlways() {
    return t('reply.answersAlways');
  },
  get away() {
    return t('reply.away');
  },
  back: (when: string) => t('reply.back', { when }),
  get offline() {
    return t('reply.offline');
  },
  get byEmail() {
    return t('reply.byEmail');
  },
  get offlineNow() {
    return t('reply.offlineNow');
  },
  usually: (phrase: string) => t('reply.usually', { phrase }),
  get usuallyInstantly() {
    return t('reply.usuallyInstantly');
  },
  teamBackAt: (when: string) => t('reply.teamBackAt', { when }),
  get teamRepliesByEmail() {
    return t('reply.teamRepliesByEmail');
  },
  get teamAwayRightNow() {
    return t('reply.teamAwayRightNow');
  },
};

/**
 * The "Talk to us" card's line (web replyTime.ts homeLine). `hide: true`
 * means take the line away (the owner chose Hide); null keeps the old line.
 */
export const homeLine = (
  rt: ReplyTime | null | undefined,
  { agent = false, now = new Date(), locale }: { agent?: boolean; now?: Date; locale?: string } = {}
): (ReplyLine & { hide?: false }) | { hide: true } | null => {
  if (rt && rt.mode === 'hide') return agent ? null : { hide: true };
  if (!live(rt) || !rt.handover) return null;
  const when = backWhen(rt.backAt, now, locale);
  const words = fixedOf(rt) || phraseOf(rt);
  const H = HOME_STRINGS;
  if (agent) {
    // The AI answers whatever the hour; say when people are around.
    if (rt.state === 'away') return { text: H.answersInstantly + (when ? STRINGS.sep + STRINGS.teamBack(when) : ''), tone: 'away' };
    if (rt.state === 'offline' || !words) return null;
    return { text: H.answersInstantly + STRINGS.sep + (fixedOf(rt) || H.teamReplies(words)), tone: 'online' };
  }
  if (rt.state === 'away') return { text: H.away + (when ? STRINGS.sep + H.back(when) : ''), tone: 'away' };
  if (rt.state === 'offline') return { text: rt.leaveMessage !== false ? H.offline + STRINGS.sep + H.byEmail : H.offlineNow, tone: 'away' };
  if (fixedOf(rt)) return { text: fixedOf(rt), tone: 'online' };
  return words ? { text: H.typically(words), tone: 'online' } : null;
};

/** Who answers and how fast; "" for none (the owner chose Hide). */
export interface PeopleLine {
  text: string;
  tone: Tone;
}

/**
 * The home card's promise (web replyTime.ts homePeople), read after
 * "Online" under the bot's name:
 *
 * - an AI agent answers whatever the hour: "Answers instantly, day or
 *   night" (or with when the team replies / is back, from homeLine);
 * - a bot that never hands over (or no data, an older server): "Answers
 *   instantly, day or night";
 * - a team that is online: "Usually replies in a few minutes" (or the
 *   owner's Fixed words);
 * - a team that is away or offline: "Team back tomorrow 9 AM", else "Team
 *   replies by email" (or "Team away right now" with leave-a-message off);
 * - Hide: no words.
 */
export const homePeople = (
  rt: ReplyTime | null | undefined,
  { agent = false, now = new Date(), locale }: { agent?: boolean; now?: Date; locale?: string } = {}
): PeopleLine => {
  const H = HOME_STRINGS;
  const line = homeLine(rt, { agent, now, locale });
  if (agent) return line && 'text' in line ? { text: line.text, tone: line.tone } : { text: H.answersAlways, tone: 'online' };
  if (line && 'hide' in line && line.hide) return { text: '', tone: 'online' };
  if (!live(rt) || !rt.handover) return { text: H.answersAlways, tone: 'online' };
  if (rt.state === 'away' || rt.state === 'offline') {
    const when = backWhen(rt.backAt, now, locale);
    const text = when ? H.teamBackAt(when) : rt.leaveMessage === false ? H.teamAwayRightNow : H.teamRepliesByEmail;
    return { text, tone: 'away' };
  }
  const words = phraseOf(rt);
  return { text: fixedOf(rt) || (words ? H.usually(words) : H.usuallyInstantly), tone: 'online' };
};
