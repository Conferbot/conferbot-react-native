/**
 * Idle call, as the web widget plays it (conferbot-widget
 * src/ts/launcher/idleCall.ts and idlePacing.ts): when the chat has sat
 * unopened a while, the mascot slips out from behind the launcher and calls
 * the visitor over.
 *
 *   customizations.launcherIdleCall:
 *     "off"   (default) nothing;
 *     "psst"  it sidles out, cups a hand to its mouth: "Psst!";
 *     "peek"  its head rises over the button, looks round, blinks;
 *     "wave"  it hops out and waves;
 *     "knock" it knocks on the button three times;
 *     "tap"   it taps the button twice, which dips.
 *   launcherIdleCallDelay: seconds before the call (5-120, default 12);
 *   launcherIdleCallText: the speech bubble's line (24 characters; default
 *     per style). Tapping the bubble opens the chat.
 *
 * The rules: one call per screen at most; paced over the app session (two
 * per session, 3 minutes apart); a visitor who opened the chat, or let both
 * calls go by, is left alone for 3 days; closing the greeting means no more
 * calls this session. A call waits (4s, then looks again) while the chat is
 * open, the app is in the background, the keyboard is up, an entrance is
 * landing, or the greeting has been up less than 15s; with the greeting up
 * the mascot only calls (the greeting does the talking: no bubble). Nothing
 * with reduced motion.
 *
 * Pure: the floating launcher drives the clock and keeps the pacing.
 */
import { localized } from './i18n';
import type { Track } from './keyframes';
import type { MascotArm } from './mascotArt';

export type LauncherIdleCall = 'off' | 'psst' | 'peek' | 'wave' | 'knock' | 'tap';
export const LAUNCHER_IDLE_CALLS: readonly LauncherIdleCall[] = ['off', 'psst', 'peek', 'wave', 'knock', 'tap'];
export const DEFAULT_LAUNCHER_IDLE_CALL: LauncherIdleCall = 'off';
export const DEFAULT_IDLE_CALL_DELAY = 12;
export const IDLE_CALL_TEXT_MAX = 24;
/** A blocked call looks again after this long. */
export const IDLE_CALL_RETRY_MS = 4000;
/** A greeting on screen gets this long alone before the mascot may call. */
export const GREETING_FIRST_MS = 15000;

/** The bubble's line per style, in the active language (web i18n idle.*). */
export const IDLE_CALL_LINES: Record<Exclude<LauncherIdleCall, 'off'>, string> = localized({
  psst: 'idle.psst',
  peek: 'idle.peek',
  wave: 'idle.wave',
  knock: 'idle.knock',
  tap: 'idle.tap',
});

export const normalizeLauncherIdleCall = (value: unknown): LauncherIdleCall =>
  LAUNCHER_IDLE_CALLS.includes(value as LauncherIdleCall) ? (value as LauncherIdleCall) : DEFAULT_LAUNCHER_IDLE_CALL;

export const normalizeIdleCallDelay = (value: unknown): number => {
  const n = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(n)) return DEFAULT_IDLE_CALL_DELAY;
  return Math.min(Math.max(Math.round(n), 5), 120);
};

/** The bubble's line: the owner's, trimmed and capped, else the style's. */
export const idleCallLine = (mode: LauncherIdleCall, text: unknown): string => {
  if (mode === 'off') return '';
  const own = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim().slice(0, IDLE_CALL_TEXT_MAX) : '';
  return own || IDLE_CALL_LINES[mode];
};

// ---- Pacing (idlePacing.ts): calling without nagging ----

export const MIN_GAP_MS = 3 * 60 * 1000;
export const SESSION_MAX = 2;
export const REST_MS = 3 * 24 * 60 * 60 * 1000;

export interface VisitState {
  /** Calls played this session. */
  n: number;
  /** When the last one played. */
  at: number;
  /** "Not now" (the greeting was closed). */
  quiet?: boolean;
}

/** May a call play now? */
export const callAllowed = (visit: VisitState, restUntil: number, now: number): boolean =>
  !visit.quiet && now >= restUntil && visit.n < SESSION_MAX && (!visit.at || now - visit.at >= MIN_GAP_MS);

