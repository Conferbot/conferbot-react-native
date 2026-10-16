/**
 * The mascot's moods and the typing mascot, as the web plays them: CSS
 * @keyframes on the drawing's parts, kept here as the web wrote them and
 * turned into tracks for the evaluator (./keyframes.ts cssKeyframes).
 *
 * Moods (conferbot-widget src/ts/launcher/art3d.ts MASCOT_ANIM_CSS,
 * mascotState): a class on the drawing.
 *   idle   a natural blink now and then (cb-m--blink, always on)
 *   wave   the arm waves; a resting arm ("down") lifts first. Repeats, or
 *          `waveCount` times (the greeting card: 2) and rests
 *   think  a gentle bob with a head tilt, eyes looking around, brows up
 *   happy  a happy bounce (twice) and a big smile, kept while the mood is
 * Each part turns about its own joint (mascotArt.ts mascotOrigins). Reduced
 * motion turns every movement off; the happy smile, which is not motion,
 * stays.
 *
 * Typing ("mascot" typing style, src/css/polish.css .cb-typing--mascot):
 * the bust, 32 x 32, swaying about 50% 90% of its box, blinking and
 * glancing at three thought dots rising beside it. Still under reduced
 * motion.
 *
 * Pure.
 */
import { cssKeyframes, type Track } from './keyframes';
import type { MascotArm } from './mascotArt';

export type MascotMood = 'idle' | 'wave' | 'think' | 'happy';
export const MASCOT_MOODS: readonly MascotMood[] = ['idle', 'wave', 'think', 'happy'];
/** How long the happy bounce plays (two hops). */
export const MASCOT_HAPPY_MS = 1800;
/** The launcher's mascot keeps its smile this long after a reply (launcherStyle.ts cheerLauncherMascot). */
export const MASCOT_CHEER_MS = MASCOT_HAPPY_MS + 600;

/** The web's @keyframes bodies (art3d.ts MASCOT_ANIM_CSS, polish.css), verbatim. */
export const MASCOT_KEYFRAMES = {
  'cb-m-blink': '0%,41%,44.4%,86%,88.4%,90.4%,92.8%,100%{transform:scaleY(0)}42.6%,87.2%,91.6%{transform:scaleY(1)}',
  'cb-m-wave': '0%,52%,100%{transform:rotate(0)}60%{transform:rotate(-18deg)}68%{transform:rotate(8deg)}76%{transform:rotate(-16deg)}84%{transform:rotate(6deg)}92%{transform:rotate(-4deg)}',
  'cb-m-wave-up': '0%,100%{transform:rotate(0)}14%{transform:rotate(-118deg)}24%{transform:rotate(-132deg)}34%{transform:rotate(-104deg)}44%{transform:rotate(-132deg)}54%{transform:rotate(-108deg)}62%{transform:rotate(-118deg)}78%{transform:rotate(0)}',
  'cb-m-bob': '0%,100%{transform:translateY(0) rotate(0)}25%{transform:translateY(-1.6px) rotate(-3deg)}50%{transform:translateY(0) rotate(0)}75%{transform:translateY(-1.2px) rotate(2deg)}',
  'cb-m-glance': '0%,8%,92%,100%{transform:translate(0,0)}16%,38%{transform:translate(-2px,-1.6px)}46%,70%{transform:translate(2px,-1.8px)}78%,86%{transform:translate(.6px,.8px)}',
  'cb-m-ponder': '0%,100%{transform:translateY(-1px)}25%{transform:translateY(-2.4px)}',
  'cb-m-hop': '0%,100%{transform:translateY(0) scale(1,1)}18%{transform:translateY(0) scale(1.07,.92)}45%{transform:translateY(-8px) scale(.96,1.05)}70%{transform:translateY(0) scale(1.05,.95)}85%{transform:translateY(0) scale(.99,1.01)}',
  'cb-m-hop-shadow': '0%,18%,70%,100%{transform:scale(1);opacity:1}45%{transform:scale(.78);opacity:.55}',
  'cb-m-cheer': '0%,100%{transform:rotate(0)}45%{transform:rotate(-24deg)}',
  'cb-typing-sway': '0%, 100% { transform: rotate(-4deg) translateY(0.5px); } 50% { transform: rotate(4deg) translateY(-1px); }',
  'cb-typing-glance': '0%, 35%, 100% { transform: translate(0, 0); } 45%, 85% { transform: translate(2.2px, -1.6px); }',
  'cb-typing-blink': '0%, 92%, 100% { transform: scaleY(0); } 95% { transform: scaleY(1); }',
  'cb-typing-dot': '0%, 100% { opacity: 0.25; } 50% { opacity: 1; }',
  'cb-typing-write': '0% { stroke-dashoffset: 60; opacity: 1; } 75% { stroke-dashoffset: 0; opacity: 1; } 90% { stroke-dashoffset: 0; opacity: 1; } 100% { stroke-dashoffset: 0; opacity: 0; }',
  'cb-typing-pencil':
    '0% { transform: translate(2px, 11px); } 9% { transform: translate(6px, 6.5px); } 19% { transform: translate(11px, 10px); } 28% { transform: translate(16px, 13px); } 37% { transform: translate(19px, 9px); } 46% { transform: translate(24px, 5px); } 54% { transform: translate(27px, 10px); } 64% { transform: translate(32px, 12.5px); } 75%, 90% { transform: translate(36px, 8px); } 100% { transform: translate(2px, 11px); }',
} as const;
export type MascotKeyframesName = keyof typeof MASCOT_KEYFRAMES;

