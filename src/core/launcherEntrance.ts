/**
 * Launcher entrance, as the web widget plays it (conferbot-widget
 * src/ts/launcher/entrance.ts): how the launcher arrives the first time it
 * shows, instead of simply being there.
 *
 *   customizations.launcherEntrance:
 *     "classic"   (default) it just appears;
 *     "lightning" a bolt strikes the corner, and the launcher is in the flash;
 *     "rocket"    a rocket comes down, burns to land, and becomes the launcher;
 *     "portal"    a ring of light opens and the launcher rises out of it;
 *     "ufo"       a saucer flies in and beams the launcher down;
 *     "drop"      it falls in, squashes on landing, and bounces;
 *     "confetti"  it pops in with a burst of confetti;
 *     "coin"      it flips in like a coin and catches the light;
 *     "meteor", "magic", "parachute", "plane", "egg" (newer, same rules).
 *
 * The rules (the hook keeps them): once per app session per bot and
 * entrance; never when the chat is open; nothing with reduced motion. The
 * launcher is held invisible until the effect reveals it (it still takes a
 * tap, which ends the entrance and opens the chat). While it lands the
 * greeting card stays hidden; 150ms after it has landed the card fades up
 * (0.9s). Attention and the idle call wait for it.
 *
 * Each effect is a set of sprites (drawings with their Web Animations
 * tracks) on a stage laid over the launcher, plus the launcher's own
 * arrival track. Filters (brightness, glows, blur) have no counterpart in
 * react-native-svg and are left out; the movement, timing and opacity are
 * the web's. Pure: the floating launcher drives the clock.
 */
import { evaluate } from './keyframes';
import type { FxValues, Keyframe, Track } from './keyframes';
import { conicDisc, flattenPath, linearBox, pointAlong, radialDisc, radialWash, stops } from './fxPaint';

export type LauncherEntrance =
  | 'classic'
  | 'lightning'
  | 'rocket'
  | 'portal'
  | 'ufo'
  | 'drop'
  | 'confetti'
  | 'coin'
  | 'meteor'
  | 'magic'
  | 'parachute'
  | 'plane'
  | 'egg';
export const LAUNCHER_ENTRANCES: readonly LauncherEntrance[] = ['classic', 'lightning', 'rocket', 'portal', 'ufo', 'drop', 'confetti', 'coin', 'meteor', 'magic', 'parachute', 'plane', 'egg'];
export const DEFAULT_LAUNCHER_ENTRANCE: LauncherEntrance = 'classic';

export const normalizeLauncherEntrance = (value: unknown): LauncherEntrance =>
  LAUNCHER_ENTRANCES.includes(value as LauncherEntrance) ? (value as LauncherEntrance) : DEFAULT_LAUNCHER_ENTRANCE;

/** Whether this mount plays an entrance. */
export const shouldPlayEntrance = (o: { mode: LauncherEntrance; reducedMotion: boolean; chatOpen: boolean; played: boolean }): boolean =>
  o.mode !== 'classic' && !o.reducedMotion && !o.chatOpen && !o.played;

/** After the launcher lands: a beat, then the rest fades up. */
export const SETTLE_BEAT_MS = 150;
export const SETTLE_FADE_MS = 900;
/** The launcher must be laid out this long before the effect starts. */
export const ENTRANCE_START_MS = 60;

/** The greeting (and anything else beside the launcher) fading up after the landing (cb-ent-reveal). */
export const SETTLE_REVEAL: Track = {
  keyframes: [
    { opacity: 0, translate: '0 10px' },
    { opacity: 1, translate: '0 0' },
  ],
  options: { duration: SETTLE_FADE_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' },
};

/**
 * The stage laid over the launcher. Sizes come from `unit`, the button's
 * short side; (cx, cy) is its centre; `above` the distance from its bottom
 * to the top of the screen; `inward` -1 when it sits on the right.
 */
export interface EntranceStage {
  w: number;
  h: number;
  unit: number;
  cx: number;
  cy: number;
  above: number;
  inward: 1 | -1;
  accent: string;
  /** The launcher's top-left on the screen, and the screen's size. */
  rect: { left: number; top: number };
  win: { w: number; h: number };
}

export const entranceStage = (o: { width: number; height: number; position: 'left' | 'right'; screenWidth: number; screenHeight: number; side: number; bottom: number; accent: string }): EntranceStage => {
  const left = o.position === 'right' ? o.screenWidth - o.side - o.width : o.side;
  const top = o.screenHeight - o.bottom - o.height;
  return {
    w: o.width,
    h: o.height,
    unit: Math.min(o.width, o.height),
    cx: o.width / 2,
    cy: o.height / 2,
    above: top + o.height,
    inward: left + o.width / 2 > o.screenWidth / 2 ? -1 : 1,
    accent: o.accent,
    rect: { left, top },
    win: { w: o.screenWidth, h: o.screenHeight },
  };
};

/** One drawing on the stage, with its animations. Children sit in its box and move with it. */
export interface FxSprite {
  x: number;
  y: number;
  w: number;
  h: number;
  /** The drawing (svg markup for w x h), or a plain box of a colour. */
  svg?: string;
  fill?: string;
  radius?: number;
  /** The pivot, in px inside the box (default: its centre). */
  origin?: [number, number];
  /** Its own static values (an opacity of 0 until it plays, a fixed rotate...). */
  base?: Partial<FxValues>;
  tracks: Track[];
  /** offset-path: the box's centre follows this path (px from the box's own top-left), turning with it when `rotate`. */
  path?: { d: string; rotate: boolean };
  /** A stroke drawn on (stroke-dashoffset 100 -> 0), shown as a wipe of the drawing. */
  wipe?: 'down' | 'right';
  /** Children are clipped to the box, with this corner radius. */
  clip?: number;
  /** `left` animates as a share of this width (px). */
  leftOf?: number;
  children?: FxSprite[];
}

export interface EntrancePlan {
  /** When the launcher itself appears (ms from the start), and how. */
  revealAt: number;
  arrive: Track;
  /** When the whole effect is over and the stage goes. */
  total: number;
  sprites: FxSprite[];
  /** Drawn just behind the launcher (it rises out of it). */
  behind: boolean;
}

/** When each phase starts: the landing, the rest fading up, the end. */
export const entranceTimeline = (p: EntrancePlan): { landAt: number; landedAt: number; settleAt: number; endAt: number } => {
  const landedAt = p.revealAt + p.arrive.options.duration;
  return { landAt: p.revealAt, landedAt, settleAt: landedAt + SETTLE_BEAT_MS, endAt: Math.max(p.total, landedAt + SETTLE_BEAT_MS + SETTLE_FADE_MS) + 60 };
};

const COLORS = ['#f59e0b', '#ec4899', '#22c55e', '#3b82f6', '#a855f7', '#ef4444'];

export const seeded = (seed: number) => {
  let r = seed || 1;
  return () => {
    r = (r * 9301 + 49297) % 233280;
    return r / 233280;
  };
};

/** A lightning channel by midpoint displacement: points, top to bottom. */
export const boltPoints = (x1: number, y1: number, x2: number, y2: number, spread: number, rand: () => number, depth = 6): Array<[number, number]> => {
  let pts: Array<[number, number]> = [
    [x1, y1],
    [x2, y2],
  ];
  let disp = spread;
  for (let d = 0; d < depth; d++) {
    const next: Array<[number, number]> = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1];
      const [bx, by] = pts[i];
      next.push([(ax + bx) / 2 + (rand() - 0.5) * disp, (ay + by) / 2 + (rand() - 0.5) * disp * 0.25]);
      next.push(pts[i]);
    }
    pts = next;
    disp *= 0.55;
  }
  return pts;
};

