/**
 * The launcher's motion as the web widget plays it (conferbot-widget
 * src/svg/launcher/motion.ts and ts/launcher/launcherMotion.ts):
 *
 *   - which parts of an icon move, and how, at a moment in an "idle" or
 *     "msg" (new message) moment: iconFrame() evaluates the CSS keyframes,
 *     easing, delays, iterations and fill modes at time t;
 *   - when the moments play: nextIdleDelay() (first ~2s after the launcher
 *     shows, then every 30s four times for "subtle", every 20-28s ten times
 *     for "lively", never for "off"; none once the chat was opened);
 *   - the ripple: two rings in the launcher colour after the page settles.
 *
 * Pure: the floating launcher drives the clock.
 */
import { LAUNCHER_MOTION } from './launcherMotion.data';
import type { MotionFrame, MotionRule } from './launcherMotion.data';
import type { LauncherIconData } from './launcherIcons.data';

export type MotionState = 'idle' | 'msg';
export type LauncherAnimation = 'lively' | 'subtle' | 'off';

/** How long a moment lasts (the longest keyframes are 2.4s). */
export const MOMENT_MS = 2600;
/** The first idle moment, after the launcher shows. */
export const FIRST_IDLE_MS = 2000;
/** An opening rests the idle moments this long. */
export const LAUNCHER_OPENED_REST_MS = 30 * 60 * 1000;

const PLANS = {
  subtle: { every: 30000, jitter: 0, plays: 4 },
  lively: { every: 20000, jitter: 8000, plays: 10 },
};

/** Milliseconds until the next idle moment after `played` of them, or null when there are no more. */
export function nextIdleDelay(mode: LauncherAnimation, played: number, random: () => number = Math.random): number | null {
  if (mode === 'off') return null;
  const plan = PLANS[mode] || PLANS.subtle;
  if (played <= 0) return FIRST_IDLE_MS;
  if (played >= plan.plays) return null;
  return plan.every + Math.round(random() * plan.jitter);
}

/** The ripple: two rings, the second 0.6s behind, each 1.8s, three times after 2.5s (polish.css cb-ripple). */
export const RIPPLE = { delay: 2.5, gap: 0.6, dur: 1.8, iter: 3, from: { scale: 1, opacity: 0.45 }, to: { scale: 1.7, opacity: 0 }, ease: [0, 0, 0.2, 1] };

/** A ring's scale and opacity at t seconds into the ripple (null when it is not showing). */
export function rippleRing(t: number, ring: 0 | 1, iterations = RIPPLE.iter, delay = RIPPLE.delay): { scale: number; opacity: number } | null {
  const lt = t - delay - ring * RIPPLE.gap;
  if (lt < 0 || lt >= RIPPLE.dur * iterations) return null;
  const p = cubicBezier(RIPPLE.ease, (lt % RIPPLE.dur) / RIPPLE.dur);
  return { scale: 1 + (RIPPLE.to.scale - 1) * p, opacity: RIPPLE.from.opacity * (1 - p) };
}

/** CSS cubic-bezier timing: the y for a given x (Newton, then bisection). */
export function cubicBezier(e: number[], x: number): number {
  const [x1, y1, x2, y2] = e;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bx = (t: number) => 3 * x1 * t * (1 - t) * (1 - t) + 3 * x2 * t * t * (1 - t) + t * t * t;
  const by = (t: number) => 3 * y1 * t * (1 - t) * (1 - t) + 3 * y2 * t * t * (1 - t) + t * t * t;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const d = (bx(t + 1e-6) - bx(t)) / 1e-6;
    if (Math.abs(d) < 1e-6) break;
    t -= (bx(t) - x) / d;
  }
  if (t < 0 || t > 1 || Math.abs(bx(t) - x) > 1e-4) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
      t = (lo + hi) / 2;
      if (bx(t) < x) lo = t;
      else hi = t;
    }
  }
  return by(t);
}

