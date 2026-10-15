/**
 * Launcher attention, as the web widget plays it (conferbot-widget
 * src/ts/launcher/attention.ts): an opt-in, continuous "look here" motion
 * on the closed launcher or the greeting card.
 *
 *   customizations.launcherAttention:
 *     "off"    (default) nothing;
 *     "pulse"  a soft ring grows out of the launcher every 3s;
 *     "wobble" a jelly squash and twist every 5.5s;
 *     "bounce" a hop with a contact shadow every 5s;
 *     "wave"   the greeting card bobs and a waving hand waves on it, 6s;
 *     "float"  the greeting card floats up and down, 4s;
 *     "shine"  a gloss sweeps across the button every 5s;
 *     "heartbeat" two beats (lub-dub) every 3s;
 *     "orbit"  a spark runs two laps round the button every 5.2s.
 *
 * The rules (the hook keeps them): the first beat 1.5s after the launcher
 * (or the card) shows; only while the chat is closed; paused while the
 * launcher plays an idle or message moment; over for the app session once
 * the chat is opened (and not started when it was opened in the last 30
 * minutes); nothing with reduced motion. While a launcher-moving mode runs,
 * the launcher's idle moments hold off and the three ripples after load
 * give way (a new message's ripple still plays). Nothing moves while an
 * entrance is landing. Each loop is one beat then stillness, as on the
 * web; it loops while the chat stays closed, as the web's does.
 *
 * Pure: the floating launcher drives the clock.
 */
import type { Track } from './keyframes';

export type LauncherAttention = 'off' | 'pulse' | 'wobble' | 'bounce' | 'wave' | 'float' | 'shine' | 'heartbeat' | 'orbit';
export const LAUNCHER_ATTENTIONS: readonly LauncherAttention[] = ['off', 'pulse', 'wobble', 'bounce', 'wave', 'float', 'shine', 'heartbeat', 'orbit'];
export const DEFAULT_LAUNCHER_ATTENTION: LauncherAttention = 'off';

export const normalizeLauncherAttention = (value: unknown): LauncherAttention =>
  LAUNCHER_ATTENTIONS.includes(value as LauncherAttention) ? (value as LauncherAttention) : DEFAULT_LAUNCHER_ATTENTION;

/** Which element a mode moves: the launcher button or the greeting card. */
export const attentionTarget = (mode: LauncherAttention): 'launcher' | 'greeting' | null =>
  mode === 'off' ? null : mode === 'wave' || mode === 'float' ? 'greeting' : 'launcher';

/** The first beat waits this long after the launcher (or the card) shows. */
export const ATTENTION_START_MS = 1500;
/** While an entrance lands, attention looks again this often. */
export const ATTENTION_RETRY_MS = 400;

/**
 * "self" = the target (launcher or card), "hand" = the card's waving hand,
 * "shadow" = the bounce's contact shadow, "shine" = the gloss band, "orbit" =
 * the spark, "ring" / "ring2" = the pulse's two sonar rings.
 */
export type AttentionPart = 'self' | 'hand' | 'shadow' | 'shine' | 'orbit' | 'ring' | 'ring2';

export interface AttentionTrack extends Track {
  part: AttentionPart;
}

const loop = (duration: number, delay = ATTENTION_START_MS) => ({ duration, iterations: Infinity, easing: 'linear', delay });

/**
 * The pulse ring (ATTENTION_CSS cb-attn-ring / cb-attn-ring-wide): a CSS
 * animation, so its timing function eases each step; as Web Animations
 * that is the easing on each keyframe. The second ring is 350ms behind.
 */
const RING_EASE = 'cubic-bezier(0,0,.2,1)';
const ring = (part: 'ring' | 'ring2', wide: boolean): AttentionTrack => ({
  part,
  keyframes: wide
    ? [
        { offset: 0, scale: '1', opacity: 0.42, easing: RING_EASE },
        { offset: 0.55, scale: '1.12 1.6', opacity: 0, easing: RING_EASE },
        { offset: 1, scale: '1.12 1.6', opacity: 0 },
      ]
    : [
        { offset: 0, scale: '1', opacity: 0.85, easing: RING_EASE },
        { offset: 0.6, scale: '1.85', opacity: 0, easing: RING_EASE },
        { offset: 1, scale: '1.85', opacity: 0 },
      ],
  options: loop(3000, part === 'ring' ? ATTENTION_START_MS : ATTENTION_START_MS + 350),
});

