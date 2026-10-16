import { useEffect, useMemo, useRef, useState } from 'react';
import { decideGreeting, frequencyAllows, greetingHead, normalizeGreetingStyle } from '../../core/greeting';
import type { GreetingClick, GreetingStyle, SeenState } from '../../core/greeting';
import { ChatState } from '../../core/state/ChatState';
import { installedAsyncStorage } from '../../utils/deviceStorage';
import { mascotLookOf, type MascotLook } from '../../core/mascotArt';
import { normalizeMascotMotion, type MascotMotion } from '../../core/mascotMotion';

/** Seen state per bot for this app session (the "session" frequency, the phone text's typing moment). */
const session: Record<string, { shownThisSession?: boolean; typed?: boolean; counted?: boolean }> = {};

const KEY = (botId: string) => `@conferbot:greeting:${botId || 'default'}`;

type Stored = SeenState & { visits?: number; chatted?: boolean; shows?: Record<string, number[]>; dismissed?: Record<string, number>; last?: string };

const read = async (botId: string): Promise<Stored> => {
  try {
    const raw = await installedAsyncStorage()?.getItem(KEY(botId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};
const write = (botId: string, st: Stored) => {
  try {
    installedAsyncStorage()?.setItem(KEY(botId), JSON.stringify(st)).catch(() => {});
  } catch {
    /* nothing kept without storage */
  }
};

const rgbOf = (v: unknown): [number, number, number] | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (m) {
    const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(s);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};
const lum = (c: [number, number, number]) => {
  const ch = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2]);
};
const hexOf = (c: [number, number, number]) => `#${c.map((n) => n.toString(16).padStart(2, '0')).join('')}`;

/** The card's accent (firstImpression.ts accentFor): the first bot colour that is not too light. */
export const greetingAccent = (c: Record<string, any>): string => {
  const gradient = c.widgetIconThemeType === 'Gradient' && c.widgetGradientBgOne && c.widgetGradientBgTwo;
  const brand = (!c._themePalette && c.brandColor) || c.headerBgColor || '#1b55f3';
  const launcher = gradient ? [c.widgetGradientBgOne, c.widgetGradientBgTwo] : [c.widgetIconBgColor || c.headerBgColor || '#4f46e5'];
  for (const v of [brand, c.headerBgColor, ...launcher]) {
    const rgb = rgbOf(v);
    if (rgb && lum(rgb) <= 0.55) return hexOf(rgb);
  }
  return '#4f46e5';
};

/** The launcher's colours for the phone text and the voice note (greetingStyle.ts). */
export const greetingBubble = (c: Record<string, any>): { bg: string | [string, string]; tail: string; fg: string } => {
  const gradient = c.widgetIconThemeType === 'Gradient' && c.widgetGradientBgOne && c.widgetGradientBgTwo;
  const solidRaw = gradient ? c.widgetGradientBgOne : c.widgetIconBgColor;
  const solid = rgbOf(solidRaw) ? hexOf(rgbOf(solidRaw)!) : '#1b55f3';
  const fg = lum(rgbOf(solid)!) > 0.6 ? '#111827' : '#ffffff';
  return gradient ? { bg: [String(c.widgetGradientBgOne), String(c.widgetGradientBgTwo)], tail: String(c.widgetGradientBgTwo), fg } : { bg: solid, tail: solid, fg };
};

export interface GreetingCardData {
  style: GreetingStyle;
  text: string;
  head: { avatar: string | null; name: string; online: boolean };
  starters: string[];
  bubble: { bg: string | [string, string]; tail: string; fg: string };
  accent: string;
  font: string | null;
  firstShow: boolean;
  click: GreetingClick;
  linkUrl: string;
  /** The owner's mascot in place of the avatar (mascotInGreeting), by its name. */
  mascot: { look: MascotLook; accent: string } | null;
  /** How the card and its figure move (mascotMotion). */
  motion: MascotMotion;
}

/**
 * The greeting card's life, as the web runs it (ts/visibility/greeting.ts):
 * decided once the bot's settings arrive, shown after its delay unless the
 * chat is open or the frequency says no, gone for a while once closed or
 * used. A new visit counts once per app session.
 */
export function useGreeting(opts: { customizations: Record<string, any> | null; chatOpen: boolean; botId: string; agentBot: any; enabled: boolean }) {
  const { customizations, chatOpen, botId, agentBot, enabled } = opts;
  const [card, setCard] = useState<GreetingCardData | null>(null);
  const seen = useRef<Stored | null>(null);

  const decided = useMemo(() => {
    if (!customizations || !enabled) return null;
    return customizations;
  }, [customizations, enabled]);

  // Opening the chat rests the card, as closing it does.
  const showing = useRef(false);
  showing.current = !!card;
  useEffect(() => {
    if (!chatOpen) return;
    // Chatted, for rules that ask; and opening the chat rests the card, as closing it does.
    const st: Stored = { ...(seen.current || {}), chatted: true, ...(showing.current ? { closedAt: Date.now() } : {}) };
    seen.current = st;
    write(botId, st);
  }, [chatOpen, botId]);

  useEffect(() => {
    if (!decided || chatOpen) {
      setCard(null);
      return undefined;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      const st = seen.current || (await read(botId));
      const s = session[botId] || (session[botId] = {});
      if (!s.counted) {
        s.counted = true;
        st.visits = (st.visits || 0) + 1;
        write(botId, st);
      }
      seen.current = st;
      const ctx = ChatState.visitorContext;
      const g = decideGreeting(decided, {
        returning: (st.visits || 0) > 1,
        signedIn: !!(ctx && (ctx.id || ctx.email)),
        visits: st.visits || 1,
        chatted: !!st.chatted,
        shows: st.shows,
        dismissed: st.dismissed,
      });
      if (!g || cancelled) return;
      if (!frequencyAllows(decided, { ...st, shownThisSession: s.shownThisSession })) return;
      timer = setTimeout(() => {
        if (cancelled) return;
        const now = Date.now();
        s.shownThisSession = true;
        // Each rule's shows count against its limits.
        const shows = { ...(st.shows || {}) };
        shows[g.key] = [...(shows[g.key] || []).filter((t) => now - t < 90 * 86400000), now].slice(-20);
        seen.current = { ...st, shownAt: now, shows, last: g.key };
        write(botId, seen.current);
        const c = decided;
        // The owner's mascot greets in place of the avatar, by its name (firstImpression.ts).
        const look = mascotLookOf(c);
        const withMascot = c.mascotInGreeting === true;
        const head0 = agentBot ? { ...greetingHead(c), name: agentBot.displayName || greetingHead(c).name } : greetingHead(c);
        setCard({
          style: normalizeGreetingStyle(c.greetingStyle),
          text: g.text,
          head: withMascot ? { ...head0, avatar: null, name: look.name || head0.name } : head0,
          mascot: withMascot ? { look, accent: c.widgetIconBgColor || c.headerBgColor || '#4f46e5' } : null,
          motion: normalizeMascotMotion(c.mascotMotion),
          starters: (g.starters.length ? g.starters : agentBot?.starters || []).slice(0, 3),
          bubble: greetingBubble(c),
          accent: greetingAccent(c),
          font: typeof c.font === 'string' && c.font.trim() && !/^(arial|gill sans)/i.test(c.font.trim()) ? c.font.trim() : null,
          firstShow: !s.typed,
          click: g.click,
          linkUrl: g.linkUrl,
        });
        s.typed = true;
      }, g.delay * 1000);
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [decided, chatOpen, botId, agentBot]);

  /** Closed: never again on this "page" for a while (or per the frequency). */
  const dismiss = () => {
    const now = Date.now();
    const st: Stored = { ...(seen.current || {}), closedAt: now };
    if (st.last) st.dismissed = { ...(st.dismissed || {}), [st.last]: now };
    seen.current = st;
    write(botId, st);
    setCard(null);
  };

  /** Used (tapped): rests for a while like a close, but is not a dismissal of its rule. */
  const closeForNow = () => {
    const st: Stored = { ...(seen.current || {}), closedAt: Date.now() };
    seen.current = st;
    write(botId, st);
    setCard(null);
  };

  return { card, dismiss, closeForNow };
}