type Prop = 'tx' | 'ty' | 'sx' | 'sy' | 'r' | 'o';
const BASE: Record<Prop, number> = { tx: 0, ty: 0, sx: 1, sy: 1, r: 0, o: 1 };

/**
 * A property's value at progress p (0..1) of one iteration: CSS interpolates
 * between the frames that set it, with the element's own value at the ends
 * when the first / last frame leaves it out; the timing function eases each
 * segment.
 */
function valueAt(frames: MotionFrame[], prop: Prop, p: number, ease: number[], vars: { dx?: number; dy?: number }, base: number): number {
  const read = (f: MotionFrame): number | undefined => {
    const v = (f as any)[prop];
    if (v === undefined) return undefined;
    if (v === 'dx') return vars.dx ?? 0;
    if (v === 'dy') return vars.dy ?? 0;
    return v as number;
  };
  const pts: { at: number; v: number }[] = [];
  for (const f of frames) {
    const v = read(f);
    if (v !== undefined) pts.push({ at: f.at, v });
  }
  if (!pts.length) return base;
  if (pts[0].at > 0) pts.unshift({ at: 0, v: base });
  if (pts[pts.length - 1].at < 1) pts.push({ at: 1, v: base });
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (p >= a.at && p <= b.at) {
      const span = b.at - a.at;
      const local = span > 0 ? cubicBezier(ease, (p - a.at) / span) : 1;
      return a.v + (b.v - a.v) * local;
    }
  }
  return pts[pts.length - 1].v;
}

/** The rule's progress at time t, or null when it does not apply (not started, finished without fill). */
function progress(rule: MotionRule, t: number): number | null {
  const lt = t - rule.delay;
  const back = rule.fill === 'backwards' || rule.fill === 'both';
  const fwd = rule.fill === 'forwards' || rule.fill === 'both';
  if (lt < 0) return back ? 0 : null;
  if (rule.iter !== -1 && lt >= rule.dur * rule.iter) return fwd ? 1 : null;
  if (rule.dur <= 0) return null;
  return (lt % rule.dur) / rule.dur;
}

/** 2x3 affine matrices [a, b, c, d, e, f]. */
type M = number[];
const mul = (a: M, b: M): M => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];
const IDENTITY: M = [1, 0, 0, 1, 0, 0];

/**
 * Each op at time t of a moment: the transform to draw it with (replacing
 * its own), the transform its clip is drawn with, and its opacity when a
 * part animates it; null for "at rest".
 */
export interface OpFrame {
  m: M;
  clipM?: M;
  /**
   * Animated opacity, per group, outer first: each fades its whole group as
   * one layer (as CSS opacity does), so overlapping shapes in it do not show
   * through each other. A group that is the shape itself replaces its own opacity.
   */
  layers?: { g: number; o: number }[];
}

const invert = (m: M): M => {
  const det = m[0] * m[3] - m[1] * m[2];
  if (!det) return IDENTITY;
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
};

