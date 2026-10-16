/**
 * The greeting card's figure, alive (conferbot-widget src/ts/home/mascotMotion.ts
 * and css/polish-home.css .cb-mm): how the bot's figure on the greeting card
 * moves. The figure is the owner's mascot (mascotInGreeting), the bot's
 * avatar, or an agent's initials; everything here moves it as a whole.
 *
 * customizations.mascotMotion: "lively" (absent), "subtle" or "off".
 *
 * Lively, from the moment the card shows (it springs up, cb-greet-spring):
 *     0ms  the greeting's words start fading up, one after another (< 1s)
 *   140ms  the figure pops in: stretch, squash, settle (620ms)
 *   760ms  a friendly wave, rocking about its feet (900ms)
 *   900ms  the "Online" dot sends out one soft ping
 *  1660ms  a blink-like double squash (380ms)
 *  1900ms  idle: a slow breath (2px), and a small gesture every 8-12s,
 *          three at most; 3s after the last one the breath ends on its
 *          next exhale and the figure stands still for good.
 * Subtle: a gentle rise, the ping, the breath and a single head tilt; the
 * card comes in as it always did (cb-greet-in). Off: nothing moves.
 *
 * Leaving: opening the chat from the card hands off (the figure shrinks
 * toward the launcher as the card collapses, cb-greet-collapse); the x sends
 * it off with a small bow (the card cb-greet-out). A voice note makes it
 * talk (a rhythmic squash) while its waveform plays.
 *
 * Calm by design: no gesture while the app is in the background, nothing
 * that loops for ever, and under reduced motion just a fade. Hovering (the
 * lean toward the pointer, the hop) has no counterpart on a touch screen,
 * as on the web, where touch pointers are ignored.
 *
 * The director has no view: it calls a stage (tested with fake timers). The
 * gestures are Web Animations keyframes (./keyframes.ts evaluates them);
 * the card's own moves are CSS @keyframes, as the web wrote them. Pure.
 */
import { cssKeyframes, type Keyframe, type Track } from './keyframes';

export type MascotMotion = 'lively' | 'subtle' | 'off';
export const MASCOT_MOTIONS: readonly MascotMotion[] = ['lively', 'subtle', 'off'];
export const DEFAULT_MASCOT_MOTION: MascotMotion = 'lively';

export const normalizeMascotMotion = (value: unknown): MascotMotion =>
  MASCOT_MOTIONS.includes(value as MascotMotion) ? (value as MascotMotion) : DEFAULT_MASCOT_MOTION;

export type Gesture = 'pop' | 'rise' | 'fadeIn' | 'wave' | 'tilt' | 'nod' | 'hop' | 'handoff' | 'bow';

/** When each part of the entrance plays, ms after the card shows. */
export const ENTRANCE = {
  lively: { pop: 140, wave: 760, ping: 900, nod: 1660, idle: 1900 },
  subtle: { rise: 80, ping: 600, idle: 900 },
} as const;
/** Idle gestures: one every 8-12s, at most this many, then still. */
export const IDLE_GAP_MIN = 8000;
export const IDLE_GAP_SPREAD = 4000;
export const IDLE_GESTURES: Record<'lively' | 'subtle', readonly Gesture[]> = {
  lively: ['tilt', 'wave', 'tilt'],
  subtle: ['tilt'],
};
/** After the last idle gesture, the breath ends this much later. */
export const SETTLE_AFTER = 3000;
/** The "Online" ping's class stays this long (one ring). */
export const PING_MS = 1300;
/** Hover hops no closer together than this. */
export const HOP_GAP = 1500;