const toPath = (pts: Array<[number, number]>) => `M${pts.map(([x, y]) => `${+x.toFixed(1)},${+y.toFixed(1)}`).join(' L')}`;
const svgOf = (w: number, h: number, vb: string, inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${+w.toFixed(2)}" height="${+h.toFixed(2)}" viewBox="${vb}">${inner}</svg>`;

type Play = (keyframes: Keyframe[], options: Track['options']) => Track;
const play: Play = (keyframes, options) => ({ keyframes, options });

// ---- Shared pieces ----

/** A soft smoke puff at (x, y), drifting by (dx, dy) as it grows and fades. */
const puff = (s: EntranceStage, x: number, y: number, d: number, delay: number, dx: number, dy: number, dur = 900, tint = 'rgba(203, 213, 225, 0.9)'): FxSprite => ({
  x: x - d / 2,
  y: y - d / 2,
  w: d,
  h: d,
  svg: radialDisc(d, d, stops(tint, 'rgba(148, 163, 184, 0)')),
  base: { o: 0 },
  tracks: [play([{ opacity: 0, translate: '0 0', scale: 0.4 }, { opacity: 0.9, offset: 0.2 }, { opacity: 0, translate: `${dx}px ${dy}px`, scale: 1.9 }], { duration: dur, delay, easing: 'ease-out', fill: 'forwards' })],
});

/** A ground shockwave: a flattened ring racing out from under the button. */
const shockwave = (s: EntranceStage, delay: number, color = 'rgba(255, 255, 255, 0.9)', spread = 2.6): FxSprite => {
  const w = s.w + s.unit * 0.4;
  const h = s.unit * 0.5;
  return {
    x: s.cx - w / 2,
    y: s.h - s.unit * 0.25,
    w,
    h,
    // A 2px border with a soft glow (box-shadow 0 0 10px).
    svg: svgOf(w, h, `0 0 ${w} ${h}`, `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2 - 1}" ry="${h / 2 - 1}" fill="none" stroke="${color}" stroke-width="6" stroke-opacity="0.25"/><ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2 - 1}" ry="${h / 2 - 1}" fill="none" stroke="${color}" stroke-width="2"/>`),
    base: { o: 0 },
    tracks: [play([{ opacity: 0.95, scale: 0.4 }, { opacity: 0, scale: spread }], { duration: 650, delay, easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)', fill: 'forwards' })],
  };
};

const STAR4 = 'M6 0 L7.2 4.8 L12 6 L7.2 7.2 L6 12 L4.8 7.2 L0 6 L4.8 4.8 Z';

/** Twinkling four-point stars round the button. */
const sparkles = (s: EntranceStage, n: number, delay: number, color = '#fde047', reach = 1): FxSprite[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + 0.4;
    const x = s.cx + Math.cos(a) * (s.w / 2 + s.unit * 0.3 * reach);
    const y = s.cy + Math.sin(a) * (s.h / 2 + s.unit * 0.3 * reach);
    const size = 9 + (i % 3) * 4;
    return {
      x: x - size / 2,
      y: y - size / 2,
      w: size,
      h: size,
      svg: svgOf(size, size, '0 0 12 12', `<path d="${STAR4}" fill="${color}"/>`),
      base: { o: 0 },
      tracks: [
        play([{ opacity: 0, scale: 0, rotate: '0deg' }, { opacity: 1, scale: 1.25, rotate: '60deg', offset: 0.45 }, { opacity: 0, scale: 0.3, rotate: '120deg' }], {
          duration: 620,
          delay: delay + i * 55,
          easing: 'ease-out',
          fill: 'forwards',
        }),
      ],
    };
  });

/** Bits thrown up from the button's base that fall back with gravity. */
const debris = (s: EntranceStage, n: number, delay: number, colors: string[], size = 5, height = 1): FxSprite[] =>
  Array.from({ length: n }, (_, i) => {
    const dir = i % 2 ? 1 : -1;
    const dx = dir * (s.w / 2 + s.unit * (0.2 + (i % 4) * 0.22));
    const up = s.unit * (0.5 + ((i * 3) % 5) * 0.16) * height;
    const d = size + (i % 3) * 2;
    return {
      x: s.cx - d / 2,
      y: s.h - d,
      w: d,
      h: d * 0.8,
      fill: colors[i % colors.length],
      radius: d * 0.35,
      base: { o: 0 },
      tracks: [
        play(
          [
            { opacity: 1, translate: '0 0', rotate: '0deg', easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)' },
            { opacity: 1, translate: `${dx * 0.6}px -${up}px`, rotate: `${dir * 200}deg`, offset: 0.4, easing: 'cubic-bezier(0.5, 0, 0.9, 0.5)' },
            { opacity: 0, translate: `${dx}px ${s.unit * 0.2}px`, rotate: `${dir * 420}deg` },
          ],
          { duration: 820, delay, fill: 'forwards' }
        ),
      ],
    };
  });

/** A launcher arrival that lands with a jolt (for impacts). */
const joltArrival = (duration: number, from: Keyframe): Track => ({
  keyframes: [
    { opacity: 0, scale: 0.4, translate: '0 0', ...from },
    { opacity: 1, scale: 1.15, translate: '-3px 0', offset: 0.18 },
    { scale: 0.95, translate: '3px 1px', offset: 0.3 },
    { scale: 1.03, translate: '-2px 0', offset: 0.42 },
    { scale: 1, translate: '1px 0', offset: 0.54 },
    { opacity: 1, scale: 1, translate: '0 0', filter: 'none' },
  ],
  options: { duration, easing: 'linear' },
});

/** A sprite's tracks delayed (lightning: everything after the storm gathers). */
const later = (sp: FxSprite, ms: number): FxSprite => ({
  ...sp,
  tracks: sp.tracks.map((t) => ({ ...t, options: { ...t.options, delay: Number(t.options.delay || 0) + ms } })),
  children: sp.children?.map((c) => later(c, ms)),
});

type Effect = (s: EntranceStage, rand: () => number) => EntrancePlan;

const EFFECTS: Record<Exclude<LauncherEntrance, 'classic'>, Effect> = {
  // A storm gathers (the corner of the screen dims), then a blue-white
  // bolt with forks races down, flashes, restrikes and fades; sky light,
  // a burst, crackles and a wisp of smoke at the strike point.
  lightning: (s, rand) => {
    const DARK = 240;
    const sprites: FxSprite[] = [];
    sprites.push({
      x: -s.rect.left,
      y: -s.rect.top,
      w: s.win.w,
      h: s.win.h,
      svg: radialWash(s.win.w, s.win.h, s.rect.left + s.cx, s.rect.top, s.win.w * 0.6, s.win.h * 0.85, stops('rgba(8, 12, 32, 0.55)', ['rgba(8, 12, 32, 0.18)', 55], ['rgba(8, 12, 32, 0)', 80])),
      base: { o: 0 },
      tracks: [play([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.45 }, { opacity: 0 }], { duration: 1150, easing: 'ease-in-out', fill: 'forwards' })],
    });
    const after: FxSprite[] = [];
    const h = Math.min(s.above + s.cy, 560);
    const W = 220;
    const x = W / 2;
    const main = boltPoints(x, 0, x, h, Math.max(24, h * 0.22), rand);
    main[main.length - 1] = [x, h];
    const branches: string[] = [];
    for (let i = 0; i < 3; i++) {
      const at = main[Math.floor(main.length * (0.25 + i * 0.18 + rand() * 0.08))];
      const dir = rand() > 0.5 ? 1 : -1;
      const len = h * (0.18 + rand() * 0.16);
      const b = boltPoints(at[0], at[1], at[0] + dir * len * (0.4 + rand() * 0.4), at[1] + len, len * 0.35, rand, 4);
      branches.push(toPath(b));
    }
    const all = [toPath(main), ...branches];
    // Glow, halo and core; the blurred layers are a little fainter without the blur.
    const layer = (d: string, width: number, color: string, opacity: number) =>
      `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const bolt =
      all.map((d, i) => layer(d, i ? 8 : 16, '#6d9eff', (i ? 0.35 : 0.45) * 0.55)).join('') +
      all.map((d, i) => layer(d, i ? 2.6 : 5, '#c7dcff', (i ? 0.7 : 0.95) * 0.85)).join('') +
      all.map((d, i) => layer(d, i ? 1 : 2, '#ffffff', 1)).join('');
    after.push({
      x: s.cx - x,
      y: s.cy - h,
      w: W,
      h,
      svg: svgOf(W, h, `0 0 ${W} ${h}`, bolt),
      // Stepped leader: every channel races down in ~110ms.
      wipe: 'down',
      base: { dash: 100 },
      tracks: [
        play([{ strokeDashoffset: 100 }, { strokeDashoffset: 0 }], { duration: 110, easing: 'linear', fill: 'forwards' }),
        // Return stroke, a dim beat, one restrike, then the channel fades.
        play([{ opacity: 1 }, { opacity: 1, offset: 0.2 }, { opacity: 0.25, offset: 0.3 }, { opacity: 1, offset: 0.38 }, { opacity: 0.55, offset: 0.55 }, { opacity: 0 }], { duration: 560, fill: 'forwards' }),
      ],
    });
    // Sky light: the screen lights up blue-white round the strike, twice.
    const skyH = s.rect.top + s.h;
    after.push({
      x: -s.rect.left,
      y: -s.rect.top,
      w: s.win.w,
      h: skyH,
      svg: radialWash(s.win.w, skyH, s.rect.left + s.cx, skyH * 0.55, s.win.w * 0.45, skyH * 0.7, stops('rgba(210, 226, 255, 0.55)', ['rgba(210, 226, 255, 0)', 70])),
      base: { o: 0 },
      tracks: [play([{ opacity: 0 }, { opacity: 0.85, offset: 0.2 }, { opacity: 0.12, offset: 0.34 }, { opacity: 0.6, offset: 0.42 }, { opacity: 0 }], { duration: 620, fill: 'forwards' })],
    });
    const d = s.unit * 3.2;
    after.push({
      x: s.cx - d / 2,
      y: s.cy - d / 2,
      w: d,
      h: d,
      svg: radialDisc(d, d, stops('#ffffff', ['rgba(186, 212, 255, 0.9)', 30], ['rgba(109, 158, 255, 0.35)', 55], ['transparent', 75])),
      base: { o: 0 },
      tracks: [play([{ opacity: 0, scale: 0.2 }, { opacity: 1, scale: 1, offset: 0.25 }, { opacity: 0.3, scale: 1.1, offset: 0.5 }, { opacity: 0, scale: 1.45 }], { duration: 640, delay: 100, easing: 'ease-out', fill: 'forwards' })],
    });
    // Crackles: tiny arcs that flicker round the button.
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rand();
      const r1 = s.unit * 0.55;
      const r2 = s.unit * (0.95 + rand() * 0.35);
      const pts = boltPoints(Math.cos(a) * r1, Math.sin(a) * r1, Math.cos(a) * r2, Math.sin(a) * r2, s.unit * 0.25, rand, 3);
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      const x0 = Math.min(...xs) - 2;
      const y0 = Math.min(...ys) - 2;
      const bw = Math.max(...xs) - x0 + 2;
      const bh = Math.max(...ys) - y0 + 2;
      after.push({
        x: s.cx + x0,
        y: s.cy + y0,
        w: bw,
        h: bh,
        svg: svgOf(bw, bh, `${x0} ${y0} ${bw} ${bh}`, `<path d="${toPath(pts)}" fill="none" stroke="#e0ecff" stroke-width="1.6" stroke-linecap="round"/>`),
        base: { o: 0 },
        tracks: [play([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 0.1, offset: 0.3 }, { opacity: 1, offset: 0.45 }, { opacity: 0 }], { duration: 380, delay: 110 + i * 35, fill: 'forwards' })],
      });
    }
    // A wisp of smoke once it has struck.
    for (let i = 0; i < 3; i++) {
      const pd = s.unit * (0.5 + i * 0.15);
      after.push({
        x: s.cx - pd / 2 + (i - 1) * s.unit * 0.25,
        y: s.cy - pd / 2,
        w: pd,
        h: pd,
        svg: radialDisc(pd, pd, stops('rgba(203, 213, 225, 0.85)', 'rgba(148, 163, 184, 0)')),
        base: { o: 0 },
        tracks: [play([{ opacity: 0, translate: '0 0', scale: 0.5 }, { opacity: 0.55, offset: 0.3 }, { opacity: 0, translate: `0 -${s.unit * 0.9}px`, scale: 1.6 }], { duration: 1100, delay: 320 + i * 90, easing: 'ease-out', fill: 'forwards' })],
      });
    }
    return {
      revealAt: DARK + 110,
      arrive: {
        keyframes: [
          { opacity: 0, scale: 0.4, translate: '0 0', filter: 'brightness(3) drop-shadow(0 0 18px #9ec5ff)' },
          { opacity: 1, scale: 1.16, translate: '-3px 0', offset: 0.14, filter: 'brightness(2.2) drop-shadow(0 0 16px #9ec5ff)' },
          { scale: 0.96, translate: '3px 1px', offset: 0.24 },
          { scale: 1.03, translate: '-2px 0', offset: 0.34, filter: 'brightness(1.4) drop-shadow(0 0 12px #9ec5ff)' },
          { scale: 1, translate: '1px 0', offset: 0.44 },
          { opacity: 1, scale: 1, translate: '0 0', filter: 'brightness(1) drop-shadow(0 0 0 rgba(158, 197, 255, 0))' },
        ],
        options: { duration: 1100, easing: 'ease-out' },
      },
      total: DARK + 1500,
      sprites: [...sprites, ...after.map((sp) => later(sp, DARK))],
      behind: false,
    };
  },

  // A rocket comes down on a flickering flame that burns harder as it
  // slows, leaving a smoke trail; legs unfold for touchdown, a dust ring
  // races out, and the rocket becomes the button.
  rocket: (s) => {
    const w = s.unit * 0.78;
    const h = s.unit * 1.6;
    const k = w / 40;
    const accent = s.accent;
    // The drawing reaches past its 40 x 82 box (the flame, the fins): drawn padded.
    const pad = (inner: string, ox: number, oy: number): FxSprite => ({
      x: -5 * k,
      y: -2 * k,
      w: 50 * k,
      h: 92 * k,
      origin: [(ox + 5) * k, (oy + 2) * k],
      svg: svgOf(50 * k, 92 * k, '-5 -2 50 92', inner),
      tracks: [],
    });
    const body =
      `<defs><linearGradient id="b" x1="0" x2="1"><stop offset="0" stop-color="#94a3b8"/><stop offset="0.4" stop-color="#ffffff"/><stop offset="0.7" stop-color="#e2e8f0"/><stop offset="1" stop-color="#64748b"/></linearGradient>` +
      `<radialGradient id="w" cx="0.35" cy="0.35" r="0.7"><stop offset="0" stop-color="#e0f2fe"/><stop offset="1" stop-color="${accent}"/></radialGradient></defs>` +
      `<path d="M20 1 C32 11 34 28 33 46 L33 58 L7 58 L7 46 C6 28 8 11 20 1 Z" fill="url(#b)" stroke="#64748b" stroke-width="1"/>` +
      `<path d="M7 38 L-1 54 L7 57 Z M33 38 L41 54 L33 57 Z" fill="${accent}" stroke="rgba(15,23,42,0.35)" stroke-width="1"/>` +
      `<path d="M14 10 Q20 4 26 10" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>` +
      `<circle cx="20" cy="27" r="7" fill="url(#w)" stroke="#64748b" stroke-width="1.4"/>` +
      `<ellipse cx="17.5" cy="24.5" rx="2.4" ry="1.6" fill="#fff" opacity="0.9"/>` +
      `<path d="M12 22 V50" stroke="#fff" stroke-width="2" opacity="0.7" stroke-linecap="round"/>`;
    const flame =
      `<defs><radialGradient id="f" cx="0.5" cy="0.1" r="0.9"><stop offset="0" stop-color="#fffbeb"/><stop offset="0.35" stop-color="#fde047"/><stop offset="0.7" stop-color="#fb923c"/><stop offset="1" stop-color="#ef4444" stop-opacity="0"/></radialGradient></defs>` +
      `<ellipse cx="20" cy="70" rx="9" ry="16" fill="url(#f)"/><ellipse cx="20" cy="66" rx="5" ry="10" fill="#fffbeb" opacity="0.9"/>`;
    const legs = `<path d="M9 50 L3 64 M31 50 L37 64" stroke="#475569" stroke-width="2.4" stroke-linecap="round"/>`;
    const fall = s.above + h + 40;
    const D = 1250;
    const decel = 'cubic-bezier(0.22, 0.7, 0.3, 1)';
    const legsL = pad(legs, 20, 56);
    legsL.tracks = [play([{ scale: '1 0' }, { scale: '1 0', offset: 0.7 }, { scale: '1 1' }], { duration: D, fill: 'forwards' })];
    const flameL = pad(flame, 20, 58);
    flameL.tracks = [
      play([{ scale: '1 1' }, { scale: '0.85 1.15' }, { scale: '1.05 0.9' }, { scale: '1 1' }], { duration: 120, iterations: Math.ceil(D / 120) }),
      play([{ opacity: 0.8 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: D + 100, fill: 'forwards' }),
    ];
    const rocket: FxSprite = {
      x: s.cx - w / 2,
      y: s.h - h,
      w,
      h,
      tracks: [
        play([{ translate: `0 -${fall}px`, rotate: '-3deg' }, { translate: '0 -10px', rotate: '1.5deg', offset: 0.88 }, { translate: '0 0', rotate: '0deg' }], { duration: D, easing: decel, fill: 'forwards' }),
        play([{ opacity: 1, scale: 1 }, { opacity: 0, scale: 0.5 }], { duration: 260, delay: D + 60, easing: 'ease-in', fill: 'forwards' }),
      ],
      children: [legsL, flameL, pad(body, 20, 41)],
    };
    const sprites: FxSprite[] = [];
    // Smoke left along the path: where the rocket is at each moment.
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    for (let i = 0; i < 9; i++) {
      const t = 0.1 + i * 0.09;
      const y = s.h - (1 - ease(t)) * fall + s.unit * 0.1;
      if (y < -s.rect.top) continue;
      sprites.push(puff(s, s.cx + (i % 2 ? 3 : -3), y, s.unit * (0.35 + i * 0.03), t * D, (i % 2 ? 1 : -1) * s.unit * 0.25, -s.unit * 0.2, 1100));
    }
    sprites.push(rocket);
    // Touchdown: a dust ring, dust both ways.
    sprites.push(shockwave(s, D - 40, 'rgba(226, 232, 240, 0.95)'));
    for (let i = 0; i < 8; i++) {
      const dir = i % 2 ? 1 : -1;
      sprites.push(puff(s, s.cx, s.h - s.unit * 0.1, s.unit * (0.35 + (i % 3) * 0.12), D - 60 + i * 25, dir * (s.w / 2 + s.unit * (0.3 + (i >> 1) * 0.25)), -s.unit * 0.15, 900));
    }
    return { revealAt: D + 80, arrive: joltArrival(520, {}), total: D + 1100, sprites, behind: false };
  },

  // A flat, glowing vortex opens on the ground under the button (rings
  // spinning inside a squashed frame), sparks spiral in, a column of light
  // rises; drawn BEHIND the button, which rises out of it; a flash closes it.
  portal: (s) => {
    const W = Math.max(s.w * 1.35, s.unit * 2);
    const H = W * 0.32;
    const cy = s.h - H * 0.15;
    const disc = (inset: number, svg: string, spin: number, dur: number): FxSprite => ({
      x: inset,
      y: inset,
      w: W - inset * 2,
      h: W - inset * 2,
      svg,
      tracks: spin ? [play([{ rotate: '0deg' }, { rotate: `${spin * 360}deg` }], { duration: dur, iterations: Infinity })] : [],
    });
    const size = (inset: number) => W - inset * 2;
    // The ring mask (transparent 52%, solid 60-86%, gone at 100%), as a band.
    const RING: [number, number] = [0.56, 0.93];
    const well: FxSprite = {
      x: 0,
      y: 0,
      w: W,
      h: W,
      tracks: [
        play(
          [
            { opacity: 0, scale: 0 },
            { opacity: 1, scale: 1.08, offset: 0.2, easing: 'ease-out' },
            { opacity: 1, scale: 1, offset: 0.3 },
            { opacity: 1, scale: 1, offset: 0.76, easing: 'ease-in' },
            { opacity: 1, scale: 0.08, offset: 0.92 },
            { opacity: 0, scale: 0 },
          ],
          { duration: 1650, fill: 'forwards' }
        ),
      ],
      children: [
        disc(-W * 0.12, radialDisc(size(-W * 0.12), size(-W * 0.12), stops(s.accent, ['rgba(168, 85, 247, 0.55)', 45], ['transparent', 72])), 0, 0),
        disc(0, conicDisc(size(0), 0, stops(s.accent, '#a855f7', '#22d3ee', '#f0abfc', s.accent), RING), 1, 1100),
        disc(W * 0.08, conicDisc(size(W * 0.08), 90, stops('#22d3ee', ['transparent', 25], ['#a855f7', 50], ['transparent', 75], '#22d3ee'), RING), -1, 700),
        disc(W * 0.16, conicDisc(size(W * 0.16), 45, stops('#ffffff', ['transparent', 20], ['#f0abfc', 50], ['transparent', 70], '#ffffff'), RING), 1, 520),
        disc(W * 0.22, radialDisc(size(W * 0.22), size(W * 0.22), stops('#020617', ['#1e1b4b', 55], ['#4c1d95', 80], 'rgba(76, 29, 149, 0)')), 0, 0),
        disc(W * 0.3, conicDisc(size(W * 0.3), 0, stops('rgba(165, 243, 252, 0.7)', ['transparent', 30], ['rgba(240, 171, 252, 0.6)', 60], ['transparent', 85], 'rgba(165, 243, 252, 0.7)')), 1, 900),
      ],
    };
    // Sparks drawn in along a spiral: each on an arm spinning inside the frame.
    const arms: FxSprite[] = [];
    for (let i = 0; i < 12; i++) {
      const d = (4 + (i % 3) * 1.5) * (W / H) * 0.35;
      arms.push({
        x: W / 2,
        y: W / 2,
        w: 0,
        h: 0,
        origin: [0, 0],
        tracks: [play([{ rotate: `${i * 30}deg` }, { rotate: `${i * 30 + 420}deg` }], { duration: 950, delay: 180 + i * 35, easing: 'ease-in', fill: 'forwards' })],
        children: [
          {
            x: W * 0.62,
            y: -d / 2,
            w: d,
            h: d,
            svg: radialDisc(d, d, stops(i % 2 ? '#f5d0fe' : '#cffafe', [i % 2 ? '#f5d0fe' : '#cffafe', 70], 'transparent')),
            base: { o: 0 },
            tracks: [play([{ opacity: 0, translate: '0 0' }, { opacity: 1, offset: 0.2 }, { opacity: 0, translate: `-${W * 0.62}px 0` }], { duration: 950, delay: 180 + i * 35, easing: 'ease-in', fill: 'forwards' })],
          },
        ],
      });
    }
    const frame: FxSprite = { x: s.cx - W / 2, y: cy - W / 2, w: W, h: W, base: { sy: H / W }, tracks: [], children: [well, ...arms] };
    const colW = Math.min(W * 0.62, s.w + s.unit * 0.3);
    const colH = s.unit * 2.2;
    const col: FxSprite = {
      x: s.cx - colW / 2,
      y: cy - colH,
      w: colW,
      h: colH,
      origin: [colW / 2, colH],
      svg: linearBox(colW, colH, 0, stops('rgba(240, 171, 252, 0.75)', ['rgba(165, 243, 252, 0.35)', 50], 'rgba(165, 243, 252, 0)'), [colW / 2, colW / 2, 0, 0]),
      base: { o: 0 },
      tracks: [play([{ opacity: 0, scale: '0.4 0' }, { opacity: 1, scale: '1 1', offset: 0.35 }, { opacity: 0.6, offset: 0.7 }, { opacity: 0, scale: '0.6 1.1' }], { duration: 1000, delay: 380, easing: 'ease-out', fill: 'forwards' })],
    };
    const flash: FxSprite = {
      x: s.cx - W / 2,
      y: cy - H * 0.3,
      w: W,
      h: H * 0.6,
      svg: radialDisc(W, H * 0.6, stops('#ffffff', ['rgba(165, 243, 252, 0.7)', 40], ['transparent', 75])),
      base: { o: 0 },
      tracks: [play([{ opacity: 0, scale: '0.3 1' }, { opacity: 1, scale: '1.3 1', offset: 0.35 }, { opacity: 0, scale: '0.05 0.4' }], { duration: 420, delay: 1250, easing: 'ease-out', fill: 'forwards' })],
    };
    return {
      revealAt: 450,
      arrive: {
        keyframes: [
          { opacity: 0, scale: 0.55, translate: `0 ${s.unit * 0.7}px`, filter: 'brightness(2.2) drop-shadow(0 0 16px #a5f3fc)', easing: 'cubic-bezier(0.2, 0.8, 0.3, 1.2)' },
          { opacity: 1, scale: 1.08, translate: `0 -${s.unit * 0.18}px`, offset: 0.6, filter: 'brightness(1.4) drop-shadow(0 0 10px #c084fc)' },
          { opacity: 1, scale: 0.98, translate: '0 2px', offset: 0.8 },
          { opacity: 1, scale: 1, translate: '0 0', filter: 'brightness(1) drop-shadow(0 0 0 rgba(192, 132, 252, 0))' },
        ],
        options: { duration: 820 },
      },
      total: 1750,
      sprites: [frame, col, flash],
      behind: true,
    };
  },

  // A saucer with chasing rim lights glides in and hovers; its tractor beam
  // lifts sparkles and draws the button down, top to bottom; then it zips off.
  ufo: (s) => {
    const w = s.unit * 1.6;
    const h = s.unit * 0.8;
    const k = w / 60;
    const lift = s.unit * 1.9;
    const saucer =
      `<defs><radialGradient id="d" cx="0.38" cy="0.3" r="0.8"><stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="#bae6fd"/><stop offset="1" stop-color="#0ea5e9"/></radialGradient>` +
      `<linearGradient id="h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1f5f9"/><stop offset="0.5" stop-color="#94a3b8"/><stop offset="1" stop-color="#334155"/></linearGradient></defs>` +
      `<ellipse cx="30" cy="12" rx="12" ry="10.5" fill="url(#d)" stroke="#334155" stroke-width="1"/>` +
      `<ellipse cx="26" cy="7.5" rx="4" ry="2.4" fill="#fff" opacity="0.85"/>` +
      `<ellipse cx="30" cy="18.5" rx="29" ry="8.5" fill="url(#h)" stroke="#1e293b" stroke-width="1"/>` +
      `<ellipse cx="30" cy="16" rx="24" ry="2.2" fill="${s.accent}" opacity="0.85"/>`;
    const lights: FxSprite[] = [8, 19, 30, 41, 52].map((lx, i) => {
      const ly = i === 2 ? 22.5 : i === 1 || i === 3 ? 21.5 : 19.5;
      const r = 2.1 * k;
      return {
        x: lx * k - r,
        y: ly * k - r,
        w: r * 2,
        h: r * 2,
        fill: '#fde047',
        radius: r,
        tracks: [play([{ opacity: 0.25 }, { opacity: 1, offset: 0.2 }, { opacity: 0.25, offset: 0.4 }, { opacity: 0.25 }], { duration: 500, delay: i * 100, iterations: Infinity })],
      };
    });
    const from = s.inward === -1 ? s.win.w - s.rect.left + w : -(s.rect.left + w * 2);
    const ufo: FxSprite = {
      x: s.cx - w / 2,
      y: -lift,
      w,
      h,
      origin: [w * 0.5, h * 0.62],
      svg: svgOf(w, h, '0 0 60 30', saucer),
      tracks: [
        play(
          [
            { translate: `${from}px -70px`, rotate: `${s.inward * -16}deg`, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' },
            { translate: '0 0', rotate: `${s.inward * 5}deg`, offset: 0.3 },
            { translate: '0 -4px', rotate: '0deg', offset: 0.42 },
            { translate: '0 3px', rotate: '0deg', offset: 0.56 },
            { translate: '0 -2px', rotate: '0deg', offset: 0.7 },
            { translate: '0 0', rotate: '0deg', offset: 0.78, easing: 'cubic-bezier(0.6, 0, 0.9, 0.4)' },
            { translate: `${s.inward * -40}px -${s.above + lift + 120}px`, rotate: `${s.inward * 20}deg`, scale: '0.6 0.6' },
          ],
          { duration: 2300, fill: 'forwards' }
        ),
      ],
      children: lights,
    };
    const beamTop = -lift + h * 0.8;
    const beamH = s.h - beamTop;
    const bw = w * 1.05;
    let stripes = '';
    for (let y = 0; y < beamH; y += 30) for (const o of [6, 15, 24]) if (y + o < beamH) stripes += `<rect x="0" y="${y + o}" width="${bw}" height="3" fill="rgb(254,249,195)" fill-opacity="0.35"/>`;
    const beam: FxSprite = {
      x: s.cx - bw / 2,
      y: beamTop,
      w: bw,
      h: beamH,
      svg: svgOf(
        bw,
        beamH,
        `0 0 ${bw} ${beamH}`,
        `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgb(254,240,138)" stop-opacity="0.9"/><stop offset="1" stop-color="rgb(254,240,138)" stop-opacity="0.15"/></linearGradient>` +
          `<clipPath id="c"><polygon points="${bw * 0.36},0 ${bw * 0.64},0 ${bw},${beamH} 0,${beamH}"/></clipPath></defs>` +
          `<g clip-path="url(#c)"><rect width="${bw}" height="${beamH}" fill="url(#g)"/>${stripes}</g>`
      ),
      base: { o: 0 },
      tracks: [play([{ opacity: 0 }, { opacity: 0.95, offset: 0.15 }, { opacity: 0.95, offset: 0.8 }, { opacity: 0 }], { duration: 1000, delay: 760, fill: 'forwards' })],
    };
    const dots: FxSprite[] = Array.from({ length: 8 }, (_, i) => ({
      x: s.cx + (i - 3.5) * (s.unit * 0.13),
      y: s.h - 6,
      w: 4,
      h: 4,
      fill: '#fef9c3',
      radius: 2,
      base: { o: 0 },
      tracks: [play([{ opacity: 0, translate: '0 0' }, { opacity: 1, offset: 0.2 }, { opacity: 0, translate: `0 -${beamH * 0.8}px` }], { duration: 800, delay: 820 + i * 60, easing: 'ease-in', fill: 'forwards' })],
    }));
    return {
      revealAt: 900,
      arrive: {
        keyframes: [
          { opacity: 0.2, scale: 0.9, translate: `0 -${s.unit * 0.35}px`, clipPath: 'inset(0 0 100% 0)', filter: 'brightness(1.8)' },
          { opacity: 0.6, offset: 0.25 },
          { opacity: 0.35, offset: 0.35 },
          { opacity: 1, scale: 1, translate: '0 0', clipPath: 'inset(0 0 0% 0)', filter: 'brightness(1)', offset: 0.8 },
          { opacity: 1, scale: 1, translate: '0 0', clipPath: 'inset(0 0 0% 0)', filter: 'brightness(1)' },
        ],
        options: { duration: 700, easing: 'ease-out' },
      },
      total: 2350,
      sprites: [beam, ...dots, ufo],
      behind: false,
    };
  },

  // It falls from the sky with speed lines, stretched by the speed; hits the
  // ground in a squash with a shockwave, pebbles and a ring of cartoon stars;
  // bounces twice and settles.
  drop: (s) => {
    const fall = s.above + s.h + 20;
    const sprites: FxSprite[] = [];
    for (let i = 0; i < 3; i++) {
      const lh = s.unit * 0.9;
      sprites.push({
        x: s.cx + (i - 1) * s.unit * 0.3,
        y: -s.unit * 1.1,
        w: 2,
        h: lh,
        svg: linearBox(2, lh, 180, stops('rgba(148, 163, 184, 0)', 'rgba(100, 116, 139, 0.8)'), 1),
        base: { o: 0 },
        tracks: [
          play([{ opacity: 0, translate: `0 -${fall * 0.6}px` }, { opacity: 0.9, translate: '0 0', offset: 0.85 }, { opacity: 0, translate: `0 ${s.unit * 0.4}px` }], {
            duration: 480,
            delay: 20 + i * 30,
            easing: 'cubic-bezier(0.55, 0, 1, 0.45)',
            fill: 'forwards',
          }),
        ],
      });
    }
    const hit = 470;
    sprites.push(shockwave(s, hit, 'rgba(148, 163, 184, 0.9)', 2.4));
    sprites.push(...debris(s, 6, hit, ['#94a3b8', '#64748b', '#cbd5e1'], 5, 0.9));
    sprites.push(puff(s, s.cx - s.w * 0.3, s.h - 4, s.unit * 0.5, hit, -s.unit * 0.6, -4, 700));
    sprites.push(puff(s, s.cx + s.w * 0.3, s.h - 4, s.unit * 0.5, hit, s.unit * 0.6, -4, 700));
    // Cartoon stars circling where it hit, for a moment.
    const STAR5 = 'M6 0 L7.5 4.2 L12 4.6 L8.5 7.4 L9.7 12 L6 9.4 L2.3 12 L3.5 7.4 L0 4.6 L4.5 4.2 Z';
    for (let i = 0; i < 3; i++) {
      sprites.push({
        x: s.cx,
        y: -s.unit * 0.15,
        w: 0,
        h: 0,
        origin: [0, 0],
        base: { sy: 0.35 },
        tracks: [play([{ rotate: `${i * 120}deg` }, { rotate: `${i * 120 + 520}deg` }], { duration: 1100, delay: hit + 60, fill: 'forwards' })],
        children: [
          {
            x: s.unit * 0.55,
            y: -6,
            w: 12,
            h: 12,
            svg: svgOf(12, 12, '0 0 12 12', `<path d="${STAR5}" fill="#fde047" stroke="#b45309" stroke-width="0.8"/>`),
            base: { o: 0 },
            tracks: [play([{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], { duration: 1100, delay: hit + 60, fill: 'forwards' })],
          },
        ],
      });
    }
    return {
      revealAt: 0,
      arrive: {
        keyframes: [
          { opacity: 1, translate: `0 -${fall}px`, scale: '0.86 1.18', easing: 'cubic-bezier(0.55, 0, 1, 0.45)' },
          { translate: '0 0', scale: '0.9 1.12', offset: 0.43, easing: 'ease-out' },
          { translate: `0 ${s.unit * 0.1}px`, scale: '1.28 0.72', offset: 0.5, easing: 'ease-out' },
          { translate: `0 -${s.unit * 0.45}px`, scale: '0.93 1.08', offset: 0.65, easing: 'ease-in' },
          { translate: '0 0', scale: '1.12 0.88', offset: 0.78, easing: 'ease-out' },
          { translate: `0 -${s.unit * 0.12}px`, scale: '0.98 1.02', offset: 0.87, easing: 'ease-in' },
          { translate: '0 0', scale: '1.03 0.97', offset: 0.94 },
          { opacity: 1, translate: '0 0', scale: '1 1' },
        ],
        options: { duration: 1100 },
      },
      total: 1700,
      sprites,
      behind: false,
    };
  },

  // A confetti cannon: 40 pieces blasted up and out, each tumbling as it
  // flutters down, drifting.
  confetti: (s) => {
    const n = 40;
    const fd = s.unit * 2.4;
    const sprites: FxSprite[] = [
      {
        x: s.cx - s.unit * 1.2,
        y: s.cy - s.unit * 1.2,
        w: fd,
        h: fd,
        svg: radialDisc(fd, fd, stops('rgba(255, 255, 255, 0.95)', ['rgba(253, 224, 71, 0.4)', 45], ['transparent', 70])),
        base: { o: 0 },
        tracks: [play([{ opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, offset: 0.3 }, { opacity: 0, scale: 1.4 }], { duration: 420, delay: 60, fill: 'forwards' })],
      },
    ];
    for (let i = 0; i < n; i++) {
      const kind = i % 4;
      const wpx = kind === 1 ? 7 : kind === 2 ? 4 : 7;
      const hpx = kind === 1 ? 7 : kind === 2 ? 16 : 10;
      // A fan leaning into the screen (so the burst is never cut off).
      const a = (-170 + (160 * i) / (n - 1)) * (Math.PI / 180);
      const v = s.unit * (1.2 + ((i * 7) % 9) * 0.18) + s.w * 0.2;
      const dx = Math.cos(a) * v * (s.inward === -1 ? -1 : 1) * -1;
      const dy = Math.sin(a) * v;
      const drift = ((i % 3) - 1) * s.unit * 0.4;
      const dur = 1500 + (i % 5) * 140;
      sprites.push({
        x: s.cx - wpx / 2,
        y: s.cy - hpx / 2,
        w: wpx,
        h: hpx,
        fill: i % 5 === 0 ? s.accent : COLORS[i % COLORS.length],
        radius: kind === 1 ? wpx / 2 : 2,
        base: { o: 0 },
        tracks: [
          play(
            [
              { opacity: 1, translate: '0 0', rotate: '0deg', easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)' },
              { opacity: 1, translate: `${dx}px ${dy}px`, rotate: `${160 + i * 23}deg`, offset: 0.3, easing: 'cubic-bezier(0.4, 0, 0.8, 0.6)' },
              { opacity: 1, translate: `${dx + drift}px ${dy + s.unit * 1.1}px`, rotate: `${320 + i * 31}deg`, offset: 0.75 },
              { opacity: 0, translate: `${dx - drift}px ${dy + s.unit * 1.8}px`, rotate: `${420 + i * 37}deg` },
            ],
            { duration: dur, delay: 60 + (i % 6) * 12, fill: 'forwards' }
          ),
          // The 3D tumble: the piece flips edge-on and back as it spins.
          play([{ scale: '1 1' }, { scale: '1 0.1' }, { scale: '1 1' }], { duration: 260 + (i % 4) * 70, iterations: Math.ceil(dur / 300) }),
        ],
      });
    }
    return {
      revealAt: 0,
      arrive: {
        keyframes: [
          { opacity: 0, scale: 0, rotate: '-14deg' },
          { opacity: 1, scale: 1.22, rotate: '6deg', offset: 0.5 },
          { scale: 0.94, rotate: '-3deg', offset: 0.72 },
          { scale: 1.03, rotate: '1deg', offset: 0.86 },
          { opacity: 1, scale: 1, rotate: '0deg' },
        ],
        options: { duration: 700, easing: 'ease-out' },
      },
      total: 2200,
      sprites,
      behind: false,
    };
  },

  // Jackpot: it rises spinning like a gold coin, a shower of coins bursts
  // out and falls, it lands with a bounce and a glint sweeps across it.
  coin: (s) => {
    const sprites: FxSprite[] = [];
    for (let i = 0; i < 12; i++) {
      const d = s.unit * (0.28 + (i % 3) * 0.06);
      const dir = i % 2 ? 1 : -1;
      const dx = dir * (s.w / 2 + s.unit * (0.2 + (i % 4) * 0.28));
      const up = s.unit * (0.9 + ((i * 5) % 4) * 0.3);
      sprites.push({
        x: s.cx - d / 2,
        y: s.cy - d / 2,
        w: d,
        h: d,
        svg: svgOf(
          d,
          d,
          '0 0 20 20',
          `<defs><radialGradient id="c" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#fef9c3"/><stop offset="0.45" stop-color="#facc15"/><stop offset="1" stop-color="#a16207"/></radialGradient></defs><circle cx="10" cy="10" r="9" fill="url(#c)" stroke="#854d0e" stroke-width="1"/><circle cx="10" cy="10" r="5.5" fill="none" stroke="#fef08a" stroke-width="1" opacity="0.8"/>`
        ),
        base: { o: 0 },
        tracks: [
          play(
            [
              { opacity: 1, translate: '0 0', easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)' },
              { opacity: 1, translate: `${dx * 0.6}px -${up}px`, offset: 0.4, easing: 'cubic-bezier(0.5, 0, 0.9, 0.5)' },
              { opacity: 0, translate: `${dx}px ${s.unit * 0.6}px` },
            ],
            { duration: 1100, delay: 560 + i * 25, fill: 'forwards' }
          ),
          play([{ scale: '1 1' }, { scale: '0.1 1' }, { scale: '1 1' }], { duration: 240, iterations: 5, delay: 560 + i * 25 }),
        ],
      });
    }
    sprites.push(...sparkles(s, 6, 900, '#fde047', 1.2));
    // The glint: a band that sweeps across the button (left -40% -> 115%).
    const bandW = s.w * 0.35;
    sprites.push({
      x: 0,
      y: 0,
      w: s.w,
      h: s.h,
      clip: s.h / 2,
      tracks: [],
      children: [
        {
          x: 0,
          y: -s.h * 0.2,
          w: bandW,
          h: s.h * 1.4,
          leftOf: s.w,
          svg: linearBox(bandW, s.h * 1.4, 100, stops('transparent', 'rgba(255,255,255,0.75)', 'transparent')),
          tracks: [play([{ left: '-40%' }, { left: '115%' }], { duration: 520, delay: 1050, easing: 'ease-in-out', fill: 'forwards' })],
        },
      ],
    });
    return {
      revealAt: 0,
      arrive: {
        keyframes: [
          { opacity: 0, scale: 0.3, rotate: 'y 0deg', translate: `0 ${s.unit * 0.8}px`, filter: 'brightness(1)' },
          { opacity: 1, rotate: 'y 180deg', filter: 'brightness(1.6) sepia(0.4)', offset: 0.15 },
          { rotate: 'y 360deg', filter: 'brightness(0.8)', offset: 0.3 },
          { rotate: 'y 540deg', translate: `0 -${s.unit * 0.5}px`, filter: 'brightness(1.6) sepia(0.4)', offset: 0.45, scale: 1.1 },
          { rotate: 'y 720deg', filter: 'brightness(0.85)', offset: 0.6 },
          { rotate: 'y 1080deg', translate: '0 0', scale: 1.06, filter: 'brightness(1.2)', offset: 0.8, easing: 'ease-out' },
          { translate: `0 -${s.unit * 0.1}px`, scale: 0.98, offset: 0.9 },
          { opacity: 1, rotate: 'y 1080deg', translate: '0 0', scale: 1, filter: 'brightness(1)' },
        ],
        options: { duration: 1200 },
      },
      total: 1900,
      sprites,
      behind: false,
    };
  },

  // A fireball streaks in from the top corner of the screen with a burning
  // tail, strikes with a flash and a shockwave, throws rocks and smoke.
  meteor: (s) => {
    const D = 560;
    const sx = s.inward * Math.min(s.win.w * 0.35, 380);
    const sy = -(s.above + s.unit);
    const ang = (Math.atan2(-sy, -sx) * 180) / Math.PI;
    const len = Math.hypot(sx, sy);
    const bd = s.unit * 0.56;
    const tw = Math.min(len * 0.45, 260);
    const th = s.unit * 0.4;
    const sprites: FxSprite[] = [];
    sprites.push({
      x: s.cx,
      y: s.cy,
      w: 0,
      h: 0,
      origin: [0, 0],
      base: { r: ang },
      tracks: [play([{ translate: `${sx}px ${sy}px`, opacity: 1 }, { translate: '0 0', opacity: 1, offset: 0.97 }, { translate: '0 0', opacity: 0 }], { duration: D, easing: 'cubic-bezier(0.5, 0, 0.9, 0.6)', fill: 'forwards' })],
      children: [
        {
          x: -s.unit * 0.1 - tw,
          y: -s.unit * 0.2,
          w: tw,
          h: th,
          svg: linearBox(tw, th, 270, stops('rgba(253, 224, 71, 0.95)', ['rgba(249, 115, 22, 0.6)', 30], 'rgba(127, 29, 29, 0)'), th / 2),
          tracks: [],
        },
        {
          x: -bd / 2,
          y: -bd / 2,
          w: bd,
          h: bd,
          svg: radialDisc(bd, bd, stops('#fffbeb', ['#fde047', 30], ['#f97316', 60], '#7c2d12')),
          tracks: [],
        },
      ],
    });
    const bu = s.unit * 3.4;
    sprites.push({
      x: s.cx - bu / 2,
      y: s.cy - bu / 2,
      w: bu,
      h: bu,
      svg: radialDisc(bu, bu, stops('#ffffff', ['rgba(253, 224, 71, 0.95)', 25], ['rgba(249, 115, 22, 0.6)', 50], ['transparent', 72])),
      base: { o: 0 },
      tracks: [play([{ opacity: 0, scale: 0.2 }, { opacity: 1, scale: 1, offset: 0.25 }, { opacity: 0, scale: 1.5 }], { duration: 620, delay: D - 20, easing: 'ease-out', fill: 'forwards' })],
    });
    sprites.push(shockwave(s, D, 'rgba(253, 186, 116, 0.95)', 3));
    sprites.push(...debris(s, 9, D, ['#44403c', '#78716c', '#292524', '#f97316'], 6, 1.3));
    for (let i = 0; i < 5; i++) sprites.push(puff(s, s.cx + (i - 2) * s.unit * 0.25, s.cy, s.unit * (0.55 + (i % 2) * 0.2), D + 120 + i * 60, (i - 2) * s.unit * 0.15, -s.unit * 1.1, 1300, 'rgba(120, 113, 108, 0.75)'));
    return {
      revealAt: D,
      arrive: joltArrival(1500, { filter: 'brightness(1.7) sepia(1) saturate(4) hue-rotate(-20deg) drop-shadow(0 0 14px #f97316)' }),
      total: D + 1600,
      sprites,
      behind: false,
    };
  },

  // A top hat appears where the button will be, a wand taps it twice in a
  // flurry of sparkles, and the button springs out; the hat drops away.
  magic: (s) => {
    const hw = s.unit * 1.2;
    const hh = s.unit * 1.0;
    const hatTop = s.h - hh * 0.72;
    const sprites: FxSprite[] = [];
    sprites.push({
      x: s.cx - hw / 2,
      y: hatTop,
      w: hw,
      h: hh,
      svg: svgOf(
        hw,
        hh,
        '0 0 60 50',
        `<defs><linearGradient id="h" x1="0" x2="1"><stop offset="0" stop-color="#0f172a"/><stop offset="0.35" stop-color="#475569"/><stop offset="0.6" stop-color="#1e293b"/><stop offset="1" stop-color="#020617"/></linearGradient></defs>` +
          `<ellipse cx="30" cy="44" rx="29" ry="6" fill="#0f172a"/><path d="M12 44 L14 6 Q30 1 46 6 L48 44 Z" fill="url(#h)"/><rect x="13" y="30" width="34" height="7" fill="${s.accent}"/>` +
          `<ellipse cx="30" cy="6" rx="16" ry="4" fill="#334155"/><path d="M19 10 L18 28" stroke="#fff" stroke-width="2" opacity="0.25" stroke-linecap="round"/>`
      ),
      tracks: [
        play(
          [
            { opacity: 0, scale: 0.3, rotate: '-10deg' },
            { opacity: 1, scale: 1.1, rotate: '4deg', offset: 0.12, easing: 'ease-out' },
            { opacity: 1, scale: 1, rotate: '0deg', offset: 0.2 },
            { opacity: 1, scale: 1, rotate: '0deg', offset: 0.62 },
            { opacity: 1, translate: `0 ${s.unit * 0.3}px`, scale: '1.15 0.85', offset: 0.68 },
            { opacity: 0, translate: `0 ${s.unit * 0.9}px`, scale: 0.6 },
          ],
          { duration: 2000, fill: 'forwards' }
        ),
      ],
    });
    const ww = s.unit * 0.9;
    const tilt = s.inward === -1 ? 1 : -1;
    sprites.push({
      x: s.inward === -1 ? s.cx - hw / 2 - ww * 0.8 : s.cx + hw / 2 - ww * 0.2,
      y: hatTop - ww * 0.2,
      w: ww,
      h: ww * 0.2,
      svg: svgOf(ww, ww * 0.2, '0 0 50 10', `<rect x="0" y="3" width="42" height="4" rx="2" fill="#111827"/><rect x="38" y="2.4" width="12" height="5.2" rx="2.4" fill="#f8fafc"/><rect x="0" y="3" width="8" height="4" rx="2" fill="#f8fafc"/>`),
      base: { o: 0, ...(s.inward === 1 ? { sx: -1 } : {}) },
      tracks: [
        play(
          [
            { opacity: 0, rotate: `${tilt * -30}deg`, translate: `${-s.inward * 0}px 0` },
            { opacity: 1, rotate: `${tilt * -20}deg`, offset: 0.12 },
            { rotate: `${tilt * 10}deg`, offset: 0.24 },
            { rotate: `${tilt * -20}deg`, offset: 0.34 },
            { rotate: `${tilt * 10}deg`, offset: 0.44 },
            { opacity: 1, rotate: `${tilt * -15}deg`, offset: 0.56 },
            { opacity: 0, rotate: `${tilt * -30}deg` },
          ],
          { duration: 1400, delay: 150, fill: 'forwards' }
        ),
      ],
    });
    sprites.push(...sparkles(s, 5, 480, '#fde047', 0.8));
    sprites.push(...sparkles(s, 5, 800, '#f0abfc', 1.1));
    sprites.push(puff(s, s.cx, s.h - s.unit * 0.1, s.unit * 1.1, 1350, 0, -s.unit * 0.3, 900, 'rgba(226, 232, 240, 0.95)'));
    return {
      revealAt: 1150,
      arrive: {
        keyframes: [
          { opacity: 0, translate: `0 ${s.unit * 0.55}px`, scale: 0.5, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' },
          { opacity: 1, translate: `0 -${s.unit * 0.9}px`, scale: 1.08, rotate: `${s.inward * 8}deg`, offset: 0.45, easing: 'cubic-bezier(0.55, 0, 1, 0.45)' },
          { translate: '0 0', scale: '1.12 0.88', rotate: '0deg', offset: 0.75, easing: 'ease-out' },
          { translate: '0 -4px', scale: '0.98 1.02', offset: 0.88 },
          { opacity: 1, translate: '0 0', scale: 1, rotate: '0deg' },
        ],
        options: { duration: 900 },
      },
      total: 2300,
      sprites,
      behind: false,
    };
  },

  // It drifts down under a striped parachute, swaying; touches down softly,
  // and the canopy collapses and floats away.
  parachute: (s) => {
    const a = s.accent;
    const cw = Math.max(s.unit * 1.7, s.w * 0.9);
    const ch = s.unit * 1.25;
    const fall = s.above + ch + s.h;
    const D = 1900;
    const mid = s.rect.left + s.cx;
    const shift = Math.min(0, s.win.w - 6 - (mid + cw / 2)) + Math.max(0, 6 - (mid - cw / 2));
    const sway: Keyframe[] = [
      { translate: `0 -${fall}px`, rotate: '0deg' },
      { translate: `${s.unit * 0.35}px -${fall * 0.72}px`, rotate: '-9deg', offset: 0.22 },
      { translate: `-${s.unit * 0.35}px -${fall * 0.45}px`, rotate: '8deg', offset: 0.45 },
      { translate: `${s.unit * 0.2}px -${fall * 0.2}px`, rotate: '-5deg', offset: 0.68 },
      { translate: `-${s.unit * 0.05}px -${s.unit * 0.12}px`, rotate: '2deg', offset: 0.88 },
      { translate: '0 0', rotate: '0deg' },
    ];
    const canopy =
      `<defs><linearGradient id="s" x1="0" x2="1">` +
      `<stop offset="0" stop-color="${a}"/><stop offset="0.2" stop-color="${a}"/><stop offset="0.2" stop-color="#ffffff"/><stop offset="0.4" stop-color="#ffffff"/>` +
      `<stop offset="0.4" stop-color="${a}"/><stop offset="0.6" stop-color="${a}"/><stop offset="0.6" stop-color="#ffffff"/><stop offset="0.8" stop-color="#ffffff"/>` +
      `<stop offset="0.8" stop-color="${a}"/><stop offset="1" stop-color="${a}"/></linearGradient>` +
      `<radialGradient id="l" cx="0.4" cy="0.2" r="0.9"><stop offset="0" stop-color="#fff" stop-opacity="0.45"/><stop offset="1" stop-color="#000" stop-opacity="0.18"/></radialGradient></defs>` +
      `<path d="M2 26 Q40 -12 78 26 Q70 22 60 26 Q50 21 40 26 Q30 21 20 26 Q10 22 2 26 Z" fill="url(#s)" stroke="rgba(15,23,42,0.35)" stroke-width="1"/>` +
      `<path d="M2 26 Q40 -12 78 26 Q70 22 60 26 Q50 21 40 26 Q30 21 20 26 Q10 22 2 26 Z" fill="url(#l)"/>` +
      `<path d="M4 26 L30 60 M20 26 L35 60 M40 26 L40 60 M60 26 L45 60 M76 26 L50 60" stroke="rgba(71,85,105,0.8)" stroke-width="0.8"/>`;
    const chute: FxSprite = {
      x: s.cx - cw / 2 + shift,
      y: s.cy - ch - s.h * 0.35,
      w: cw,
      h: ch,
      origin: [cw / 2 - shift, ch + s.h * 0.35],
      tracks: [play(sway, { duration: D, easing: 'cubic-bezier(0.3, 0.2, 0.4, 1)', fill: 'forwards' })],
      children: [
        {
          x: 0,
          y: 0,
          w: cw,
          h: ch,
          origin: [cw / 2, ch],
          svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}" viewBox="0 0 80 60" preserveAspectRatio="none">${canopy}</svg>`,
          tracks: [
            play(
              [
                { scale: '1 1', opacity: 1, translate: '0 0' },
                { scale: '0.8 0.35', opacity: 1, translate: `${s.inward * s.unit * 0.4}px ${ch * 0.45}px`, offset: 0.45 },
                { scale: '0.4 0.2', opacity: 0, translate: `${s.inward * s.unit * 1.2}px ${ch * 0.6}px` },
              ],
              { duration: 800, delay: D + 80, fill: 'forwards' }
            ),
          ],
        },
      ],
    };
    const sprites = [chute, puff(s, s.cx - s.w * 0.3, s.h - 3, s.unit * 0.4, D - 40, -s.unit * 0.4, -3, 600), puff(s, s.cx + s.w * 0.3, s.h - 3, s.unit * 0.4, D - 40, s.unit * 0.4, -3, 600)];
    return {
      revealAt: 0,
      arrive: {
        keyframes: sway
          .map((k, i) => ({ ...k, opacity: 1, offset: i === 0 ? 0 : k.offset }))
          .map((k) => ({ ...k, offset: k.offset === undefined ? undefined : k.offset * (D / (D + 260)) })),
        options: { duration: D + 260, easing: 'cubic-bezier(0.3, 0.2, 0.4, 1)' },
      },
      total: D + 950,
      sprites,
      behind: false,
    };
  },

  // A paper plane loops the loop across the screen and glides in; at the
  // corner it unfolds into the button.
  plane: (s) => {
    const pw = s.unit * 0.95;
    const ph = pw * 0.55;
    const L = Math.min(s.win.w * 0.55, 520) * s.inward;
    const top = -Math.min(s.rect.top * 0.6, 260);
    const R = s.unit * 1.1;
    const d = `M ${L * 1.1},${top} C ${L * 0.6},${top + 40} ${L * 0.35},${top - 30} ${L * 0.25},${top + 20} a ${R},${R} 0 1,${s.inward === -1 ? 1 : 0} ${s.inward * 0.01},0 C ${L * 0.12},${top + 60} ${s.inward * s.unit * 0.8},${s.cy - 30} ${s.cx - s.w / 2 + s.w / 2},${s.cy}`;
    const D = 1700;
    const ease = 'cubic-bezier(0.35, 0.1, 0.4, 1)';
    const sprites: FxSprite[] = [
      {
        x: -pw / 2,
        y: -ph / 2,
        w: pw,
        h: ph,
        path: { d, rotate: true },
        svg: svgOf(
          pw,
          ph,
          '0 0 40 22',
          `<defs><linearGradient id="p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cbd5e1"/></linearGradient></defs>` +
            `<path d="M40 11 L0 0 L10 11 Z" fill="url(#p)" stroke="#94a3b8" stroke-width="0.8" stroke-linejoin="round"/><path d="M40 11 L10 11 L0 22 Z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.8" stroke-linejoin="round"/>` +
            `<path d="M40 11 L10 11 L14 15 Z" fill="#94a3b8"/><path d="M40 11 L10 11" stroke="${s.accent}" stroke-width="1.2"/>`
        ),
        tracks: [play([{ offsetDistance: '0%', opacity: 1 }, { offsetDistance: '100%', opacity: 1, offset: 0.96 }, { offsetDistance: '100%', opacity: 0 }], { duration: D, easing: ease, fill: 'forwards' })],
      },
    ];
    for (let i = 0; i < 6; i++) {
      sprites.push({
        x: -2,
        y: -2,
        w: 4,
        h: 4,
        fill: 'rgba(148, 163, 184, 0.7)',
        radius: 2,
        path: { d, rotate: true },
        base: { o: 0 },
        tracks: [play([{ offsetDistance: '0%', opacity: 0 }, { offsetDistance: '80%', opacity: 0.6, offset: 0.7 }, { offsetDistance: '96%', opacity: 0 }], { duration: D, delay: 80 + i * 70, easing: ease, fill: 'forwards' })],
      });
    }
    sprites.push({
      x: 0,
      y: 0,
      w: s.w,
      h: s.h,
      svg: linearBox(s.w, s.h, 135, stops('#ffffff', '#e2e8f0'), Math.min(s.w, s.h) / 2),
      base: { o: 0 },
      tracks: [play([{ opacity: 0, scale: '0.2 0.2', rotate: '-40deg' }, { opacity: 1, scale: '1 1', rotate: '0deg', offset: 0.55 }, { opacity: 0, scale: '1 1', rotate: '0deg' }], { duration: 520, delay: D - 80, easing: 'ease-out', fill: 'forwards' })],
    });
    return {
      revealAt: D + 150,
      arrive: {
        keyframes: [
          { opacity: 0, scale: '1 0.1', rotate: 'x 80deg' },
          { opacity: 1, scale: '1 1.08', rotate: 'x 0deg', offset: 0.6 },
          { opacity: 1, scale: '1 1', rotate: 'x 0deg' },
        ],
        options: { duration: 480, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      },
      total: D + 700,
      sprites,
      behind: false,
    };
  },

  // An egg lands in the corner, wobbles, cracks, the top pops off; the
  // button hatches with a happy bounce.
  egg: (s) => {
    const ew = s.unit * 0.95;
    const eh = s.unit * 1.2;
    const left = s.cx - ew / 2;
    const top = s.h - eh;
    const shell = (part: 'top' | 'bottom') =>
      svgOf(
        ew,
        eh,
        '0 0 40 50',
        `<defs><radialGradient id="g" cx="0.38" cy="0.3" r="0.85"><stop offset="0" stop-color="#fffdf5"/><stop offset="0.6" stop-color="#fdf2d8"/><stop offset="1" stop-color="#d6b98c"/></radialGradient>` +
          `<clipPath id="c"><path d="${part === 'top' ? 'M-5 -5 H45 V24 L36 20 L29 27 L21 20 L13 27 L6 21 L-5 25 Z' : 'M-5 25 L6 21 L13 27 L21 20 L29 27 L36 20 L45 24 V60 H-5 Z'}"/></clipPath></defs>` +
          `<g clip-path="url(#c)"><path d="M20 1 C33 1 39 20 39 31 C39 43 30 49 20 49 C10 49 1 43 1 31 C1 20 7 1 20 1 Z" fill="url(#g)" stroke="#c9a57a" stroke-width="1"/>` +
          `<circle cx="13" cy="16" r="1.6" fill="#d6b98c" opacity="0.7"/><circle cx="27" cy="12" r="1.2" fill="#d6b98c" opacity="0.7"/>` +
          `<circle cx="29" cy="36" r="1.6" fill="#d6b98c" opacity="0.6"/><circle cx="11" cy="38" r="1.2" fill="#d6b98c" opacity="0.6"/>` +
          `<ellipse cx="14" cy="12" rx="4" ry="6" fill="#fff" opacity="0.7"/></g>`
      );
    const land = play(
      [
        { translate: `0 -${s.above + eh}px`, rotate: '0deg', scale: '1 1', easing: 'cubic-bezier(0.55, 0, 1, 0.45)' },
        { translate: '0 0', scale: '1.12 0.9', offset: 0.22, easing: 'ease-out' },
        { translate: '0 0', scale: '1 1', rotate: '0deg', offset: 0.3 },
        { rotate: '-12deg', offset: 0.38 },
        { rotate: '10deg', offset: 0.46 },
        { rotate: '-8deg', offset: 0.54 },
        { rotate: '6deg', offset: 0.6 },
        { rotate: '0deg', offset: 0.66 },
        { translate: '0 0', rotate: '0deg', scale: '1 1' },
      ],
      { duration: 1600, fill: 'forwards' }
    );
    const hatch = 1600;
    const k = ew / 40;
    const bottom: FxSprite = {
      x: left,
      y: top,
      w: ew,
      h: eh,
      origin: [ew / 2, eh],
      tracks: [land],
      children: [{ x: 0, y: 0, w: ew, h: eh, svg: shell('bottom'), tracks: [play([{ opacity: 1, scale: 1 }, { opacity: 0, scale: 0.7, translate: `0 ${s.unit * 0.3}px` }], { duration: 500, delay: hatch + 250, fill: 'forwards' })] }],
    };
    const topHalf: FxSprite = {
      x: left,
      y: top,
      w: ew,
      h: eh,
      origin: [ew / 2, eh],
      tracks: [land],
      children: [
        {
          x: 0,
          y: 0,
          w: ew,
          h: eh,
          svg: shell('top'),
          tracks: [
            play(
              [
                { translate: '0 0', rotate: '0deg', opacity: 1 },
                { translate: `${-s.inward * s.unit * 0.8}px -${s.unit * 1.2}px`, rotate: `${-s.inward * 160}deg`, opacity: 1, offset: 0.55 },
                { translate: `${-s.inward * s.unit * 1.2}px ${s.unit * 0.4}px`, rotate: `${-s.inward * 260}deg`, opacity: 0 },
              ],
              { duration: 800, delay: hatch, easing: 'cubic-bezier(0.2, 0.8, 0.4, 1)', fill: 'forwards' }
            ),
          ],
          children: [
            {
              // The crack racing across the shell, as a wipe from the left.
              x: 2 * k,
              y: 19 * k,
              w: 37 * k,
              h: 9 * k,
              svg: svgOf(37 * k, 9 * k, '2 19 37 9', `<path d="M3 24 L6 21 L13 27 L21 20 L29 27 L36 20 L38 22" fill="none" stroke="#7c5a33" stroke-width="1.4" stroke-linejoin="round"/>`),
              wipe: 'right',
              base: { dash: 100 },
              tracks: [play([{ strokeDashoffset: 100 }, { strokeDashoffset: 100, offset: 0.4 }, { strokeDashoffset: 0 }], { duration: 1400, fill: 'forwards' })],
            },
          ],
        },
      ],
    };
    return {
      revealAt: hatch + 60,
      arrive: {
        keyframes: [
          { opacity: 0, scale: 0.2, translate: `0 ${s.unit * 0.25}px` },
          { opacity: 1, scale: 1.25, translate: `0 -${s.unit * 0.35}px`, offset: 0.4, easing: 'ease-in' },
          { scale: '1.12 0.88', translate: '0 0', offset: 0.62, easing: 'ease-out' },
          { scale: '0.97 1.03', translate: '0 -3px', offset: 0.8 },
          { opacity: 1, scale: 1, translate: '0 0' },
        ],
        options: { duration: 820 },
      },
      total: hatch + 1000,
      sprites: [bottom, topHalf, ...debris(s, 6, hatch + 30, ['#fdf2d8', '#f5e6c8', '#e7d3b0'], 5, 0.8), ...sparkles(s, 5, hatch + 120, '#fde047', 0.9)],
      behind: false,
    };
  },
};

/** The entrance for a mode on this stage (null for "classic"). `seed` picks the lightning's shape. */
export const entrancePlan = (mode: LauncherEntrance, s: EntranceStage, seed: number = Math.floor(Math.random() * 100000) + 7): EntrancePlan | null =>
  mode === 'classic' ? null : EFFECTS[mode](s, seeded(seed));

/**
 * A sprite's drawn values at t ms: its translate (px, the box's own share
 * and an animated `left` folded in, and a motion path's point), rotate, the
 * scale (a 3D turn about x / y, unlit and without perspective as on the
 * web, is the cosine of its angle), opacity and how much of a wipe shows.
 */
export interface SpriteFrame {
  tx: number;
  ty: number;
  r: number;
  sx: number;
  sy: number;
  o: number;
  reveal: number;
}

const pathCache = new Map<string, Array<[number, number]>>();

export const spriteFrame = (sp: FxSprite, t: number, values?: FxValues): SpriteFrame => {
  const f = values || evaluate(sp.tracks, t, sp.base);
  let tx = f.tx + (f.txp / 100) * sp.w + (sp.leftOf !== undefined ? (f.left / 100) * sp.leftOf : 0);
  let ty = f.ty + (f.typ / 100) * sp.h;
  let r = f.r;
  if (sp.path) {
    let pts = pathCache.get(sp.path.d);
    if (!pts) {
      pts = flattenPath(sp.path.d);
      pathCache.set(sp.path.d, pts);
    }
    const at = pointAlong(pts, f.od / 100);
    // Chrome measures the path from the box's own top-left and puts its centre on it.
    tx += at.x - sp.w / 2;
    ty += at.y - sp.h / 2;
    if (sp.path.rotate) r += at.angle;
  }
  return {
    tx,
    ty,
    r,
    sx: f.sx * Math.cos((f.ry * Math.PI) / 180),
    sy: f.sy * Math.cos((f.rx * Math.PI) / 180),
    o: f.o,
    reveal: sp.wipe ? 1 - f.dash / 100 : 1,
  };
};