/**
 * The movement for a mode, as the web's tracks (attentionTracks). `clipped`:
 * the button clips its own outline, so the pulse throbs the button instead
 * of a ring (no RN launcher clips today; kept for the ports). `wide`: the
 * label pill, whose ring grows less sideways.
 */
export const attentionTracks = (mode: LauncherAttention, clipped = false, wide = false): AttentionTrack[] => {
  const e = 'ease-in-out';
  switch (mode) {
    case 'pulse':
      return clipped
        ? [
            {
              part: 'self',
              keyframes: [
                { scale: '1', offset: 0, easing: e },
                { scale: '1.08', offset: 0.1, easing: e },
                { scale: '1', offset: 0.2, easing: e },
                { scale: '1.05', offset: 0.28, easing: e },
                { scale: '1', offset: 0.36 },
                { scale: '1', offset: 1 },
              ],
              options: loop(3000),
            },
          ]
        : [ring('ring', wide), ring('ring2', wide)];
    case 'wobble':
      return [
        {
          part: 'self',
          keyframes: [
            { scale: '1', rotate: '0deg', offset: 0, easing: e },
            { scale: '1.14 0.86', rotate: '-4deg', offset: 0.04, easing: e },
            { scale: '0.88 1.12', rotate: '4deg', offset: 0.08, easing: e },
            { scale: '1.07 0.94', rotate: '-2.5deg', offset: 0.12, easing: e },
            { scale: '0.96 1.04', rotate: '1.5deg', offset: 0.16, easing: e },
            { scale: '1.02 0.98', rotate: '0deg', offset: 0.2, easing: e },
            { scale: '1', rotate: '0deg', offset: 0.24 },
            { scale: '1', rotate: '0deg', offset: 1 },
          ],
          options: loop(5500),
        },
      ];
    case 'bounce':
      return [
        {
          part: 'self',
          keyframes: [
            { translate: '0 0', scale: '1', offset: 0 },
            { translate: '0 0', scale: '1.12 0.88', offset: 0.04, easing: 'cubic-bezier(.2,.7,.3,1)' },
            { translate: '0 -14px', scale: '0.92 1.1', offset: 0.1, easing: 'cubic-bezier(.3,0,.7,1)' },
            { translate: '0 -18px', scale: '1 1', offset: 0.13, easing: 'cubic-bezier(.6,0,.8,.4)' },
            { translate: '0 0', scale: '1.16 0.84', offset: 0.19, easing: 'cubic-bezier(.2,.7,.3,1)' },
            { translate: '0 -5px', scale: '0.97 1.03', offset: 0.24, easing: 'cubic-bezier(.6,0,.8,.4)' },
            { translate: '0 0', scale: '1.04 0.96', offset: 0.28 },
            { translate: '0 0', scale: '1', offset: 0.31 },
            { translate: '0 0', scale: '1', offset: 1 },
          ],
          options: loop(5000),
        },
        {
          part: 'shadow',
          keyframes: [
            { scale: '1', opacity: 0.35, offset: 0 },
            { scale: '1.12 1', opacity: 0.4, offset: 0.04 },
            { scale: '0.55 0.7', opacity: 0.14, offset: 0.13 },
            { scale: '1.2 1', opacity: 0.42, offset: 0.19 },
            { scale: '0.9 0.9', opacity: 0.3, offset: 0.24 },
            { scale: '1', opacity: 0.35, offset: 0.31 },
            { scale: '1', opacity: 0.35, offset: 1 },
          ],
          options: loop(5000),
        },
      ];
    case 'wave':
      return [
        {
          part: 'self',
          keyframes: [
            { translate: '0 0', offset: 0, easing: e },
            { translate: '0 -6px', offset: 0.08, easing: e },
            { translate: '0 0', offset: 0.17, easing: e },
            { translate: '0 -2px', offset: 0.23, easing: e },
            { translate: '0 0', offset: 0.3 },
            { translate: '0 0', offset: 1 },
          ],
          options: loop(6000),
        },
        {
          part: 'hand',
          keyframes: [
            { rotate: '0deg', offset: 0, easing: e },
            { rotate: '16deg', offset: 0.05, easing: e },
            { rotate: '-10deg', offset: 0.1, easing: e },
            { rotate: '16deg', offset: 0.15, easing: e },
            { rotate: '-6deg', offset: 0.2, easing: e },
            { rotate: '10deg', offset: 0.25, easing: e },
            { rotate: '0deg', offset: 0.3 },
            { rotate: '0deg', offset: 1 },
          ],
          options: loop(6000),
        },
      ];
    case 'float':
      return [
        {
          part: 'self',
          keyframes: [
            { translate: '0 0', offset: 0, easing: e },
            { translate: '0 -5px', offset: 0.5, easing: e },
            { translate: '0 0', offset: 1 },
          ],
          options: loop(4000),
        },
      ];
    case 'shine':
      return [
        {
          part: 'shine',
          keyframes: [
            { translate: '-160% 0', offset: 0 },
            { translate: '-160% 0', offset: 0.02, easing: 'cubic-bezier(.4,0,.2,1)' },
            { translate: '260% 0', offset: 0.16 },
            { translate: '260% 0', offset: 1 },
          ],
          options: loop(5000),
        },
        {
          part: 'self',
          keyframes: [
            { scale: '1', offset: 0 },
            { scale: '1.04', offset: 0.08, easing: e },
            { scale: '1', offset: 0.18 },
            { scale: '1', offset: 1 },
          ],
          options: loop(5000),
        },
      ];
    case 'heartbeat':
      return [
        {
          part: 'self',
          keyframes: [
            { scale: '1', offset: 0 },
            { scale: '1.14', offset: 0.06, easing: e },
            { scale: '1', offset: 0.12, easing: e },
            { scale: '1.08', offset: 0.18, easing: e },
            { scale: '1', offset: 0.28 },
            { scale: '1', offset: 1 },
          ],
          options: loop(3000),
        },
      ];
    case 'orbit':
      return [
        {
          part: 'orbit',
          keyframes: [
            { offsetDistance: '0%', opacity: 0, offset: 0 },
            { offsetDistance: '8%', opacity: 1, offset: 0.05 },
            { offsetDistance: '192%', opacity: 1, offset: 0.4, easing: 'cubic-bezier(.4,0,.6,1)' },
            { offsetDistance: '200%', opacity: 0, offset: 0.45 },
            { offsetDistance: '200%', opacity: 0, offset: 1 },
          ],
          options: loop(5200),
        },
      ];
    default:
      return [];
  }
};

