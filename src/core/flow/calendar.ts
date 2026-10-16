/**
 * Calendar step rules, ported from the web widget
 * (conferbot-widget/src/ts/chat/nodeLogic.ts: expandSlots, futureSlots,
 * dayKeyInZone, noonInZone; displayStep.ts calendar-node). Slot times are
 * the bot's clock (data.timeZone); the visitor sees their own.
 */
import { widgetLanguage, widgetLocale } from '../i18n';

export interface CalendarSlot {
  start: string;
  end: string;
}

const toMinutes = (hhmm: any): number | null => {
  const m = String(hhmm ?? '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
};

const toHhmm = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** A day's windows cut into slotDuration-minute slots with bufferMinutes between. */
export const expandSlots = (windows: any[], slotDuration?: any, bufferMinutes?: any): CalendarSlot[] => {
  const list = Array.isArray(windows) ? windows : [];
  const length = Math.floor(Number(slotDuration) || 0);
  const buffer = Math.max(0, Math.floor(Number(bufferMinutes) || 0));
  if (length <= 0) return list.filter((w) => w?.start && w?.end).map((w) => ({ start: w.start, end: w.end }));
  const out: CalendarSlot[] = [];
  for (const w of list) {
    const from = toMinutes(w?.start);
    const to = toMinutes(w?.end);
    if (from === null || to === null || to <= from) continue;
    for (let t = from; t + length <= to; t += length + buffer) out.push({ start: toHhmm(t), end: toHhmm(t + length) });
  }
  return out;
};

export const slotLabel = (slot: CalendarSlot): string => `${slot.start} - ${slot.end}`;

const partsIn = (date: Date, timeZone: string): Record<string, string> =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    } as any)
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );

/** "YYYY-MM-DD" of an instant on a zone's clock. */
export const dayKeyInZone = (date: Date, timeZone: string): string => {
  if (!date || typeof (date as any).getTime !== 'function' || Number.isNaN(date.getTime())) return '';
  try {
    const p = partsIn(date, timeZone);
    return `${p.year}-${p.month}-${p.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
};

/** Today's slots that have not started yet (bot's clock); other days keep all. */
export const futureSlots = (slots: CalendarSlot[], dayKey: string, timeZone: string, now: Date = new Date()): CalendarSlot[] => {
  let p: Record<string, string>;
  try {
    p = partsIn(now, timeZone);
  } catch {
    return slots;
  }
  if (dayKey !== `${p.year}-${p.month}-${p.day}`) return slots;
  const nowMin = toMinutes(`${p.hour}:${p.minute}`) ?? 0;
  return (slots || []).filter((s) => (toMinutes(s.start) ?? 0) > nowMin);
};

/** How far (ms) a zone's clock is ahead of UTC at instant `t`. */
const zoneOffsetMs = (t: number, timeZone: string): number => {
  try {
    const p: Record<string, string> = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      } as any)
        .formatToParts(new Date(t))
        .map((x) => [x.type, x.value])
    );
    const wall = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute), Number(p.second));
    return wall - Math.floor(t / 1000) * 1000;
  } catch {
    return 0;
  }
};

/** The instant it is hh:mm on `dateString` on `timeZone`'s clock. */
export const wallTimeInZone = (dateString: string, hhmm: string, timeZone: string): Date => {
  const [y, m, d] = String(dateString).split('-').map(Number);
  const mins = toMinutes(hhmm) ?? 12 * 60;
  const guess = Date.UTC(y, (m || 1) - 1, d || 1, Math.floor(mins / 60), mins % 60);
  let t = guess - zoneOffsetMs(guess, timeZone);
  t = guess - zoneOffsetMs(t, timeZone);
  return new Date(t);
};

/** 12:00 on that day on that zone's clock (the picked day, read the same everywhere). */
export const noonInZone = (dateString: string, timeZone: string): Date => wallTimeInZone(dateString, '12:00', timeZone);

/** "HH:MM" of an instant on a zone's clock. */
export const hhmmInZone = (date: Date, timeZone: string): string => {
  const p = partsIn(date, timeZone);
  return `${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
};

/** "Tuesday, October 20, 2026" */
export const longDate = (date: Date, timeZone: string, locale = 'en-US'): string =>
  date.toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone });

/**
 * The locale a visitor's own date is written in: the widget's (web
 * displayStep.ts formattedVisitorDate uses widgetLocale()), "en-US" for
 * English. The bot's date stays en-US, as the web keeps it.
 */
export const visitorLocale = (): string => (widgetLanguage() === 'en' ? 'en-US' : widgetLocale());

/** The owner's day names (weeklyHours.dayName, excludeDays) are English: kept so here. */
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The weekday name of a day on the bot's clock. */
export const dayNameInZone = (date: Date, timeZone: string): string =>
  date.toLocaleDateString('en-US', { weekday: 'long', timeZone }) || DAY_NAMES[date.getUTCDay()];

/** The visitor's own time zone (UTC when unknown). */
export const visitorTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};
