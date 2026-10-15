import React, { useMemo } from 'react';
import { Animated, View } from 'react-native';
import { spriteFrame } from '../../core/launcherEntrance';
import type { FxSprite } from '../../core/launcherEntrance';
import { boxTransform, curve, sample } from './fxAnimated';

type SvgComponent = React.ComponentType<{ xml: string; width: number | string; height: number | string }>;

/**
 * An entrance's sprites (core/launcherEntrance) on the clock: each a box at
 * its place on the stage, moved, turned, scaled and faded as the web
 * animates it, its children inside it. A stroke drawn on is a wipe of the
 * drawing.
 */
export const FxSpriteView: React.FC<{ sp: FxSprite; clock: Animated.Value; end: number; Svg: SvgComponent }> = ({ sp, clock, end, Svg }) => {
  const s = useMemo(() => sample(0, end, (t) => spriteFrame(sp, t) as unknown as Record<string, number>), [sp, end]);
  const w = Math.max(1, sp.w);
  const h = Math.max(1, sp.h);
  const v = s.values;
  const drawing = sp.svg ? (
    <Svg xml={sp.svg} width={w} height={h} />
  ) : sp.fill ? (
    <View style={{ width: w, height: h, backgroundColor: sp.fill, borderRadius: sp.radius || 0 }} />
  ) : null;
  let body = drawing;
  if (drawing && sp.wipe) {
    // The part not yet drawn is cut off: a clipping box slid back by what is left, the drawing slid forward as much.
    const along = sp.wipe === 'down' ? h : w;
    const hidden = v.reveal.map((p) => (1 - p) * along);
    const key = sp.wipe === 'down' ? 'translateY' : 'translateX';
    body = (
      <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, overflow: 'hidden', transform: [{ [key]: curve(clock, s.times, hidden.map((x) => -x)) } as any] }}>
        <Animated.View style={{ transform: [{ [key]: curve(clock, s.times, hidden) } as any] }}>{drawing}</Animated.View>
      </Animated.View>
    );
  }
  const kids = (sp.children || []).map((c, i) => <FxSpriteView key={i} sp={c} clock={clock} end={end} Svg={Svg} />);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: sp.x,
        top: sp.y,
        width: w,
        height: h,
        opacity: curve(clock, s.times, v.o) as any,
        transform: boxTransform(clock, s, w, h, sp.origin),
      }}
    >
      {body}
      {sp.clip !== undefined ? <View style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, overflow: 'hidden', borderRadius: sp.clip }}>{kids}</View> : kids}
    </Animated.View>
  );
};
