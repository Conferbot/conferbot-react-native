/**
 * Web Animations, evaluated: the launcher's entrance, attention and idle
 * call (conferbot-widget src/ts/launcher/entrance.ts, attention.ts,
 * idleCall.ts) are element.animate() calls on the individual translate /
 * scale / rotate properties and opacity. Their keyframes are kept here as the
 * web wrote them, and this works out each property at time t the way the
 * browser does:
 *
 *   - offsets: a keyframe without one is spaced evenly between its
 *     neighbours (the first defaults to 0, the last to 1);
 *   - per property, only the keyframes that set it count; a missing 0% or
 *     100% keyframe is the element's own value (the step from a missing 0%
 *     eases with the 0% keyframe's easing, as Chrome plays it);
 *   - each keyframe's `easing` eases the step that starts at it; the
 *     options' easing eases the whole iteration first;
 *   - delay, iterations (Infinity loops) and fill (forwards / backwards /
 *     both; none: the element's own value outside the animation);
 *   - several animations on one element: the later one wins for the
 *     properties it sets.
 *
 * Checked against Chrome's own animations, frame by frame
 * (scripts/parity/launcherfx). Pure.
 */
import { cubicBezier } from './launcherMotion';

/** One keyframe, as the web passes it to element.animate(). */
export type Keyframe = { offset?: number; easing?: string } & Record<string, string | number | undefined>;

export interface TrackOptions {
  duration: number;
  delay?: number;
  iterations?: number;
  easing?: string;
  fill?: 'none' | 'forwards' | 'backwards' | 'both' | 'auto';
}

export interface Track {
  keyframes: Keyframe[];
  options: TrackOptions;
}

/**
 * The animated values: translate in px (tx, ty) plus a share of the
 * element's own box (txp, typ, in %), scale, rotate about z (r) and the 3D
 * turns (rx, ry) in degrees, opacity, offset-distance (od, %),
 * stroke-dashoffset (dash), clip-path inset from the bottom (clip, %) and
 * `left` (%).
 */
export interface FxValues {
  tx: number;
  ty: number;
  txp: number;
  typ: number;
  sx: number;
  sy: number;
  r: number;
  rx: number;
  ry: number;
  o: number;
  od: number;
  dash: number;
  clip: number;
  left: number;
}

export const REST: FxValues = { tx: 0, ty: 0, txp: 0, typ: 0, sx: 1, sy: 1, r: 0, rx: 0, ry: 0, o: 1, od: 0, dash: 0, clip: 0, left: 0 };

const EASE: Record<string, number[]> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
};

/** A CSS easing as cubic-bezier control points (unknown: linear). */
export const easingOf = (e: string | undefined): number[] => {
  if (!e) return EASE.linear;
  const s = e.trim();
  if (EASE[s]) return EASE[s];
  const m = /^cubic-bezier\(([^)]*)\)$/.exec(s);
  if (m) {
    const n = m[1].split(',').map((x) => parseFloat(x));
    if (n.length === 4 && n.every((x) => Number.isFinite(x))) return n;
  }
  return EASE.linear;
};

const ease = (e: number[], x: number): number => (e === EASE.linear || (e[0] === 0 && e[1] === 0 && e[2] === 1 && e[3] === 1) ? x : cubicBezier(e, x));

type Group = 'translate' | 'scale' | 'rotate' | 'opacity' | 'offsetDistance' | 'strokeDashoffset' | 'clipPath' | 'left' | 'transform';
const CHANNELS: Record<Group, (keyof FxValues)[]> = {
  translate: ['tx', 'ty', 'txp', 'typ'],
  scale: ['sx', 'sy'],
  rotate: ['r', 'rx', 'ry'],
  opacity: ['o'],
  offsetDistance: ['od'],
  strokeDashoffset: ['dash'],
  clipPath: ['clip'],
  left: ['left'],
  // Only "scaleY(n)" is used (the eyelids): it is the scale's y.
  transform: ['sy'],
};
const GROUPS = Object.keys(CHANNELS) as Group[];

