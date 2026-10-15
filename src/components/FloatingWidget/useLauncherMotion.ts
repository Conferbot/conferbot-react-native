import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { iconFrame, nextIdleDelay, MOMENT_MS, LAUNCHER_OPENED_REST_MS, rippleRing, RIPPLE } from '../../core/launcherMotion';
import type { MotionState, LauncherAnimation, OpFrame } from '../../core/launcherMotion';
import { launcherIconById } from '../../core/launcherIcons';

/** When the chat was last opened in this app session: idle moments rest a while after. */
let lastOpenedAt = 0;
export const noteLauncherOpened = () => {
  lastOpenedAt = Date.now();
};

const FRAME_MS = 33;

/**
 * The launcher's motion, as the web plays it (core/launcherMotion): an idle
 * moment ~2s after it shows and a few more after that ("subtle" / "lively"),
 * a reaction when a message arrives while the chat is closed, nothing while
 * it is open, after it was opened, for "off", or with reduced motion on. Also
 * the ripple rings: three times after the launcher settles, and once more
 * for a new message.
 */
export function useLauncherMotion(opts: {
  iconId: string | null | undefined;
  mode: LauncherAnimation;
  chatOpen: boolean;
  unreadCount: number;
  enabled: boolean;
}): { frame: (OpFrame | null)[] | null; rings: ({ scale: number; opacity: number } | null)[] } {
  const { iconId, mode, chatOpen, unreadCount, enabled } = opts;
  const [frame, setFrame] = useState<(OpFrame | null)[] | null>(null);
  const [rings, setRings] = useState<({ scale: number; opacity: number } | null)[]>([null, null]);
  const [reduceMotion, setReduceMotion] = useState(false);
  const moment = useRef<{ state: MotionState; start: number } | null>(null);
  const ripple = useRef<{ start: number; delay: number; iterations: number } | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const played = useRef(0);
  const chatOpenRef = useRef(chatOpen);
  chatOpenRef.current = chatOpen;

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((on) => alive && setReduceMotion(!!on)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (on: boolean) => setReduceMotion(!!on));
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);

  const still = !enabled || reduceMotion;

  // One clock for the icon's moment and the ripple; it stops when both are done.
  const run = () => {
    if (tick.current) return;
    tick.current = setInterval(() => {
      const now = Date.now();
      const icon = launcherIconById(iconId);
      const m = moment.current;
      if (m && now - m.start < MOMENT_MS && !chatOpenRef.current) {
        setFrame(iconFrame(icon, m.state, (now - m.start) / 1000));
      } else if (m) {
        moment.current = null;
        setFrame(null);
      }
      const r = ripple.current;
      if (r) {
        const t = (now - r.start) / 1000;
        if (t > r.delay + RIPPLE.gap + RIPPLE.dur * r.iterations || chatOpenRef.current) {
          ripple.current = null;
          setRings([null, null]);
        } else {
          setRings([rippleRing(t, 0, r.iterations, r.delay), rippleRing(t, 1, r.iterations, r.delay)]);
        }
      }
      if (!moment.current && !ripple.current && tick.current) {
        clearInterval(tick.current);
        tick.current = null;
      }
    }, FRAME_MS);
  };

  const play = (state: MotionState) => {
    if (still || mode === 'off' || chatOpenRef.current) return;
    moment.current = { state, start: Date.now() };
    run();
  };

  // The ripple after the launcher settles (three times), whatever the motion mode.
  useEffect(() => {
    if (still) return undefined;
    ripple.current = { start: Date.now(), delay: RIPPLE.delay, iterations: RIPPLE.iter };
    run();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still]);

  // Idle moments: the first ~2s in, then the plan's pace, never after the chat was opened.
  useEffect(() => {
    if (still || mode === 'off' || chatOpen) return undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      const delay = nextIdleDelay(mode, played.current);
      if (delay === null) return;
      timer = setTimeout(() => {
        if (Date.now() - lastOpenedAt < LAUNCHER_OPENED_REST_MS && lastOpenedAt) return;
        played.current += 1;
        play('idle');
        schedule();
      }, delay);
    };
    schedule();
    return () => {
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still, mode, chatOpen, iconId]);

  // A message while the chat is closed: the icon reacts and the ripple plays once more.
  const lastUnread = useRef(unreadCount);
  useEffect(() => {
    if (unreadCount > lastUnread.current && !chatOpen && !still) {
      play('msg');
      ripple.current = { start: Date.now(), delay: 0, iterations: 1 };
      run();
    }
    lastUnread.current = unreadCount;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCount]);

  useEffect(() => () => {
    if (tick.current) clearInterval(tick.current);
  }, []);

  return { frame, rings };
}
