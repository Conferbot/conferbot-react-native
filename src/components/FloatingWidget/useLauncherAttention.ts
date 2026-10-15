import { useEffect, useMemo, useRef, useState } from 'react';
import { evaluate } from '../../core/keyframes';
import { ATTENTION_BASE, attentionTarget, attentionTracks, orbitPoint } from '../../core/launcherAttention';
import type { AttentionPart, LauncherAttention } from '../../core/launcherAttention';
import { FxClock, boxTransform, curve, sample } from './fxAnimated';
import { launcherOpenedRecently } from './useLauncherMotion';

/** The orbit's spark and the gloss band (attention.ts ATTENTION_CSS). */
export const ORBIT_DOT = 8;
export const GLOSS = { width: 0.45, top: -0.3, height: 1.6 };
/** The waving hand's box (a 20px emoji), turning about 70% 80%. */
export const HAND = { w: 22, h: 20, origin: [15.4, 16] as [number, number] };

/**
 * The opt-in "look here" loop (core/launcherAttention, as the web's
 * attention.ts): the first beat 1.5s after the launcher (or the greeting
 * card) shows, then a beat and stillness per lap while the chat stays
 * closed; paused while the launcher plays an idle or message moment; not
 * while an entrance lands; over once the chat is opened (and not started
 * when it was opened in the last 30 minutes); nothing with reduced motion.
 */
export function useLauncherAttention(o: {
  mode: LauncherAttention;
  enabled: boolean;
  reduced: boolean;
  chatOpen: boolean;
  cardShown: boolean;
  moment: boolean;
  entranceBusy: boolean;
  size: { w: number; h: number } | null;
  wide: boolean;
}) {
  const { mode, enabled, reduced, chatOpen, cardShown, moment, entranceBusy, size, wide } = o;
  const target = attentionTarget(mode);
  // Not started at all when the chat was opened a moment ago; over for this screen once it opens.
  const [over, setOver] = useState(() => launcherOpenedRecently());
  useEffect(() => {
    if (chatOpen) setOver(true);
  }, [chatOpen]);
  const active = enabled && !!target && !reduced && !over;
  const running = active && !entranceBusy && !!size && (target === 'launcher' || cardShown);
  const clock = useRef(new FxClock()).current;

  const parts = useMemo(() => {
    if (!active || !size) return null;
    const tracks = attentionTracks(mode, false, wide);
    if (!tracks.length) return null;
    const intro = Math.max(...tracks.map((t) => t.options.delay || 0));
    const period = tracks[0].options.duration;
    const end = intro + period;
    const out: Partial<Record<AttentionPart, any>> = {};
    for (const t of tracks) {
      const base = ATTENTION_BASE[t.part] || {};
      if (t.part === 'orbit') {
        const s = sample(0, end, (ms) => {
          const v = evaluate([t], ms, base);
          const p = orbitPoint(size.w, size.h, v.od / 100);
          return { o: v.o, tx: p.x - ORBIT_DOT / 2, ty: p.y - ORBIT_DOT / 2 };
        });
        out.orbit = { opacity: curve(clock.value, s.times, s.values.o), transform: boxTransform(clock.value, s, ORBIT_DOT, ORBIT_DOT) };
        continue;
      }
      const bandW = size.w * GLOSS.width;
      const s = sample(0, end, (ms) => {
        const v = evaluate([t], ms, base);
        return { o: v.o, tx: v.tx + (v.txp / 100) * (t.part === 'shine' ? bandW : size.w), ty: v.ty, r: v.r, sx: v.sx, sy: v.sy };
      });
      out[t.part] = {
        opacity: curve(clock.value, s.times, s.values.o),
        transform: t.part === 'hand' ? boxTransform(clock.value, s, HAND.w, HAND.h, HAND.origin) : boxTransform(clock.value, s, 1, 1),
      };
    }
    return { styles: out, intro, period };
  }, [active, size, mode, wide, clock]);

  // Run, restart when the card shows again, stop when it goes.
  useEffect(() => {
    if (!running || !parts) {
      clock.stop();
      clock.value.setValue(0);
      return undefined;
    }
    clock.loop(parts.intro, parts.period);
    return () => clock.stop();
  }, [running, parts, clock]);

  // A launcher moment (idle / message) pauses it.
  useEffect(() => {
    if (!running) return;
    if (moment) clock.pause();
    else clock.resume();
  }, [moment, running, clock]);

  return {
    /** Mounted for a launcher-moving mode: idle moments hold off and the load ripples give way. */
    onLauncher: active && target === 'launcher',
    running,
    target,
    styles: running && parts ? parts.styles : null,
  };
}
