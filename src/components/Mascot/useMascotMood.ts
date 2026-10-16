import { useEffect, useMemo } from 'react';
import { evaluate, transformOrder, type FxValues, type Track } from '../../core/keyframes';
import { mascotOrigins, mascotPoint, mascotUnit, type MascotArm, type MascotLook } from '../../core/mascotArt';
import { moodPlan, type MascotMood, type MoodPart } from '../../core/mascotMoods';
import { boxTransform, curve, FxClock, sample } from '../FloatingWidget/fxAnimated';
import type { MascotPartStyles } from './MascotFigure';

/** Each part's own value at rest: the lids open (scaleY 0, as drawn on the web). */
const BASE: Partial<Record<MoodPart, Partial<FxValues>>> = { lid: { sy: 0 } };

/**
 * A part moved by its tracks on `clock`, about its joint (`pivot`, in the
 * drawing's units) in a size x size box: the transform list in its own order,
 * the opacity when it changes.
 */
export const partStyle = (
  clock: FxClock,
  tracks: Track[],
  end: number,
  size: number,
  pivot: readonly [number, number],
  bust: boolean,
  base: Partial<FxValues> = {}
): any => {
  const s = sample(0, end, (t) => {
    const v = evaluate(tracks, t, base);
    return { o: v.o, tx: v.tx, ty: v.ty, r: v.r, sx: v.sx, sy: v.sy };
  });
  const o = s.values.o;
  const at = mascotPoint(pivot, size, bust);
  return {
    ...(o && o.some((x) => x !== 1) ? { opacity: curve(clock.value, s.times, o) } : null),
    transform: boxTransform(clock.value, s, size, size, at, mascotUnit(size, bust), transformOrder(tracks[0])),
  };
};

/**
 * The mascot in a mood (core/mascotMoods: blink, wave, think, happy) on the
 * native driver: one clock plays the mood's finite part, then loops a lap
 * of what goes on (the blink). Reduced motion: still, the happy smile kept.
 */
export function useMascotMood(o: {
  mood: MascotMood;
  size: number;
  look?: Partial<MascotLook>;
  arm?: MascotArm;
  bust?: boolean;
  waveCount?: number;
  reduced?: boolean;
  enabled?: boolean;
}): { styles: MascotPartStyles | null; grin: boolean } {
  const { mood, size, look, arm, bust = false, waveCount, reduced = false, enabled = true } = o;
  const clock = useMemo(() => new FxClock(), []);
  const plan = useMemo(() => moodPlan(mood, { arm, bust, waveCount, reduced }), [mood, arm, bust, waveCount, reduced]);
  const moving = enabled && Object.keys(plan.parts).length > 0;

  useEffect(() => {
    if (!moving) {
      clock.stop();
      return undefined;
    }
    clock.loop(plan.settle, plan.period);
    return () => clock.stop();
  }, [moving, plan, clock]);

  const styles = useMemo(() => {
    if (!moving) return null;
    const pivots = mascotOrigins(look);
    const end = plan.settle + plan.period;
    const pivot: Record<MoodPart, readonly [number, number]> = {
      body: pivots.body,
      arm: pivots.arm,
      lid: pivots.lid,
      look: pivots.look,
      brow: pivots.brow,
      shadow: [50, look?.shape === 'ghost' ? 99 : 95],
    };
    const out: MascotPartStyles = {};
    (Object.keys(plan.parts) as MoodPart[]).forEach((part) => {
      const tracks = plan.parts[part];
      if (tracks && tracks.length) out[part] = partStyle(clock, tracks, end, size, pivot[part], bust, BASE[part]);
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moving, plan, size, bust, look?.shape, clock]);

  return { styles, grin: plan.grin };
}