/** What the director asks of the view. Every call is safe without a figure. */
export interface MascotStage {
  /** Play a one-off gesture on the figure (replacing one in flight). */
  play(g: Gesture, amp: number, delay?: number): void;
  /** Start the slow breath, or let it end on its next exhale. */
  breathe(on: boolean): void;
  /** Talk (a rhythmic squash) while a voice note plays. */
  talk(on: boolean, amp: number): void;
  /** Lean toward the pointer: -1 (left) .. 1 (right), 0 upright. */
  lean(x: number, amp: number): void;
  /** The "Online" dot's single ping. */
  ping(on: boolean): void;
  /** The greeting's words fading up one by one. */
  words(): void;
  /** Stop everything now, the figure as drawn. */
  reset(): void;
}

export interface Timers {
  set(fn: () => void, ms: number): unknown;
  clear(id: unknown): void;
}

export type DirectorState = 'hidden' | 'entering' | 'living' | 'settled' | 'destroyed';
export type HideReason = 'open' | 'close' | 'away';

export interface DirectorOptions {
  mode: MascotMotion;
  stage: MascotStage;
  /** Reduced motion, read each time the card shows. */
  reduced?: () => boolean;
  /** How far the figure moves: 1 for a mascot, less for a photo / initials (figureAmp). */
  amp?: () => number;
  /** The style reveals its own text (typewriter, text message): no word fade. */
  ownText?: () => boolean;
  timers?: Timers;
  random?: () => number;
  now?: () => number;
  /** False once the card has gone: the director stops itself. */
  alive?: () => boolean;
}

export interface MascotDirector {
  readonly state: DirectorState;
  /** Idle gestures played since the card last showed. */
  readonly gestures: number;
  show(): void;
  hide(reason?: HideReason): void;
  hover(on: boolean): void;
  point(x: number): void;
  talk(on: boolean): void;
  /** Talk for `ms`, then stop (a voice note of known length). */
  talkFor(ms: number): void;
  /** The app went to the background / came back. */
  pageHidden(hidden: boolean): void;
  destroy(): void;
  /** Timers waiting (tests: none may outlive a hide / settle / destroy). */
  pending(): number;
}

const defaultTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (id) => clearTimeout(id as any),
};

