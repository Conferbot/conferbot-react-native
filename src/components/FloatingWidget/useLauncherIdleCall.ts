import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Keyboard } from 'react-native';
import { evaluate } from '../../core/keyframes';
import {
  GREETING_FIRST_MS,
  IDLE_CALL_RETRY_MS,
  MASCOT_PART_BASE,
  REST_MS,
  afterCall,
  callAllowed,
  idleCallGeometry,
  idleCallPerformance,
} from '../../core/launcherIdleCall';
import type { IdleCallPerformance, LauncherIdleCall, MascotPart, VisitState } from '../../core/launcherIdleCall';
import { MASCOT_ORIGINS } from '../../core/mascotArt';
import { installedAsyncStorage } from '../../utils/deviceStorage';
import { FxClock, boxTransform, curve, sample } from './fxAnimated';
import { launcherOpenedRecently } from './useLauncherMotion';

/** The calls each bot made this app session (the web's visit, in sessionStorage). */
const visits: Record<string, VisitState> = {};
const REST_KEY = (botId: string) => `@conferbot:idlecall:rest:${botId || 'default'}`;

const readRest = async (botId: string): Promise<number> => {
  try {
    const raw = await installedAsyncStorage()?.getItem(REST_KEY(botId));
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v.until === 'number' ? v.until : 0;
  } catch {
    return 0;
  }
};
const writeRest = (botId: string, until: number) => {
  try {
    installedAsyncStorage()?.setItem(REST_KEY(botId), JSON.stringify({ until })).catch(() => {});
  } catch {
    /* blocked storage: the per-session rules still hold */
  }
};

/**
 * The idle call (core/launcherIdleCall, as the web's idleCall.ts and
 * idlePacing.ts): after the owner's delay, if the visitor has not opened
 * the chat, the mascot slips out from behind the launcher and calls them
 * over, with a speech bubble that opens the chat. One call per screen, two
 * per app session 3 minutes apart, then 3 days' rest (also after an
 * opening); closing the greeting means none for the session. A call waits
 * while the chat is open, the app is in the background, the keyboard is up,
 * an entrance lands, or the greeting has had less than 15s alone.
 */
