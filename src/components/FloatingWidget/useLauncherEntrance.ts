import { useEffect, useMemo, useRef, useState } from 'react';
import { evaluate, REST } from '../../core/keyframes';
import {
  ENTRANCE_START_MS,
  SETTLE_REVEAL,
  entrancePlan,
  entranceStage,
  entranceTimeline,
  shouldPlayEntrance,
  spriteFrame,
} from '../../core/launcherEntrance';
import type { EntrancePlan, LauncherEntrance } from '../../core/launcherEntrance';
import { FxClock, boxTransform, curve, sample } from './fxAnimated';

/** The entrance each bot played this app session (a different one plays once more). */
const played: Record<string, string> = {};
/** If the effect has not started by then, the launcher simply appears. */
const REVEAL_FAILSAFE_MS = 6000;

/**
 * How the launcher arrives (core/launcherEntrance, as the web's
 * entrance.ts): decided when the bot's settings arrive, once per app
 * session per bot and entrance, never over an open chat or with reduced
 * motion. The launcher is held invisible until the effect reveals it; the
 * greeting stays hidden until it has landed, then fades up. Opening the
 * chat ends it at once. `busy` (the effect has not landed yet) holds the
 * attention loop and the idle call.
 */
export function useLauncherEntrance(o: {
  mode: LauncherEntrance;
  botId: string;
  enabled: boolean;
  reduced: boolean;
  chatOpen: boolean;
  size: { w: number; h: number } | null;
  position: 'left' | 'right';
  screen: { width: number; height: number };
  side: number;
  bottom: number;
  accent: string;
}) {
  const { mode, botId, enabled, reduced, chatOpen, size } = o;
  const [phase, setPhase] = useState<'none' | 'hold' | 'play' | 'done'>('none');
  const [plan, setPlan] = useState<EntrancePlan | null>(null);
  const [busy, setBusy] = useState(false);
  const clock = useRef(new FxClock()).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const decided = useRef(false);

  const finish = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    clock.stop();
    setBusy(false);
    setPhase('done');
  };

  // Decided once, when the settings arrive.
  useEffect(() => {
    if (decided.current || !enabled) return;
    decided.current = true;
    if (!shouldPlayEntrance({ mode, reducedMotion: reduced, chatOpen, played: played[botId || 'bot'] === mode })) return;
    setPhase('hold');
    setBusy(true);
    timers.current.push(setTimeout(() => setPhase((p) => (p === 'hold' ? 'done' : p)), REVEAL_FAILSAFE_MS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Once the launcher is laid out: the stage, the effect, the phases.
  useEffect(() => {
    if (phase !== 'hold' || !size) return undefined;
    const t = setTimeout(() => {
      const p = entrancePlan(mode, entranceStage({ width: size.w, height: size.h, position: o.position, screenWidth: o.screen.width, screenHeight: o.screen.height, side: o.side, bottom: o.bottom, accent: o.accent }));
      if (!p) return finish();
      played[botId || 'bot'] = mode;
      const tl = entranceTimeline(p);
      setPlan(p);
      setPhase('play');
      clock.play(tl.endAt, finish);
      timers.current.push(setTimeout(() => setBusy(false), tl.settleAt));
    }, ENTRANCE_START_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, size]);

  // Opening the chat by any route ends it at once.
  useEffect(() => {
    if (chatOpen && (phase === 'hold' || phase === 'play')) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatOpen]);

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    clock.stop();
  }, [clock]);

  // The launcher: hidden until the reveal, then its arrival; the greeting: hidden until the settle, then fading up.
  const styles = useMemo(() => {
    if (phase === 'hold') return { launcher: { opacity: 0 }, greeting: { opacity: 0 }, wipe: null };
    if (phase !== 'play' || !plan || !size) return null;
    const tl = entranceTimeline(plan);
    const arrive = [{ ...plan.arrive, options: { ...plan.arrive.options, delay: plan.revealAt } }];
    const self = { x: 0, y: 0, w: size.w, h: size.h, tracks: arrive };
    const launcher = sample(0, tl.endAt, (t) => {
      if (t < plan.revealAt) return { ...(spriteFrame(self, t, { ...REST }) as any), o: 0 };
      const v = evaluate(arrive, t);
      return { ...(spriteFrame(self, t, v) as any), clip: v.clip };
    });
    const settle = [{ ...SETTLE_REVEAL, options: { ...SETTLE_REVEAL.options, delay: tl.settleAt } }];
    const greeting = sample(0, tl.endAt, (t) => {
      const v = evaluate(settle, t);
      return { o: v.o, ty: v.ty };
    });
    const clipped = plan.arrive.keyframes.some((k) => k.clipPath !== undefined);
    return {
      launcher: { opacity: curve(clock.value, launcher.times, launcher.values.o), transform: boxTransform(clock.value, launcher, size.w, size.h) },
      greeting: { opacity: curve(clock.value, greeting.times, greeting.values.o), transform: [{ translateY: curve(clock.value, greeting.times, greeting.values.ty) }] },
      // The saucer's beam draws it top to bottom (clip-path inset from the bottom).
      wipe: clipped
        ? {
            outer: [{ translateY: curve(clock.value, launcher.times, launcher.values.clip.map((c) => -(c / 100) * size.h)) }],
            inner: [{ translateY: curve(clock.value, launcher.times, launcher.values.clip.map((c) => (c / 100) * size.h)) }],
          }
        : null,
    };
  }, [phase, plan, size, clock]);

  return { phase, plan, clock: clock.value, end: plan ? entranceTimeline(plan).endAt : 0, busy, styles, finish };
}
