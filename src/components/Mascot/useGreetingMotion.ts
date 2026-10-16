import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { evaluate, transformOrder, type FxValues, type Track } from '../../core/keyframes';
import {
  cardEnterTrack,
  cardLeaveTrack,
  createMascotDirector,
  figureAmp,
  gestureTrack,
  ownsText,
  talkTrack,
  voicePlayMs,
  wordFade,
  BREATH,
  BREATH_MS,
  PING,
  TALK_MS,
  type MascotDirector,
  type MascotMotion,
  type MascotStage,
} from '../../core/mascotMotion';
import { tracksEnd } from '../../core/keyframes';
import { boxTransform, curve, FxClock, sample } from '../FloatingWidget/fxAnimated';

const styleOf = (clock: FxClock, tracks: Track[], end: number, w: number, h: number, origin?: [number, number], base: Partial<FxValues> = {}) => {
  const s = sample(0, end, (t) => {
    const v = evaluate(tracks, t, base);
    return { o: v.o, tx: v.tx, ty: v.ty, r: v.r, sx: v.sx, sy: v.sy };
  });
  const o = s.values.o;
  return {
    ...(o && o.some((x) => Math.abs(x - 1) > 1e-6) ? { opacity: curve(clock.value, s.times, o) } : null),
    transform: boxTransform(clock.value, s, w, h, origin, 1, transformOrder(tracks[0])),
  };
};
const endOf = (t: Track) => (t.options.iterations === Infinity ? (t.options.delay || 0) + t.options.duration : tracksEnd([t]));

export type GreetingFigure = 'mascot' | 'avatar' | null;

/**
 * The greeting card alive (core/mascotMotion): the web's director on this
 * card, its stage on native-driven clocks. The card springs up (lively) or
 * comes in as always; the figure pops (or rises), waves, nods, breathes and
 * gives at most three small gestures, then stands still; the "Online" dot
 * pings once; the words fade up. When the card goes (`leaving`), the figure
 * hands off to the launcher (opened) or bows (the x) as the card collapses
 * or fades, then `onGone`. A voice note talks while its waveform plays.
 * Nothing while the app is in the background; reduced motion: a fade.
 */