export function iconFrame(icon: LauncherIconData & { boxes?: Record<string, number[]> }, state: MotionState, t: number): (OpFrame | null)[] {
  const fam = LAUNCHER_MOTION.families[icon.anim];
  if (!fam) return icon.ops.map(() => null);
  const rules = fam[state] || [];
  const boxes = icon.boxes || {};
  const awakeOpacity = state === 'msg' ? fam.awakeOpacity : undefined;

  // The value of one part (group) at time t: its transform about its own box, and opacity.
  const cache = new Map<number, { m: M; o?: number } | null>();
  const partFrame = (classes: string[], gid: number, vars: { dx?: number; dy?: number }, unclassed = false): { m: M; o?: number } | null => {
    if (cache.has(gid)) return cache.get(gid)!;
    let m: M | null = null;
    let o: number | undefined;
    // The cascade gives an element one animation: the last rule that matches it.
    let rule: MotionRule | undefined;
    for (const r of rules) if (classes.includes(r.part)) rule = r;
    // A delay set on one of the element's own classes wins (".cbl-d2", ".cbl-c3"...).
    if (rule) {
      for (const c of classes) {
        const d = LAUNCHER_MOTION.delays[`${icon.anim} ${c}`] ?? LAUNCHER_MOTION.delays[`* ${c}`];
        if (d !== undefined) rule = { ...rule, delay: d };
      }
    }
    const p = rule ? progress(rule, t) : null;
    if (rule && p !== null) {
      // A frame that uses --dx / --dy on an element without them is invalid
      // at computed-value time: its transform is "none".
      const frames = LAUNCHER_MOTION.keyframes[rule.kf].map((f) =>
        (f.tx === 'dx' || f.ty === 'dy' || f.tx === 'dy' || f.ty === 'dx') && (vars.dx === undefined || vars.dy === undefined)
          ? { ...f, tx: 0, ty: 0, sx: 1, sy: 1, r: 0 }
          : f
      );
      const ease = rule.ease;
      const v = (k: Prop) => valueAt(frames, k, p, ease, vars, BASE[k]);
      if (frames.some((f) => f.tx !== undefined || f.sx !== undefined || f.r !== undefined || f.sy !== undefined || f.ty !== undefined)) {
        const box = unclassed ? [0, 0, 0, 0] : boxes[String(gid)] || [0, 0, 24, 24];
        const origin = LAUNCHER_MOTION.origins[`${icon.anim} ${rule.part}`] || [0.5, 0.5];
        const ox = box[0] + box[2] * origin[0];
        const oy = box[1] + box[3] * origin[1];
        const rad = (v('r') * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        // translate(origin) translate(tx, ty) rotate(r) scale(sx, sy) translate(-origin)
        let n: M = [1, 0, 0, 1, ox + v('tx'), oy + v('ty')];
        n = mul(n, [cos, sin, -sin, cos, 0, 0]);
        n = mul(n, [v('sx'), 0, 0, v('sy'), 0, 0]);
        n = mul(n, [1, 0, 0, 1, -ox, -oy]);
        m = n;
      }
      // CSS clamps opacity (an overshooting easing goes past 1).
      if (frames.some((f) => f.o !== undefined)) o = Math.min(1, Math.max(0, v('o')));
    }
    if (o === undefined && awakeOpacity) {
      for (const c of classes) if (awakeOpacity[c] !== undefined) o = awakeOpacity[c];
    }
    const out = m || o !== undefined ? { m: m || IDENTITY, o } : null;
    cache.set(gid, out);
    return out;
  };

  return icon.ops.map((op) => {
    const chain = [{ c: ['cbl-r'], g: 0 } as { c: string[]; g: number; dx?: number; dy?: number; t?: number[]; u?: number; o?: number; pre?: number[] }, ...(op.parts || [])];
    // Level by level, as the tree nests: the static transform above each part,
    // then the part's own transform, or its animation in place of it.
    let m: M = IDENTITY;
    let clipM: M | undefined;
    const layers: { g: number; o: number }[] = [];
    let moved = false;
    chain.forEach((part, i) => {
      // The clip moves with the root and the parts down to the element that declared it.
      if (op.clip && i === (op.clipDepth ?? 0) + 1) clipM = m;
      if (part.pre) m = mul(m, part.pre);
      const f = partFrame(part.c, part.g, { dx: part.dx, dy: part.dy }, !!part.u);
      if (f) moved = true;
      // A CSS transform replaces the element's own transform attribute while it runs.
      m = mul(m, f && f.m !== IDENTITY ? f.m : part.t || IDENTITY);
      if (f && f.o !== undefined) layers.push({ g: part.g, o: f.o });
    });
    if (!moved) return null;
    if (op.clip && clipM === undefined) clipM = m;
    if (op.post) m = mul(m, op.post);
    return { m, clipM: op.clip ? clipM : undefined, layers: layers.length ? layers : undefined };
  });
}