/** A call just played: the new session state, and whether the visitor now rests (the last call). */
export const afterCall = (visit: VisitState, now: number): { visit: VisitState; rest: boolean } => {
  const v = { ...visit, n: visit.n + 1, at: now };
  return { visit: v, rest: v.n >= SESSION_MAX };
};

// ---- The performances ----

/**
 * The geometry, from the launcher: its short side (unit), which way the
 * screen is (-1: the launcher is on the right), the x of its edge facing
 * the screen and its height, in the stage (the launcher's own box); and
 * whether the greeting card is up.
 */
export interface IdleCallGeometry {
  unit: number;
  inward: 1 | -1;
  edgeX: number;
  width: number;
  height: number;
  card: boolean;
}

/** The mascot's parts the performance moves (art3d.ts mascot classes). */
export type MascotPart = 'body' | 'arm' | 'look' | 'lid' | 'brow' | 'smile' | 'o' | 'grin';

export interface IdleCallPerformance {
  total: number;
  /** When the speech bubble shows (none with the greeting up), and where it points (stage px). */
  bubbleAt: number;
  sayX: number;
  sayY: number;
  /** The mascot's box in the stage, mirrored (scale -1 1) when the launcher is on the left. */
  mascot: { x: number; y: number; size: number; arm: MascotArm; base: { sx: number } };
  /** The box's own movement, and each part's (in the drawing's 100 x 100 units). */
  self: Track[];
  parts: Partial<Record<MascotPart, Track[]>>;
  /** The launcher's jolt (knock, tap). */
  launcher: Track[];
  /** White rings where a knock / tap lands (stage px, centre and diameter). */
  ripples: { x: number; y: number; d: number; track: Track }[];
  /** The bubble's pop and fade (from bubbleAt). */
  bubble: Track;
  /** It speaks (a bubble) only when the greeting is not up. */
  talks: boolean;
  /** Drawn in front of the launcher (its paw lands on the button); else just behind it. */
  front: boolean;
}

const POP = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

/** Slide out past the facing edge, hold, slide back - fading in from behind. */
const slide = (dx: number, dy: number, total: number, rotate = '0deg'): Track => {
  const inAt = 380 / total;
  return {
    keyframes: [
      { translate: '0 0', rotate: '0deg', opacity: 0, scale: 0.7, easing: POP },
      { translate: `${dx}px ${dy}px`, rotate, opacity: 1, scale: 1, offset: inAt },
      { translate: `${dx}px ${dy}px`, rotate, opacity: 1, scale: 1, offset: 1 - inAt, easing: 'ease-in' },
      { translate: '0 0', rotate: '0deg', opacity: 0, scale: 0.7 },
    ],
    options: { duration: total, easing: 'linear', fill: 'forwards' },
  };
};

const ripple = (unit: number, x: number, y: number, delay: number) => ({
  x,
  y,
  d: unit * 0.55,
  track: {
    keyframes: [
      { opacity: 0.95, scale: 0.35 },
      { opacity: 0, scale: 1.7 },
    ],
    options: { duration: 520, delay, easing: 'ease-out', fill: 'forwards' as const },
  },
});

/** Blink (the lids are closed for ~70ms each time). */
const blink = (total: number, at: number[]): Track => ({
  keyframes: [
    { transform: 'scaleY(0)' },
    ...at.flatMap((o) => [
      { transform: 'scaleY(0)', offset: o - 0.02 },
      { transform: 'scaleY(1)', offset: o },
      { transform: 'scaleY(0)', offset: o + 0.02 },
    ]),
    { transform: 'scaleY(0)' },
  ],
  options: { duration: total, fill: 'forwards' },
});

/** Where the pupils look: [offset, x, y] in drawing units. */
const look = (total: number, path: Array<[number, number, number]>): Track => ({
  keyframes: [{ translate: '0 0' }, ...path.map(([o, x, y]) => ({ translate: `${x}px ${y}px`, offset: o, easing: 'ease-in-out' })), { translate: '0 0' }],
  options: { duration: total, fill: 'forwards' },
});