export function useLauncherIdleCall(o: {
  mode: LauncherIdleCall;
  delay: number;
  enabled: boolean;
  reduced: boolean;
  chatOpen: boolean;
  cardShown: boolean;
  entranceBusy: boolean;
  botId: string;
  size: { w: number; h: number } | null;
  position: 'left' | 'right';
}) {
  const { mode, enabled, reduced, botId } = o;
  const [perf, setPerf] = useState<IdleCallPerformance | null>(null);
  const clock = useRef(new FxClock()).current;
  const live = useRef(o);
  live.current = o;
  const destroyed = useRef(false);
  const playing = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  const cardSince = useRef(0);
  const keyboard = useRef(false);

  useEffect(() => {
    cardSince.current = o.cardShown ? cardSince.current || Date.now() : 0;
  }, [o.cardShown]);

  useEffect(() => {
    const a = Keyboard.addListener('keyboardDidShow', () => (keyboard.current = true));
    const b = Keyboard.addListener('keyboardDidHide', () => (keyboard.current = false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);

  const end = () => {
    clock.stop();
    playing.current = false;
    setPerf(null);
  };

  const destroy = () => {
    destroyed.current = true;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    end();
  };

  useEffect(() => {
    if (!enabled || mode === 'off' || reduced) return undefined;
    destroyed.current = false;
    let restUntil = 0;
    const visit = () => visits[botId] || { n: 0, at: 0 };
    const allowed = () => !launcherOpenedRecently() && callAllowed(visit(), restUntil, Date.now());
    const blocked = () => {
      const l = live.current;
      const greetingHasTheFloor = l.cardShown && Date.now() - cardSince.current < GREETING_FIRST_MS;
      return l.chatOpen || AppState.currentState !== 'active' || keyboard.current || greetingHasTheFloor || l.entranceBusy || !l.size;
    };
    const attempt = () => {
      if (destroyed.current) return;
      if (!allowed()) return destroy();
      if (playing.current || blocked()) return later(attempt, IDLE_CALL_RETRY_MS);
      const now = Date.now();
      const next = afterCall(visit(), now);
      visits[botId] = next.visit;
      // After the last call this session, rest for a few days.
      if (next.rest) writeRest(botId, now + REST_MS);
      const l = live.current;
      const p = idleCallPerformance(mode as Exclude<LauncherIdleCall, 'off'>, idleCallGeometry(l.size!.w, l.size!.h, l.position, l.cardShown));
      playing.current = true;
      setPerf(p);
      clock.play(p.total);
      later(end, p.total + 80);
    };
    (async () => {
      restUntil = await readRest(botId);
      if (destroyed.current || !allowed()) return;
      later(attempt, o.delay * 1000);
    })();
    return destroy;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, mode, reduced, botId]);

  // Opening the chat: the call ends, and they are left alone for a few days.
  useEffect(() => {
    if (!o.chatOpen || destroyed.current || !enabled || mode === 'off') return;
    writeRest(botId, Date.now() + REST_MS);
    destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.chatOpen]);

  /** The greeting was closed ("not now"): no more calls this session. */
  const greetingClosed = () => {
    if (mode === 'off') return;
    visits[botId] = { ...(visits[botId] || { n: 0, at: 0 }), quiet: true };
    destroy();
  };

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    clock.stop();
  }, [clock]);

  // Every moving part on the clock: the mascot's box, each part of the drawing, the launcher's jolt, the rings, the bubble.
  const styles = useMemo(() => {
    if (!perf) return null;
    const end = perf.total;
    const k = perf.mascot.size / 100;
    const box = sample(0, end, (t) => {
      const v = evaluate(perf.self, t, perf.mascot.base);
      return { o: v.o, tx: v.tx, ty: v.ty, r: v.r, sx: v.sx, sy: v.sy };
    });
    const part = (name: MascotPart, origin: readonly [number, number]) => {
      const tracks = perf.parts[name];
      if (!tracks) return null;
      const s = sample(0, end, (t) => {
        const v = evaluate(tracks, t, MASCOT_PART_BASE[name] || {});
        return { o: v.o, tx: v.tx, ty: v.ty, r: v.r, sx: v.sx, sy: v.sy };
      });
      return { opacity: curve(clock.value, s.times, s.values.o), transform: boxTransform(clock.value, s, perf.mascot.size, perf.mascot.size, [origin[0] * k, origin[1] * k], k) };
    };
    const jolt = perf.launcher.length
      ? (() => {
          const s = sample(0, end, (t) => {
            const v = evaluate(perf.launcher, t);
            return { tx: v.tx, ty: v.ty, sx: v.sx, sy: v.sy };
          });
          return { transform: boxTransform(clock.value, s, 1, 1) };
        })()
      : null;
    const rings = perf.ripples.map((r) => {
      const s = sample(0, end, (t) => {
        const v = evaluate([r.track], t, { o: 0 });
        return { o: v.o, sx: v.sx, sy: v.sy };
      });
      return { ...r, style: { opacity: curve(clock.value, s.times, s.values.o), transform: boxTransform(clock.value, s, 1, 1) } };
    });
    const b = sample(0, end, (t) => {
      const v = evaluate([perf.bubble], t, { o: 0 });
      return { o: v.o, ty: v.ty, sx: v.sx, sy: v.sy };
    });
    return {
      mascot: { opacity: curve(clock.value, box.times, box.values.o), transform: boxTransform(clock.value, box, perf.mascot.size, perf.mascot.size) },
      body: part('body', MASCOT_ORIGINS.body),
      arm: part('arm', MASCOT_ORIGINS.arm),
      look: part('look', MASCOT_ORIGINS.look),
      lid: part('lid', MASCOT_ORIGINS.lid) || { transform: [{ scaleY: 0 }] },
      brow: part('brow', MASCOT_ORIGINS.brow),
      smile: part('smile', [50, 50]),
      o: part('o', [50, 50]) || { opacity: 0 },
      grin: part('grin', [50, 50]) || { opacity: 0 },
      jolt,
      rings,
      bubble: { opacity: curve(clock.value, b.times, b.values.o), transform: boxTransform(clock.value, b, 1, 1) },
    };
  }, [perf, clock]);

  return { perf, styles, greetingClosed, stop: end };
}