export function useGreetingMotion(o: {
  mode: MascotMotion;
  style: string;
  text: string;
  figure: GreetingFigure;
  /** The figure's box (px): its pivot is its feet (50% 100%). */
  figureSize: number;
  /** Where the launcher's centre is from the figure's (the hand-off), when known. */
  toward?: () => { x: number; y: number } | undefined;
  /** The card's box, for its own moves (about its centre). */
  cardSize: { w: number; h: number };
  leaving?: 'open' | 'close';
  onGone?: () => void;
}) {
  const { mode, style, text, figure, figureSize } = o;
  const live = useRef(o);
  live.current = o;
  const [reduced, setReduced] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    const p = AccessibilityInfo?.isReduceMotionEnabled?.();
    if (!p) setReduced(false);
    else p.then((v) => alive && setReduced(!!v)).catch(() => alive && setReduced(false));
    return () => {
      alive = false;
    };
  }, []);

  const clocks = useMemo(() => ({ enter: new FxClock(), leave: new FxClock(), gesture: new FxClock(), breath: new FxClock(), talk: new FxClock(), ping: new FxClock(), words: new FxClock() }), []);
  const amp = figureAmp(figure);
  const moving = mode !== 'off' && reduced !== true;
  // The figure's first move, held from the first frame so it never shows before its pop.
  const [gesture, setGesture] = useState<Track | null>(() => (moving && figure ? (mode === 'lively' ? gestureTrack('pop', amp, 140) : gestureTrack('rise', amp, 80)) : null));
  const [talk, setTalk] = useState<Track | null>(null);
  const [breathing, setBreathing] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [words, setWords] = useState(false);
  const enterTrack = useMemo(() => cardEnterTrack(mode, style, reduced === true), [mode, style, reduced]);
  const leaveTrack = useMemo(() => (o.leaving ? cardLeaveTrack(mode, o.leaving, reduced === true) : null), [mode, o.leaving, reduced]);

  // ---- The stage the director plays on ----
  const director = useRef<MascotDirector | null>(null);
  useEffect(() => {
    if (reduced === null) return undefined;
    const stage: MascotStage = {
      play(g, a, delay = 0) {
        if (!live.current.figure) return;
        const tr = gestureTrack(g, a, delay, g === 'handoff' ? live.current.toward?.() : undefined);
        clocks.talk.stop();
        setTalk(null);
        setGesture(tr);
        clocks.gesture.play(endOf(tr));
      },
      breathe(on) {
        if (on) {
          setBreathing(true);
          clocks.breath.loop(0, BREATH_MS);
        } else clocks.breath.finishLap(() => setBreathing(false));
      },
      talk(on, a) {
        if (on) {
          clocks.gesture.stop();
          setGesture(null);
          setTalk(talkTrack(a));
          clocks.talk.loop(0, TALK_MS);
        } else clocks.talk.finishLap(() => setTalk(null));
      },
      // A touch screen has no pointer to lean toward.
      lean() {},
      ping(on) {
        if (!on) return;
        setPinging(true);
        clocks.ping.play(endOf(PING.ring));
      },
      words() {
        if (!wordFade(live.current.text)) return;
        setWords(true);
        const f = wordFade(live.current.text)!;
        clocks.words.play(tracksEnd(f.tracks));
      },
      reset() {
        for (const k of ['gesture', 'breath', 'talk', 'ping'] as const) clocks[k].stop();
        setGesture(null);
        setTalk(null);
        setBreathing(false);
        setPinging(false);
      },
    };
    const d = createMascotDirector({
      mode,
      stage,
      reduced: () => reduced,
      amp: () => figureAmp(live.current.figure),
      ownText: () => ownsText(style),
    });
    director.current = d;
    if (enterTrack) clocks.enter.play(endOf(enterTrack));
    d.show();
    if (style === 'voice' && !reduced) d.talkFor(voicePlayMs());
    const sub = AppState?.addEventListener?.('change', (s) => d.pageHidden(s !== 'active'));
    return () => {
      sub?.remove?.();
      d.destroy();
      Object.values(clocks).forEach((c) => c.stop());
      director.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  // ---- Leaving: the figure's hand-off or bow, the card's collapse or fade, then gone ----
  useEffect(() => {
    if (!o.leaving) return undefined;
    director.current?.hide(o.leaving);
    const figureEnd = moving && figure ? (o.leaving === 'close' ? 300 : 280) : 0;
    const cardEnd = leaveTrack ? endOf(leaveTrack) : 0;
    if (leaveTrack) clocks.leave.play(cardEnd);
    const t = setTimeout(() => live.current.onGone?.(), Math.max(figureEnd, cardEnd) + 16);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.leaving]);

  const { w, h } = o.cardSize;
  const feet: [number, number] = [figureSize / 2, figureSize];
  const styles = useMemo(
    () => ({
      enter: enterTrack ? styleOf(clocks.enter, [enterTrack], endOf(enterTrack), w, h) : null,
      leave: leaveTrack ? styleOf(clocks.leave, [leaveTrack], endOf(leaveTrack), w, h) : null,
      gesture: gesture ? styleOf(clocks.gesture, [gesture], endOf(gesture), figureSize, figureSize, feet) : null,
      breath: breathing ? styleOf(clocks.breath, [BREATH], BREATH_MS, figureSize, figureSize, feet) : null,
      talk: talk ? styleOf(clocks.talk, [talk], TALK_MS, figureSize, figureSize, feet) : null,
      pingDot: pinging ? styleOf(clocks.ping, [PING.dot], endOf(PING.ring), 7, 7) : null,
      pingRing: pinging && PING.ringed(style) ? styleOf(clocks.ping, [PING.ring], endOf(PING.ring), 7, 7) : null,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enterTrack, leaveTrack, gesture, breathing, talk, pinging, w, h, figureSize, style]
  );
  const wordStyles = useMemo(() => {
    if (!words) return null;
    const f = wordFade(text);
    if (!f) return null;
    const end = tracksEnd(f.tracks);
    return { words: f.words, styles: f.tracks.map((tr) => styleOf(clocks.words, [tr], end, 1, 1)) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, text]);

  return { ...styles, words: wordStyles, ready: reduced !== null };
}