/** The web's director (mascotMotion.ts createMascotDirector), line for line. */
export const createMascotDirector = (o: DirectorOptions): MascotDirector => {
  const timers = o.timers || defaultTimers;
  const random = o.random || Math.random;
  const now = o.now || (() => Date.now());
  const stage = o.stage;
  const live = new Set<unknown>();
  let state: DirectorState = 'hidden';
  let gestures = 0;
  let talking = false;
  let wantTalk = false;
  let reduced = false;
  let amp = 1;
  let lastHop = -Infinity;
  let hidden = false;
  let idleTimer: unknown = null;
  let talkTimer: unknown = null;

  const lively = o.mode === 'lively';
  const moving = () => o.mode !== 'off' && !reduced;

  const after = (ms: number, fn: () => void): unknown => {
    const id = timers.set(() => {
      live.delete(id);
      if (o.alive && !o.alive()) {
        director.destroy();
        return;
      }
      fn();
    }, ms);
    live.add(id);
    return id;
  };
  const cancel = (id: unknown) => {
    if (id === null || id === undefined) return;
    timers.clear(id);
    live.delete(id);
  };
  const cancelAll = () => {
    live.forEach((id) => timers.clear(id));
    live.clear();
    idleTimer = null;
    talkTimer = null;
  };

  const startTalking = () => {
    if (talking) return;
    talking = true;
    stage.talk(true, lively ? amp : amp * 0.5);
  };
  const stopTalking = () => {
    if (!talking) return;
    talking = false;
    stage.talk(false, amp);
  };

  const gestureList = () => IDLE_GESTURES[lively ? 'lively' : 'subtle'];

  const scheduleIdle = () => {
    cancel(idleTimer);
    idleTimer = null;
    if (state !== 'living' || hidden) return;
    if (gestures >= gestureList().length) {
      idleTimer = after(SETTLE_AFTER, () => {
        idleTimer = null;
        settle();
      });
      return;
    }
    idleTimer = after(IDLE_GAP_MIN + Math.floor(random() * IDLE_GAP_SPREAD), () => {
      idleTimer = null;
      // Talking: the gesture waits for a quiet moment (not counted).
      if (!talking) {
        stage.play(gestureList()[gestures], amp);
        gestures += 1;
      }
      scheduleIdle();
    });
  };

  const settle = () => {
    if (state !== 'living') return;
    state = 'settled';
    stage.breathe(false);
  };

  const live_ = () => {
    if (state !== 'entering') return;
    state = 'living';
    stage.breathe(true);
    if (wantTalk) startTalking();
    scheduleIdle();
  };

  const director: MascotDirector = {
    get state() {
      return state;
    },
    get gestures() {
      return gestures;
    },
    show() {
      if (state === 'destroyed') return;
      cancelAll();
      stage.reset();
      talking = false;
      gestures = 0;
      lastHop = -Infinity;
      reduced = !!(o.reduced && o.reduced());
      amp = Math.max(0, Math.min(1, o.amp ? o.amp() : 1));
      if (o.mode === 'off') {
        state = 'settled';
        return;
      }
      if (reduced) {
        // A plain fade, and nothing after it.
        stage.play('fadeIn', 0);
        state = 'settled';
        return;
      }
      state = 'entering';
      if (lively) {
        const t = ENTRANCE.lively;
        if (!(o.ownText && o.ownText())) stage.words();
        stage.play('pop', amp, t.pop);
        after(t.wave, () => {
          if (wantTalk) startTalking();
          else stage.play('wave', amp);
        });
        after(t.ping, () => {
          stage.ping(true);
          after(PING_MS, () => stage.ping(false));
        });
        after(t.nod, () => {
          if (!talking) stage.play('nod', amp);
        });
        after(t.idle, live_);
      } else {
        const t = ENTRANCE.subtle;
        stage.play('rise', amp, t.rise);
        after(t.ping, () => {
          stage.ping(true);
          after(PING_MS, () => stage.ping(false));
        });
        after(t.idle, live_);
      }
    },
    hide(reason: HideReason = 'open') {
      if (state === 'destroyed' || state === 'hidden') return;
      cancelAll();
      const wasMoving = moving();
      stage.reset();
      talking = false;
      wantTalk = false;
      state = 'hidden';
      if (wasMoving && reason !== 'away') stage.play(reason === 'close' ? 'bow' : 'handoff', lively ? amp : amp * 0.6);
    },
    hover(on: boolean) {
      if (!moving() || (state !== 'living' && state !== 'settled' && state !== 'entering')) return;
      if (!on) {
        stage.lean(0, amp);
        return;
      }
      if (lively && state !== 'entering' && !talking && now() - lastHop >= HOP_GAP) {
        lastHop = now();
        stage.play('hop', amp);
      }
    },
    point(x: number) {
      if (!moving() || state === 'hidden' || state === 'destroyed') return;
      const clamped = Math.max(-1, Math.min(1, Number.isFinite(x) ? x : 0));
      stage.lean(clamped, lively ? amp : amp * 0.6);
    },
    talk(on: boolean) {
      wantTalk = on;
      if (!on) {
        cancel(talkTimer);
        talkTimer = null;
        stopTalking();
        return;
      }
      if (!moving() || state === 'hidden' || state === 'destroyed') return;
      // During the entrance it waits for the pop to land.
      if (state === 'entering') return;
      startTalking();
    },
    talkFor(ms: number) {
      if (!moving() || state === 'hidden' || state === 'destroyed') return;
      director.talk(true);
      cancel(talkTimer);
      talkTimer = after(Math.max(0, ms), () => {
        talkTimer = null;
        director.talk(false);
      });
    },
    pageHidden(isHidden: boolean) {
      if (hidden === isHidden) return;
      hidden = isHidden;
      if (state !== 'living') return;
      if (hidden) {
        cancel(idleTimer);
        idleTimer = null;
      } else scheduleIdle();
    },
    destroy() {
      if (state === 'destroyed') return;
      cancelAll();
      stage.reset();
      talking = false;
      state = 'destroyed';
    },
    pending: () => live.size,
  };
  return director;
};

