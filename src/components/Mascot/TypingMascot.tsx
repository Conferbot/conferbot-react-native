import React, { useEffect, useMemo } from 'react';
import { Animated, Easing, View } from 'react-native';
import { evaluate, type Track } from '../../core/keyframes';
import { mascotOrigins, type MascotLook } from '../../core/mascotArt';
import { TYPING_MASCOT, TYPING_PENCIL } from '../../core/mascotMoods';
import { boxTransform, curve, FxClock, sample } from '../FloatingWidget/fxAnimated';
import { MascotFigure, useMascotLayers, type SvgXmlComponent } from './MascotFigure';
import { partStyle } from './useMascotMood';
import { loadSvg } from '../../optional/svg';

/** A track looping on its own clock (after its delay), as a style. */
const useLoop = (make: (clock: FxClock) => any, period: number, intro: number, on: boolean) => {
  const clock = useMemo(() => new FxClock(), []);
  useEffect(() => {
    if (!on) return undefined;
    clock.loop(intro, period);
    return () => clock.stop();
  }, [on, intro, period, clock]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (on ? make(clock) : null), [on, clock]);
};

const opacityOf = (clock: FxClock, track: Track, end: number, base: number) => {
  const s = sample(0, end, (t) => ({ o: evaluate([track], t, { o: base }).o }));
  return curve(clock.value, s.times, s.values.o);
};

/**
 * The "mascot" typing style (chatChrome.ts, polish.css .cb-typing--mascot):
 * the bot's mascot, its head framed tight (32 x 32), gently swaying about
 * 50% 90% of its box, blinking and glancing at three thought dots rising
 * beside it in the bubble's text colour. Still under reduced motion.
 */
export const TypingMascot: React.FC<{ look: Partial<MascotLook>; accent: string; ink: string; reduced: boolean; Svg: SvgXmlComponent }> = ({ look, accent, ink, reduced, Svg }) => {
  const T = TYPING_MASCOT;
  const n = T.size;
  const on = !reduced;
  const layers = useMascotLayers(accent, 'down', look, true);
  const joints = mascotOrigins(look);
  const sway = useLoop((clock) => {
    const s = sample(0, 2400, (t) => {
      const v = evaluate([T.sway], t);
      return { r: v.r, ty: v.ty };
    });
    return { transform: boxTransform(clock.value, s, n, n, [T.origin[0], T.origin[1]], 1, 'rts') };
  }, 2400, 0, on);
  const lid = useLoop((clock) => partStyle(clock, [T.blink], 3400, n, joints.lid, true, { sy: 0 }), 3400, 0, on);
  const glance = useLoop((clock) => partStyle(clock, [T.glance], 2400, n, joints.look, true), 2400, 0, on);
  const dots = useLoop((clock) => T.dots.map((d) => opacityOf(clock, d.track, 2400, 0.25)), 1200, 1200, on);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Animated.View style={[{ width: n, height: n }, sway]}>
        <MascotFigure layers={layers} size={n} Svg={Svg} styles={{ lid, look: glance }} />
      </Animated.View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 16 }}>
        {T.dots.map((d, i) => (
          <Animated.View key={i} style={{ width: d.d, height: d.d, borderRadius: d.d / 2, marginBottom: d.up, backgroundColor: ink, opacity: dots ? dots[i] : 0.25 }} />
        ))}
      </View>
    </View>
  );
};

// The pencil needs react-native-svg's own Path (its dash moves); without it the dots are drawn.
let AnimatedPath: any = null;
let SvgRoot: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const svg = loadSvg();
  SvgRoot = svg.Svg || svg.default;
  AnimatedPath = svg.Path ? Animated.createAnimatedComponent(svg.Path) : null;
} catch {
  AnimatedPath = null;
}
export const canDrawPencil = (): boolean => !!AnimatedPath && !!SvgRoot;

const pencilXml = (accent: string, ink: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -6 20 20"><path d="M0 0 L4 -4 L14 6 L10 10 Z" fill="${accent}"/><path d="M0 0 L2.6 -2.6 L1.2 1.2 Z" fill="${ink}"/><path d="M10 10 L14 6 L15.6 7.6 L11.6 11.6 Z" fill="#f59e9e"/></svg>`;

/**
 * The "pencil" typing style (polish.css .cb-typing--pencil): a 44 x 16 line
 * that writes itself in 2s (stroke-dashoffset 60 to 0, then fades), the
 * pencil in the launcher colour riding its tip. Still under reduced motion
 * (the line drawn, the pencil at rest).
 */
export const TypingPencil: React.FC<{ accent: string; ink: string; reduced: boolean; Svg: SvgXmlComponent }> = ({ accent, ink, reduced, Svg }) => {
  const P = TYPING_PENCIL;
  const t = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    if (reduced) return undefined;
    const a = Animated.loop(Animated.timing(t, { toValue: P.period, duration: P.period, easing: Easing.linear, useNativeDriver: false }));
    a.start();
    return () => a.stop();
  }, [reduced, t, P.period]);
  // Linear keyframes: the interpolation through them is exactly the CSS.
  const styles = useMemo(() => {
    const at = (k: { offset?: number }) => (k.offset as number) * P.period;
    const pen = P.pencil.keyframes.map((k) => ({ t: at(k), v: evaluate([P.pencil], Math.min(at(k), P.period - 0.001)) }));
    pen[pen.length - 1].v = evaluate([P.pencil], 0);
    const line = P.write.keyframes.map((k) => ({ t: at(k), v: evaluate([P.write], Math.min(at(k), P.period - 0.001), { dash: P.dash }) }));
    line[line.length - 1].v = { ...line[line.length - 1].v, o: 0 };
    const range = (pts: { t: number }[], vals: number[]) => t.interpolate({ inputRange: pts.map((p) => p.t), outputRange: vals, extrapolate: 'clamp' });
    return {
      pencil: { transform: [{ translateX: range(pen, pen.map((p) => p.v.tx)) }, { translateY: range(pen, pen.map((p) => p.v.ty)) }] },
      dash: range(line, line.map((p) => p.v.dash)),
      opacity: range(line, line.map((p) => p.v.o)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);
  if (!AnimatedPath || !SvgRoot) return null;
  return (
    <View style={{ width: 44, height: 16 }}>
      <Animated.View style={{ opacity: reduced ? 1 : styles.opacity }}>
        <SvgRoot width={44} height={16} viewBox="0 0 44 16">
          <AnimatedPath d={P.line} stroke={ink} strokeWidth={1.8} strokeLinecap="round" fill="none" strokeDasharray={[P.dash, P.dash]} strokeDashoffset={reduced ? 0 : styles.dash} />
        </SvgRoot>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: -2, top: -6, width: 20, height: 20 }, reduced ? { transform: [{ translateX: 2 }, { translateY: 11 }] } : styles.pencil]}>
        <Svg xml={pencilXml(accent, ink)} width={20} height={20} />
      </Animated.View>
    </View>
  );
};