/** The bits each part starts from (CSS): the shadow at .35, the ring and spark hidden, the gloss parked off the button. */
export const ATTENTION_BASE: Partial<Record<AttentionPart, { o?: number; txp?: number; r?: number }>> = {
  shadow: { o: 0.35 },
  ring: { o: 0 },
  ring2: { o: 0 },
  orbit: { o: 0 },
  shine: { txp: -160, r: 18 },
};

/**
 * The orbit's track: a rounded rectangle 7px outside the button (a circle
 * round a round launcher, a stadium round a pill), clockwise from the top
 * edge's left end - the web's orbitPath, as a point at a share of its
 * length (wrapping, so 2 is two laps). Relative to the button's top-left.
 */
export const orbitPoint = (w: number, h: number, fraction: number, margin = 7): { x: number; y: number } => {
  const x0 = -margin;
  const y0 = -margin;
  const W = w + margin * 2;
  const H = h + margin * 2;
  const R = Math.min(W, H) / 2;
  const sw = W - 2 * R;
  const sh = H - 2 * R;
  const arc = (Math.PI * R) / 2;
  const total = 2 * sw + 2 * sh + 4 * arc;
  let d = (((fraction % 1) + 1) % 1) * total;
  if (fraction > 0 && fraction % 1 === 0) d = 0;
  const corner = (cx: number, cy: number, from: number, len: number) => {
    const a = from + len / R;
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  };
  // Top edge, top-right corner, right edge, bottom-right, bottom, bottom-left, left, top-left.
  if (d <= sw) return { x: x0 + R + d, y: y0 };
  d -= sw;
  if (d <= arc) return corner(x0 + W - R, y0 + R, -Math.PI / 2, d);
  d -= arc;
  if (d <= sh) return { x: x0 + W, y: y0 + R + d };
  d -= sh;
  if (d <= arc) return corner(x0 + W - R, y0 + H - R, 0, d);
  d -= arc;
  if (d <= sw) return { x: x0 + W - R - d, y: y0 + H };
  d -= sw;
  if (d <= arc) return corner(x0 + R, y0 + H - R, Math.PI / 2, d);
  d -= arc;
  if (d <= sh) return { x: x0, y: y0 + H - R - d };
  d -= sh;
  return corner(x0 + R, y0 + R, Math.PI, d);
};

/** The waving hand: the web's sticker, unless the card's own text has one (which waves in place there). */
export const WAVING_HAND = '\u{1F44B}';