// ---------- The gestures: Web Animations on the figure ----------

const sc = (a: number, x: number) => +(1 + (x - 1) * a).toFixed(4);
const dg = (a: number, x: number) => `${+(x * a).toFixed(2)}deg`;
const px = (a: number, x: number) => `${+(x * a).toFixed(2)}px`;

/** Each gesture's keyframes at a given amplitude (1 = the mascot's full swing), as the web passes them to element.animate(). */
export const gestureFrames = (g: Gesture, a: number, toward: { x: number; y: number } = { x: 0, y: 30 }): { frames: Keyframe[]; ms: number; easing: string } => {
  switch (g) {
    case 'pop':
      return {
        ms: 620,
        easing: 'cubic-bezier(.3,.7,.4,1)',
        frames: [
          { transform: `translateY(${px(a, 6)}) scale(0.3)`, opacity: 0, offset: 0 },
          { transform: `translateY(${px(a, -3)}) scale(${sc(a, 0.92)}, ${sc(a, 1.14)})`, opacity: 1, offset: 0.42 },
          { transform: `translateY(0px) scale(${sc(a, 1.1)}, ${sc(a, 0.9)})`, offset: 0.64 },
          { transform: `translateY(${px(a, -1)}) scale(${sc(a, 0.97)}, ${sc(a, 1.03)})`, offset: 0.82 },
          { transform: 'none', opacity: 1, offset: 1 },
        ],
      };
    case 'rise':
      return {
        ms: 420,
        easing: 'cubic-bezier(.22,1,.36,1)',
        frames: [
          { transform: 'translateY(4px) scale(0.85)', opacity: 0 },
          { transform: 'none', opacity: 1 },
        ],
      };
    case 'fadeIn':
      return { ms: 220, easing: 'ease-out', frames: [{ opacity: 0 }, { opacity: 1 }] };
    case 'wave':
      return {
        ms: 900,
        easing: 'ease-in-out',
        frames: [
          { transform: 'rotate(0deg)', offset: 0 },
          { transform: `rotate(${dg(a, -10)})`, offset: 0.2 },
          { transform: `rotate(${dg(a, 8)})`, offset: 0.42 },
          { transform: `rotate(${dg(a, -6)})`, offset: 0.62 },
          { transform: `rotate(${dg(a, 3)})`, offset: 0.8 },
          { transform: 'rotate(0deg)', offset: 1 },
        ],
      };
    case 'tilt':
      return {
        ms: 1300,
        easing: 'cubic-bezier(.45,0,.25,1)',
        frames: [
          { transform: 'none', offset: 0 },
          { transform: `rotate(${dg(a, -7)}) translateX(${px(a, -1)})`, offset: 0.25 },
          { transform: `rotate(${dg(a, -6)}) translateX(${px(a, -1)})`, offset: 0.7 },
          { transform: 'none', offset: 1 },
        ],
      };
    case 'nod':
      return {
        ms: 380,
        easing: 'ease-in-out',
        frames: [
          { transform: 'none', offset: 0 },
          { transform: `scale(${sc(a, 1.03)}, ${sc(a, 0.9)})`, offset: 0.3 },
          { transform: 'none', offset: 0.55 },
          { transform: `scale(${sc(a, 1.02)}, ${sc(a, 0.93)})`, offset: 0.75 },
          { transform: 'none', offset: 1 },
        ],
      };
    case 'hop':
      return {
        ms: 560,
        easing: 'cubic-bezier(.3,.7,.4,1)',
        frames: [
          { transform: 'none', offset: 0 },
          { transform: `scale(${sc(a, 1.08)}, ${sc(a, 0.92)})`, offset: 0.18 },
          { transform: `translateY(${px(a, -6)}) scale(${sc(a, 0.96)}, ${sc(a, 1.05)})`, offset: 0.45 },
          { transform: `scale(${sc(a, 1.05)}, ${sc(a, 0.95)})`, offset: 0.72 },
          { transform: 'none', offset: 1 },
        ],
      };
    case 'handoff':
      // Toward the launcher, shrinking, gone as the card collapses.
      return {
        ms: 280,
        easing: 'cubic-bezier(.5,0,.75,0)',
        frames: [
          { transform: 'none', opacity: 1 },
          { transform: `translate(${px(a, toward.x * 0.2)}, ${px(a, toward.y * 0.12)}) scale(${sc(a, 1.08)}, ${sc(a, 0.94)})`, opacity: 1, offset: 0.25 },
          { transform: `translate(${px(a, toward.x * 0.6)}, ${px(a, toward.y * 0.6)}) scale(0.25)`, opacity: 0 },
        ],
      };
    case 'bow':
      return {
        ms: 300,
        easing: 'ease-in',
        frames: [
          { transform: 'none', opacity: 1 },
          { transform: `rotate(${dg(a, 6)}) translateY(${px(a, 1)}) scale(${sc(a, 1.02)}, ${sc(a, 0.9)})`, opacity: 1, offset: 0.4 },
          { transform: `rotate(${dg(a, 6)}) scale(0.5)`, opacity: 0 },
        ],
      };
  }
};