/** "12px", "-160%", "0", "calc(10% + 4px)": [px, %]. */
const length = (v: string): [number, number] => {
  const s = v.trim();
  if (s.startsWith('calc(')) {
    let px = 0;
    let pc = 0;
    s.slice(5, -1).replace(/([+-]?)\s*([\d.]+)(px|%)/g, (_m, sign, n, u) => {
      const x = (sign === '-' ? -1 : 1) * parseFloat(n);
      if (u === '%') pc += x;
      else px += x;
      return '';
    });
    return [px, pc];
  }
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return [0, 0];
  return s.endsWith('%') ? [0, n] : [n, 0];
};

/** One keyframe's value for a group, or undefined when it does not set it. */
const parse = (k: Keyframe, g: Group): Partial<FxValues> | undefined => {
  const v = k[g];
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  switch (g) {
    case 'translate': {
      // Split on spaces outside calc().
      const parts = s.split(/\s+(?![^(]*\))/);
      const [x, xp] = length(parts[0] || '0');
      const [y, yp] = length(parts[1] || '0');
      return { tx: x, txp: xp, ty: y, typ: yp };
    }
    case 'scale': {
      const parts = s.split(/\s+/).map(parseFloat);
      return { sx: parts[0], sy: parts.length > 1 ? parts[1] : parts[0] };
    }
    case 'rotate': {
      // "45deg", "y 180deg", "x 80deg".
      const m = /^(?:([xyz])\s+)?(-?[\d.]+)deg$/.exec(s);
      const a = m ? parseFloat(m[2]) : parseFloat(s) || 0;
      const axis = m && m[1] ? m[1] : 'z';
      return { r: axis === 'z' ? a : 0, rx: axis === 'x' ? a : 0, ry: axis === 'y' ? a : 0 };
    }
    case 'opacity':
      return { o: Number(v) };
    case 'offsetDistance':
      return { od: parseFloat(s) };
    case 'strokeDashoffset':
      return { dash: Number(v) };
    case 'clipPath': {
      // inset(top right bottom left): the bottom inset, in %.
      const m = /inset\(([^)]*)\)/.exec(s);
      const p = m ? m[1].trim().split(/\s+/) : [];
      return { clip: p.length >= 3 ? parseFloat(p[2]) || 0 : 0 };
    }
    case 'left':
      return { left: parseFloat(s) };
    case 'transform': {
      const m = /scaleY\(([^)]*)\)/.exec(s);
      return m ? { sy: parseFloat(m[1]) } : undefined;
    }
  }
  return undefined;
};

/** Offsets as the browser computes them: missing ones spaced evenly between their neighbours. */
export const computedOffsets = (kfs: Keyframe[]): number[] => {
  const out: (number | undefined)[] = kfs.map((k) => (typeof k.offset === 'number' ? k.offset : undefined));
  if (out.length === 1 && out[0] === undefined) out[0] = 1;
  if (out.length > 1) {
    if (out[0] === undefined) out[0] = 0;
    if (out[out.length - 1] === undefined) out[out.length - 1] = 1;
  }
  let i = 0;
  while (i < out.length) {
    if (out[i] !== undefined) {
      i += 1;
      continue;
    }
    const a = i - 1;
    let b = i;
    while (out[b] === undefined) b += 1;
    const from = out[a] as number;
    const to = out[b] as number;
    for (let j = a + 1; j < b; j++) out[j] = from + ((to - from) * (j - a)) / (b - a);
    i = b;
  }
  return out as number[];
};

/** The iteration progress (0..1, eased by the options' easing) at t ms, or null when the animation does not apply. */
export const iterationProgress = (o: TrackOptions, t: number): number | null => {
  const delay = o.delay || 0;
  const iterations = o.iterations === undefined ? 1 : o.iterations;
  const dur = o.duration;
  const fill = o.fill || 'none';
  const active = iterations === Infinity ? Infinity : dur * iterations;
  const local = t - delay;
  let p: number;
  if (local < 0) {
    if (fill !== 'backwards' && fill !== 'both') return null;
    p = 0;
  } else if (local >= active) {
    if (fill !== 'forwards' && fill !== 'both') return null;
    // Ended on a whole iteration: its end (1), else where it stopped.
    const whole = iterations - Math.floor(iterations);
    p = iterations > 0 && whole === 0 ? 1 : whole;
  } else {
    if (dur <= 0) return null;
    p = (local % dur) / dur;
  }
  return ease(easingOf(o.easing), p);
};