/** One mouth ("smile" rests) between two offsets. */
const mouth = (total: number, name: 'o' | 'grin', from: number, to: number): Partial<Record<MascotPart, Track[]>> => ({
  [name]: [
    {
      keyframes: [{ opacity: 0 }, { opacity: 0, offset: from }, { opacity: 1, offset: from + 0.02 }, { opacity: 1, offset: to }, { opacity: 0, offset: to + 0.02 }, { opacity: 0 }],
      options: { duration: total, fill: 'forwards' },
    },
  ],
  smile: [
    {
      keyframes: [{ opacity: 1 }, { opacity: 1, offset: from }, { opacity: 0, offset: from + 0.02 }, { opacity: 0, offset: to }, { opacity: 1, offset: to + 0.02 }, { opacity: 1 }],
      options: { duration: total, fill: 'forwards' },
    },
  ],
});

const brows = (total: number, from: number, to: number): Track => ({
  keyframes: [
    { translate: '0 0' },
    { translate: '0 0', offset: from },
    { translate: '0 -3.5px', offset: from + 0.05 },
    { translate: '0 -3.5px', offset: to },
    { translate: '0 0', offset: to + 0.05 },
    { translate: '0 0' },
  ],
  options: { duration: total, fill: 'forwards' },
});

const bubbleTrack = (total: number, at: number): Track => ({
  keyframes: [
    { opacity: 0, scale: 0.6, translate: '0 8px', easing: POP },
    { opacity: 1, scale: 1, translate: '0 0', offset: 0.12 },
    { opacity: 1, scale: 1, translate: '0 0', offset: 0.88, easing: 'ease-in' },
    { opacity: 0, scale: 0.9, translate: '0 4px' },
  ],
  options: { duration: total - at, delay: at, fill: 'forwards' },
});

/** The parts each mascot part starts from: closed-lid rest, the o and grin mouths hidden. */
export const MASCOT_PART_BASE: Partial<Record<MascotPart, { sy?: number; o?: number }>> = {
  lid: { sy: 0 },
  o: { o: 0 },
  grin: { o: 0 },
};

/**
 * The performance for a mode in this geometry (PERFORMANCES): the mascot,
 * a touch bigger than the button, is centred just inside the facing edge
 * (behind the button) and moves out from there.
 */
