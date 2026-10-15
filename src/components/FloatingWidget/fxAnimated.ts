import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

/**
 * The launcher effects (core/launcherEntrance, launcherAttention,
 * launcherIdleCall) on the native driver: one clock (ms) per effect, and
 * every moving value an interpolation of it, sampled from the core
 * evaluator. Nothing re-renders while they play.
 */

/** How often the evaluator is sampled (ms). */
export const FX_STEP = 16;

type Sampled = Record<string, number[]>;

/** Sample `fn` (values per channel at t ms) from `from` to `to`. */
export const sample = (from: number, to: number, fn: (t: number) => Record<string, number>, step = FX_STEP): { times: number[]; values: Sampled } => {
  const times: number[] = [];
  for (let t = from; t < to; t += step) times.push(t);
  times.push(to);
  const values: Sampled = {};
  times.forEach((t, i) => {
    const v = fn(t);
    for (const k of Object.keys(v)) (values[k] = values[k] || new Array(times.length))[i] = v[k];
  });
  return { times, values };
};

/** Drop the points a straight line already passes through (to keep the native ranges short). */
const simplify = (times: number[], vals: number[], eps: number): { input: number[]; output: number[] } => {
  const input = [times[0]];
  const output = [vals[0]];
  for (let i = 1; i < times.length - 1; i++) {
    const t0 = input[input.length - 1];
    const v0 = output[output.length - 1];
    const t2 = times[i + 1];
    const v2 = vals[i + 1];
    const lerp = v0 + ((v2 - v0) * (times[i] - t0)) / (t2 - t0);
    if (Math.abs(lerp - vals[i]) > eps) {
      input.push(times[i]);
      output.push(vals[i]);
    }
  }
  input.push(times[times.length - 1]);
  output.push(vals[vals.length - 1]);
  return { input, output };
};

/** A channel as a value of the clock (a plain number when it never moves). */
// Typed loosely: it goes straight into an Animated style (a number, a "12deg" string or an interpolation).
export const curve = (clock: Animated.Value, times: number[], vals: number[], unit = ''): any => {
  const first = vals[0];
  if (vals.every((v) => Math.abs(v - first) < 1e-6)) return unit ? `${first}${unit}` : first;
  const { input, output } = simplify(times, vals, unit === 'deg' ? 0.02 : 0.002);
  return clock.interpolate({
    inputRange: input,
    outputRange: (unit ? output.map((v) => `${v}${unit}`) : output) as any,
    extrapolate: 'clamp',
  });
};

/** The transform of a box (w x h) moved about `origin` (px in the box; default its centre): translate, rotate, scale. */
export const boxTransform = (
  clock: Animated.Value,
  s: { times: number[]; values: Sampled },
  w: number,
  h: number,
  origin?: [number, number],
  k = 1
): any[] => {
  const v = s.values;
  const ox = (origin ? origin[0] : w / 2) - w / 2;
  const oy = (origin ? origin[1] : h / 2) - h / 2;
  const out: any[] = [];
  if (ox || oy) out.push({ translateX: ox }, { translateY: oy });
  if (v.tx) out.push({ translateX: curve(clock, s.times, k === 1 ? v.tx : v.tx.map((x) => x * k)) });
  if (v.ty) out.push({ translateY: curve(clock, s.times, k === 1 ? v.ty : v.ty.map((x) => x * k)) });
  if (v.r) out.push({ rotate: curve(clock, s.times, v.r, 'deg') });
  if (v.sx) out.push({ scaleX: curve(clock, s.times, v.sx) });
  if (v.sy) out.push({ scaleY: curve(clock, s.times, v.sy) });
  if (ox || oy) out.push({ translateX: -ox }, { translateY: -oy });
  return out;
};

/**
 * A clock that runs once (`play`), or an intro then a loop forever
 * (`loop`), and pauses where it is.
 */
export class FxClock {
  value = new Animated.Value(0);
  private plan: { intro: number; period: number } | { end: number; done?: () => void } | null = null;
  private running = false;

  play(end: number, done?: () => void) {
    this.stop();
    this.value.setValue(0);
    this.plan = { end, done };
    this.go(0);
  }

  loop(intro: number, period: number) {
    this.stop();
    this.value.setValue(0);
    this.plan = { intro, period };
    this.go(0);
  }

  pause() {
    if (!this.running) return;
    this.running = false;
    this.value.stopAnimation();
  }

  resume() {
    if (this.running || !this.plan) return;
    this.value.stopAnimation((v) => this.go(v));
  }

  stop() {
    this.running = false;
    this.plan = null;
    this.value.stopAnimation();
  }

  private go(from: number) {
    const p = this.plan;
    if (!p) return;
    this.running = true;
    const timing = (to: number, ms: number) => Animated.timing(this.value, { toValue: to, duration: Math.max(0, ms), easing: Easing.linear, useNativeDriver: true });
    if ('end' in p) {
      timing(p.end, p.end - from).start(({ finished }) => {
        if (finished && this.plan === p) {
          this.running = false;
          p.done?.();
        }
      });
      return;
    }
    const end = p.intro + p.period;
    const steady = Animated.loop(Animated.sequence([Animated.timing(this.value, { toValue: p.intro, duration: 0, useNativeDriver: true }), timing(end, p.period)]));
    // From where it was: to the end of this lap (or of the intro), then lap after lap.
    const first = from < p.intro ? Animated.sequence([timing(p.intro, p.intro - from), timing(end, p.period)]) : timing(end, end - from);
    Animated.sequence([first, steady]).start();
  }
}

/** Reduced motion, as the platform reports it (and when it changes). */
export const useReducedMotion = (): boolean => {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => alive && setOn(!!v)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => setOn(!!v));
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return on;
};