/** A CSS animation (name duration timing delay iterations) as a track. */
export const cssTrack = (name: MascotKeyframesName, duration: number, timing: string, iterations = 1, delay = 0): Track => ({
  keyframes: cssKeyframes(MASCOT_KEYFRAMES[name], timing),
  options: { duration, iterations, ...(delay ? { delay } : {}) },
});

/** The parts a mood moves (art3d classes): .cb-m-lid, -arm, -body, -look, -brow, -shadow. */
export type MoodPart = 'lid' | 'arm' | 'body' | 'look' | 'brow' | 'shadow';

export interface MoodPlan {
  parts: Partial<Record<MoodPart, Track[]>>;
  /** The big smile in place of the usual one (happy; kept under reduced motion). */
  grin: boolean;
  /** When every finite part is over (ms); the blink goes on. */
  settle: number;
  /** The blink's period: the loop after `settle` repeats it. */
  period: number;
}

export interface MoodOptions {
  /** The arm's pose as drawn ("down" lifts before it waves). */
  arm?: MascotArm;
  /** No arm (the bust). */
  bust?: boolean;
  /** --cb-m-wave-count: how many waves (Infinity: on and on). */
  waveCount?: number;
  reduced?: boolean;
}

const BLINK_MS = 6400;

/** A mood's tracks per part (mascotState: blink always, plus the mood's own). */
export const moodPlan = (mood: MascotMood, o: MoodOptions = {}): MoodPlan => {
  const grin = mood === 'happy';
  if (o.reduced) return { parts: {}, grin, settle: 0, period: 0 };
  const parts: Partial<Record<MoodPart, Track[]>> = { lid: [cssTrack('cb-m-blink', BLINK_MS, 'linear', Infinity)] };
  const arm = !o.bust;
  if (mood === 'wave' && arm) {
    const n = o.waveCount ?? Infinity;
    parts.arm = [o.arm === 'down' || o.arm === undefined ? cssTrack('cb-m-wave-up', 3200, 'ease-in-out', n) : cssTrack('cb-m-wave', 2800, 'ease-in-out', n)];
  }
  if (mood === 'think') {
    parts.body = [cssTrack('cb-m-bob', 3200, 'ease-in-out', Infinity)];
    parts.look = [cssTrack('cb-m-glance', 4800, 'ease-in-out', Infinity)];
    parts.brow = [cssTrack('cb-m-ponder', 3200, 'ease-in-out', Infinity)];
  }
  if (mood === 'happy') {
    const hop = 'cubic-bezier(.3,.7,.4,1)';
    parts.body = [cssTrack('cb-m-hop', 900, hop, 2)];
    parts.shadow = [cssTrack('cb-m-hop-shadow', 900, hop, 2)];
    if (arm) parts.arm = [cssTrack('cb-m-cheer', 900, 'ease-in-out', 2)];
  }
  let settle = 0;
  let loops = false;
  for (const tracks of Object.values(parts)) {
    for (const t of tracks || []) {
      if (t.options.iterations === Infinity) {
        if (t.options.duration !== BLINK_MS) loops = true;
      } else settle = Math.max(settle, (t.options.delay || 0) + t.options.duration * (t.options.iterations ?? 1));
    }
  }
  // Loops of their own (think, an endless wave): one lap of all of them together.
  const period = loops ? lcm(Object.values(parts).flatMap((ts) => (ts || []).filter((t) => t.options.iterations === Infinity).map((t) => t.options.duration))) : BLINK_MS;
  // The finite part done, the loop starts on a whole blink.
  return { parts, grin, settle: Math.ceil(settle / BLINK_MS) * BLINK_MS, period };
};

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const lcm = (xs: number[]): number => xs.reduce((m, x) => (m * x) / gcd(m, x), 1);

/** The typing mascot (polish.css): the whole bust sways, the lids blink, the pupils glance; the three dots rise. */
export const TYPING_MASCOT = {
  /** The bust's box, and its pivot (transform-origin 50% 90%). */
  size: 32,
  origin: [16, 28.8] as const,
  sway: cssTrack('cb-typing-sway', 2400, 'ease-in-out', Infinity),
  blink: cssTrack('cb-typing-blink', 3400, 'ease-in-out', Infinity),
  glance: cssTrack('cb-typing-glance', 2400, 'ease-in-out', Infinity),
  /** The thought dots: 4, 5 and 7 across, 0, 3 and 7 up, each 0.2s after the last. */
  dots: [
    { d: 4, up: 0, track: cssTrack('cb-typing-dot', 1200, 'ease-in-out', Infinity) },
    { d: 5, up: 3, track: cssTrack('cb-typing-dot', 1200, 'ease-in-out', Infinity, 200) },
    { d: 7, up: 7, track: cssTrack('cb-typing-dot', 1200, 'ease-in-out', Infinity, 400) },
  ],
  /** One lap of all of it (the clock loops this). */
  period: 40800,
} as const;

/** The pencil (polish.css .cb-typing--pencil): the line writes itself in 2s, the pencil riding its tip. */
export const TYPING_PENCIL = {
  write: cssTrack('cb-typing-write', 2000, 'linear', Infinity),
  pencil: cssTrack('cb-typing-pencil', 2000, 'linear', Infinity),
  line: 'M2 11 C 6 5, 9 5, 11 10 S 16 14, 19 9 S 25 4, 27 10 S 33 13, 36 8',
  dash: 60,
  period: 2000,
} as const;

/** "Pip is typing" when the owner named their mascot (chatChrome.ts typingBubbleHtml), else "Typing". */
export const typingLabel = (style: string, mascotName: string): string =>
  style === 'mascot' && mascotName ? `${mascotName} is typing` : 'Typing';