export const idleCallPerformance = (mode: Exclude<LauncherIdleCall, 'off'>, g: IdleCallGeometry): IdleCallPerformance => {
  const w = g.unit * 1.2;
  const place = (dy: number) => ({ x: g.edgeX - g.inward * (Math.min(w, g.width) / 2) - w / 2, y: g.height / 2 + dy - w / 2 });
  const base = { sx: g.inward === 1 ? -1 : 1 };
  const common = { launcher: [] as Track[], ripples: [] as IdleCallPerformance['ripples'], front: mode === 'tap' || mode === 'knock', talks: !g.card };
  if (mode === 'psst') {
    const total = 3600;
    const dx = g.inward * (w * 0.5);
    return {
      ...common,
      total,
      bubbleAt: 360,
      sayX: g.edgeX + dx,
      sayY: g.height / 2 - g.unit * 0.1 - w * 0.42,
      mascot: { ...place(-g.unit * 0.1), size: w, arm: 'whisper', base },
      self: [slide(dx, -g.unit * 0.06, total, `${g.inward * -6}deg`)],
      parts: {
        ...mouth(total, 'o', 0.14, 0.82),
        brow: [brows(total, 0.14, 0.8)],
        look: [
          look(total, [
            [0.16, 0, 0],
            [0.32, -2.5, -0.5],
            [0.44, -2.5, -0.5],
            [0.52, 1.5, 0],
            [0.72, 0, 0.5],
          ]),
        ],
        arm: [
          {
            keyframes: [{ rotate: '0deg' }, { rotate: '0deg', offset: 0.3 }, { rotate: '-8deg', offset: 0.36 }, { rotate: '0deg', offset: 0.42 }, { rotate: '-8deg', offset: 0.48 }, { rotate: '0deg', offset: 0.54 }, { rotate: '0deg' }],
            options: { duration: total, fill: 'forwards' },
          },
        ],
        lid: [blink(total, [0.62])],
      },
      bubble: bubbleTrack(total, 360),
    };
  }
  if (mode === 'peek') {
    const total = 3800;
    const dx = g.card ? g.inward * (w * 0.55) : -g.inward * w * 0.15;
    const dy = g.card ? -g.unit * 0.05 : -(g.height * 0.5 + w * 0.08);
    return {
      ...common,
      total,
      bubbleAt: 560,
      sayX: g.edgeX + dx,
      sayY: g.height / 2 + dy - w * 0.35,
      mascot: { ...place(g.card ? 0 : g.height * 0.05), size: w, arm: 'down', base },
      self: [
        {
          keyframes: [
            { translate: '0 0', opacity: 0, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
            { translate: `${dx}px ${dy}px`, opacity: 1, offset: 0.12 },
            { translate: `${dx}px ${dy + 3}px`, offset: 0.5 },
            { translate: `${dx}px ${dy}px`, opacity: 1, offset: 0.86, easing: 'ease-in' },
            { translate: '0 0', opacity: 0 },
          ],
          options: { duration: total, fill: 'forwards' },
        },
      ],
      parts: {
        look: [
          look(total, [
            [0.18, 0, 0],
            [0.28, -3, 0],
            [0.4, -3, 0],
            [0.5, 3, 0],
            [0.62, 3, 0],
            [0.7, 0, 1],
          ]),
        ],
        brow: [brows(total, 0.2, 0.36)],
        lid: [blink(total, [0.46, 0.76])],
      },
      bubble: bubbleTrack(total, 560),
    };
  }
  if (mode === 'wave') {
    const total = 3500;
    const dx = g.inward * (w * 0.62 + g.unit * 0.05);
    return {
      ...common,
      total,
      bubbleAt: 320,
      sayX: g.edgeX + dx,
      sayY: g.height / 2 - g.unit * 0.1 - w * 0.46,
      mascot: { ...place(-g.unit * 0.08), size: w, arm: 'wave', base },
      self: [slide(dx, -g.unit * 0.1, total)],
      parts: {
        body: [
          {
            keyframes: [{ scale: '1 1' }, { scale: '1.12 0.88', offset: 0.06 }, { scale: '0.92 1.1', offset: 0.12 }, { scale: '1.04 0.96', offset: 0.18 }, { scale: '1 1', offset: 0.24 }, { scale: '1 1' }],
            options: { duration: total, fill: 'forwards' },
          },
        ],
        ...mouth(total, 'grin', 0.12, 0.84),
        arm: [
          {
            keyframes: [
              { rotate: '0deg' },
              { rotate: '0deg', offset: 0.14 },
              { rotate: '-24deg', offset: 0.24 },
              { rotate: '18deg', offset: 0.36 },
              { rotate: '-24deg', offset: 0.48 },
              { rotate: '18deg', offset: 0.6 },
              { rotate: '-10deg', offset: 0.7 },
              { rotate: '0deg', offset: 0.78 },
              { rotate: '0deg' },
            ],
            options: { duration: total, fill: 'forwards' },
          },
        ],
        look: [look(total, [[0.2, 0, 1]])],
        lid: [blink(total, [0.66])],
      },
      bubble: bubbleTrack(total, 320),
    };
  }
  if (mode === 'knock') {
    const total = 3500;
    const dx = g.inward * (w * 0.9);
    const beats = [0.3, 0.41, 0.52];
    return {
      ...common,
      total,
      bubbleAt: 320,
      sayX: g.edgeX + dx,
      sayY: g.height / 2 - g.unit * 0.08 - w * 0.42,
      mascot: { ...place(-g.unit * 0.04), size: w, arm: 'knock', base },
      self: [slide(dx, -g.unit * 0.08, total)],
      parts: {
        arm: [
          {
            keyframes: [
              { translate: '0 0', rotate: '0deg' },
              ...beats.flatMap((o) => [
                { translate: '0 0', rotate: '0deg', offset: o - 0.045 },
                { translate: '4px 0.5px', rotate: '5deg', offset: o, easing: 'cubic-bezier(.5,0,.9,.4)' },
                { translate: '0 0', rotate: '0deg', offset: o + 0.05, easing: 'cubic-bezier(.2,.8,.4,1)' },
              ]),
              { translate: '0 0', rotate: '0deg' },
            ],
            options: { duration: total, fill: 'forwards' },
          },
        ],
        body: [
          {
            keyframes: [
              { rotate: '0deg' },
              ...beats.flatMap((o) => [
                { rotate: '0deg', offset: o - 0.045 },
                { rotate: '2.5deg', offset: o },
                { rotate: '0deg', offset: o + 0.05 },
              ]),
              { rotate: '0deg' },
            ],
            options: { duration: total, fill: 'forwards' },
          },
        ],
        lid: [
          {
            keyframes: [
              { transform: 'scaleY(0)' },
              ...beats.flatMap((o) => [
                { transform: 'scaleY(0)', offset: o - 0.03 },
                { transform: 'scaleY(0.5)', offset: o },
                { transform: 'scaleY(0)', offset: o + 0.04 },
              ]),
              { transform: 'scaleY(0)' },
            ],
            options: { duration: total, fill: 'forwards' },
          },
        ],
        ...mouth(total, 'grin', 0.26, 0.8),
        look: [look(total, [[0.2, 0, 1]])],
      },
      launcher: beats.map((o) => ({
        keyframes: [{ translate: '0 0' }, { translate: `${-g.inward * 2}px 0`, offset: 0.35 }, { translate: '0 0' }],
        options: { duration: 200, delay: o * total, easing: 'ease-out' },
      })),
      ripples: beats.map((o) => ripple(g.unit, g.edgeX - g.inward * g.unit * 0.08, g.height / 2 - g.unit * 0.12, o * total)),
      bubble: bubbleTrack(total, 320),
    };
  }
  // tap
  const total = 3300;
  const dx = g.inward * (w * 0.98);
  const taps = [0.32, 0.46];
  return {
    ...common,
    total,
    bubbleAt: 320,
    sayX: g.edgeX + dx,
    sayY: g.height / 2 - w * 0.42,
    mascot: { ...place(-g.unit * 0.02), size: w, arm: 'reach', base },
    self: [slide(dx, 0, total)],
    parts: {
      arm: [
        {
          keyframes: [
            { translate: '0 0' },
            ...taps.flatMap((o) => [
              { translate: '0 0', offset: o - 0.05 },
              { translate: '5px 1px', offset: o, easing: 'cubic-bezier(.5,0,.9,.4)' },
              { translate: '0 0', offset: o + 0.06, easing: 'cubic-bezier(.2,.8,.4,1)' },
            ]),
            { translate: '0 0' },
          ],
          options: { duration: total, fill: 'forwards' },
        },
      ],
      look: [
        look(total, [
          [0.16, 3, 1],
          [0.52, 3, 1],
          [0.62, 0, 0],
        ]),
      ],
      ...mouth(total, 'grin', 0.58, 0.84),
      lid: [blink(total, [0.7])],
    },
    launcher: taps.map((o) => ({
      keyframes: [{ scale: 1 }, { scale: 0.92, offset: 0.4 }, { scale: 1 }],
      options: { duration: 240, delay: o * total, easing: 'ease-out' },
    })),
    ripples: taps.map((o) => ripple(g.unit, g.edgeX - g.inward * g.unit * 0.18, g.height / 2, o * total)),
    bubble: bubbleTrack(total, 320),
  };
};

/** The idle call's geometry for a launcher of this size on this side. */
export const idleCallGeometry = (width: number, height: number, position: 'left' | 'right', card: boolean): IdleCallGeometry => {
  const inward: 1 | -1 = position === 'right' ? -1 : 1;
  return { unit: Math.min(width, height), inward, edgeX: inward === -1 ? 0 : width, width, height, card };
};