/** One track's values at t ms: only the properties it animates, or null when it does not apply. */
export const trackValues = (track: Track, t: number, base: FxValues = REST): Partial<FxValues> | null => {
  const p = iterationProgress(track.options, t);
  if (p === null) return null;
  const kfs = track.keyframes;
  const offs = computedOffsets(kfs);
  const out: Partial<FxValues> = {};
  let any = false;
  for (const g of GROUPS) {
    const pts: { at: number; v: Partial<FxValues>; e: number[] }[] = [];
    kfs.forEach((k, i) => {
      const v = parse(k, g);
      if (v) pts.push({ at: offs[i], v, e: easingOf(k.easing) });
    });
    if (!pts.length) continue;
    any = true;
    const neutral: Partial<FxValues> = {};
    for (const ch of CHANNELS[g]) neutral[ch] = base[ch];
    // As Chrome does: a missing 0% keyframe takes the easing of the keyframe at 0% (if any).
    const first = kfs.findIndex((_, i) => offs[i] === 0);
    if (pts[0].at !== 0) pts.unshift({ at: 0, v: neutral, e: first >= 0 ? easingOf(kfs[first].easing) : EASE.linear });
    if (pts[pts.length - 1].at !== 1) pts.push({ at: 1, v: neutral, e: EASE.linear });
    // The interval: the last keyframe at or before p (and before 1), and the next.
    let s = -1;
    for (let i = 0; i < pts.length; i++) if (pts[i].at <= p && pts[i].at < 1) s = i;
    if (s < 0) {
      for (let i = 0; i < pts.length; i++) if (pts[i].at === 0) s = i;
    }
    let value: Partial<FxValues>;
    if (p >= 1 && pts.filter((x) => x.at === 1).length > 1) value = pts[pts.length - 1].v;
    else if (s < 0 || s >= pts.length - 1) value = pts[Math.max(0, Math.min(pts.length - 1, s))].v;
    else {
      const a = pts[s];
      const b = pts[s + 1];
      const span = b.at - a.at;
      const local = span > 0 ? ease(a.e, (p - a.at) / span) : 1;
      value = {};
      for (const ch of CHANNELS[g]) {
        const va = (a.v[ch] ?? base[ch]) as number;
        const vb = (b.v[ch] ?? base[ch]) as number;
        value[ch] = va + (vb - va) * local;
      }
    }
    for (const ch of CHANNELS[g]) if (value[ch] !== undefined) out[ch] = value[ch];
  }
  if (!any) return null;
  // The computed opacity is clamped (an overshooting easing goes past 1).
  if (out.o !== undefined) out.o = Math.min(1, Math.max(0, out.o));
  return out;
};

/** An element's values at t ms under its animations, in order (the later wins), over its own `base`. */
export const evaluate = (tracks: Track[], t: number, base: Partial<FxValues> = {}): FxValues => {
  const b: FxValues = { ...REST, ...base };
  const out: FxValues = { ...b };
  for (const tr of tracks) {
    const v = trackValues(tr, t, b);
    if (v) Object.assign(out, v);
  }
  return out;
};

/** When a set of tracks is over (ms; Infinity when one loops forever). */
export const tracksEnd = (tracks: Track[]): number =>
  tracks.reduce((m, tr) => {
    const it = tr.options.iterations === undefined ? 1 : tr.options.iterations;
    return Math.max(m, (tr.options.delay || 0) + tr.options.duration * it);
  }, 0);

/**
 * The tracks sampled every `step` ms from `from` to `to`: the times and, per
 * channel that moves, its values (for a native-driven interpolation).
 */
export const sampleTracks = (
  tracks: Track[],
  from: number,
  to: number,
  step: number,
  base: Partial<FxValues> = {}
): { times: number[]; values: Partial<Record<keyof FxValues, number[]>> } => {
  const times: number[] = [];
  for (let t = from; t < to; t += step) times.push(t);
  times.push(to);
  const frames = times.map((t) => evaluate(tracks, t, base));
  const values: Partial<Record<keyof FxValues, number[]>> = {};
  (Object.keys(REST) as (keyof FxValues)[]).forEach((ch) => {
    const col = frames.map((f) => f[ch]);
    if (col.some((v) => Math.abs(v - col[0]) > 1e-9) || (base as any)[ch] !== undefined) values[ch] = col;
  });
  return { times, values };
};