/** A gesture as the track the web plays (fill backwards; forwards for the two that leave). */
export const gestureTrack = (g: Gesture, amp: number, delay = 0, toward?: { x: number; y: number }): Track => {
  const { frames, ms, easing } = gestureFrames(g, amp, toward);
  const leaving = g === 'handoff' || g === 'bow';
  return { keyframes: frames, options: { duration: ms, delay, easing, fill: leaving ? 'forwards' : 'backwards' } };
};

export const TALK_MS = 640;
export const talkFrames = (a: number): Keyframe[] => [
  { transform: 'none', offset: 0 },
  { transform: `scale(${sc(a, 1.025)}, ${sc(a, 0.965)})`, offset: 0.2 },
  { transform: `scale(${sc(a, 0.99)}, ${sc(a, 1.03)})`, offset: 0.45 },
  { transform: `scale(${sc(a, 1.03)}, ${sc(a, 0.96)})`, offset: 0.7 },
  { transform: 'none', offset: 1 },
];
/** The talk, one syllable per lap. */
export const talkTrack = (a: number): Track => ({ keyframes: talkFrames(a), options: { duration: TALK_MS, iterations: Infinity, easing: 'ease-in-out' } });

export const BREATH_MS = 3400;
/** The slow breath, on the individual translate / scale (it sits under the gestures' transform). */
export const BREATH: Track = {
  keyframes: [
    { translate: '0 0', scale: '1' },
    { translate: '0 -2px', scale: '1.012' },
    { translate: '0 0', scale: '1' },
  ],
  options: { duration: BREATH_MS, iterations: Infinity, easing: 'ease-in-out' },
};
/** How far the figure leans toward the pointer at full amplitude. */
export const LEAN_DEG = 6;

/** How far each figure moves: the mascot all the way, a photo 0.75, initials 0.55. */
export const figureAmp = (figure: 'mascot' | 'avatar' | 'initials' | null): number =>
  figure === 'initials' ? 0.55 : figure === 'avatar' ? 0.75 : 1;

/** The styles that reveal their own words (typewriter, the text message): no word fade. */
export const ownsText = (style: string): boolean => style === 'typewriter' || style === 'imessage';

// ---------- The card (polish-home.css), as the web wrote it ----------

