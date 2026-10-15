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

/** "The team typically replies <phrase>" */
export const PHRASES: Record<string, string> = {
  under_minute: 'in under a minute',
  few_minutes: 'in a few minutes',
  under_15_minutes: 'in under 15 minutes',
  under_hour: 'in under an hour',
  few_hours: 'in a few hours',
  day: 'within a day',
  few_days: 'in a few days',
};

export const STRINGS = {
  statusOnline: 'Online',
  typicallyShort: (phrase: string) => `Typically replies ${phrase}`,
  teamBack: (when: string) => `team back ${when}`,
  teamByEmail: 'team replies by email',
  teamAwayNow: 'team away right now',
  atTime: (time: string) => `at ${time}`,
  tomorrow: 'tomorrow',
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
export const backWhen = (backAt: string | null | undefined, now: Date = new Date(), locale = 'en-US'): string => {
  if (!backAt) return '';
  const d = new Date(backAt);
  if (Number.isNaN(d.getTime())) return '';
  const time = fmt(locale, d, d.getMinutes() ? { hour: 'numeric', minute: '2-digit' } : { hour: 'numeric' }, () => d.toLocaleTimeString());
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(d) - day(now)) / 86400000);
  if (days <= 0) return STRINGS.atTime(time);
  if (days === 1) return `${STRINGS.tomorrow} ${time}`;
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
  { agent = false, now = new Date(), locale = 'en-US' }: { agent?: boolean; now?: Date; locale?: string } = {}
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
  { personInChat = false, agentBot = false, hidden = false, now = new Date(), locale = 'en-US' }:
    { personInChat?: boolean; agentBot?: boolean; hidden?: boolean; now?: Date; locale?: string } = {}
): ReplyLine | null => {
  if (hidden) return null;
  if (personInChat) return { text: STRINGS.statusOnline, tone: 'online' };
  return headerLine(rt, { agent: agentBot, now, locale }) || { text: STRINGS.statusOnline, tone: 'online' };
};