export const CARD_KEYFRAMES = {
  'cb-greet-in': 'from { opacity: 0; transform: translateY(10px) scale(0.98); } to { opacity: 1; transform: none; }',
  'cb-greet-out': 'from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(6px) scale(0.98); }',
  'cb-greet-spring': '0% { opacity: 0; transform: translateY(14px) scale(0.94); } 55% { opacity: 1; transform: translateY(-3px) scale(1.01); } 78% { transform: translateY(1px) scale(0.998); } 100% { opacity: 1; transform: none; }',
  'cb-greet-collapse': 'from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(16px) scale(0.86); }',
  'cb-mm-word': 'from { opacity: 0; transform: translateY(5px); filter: blur(2px); } to { opacity: 1; transform: none; filter: none; }',
  'cb-mm-dot': '0%, 100% { transform: scale(1); } 40% { transform: scale(1.35); }',
  'cb-mm-ring': 'from { opacity: 0.55; transform: scale(1); } to { opacity: 0; transform: scale(3.2); }',
} as const;
export type CardKeyframesName = keyof typeof CARD_KEYFRAMES;

const cardTrack = (name: CardKeyframesName, duration: number, timing: string, delay = 0, fill: 'forwards' | 'both' | 'none' = 'forwards'): Track => ({
  keyframes: cssKeyframes(CARD_KEYFRAMES[name], timing),
  options: { duration, ...(delay ? { delay } : {}), fill },
});

/**
 * How the card comes in: lively springs up (cb-greet-spring 0.62s), the
 * others as always (cb-greet-in 0.45s). The notification and neon keep their
 * own entrance (the style's rule wins), as does reduced motion (none): null.
 */
export const cardEnterTrack = (mode: MascotMotion, style: string, reduced = false): Track | null => {
  if (reduced || style === 'notification' || style === 'neon') return null;
  return mode === 'lively'
    ? cardTrack('cb-greet-spring', 620, 'cubic-bezier(0.2, 0.9, 0.3, 1)')
    : cardTrack('cb-greet-in', 450, 'cubic-bezier(0.22, 1, 0.36, 1)');
};

/**
 * How the card goes: opened from the card with the figure moving, it
 * collapses toward the launcher (cb-greet-collapse 0.24s after 0.04s);
 * otherwise it fades down (cb-greet-out 0.22s). Reduced motion: at once.
 */
export const cardLeaveTrack = (mode: MascotMotion, reason: 'open' | 'close', reduced = false): Track | null => {
  if (reduced) return null;
  return reason === 'open' && mode !== 'off'
    ? cardTrack('cb-greet-collapse', 240, 'cubic-bezier(0.55, 0, 0.75, 0.2)', 40)
    : cardTrack('cb-greet-out', 220, 'ease-in');
};

/** The "Online" dot's ping: the dot swells once (cb-mm-dot 0.5s) and one ring goes out (cb-mm-ring 1.1s). No ring on the notification and postcard. */
export const PING = {
  dot: cardTrack('cb-mm-dot', 500, 'cubic-bezier(0.3, 1.6, 0.5, 1)', 0, 'none'),
  ring: cardTrack('cb-mm-ring', 1100, 'cubic-bezier(0.2, 0.7, 0.3, 1)'),
  ringed: (style: string) => style !== 'notification' && style !== 'postcard',
};

/**
 * The greeting's words fading up (mascotMotion.ts stage.words): each word
 * 0.32s, from 380ms, a step apart that shrinks for a longer message so all
 * of it is up within about a second. Null for fewer than two words (left as
 * it is).
 */
export const wordFade = (text: string): { words: string[]; step: number; tracks: Track[] } | null => {
  const parts = String(text || '').split(/(\s+)/);
  const words = parts.filter((p) => p && !/^\s+$/.test(p));
  if (words.length < 2) return null;
  const step = Math.min(55, Math.floor(520 / (words.length - 1)));
  return {
    words,
    step,
    tracks: words.map((_, i) => cardTrack('cb-mm-word', 320, 'cubic-bezier(0.22, 1, 0.36, 1)', 380 + i * step, 'both')),
  };
};

/** How long a voice note "plays" as the card shows: 22 bars, each 1.2s twice, 60ms apart (polish-home.css cb-wave). */
export const voicePlayMs = (bars = 22): number => (bars - 1) * 60 + 1200 * 2;
