/**
 * The chat's sounds, as the web widget plays them. Ported from
 * conferbot-widget src/ts/chat/messageSound.ts (soundRecipe, packRecipe,
 * playMessageFor, playPackSound, MIN_GAP_MS, PACK_GAP_MS), the launcher
 * sound in src/index.ts (_playToggleSound and the soundUrl it picks) and
 * src/ts/layout/ownerLayout.ts (normalizeMessageSound).
 *
 *   messageSound  "off" (default) | "pop" | "chime" | "bubble": a message
 *                 arrived (the bot's step drawn, an agent's message)
 *   soundPack     "off" (default) | "soft" | "playful" | "retro" |
 *                 "bubbly" | "premium": open, message, send and close as a
 *                 set; a pack replaces the single message sound and the
 *                 launcher sound, so nothing doubles up
 *   launcher sound enableWidgetToggleSound with checkedSoundTab "choose"
 *                 (widgetToggleSound) or "upload" (customWidgetSoundUrl):
 *                 an audio file played when the chat opens or closes
 *
 * The visitor's "Sound off" in the chat menu silences all of them (the web
 * keeps it as localStorage "conferbot-sound-enabled" = "false").
 *
 * The web synthesises each tone with Web Audio (an oscillator per step,
 * its frequency and gain on exponential ramps), so there are no files. An
 * app has no Web Audio: `renderWav` computes the same steps into a small
 * 16-bit mono WAV (about 20 KB for the longest sound) that a player can
 * load. Pure: no audio, storage or clock of its own.
 */

export type MessageSound = 'off' | 'pop' | 'chime' | 'bubble';
export type SoundPack = 'off' | 'soft' | 'playful' | 'retro' | 'bubbly' | 'premium';
export type SoundEvent = 'open' | 'message' | 'send' | 'close';
export type Wave = 'sine' | 'triangle' | 'square';

export const MESSAGE_SOUNDS: readonly MessageSound[] = ['off', 'pop', 'chime', 'bubble'];
export const SOUND_PACKS: readonly SoundPack[] = ['off', 'soft', 'playful', 'retro', 'bubbly', 'premium'];
export const SOUND_EVENTS: readonly SoundEvent[] = ['open', 'message', 'send', 'close'];

/** The visitor's switch, under the web's own key. */
export const SOUND_ENABLED_KEY = 'conferbot-sound-enabled';

export interface ToneStep {
  /** Start, seconds after the sound begins. */
  at: number;
  /** Frequency at the start and end of the step (Hz). */
  from: number;
  to: number;
  /** Length of the step (seconds). */
  dur: number;
  type: Wave;
  /** Peak gain, 0-1. */
  gain: number;
}

export const normalizeMessageSound = (v: unknown): MessageSound =>
  MESSAGE_SOUNDS.includes(v as MessageSound) ? (v as MessageSound) : 'off';

export const normalizeSoundPack = (v: unknown): SoundPack =>
  SOUND_PACKS.includes(v as SoundPack) ? (v as SoundPack) : 'off';

/** True when a pack (not "off") is chosen. */
export const soundPackOn = (c: any): boolean => normalizeSoundPack(c?.soundPack) !== 'off';

/** The notes of each message sound. */
export const soundRecipe = (kind: unknown): ToneStep[] => {
  switch (normalizeMessageSound(kind)) {
    case 'pop':
      return [{ at: 0, from: 520, to: 880, dur: 0.09, type: 'sine', gain: 0.18 }];
    case 'chime':
      return [
        { at: 0, from: 880, to: 880, dur: 0.18, type: 'triangle', gain: 0.12 },
        { at: 0.09, from: 1318.5, to: 1318.5, dur: 0.22, type: 'triangle', gain: 0.1 },
      ];
    case 'bubble':
      return [
        { at: 0, from: 380, to: 760, dur: 0.07, type: 'sine', gain: 0.16 },
        { at: 0.08, from: 520, to: 1040, dur: 0.07, type: 'sine', gain: 0.12 },
      ];
    default:
      return [];
  }
};

const note = (at: number, from: number, dur: number, type: Wave, gain: number, to = from): ToneStep => ({ at, from, to, dur, type, gain });
const run = (freqs: number[], step: number, dur: number, type: Wave, gain: number): ToneStep[] =>
  freqs.map((f, i) => note(i * step, f, dur, type, gain));

// C5 E5 G5 C6, and the rest of the notes the packs use.
const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, E6 = 1318.5, G6 = 1568, B5 = 987.77, A4 = 440, E4 = 329.63;

const PACKS: Record<Exclude<SoundPack, 'off'>, Record<SoundEvent, ToneStep[]>> = {
  // Soft: low, rounded sines - barely there.
  soft: {
    open: [note(0, A4, 0.16, 'sine', 0.07, E5), note(0.08, E5, 0.16, 'sine', 0.05)],
    message: [note(0, E5, 0.16, 'sine', 0.08), note(0.07, A4 * 2, 0.2, 'sine', 0.05)],
    send: [note(0, C5, 0.08, 'sine', 0.05, G5)],
    close: [note(0, E5, 0.16, 'sine', 0.06, A4)],
  },
  // Playful: a bright arpeggio and a boing.
  playful: {
    open: run([C5, E5, G5], 0.065, 0.09, 'triangle', 0.1),
    message: [note(0, 300, 0.14, 'sine', 0.14, 900), note(0.13, 900, 0.06, 'sine', 0.06)],
    send: [note(0, 600, 0.06, 'sine', 0.12, 1050)],
    close: run([G5, E5, C5], 0.06, 0.08, 'triangle', 0.08),
  },
  // Retro: square-wave chiptune - a power-up and a coin.
  retro: {
    open: run([E4, A4, E5, A4 * 2], 0.045, 0.05, 'square', 0.045),
    message: [note(0, B5, 0.07, 'square', 0.05), note(0.07, E6, 0.16, 'square', 0.045)],
    send: [note(0, 660, 0.04, 'square', 0.04)],
    close: run([A4 * 2, E5, A4], 0.05, 0.05, 'square', 0.04),
  },
  // Bubbly: rising bubbles.
  bubbly: {
    open: [note(0, 400, 0.06, 'sine', 0.13, 800), note(0.07, 500, 0.06, 'sine', 0.11, 1000), note(0.14, 650, 0.07, 'sine', 0.09, 1300)],
    message: [note(0, 380, 0.07, 'sine', 0.16, 760), note(0.08, 520, 0.07, 'sine', 0.12, 1040)],
    send: [note(0, 700, 0.05, 'sine', 0.1, 1400)],
    close: [note(0, 800, 0.09, 'sine', 0.1, 400)],
  },
  // Premium: a soft bell - a fundamental and its octave, long and low.
  premium: {
    open: [note(0, C5, 0.42, 'sine', 0.07), note(0, C6, 0.34, 'sine', 0.03), note(0.1, G5, 0.36, 'sine', 0.04)],
    message: [note(0, C6, 0.32, 'triangle', 0.07), note(0.09, G6, 0.28, 'sine', 0.035)],
    send: [note(0, A4 * 2, 0.1, 'sine', 0.045)],
    close: [note(0, G5, 0.26, 'sine', 0.05, C5)],
  },
};

/** The notes of `pack` for `event`. */
export const packRecipe = (pack: unknown, event: SoundEvent): ToneStep[] => {
  const p = normalizeSoundPack(pack);
  return p === 'off' ? [] : PACKS[p][event] || [];
};

/** At most one message sound this often. */
export const MIN_GAP_MS = 800;
/** A pack's own moments can follow each other quickly (open, then the greeting arriving); each has its own gap. */
export const PACK_GAP_MS: Record<SoundEvent, number> = { open: 400, message: 800, send: 250, close: 400 };

/** The launcher sound's file, or "" (none, or a pack plays open and close instead). */
export const toggleSoundUrl = (c: any): string => {
  if (!c?.enableWidgetToggleSound || soundPackOn(c)) return '';
  const tab = c?.checkedSoundTab || 'choose';
  const url = tab === 'choose' ? c?.widgetToggleSound : tab === 'upload' ? c?.customWidgetSoundUrl : '';
  return typeof url === 'string' && /^https?:\/\//i.test(url.trim()) ? url.trim() : '';
};

/** Whether the bot has any sound at all (the chat menu offers Sound on / off only then). */
export const hasAnySound = (c: any): boolean =>
  soundPackOn(c) || normalizeMessageSound(c?.messageSound) !== 'off' || !!toggleSoundUrl(c);

/** The visitor's stored switch: only "false" turns sounds off (blocked or empty storage reads as on). */
export const soundEnabledFrom = (stored: unknown): boolean => stored !== 'false';

/** What to play for a moment: a tone (its cache key and notes), a file, or nothing. */
export type SoundCue =
  | { kind: 'tone'; key: string; steps: ToneStep[] }
  | { kind: 'url'; url: string };

/**
 * The cue for `event` under the owner's settings: the pack's sound when a
 * pack is on; else the message sound for "message" and the launcher file
 * for "open" / "close"; "send" has a sound only in a pack.
 */
export const cueFor = (c: any, event: SoundEvent): SoundCue | null => {
  if (soundPackOn(c)) {
    const pack = normalizeSoundPack(c?.soundPack);
    const steps = packRecipe(pack, event);
    return steps.length ? { kind: 'tone', key: `${pack}.${event}`, steps } : null;
  }
  if (event === 'message') {
    const kind = normalizeMessageSound(c?.messageSound);
    const steps = soundRecipe(kind);
    return steps.length ? { kind: 'tone', key: `message.${kind}`, steps } : null;
  }
  if (event === 'open' || event === 'close') {
    const url = toggleSoundUrl(c);
    return url ? { kind: 'url', url } : null;
  }
  return null;
};

/**
 * The gaps between sounds, per moment: a message sound at most every
 * MIN_GAP_MS (a pack's message too), each pack moment its own gap. The
 * launcher file has no gap (the web plays it on every toggle).
 */
export const createSoundGate = () => {
  const last: Partial<Record<SoundEvent, number>> = {};
  return {
    /** True (and noted) when `event` may play at `now`. */
    allow(c: any, event: SoundEvent, now: number): boolean {
      const pack = soundPackOn(c);
      if (!pack && event !== 'message') return true;
      const gap = pack ? PACK_GAP_MS[event] : MIN_GAP_MS;
      if (now - (last[event] ?? -Infinity) < gap) return false;
      last[event] = now;
      return true;
    },
  };
};

// ---------------------------------------------------------------------------
// The tone as a WAV file
// ---------------------------------------------------------------------------

/** Web Audio starts the notes this long after the call (t0 = currentTime + 0.01). */
const LEAD_S = 0.01;
/** The gain's attack (exponentialRampToValueAtTime(gain, t + 0.012)). */
const ATTACK_S = 0.012;
/** Each oscillator stops this long after its note (osc.stop(t + dur + 0.02)). */
const TAIL_S = 0.02;
const FLOOR = 0.0001;

const wave = (type: Wave, phase: number): number => {
  const p = phase - Math.floor(phase); // 0..1 of a cycle
  if (type === 'square') return p < 0.5 ? 1 : -1;
  if (type === 'triangle') return p < 0.25 ? 4 * p : p < 0.75 ? 2 - 4 * p : 4 * p - 4;
  return Math.sin(2 * Math.PI * p);
};

/** A value on an exponential ramp from a to b, at fraction f (Web Audio's exponentialRampToValueAtTime). */
const expRamp = (a: number, b: number, f: number): number => a * Math.pow(b / a, Math.max(0, Math.min(1, f)));

/** The gain of a step `t` seconds into it: 0.0001, up to `gain` in 12 ms, down to 0.0001 at `dur`. */
export const stepGain = (s: ToneStep, t: number): number => {
  if (t < 0 || t > s.dur + TAIL_S) return 0;
  if (t <= ATTACK_S) return expRamp(FLOOR, s.gain, t / ATTACK_S);
  if (t <= s.dur) return expRamp(s.gain, FLOOR, (t - ATTACK_S) / Math.max(1e-6, s.dur - ATTACK_S));
  return FLOOR;
};

/** The step's frequency `t` seconds into it: an exponential glide from `from` to `to` over `dur`. */
export const stepFrequency = (s: ToneStep, t: number): number => expRamp(s.from, s.to, t / s.dur);

/** Seconds the sound lasts, its lead-in and tails included. */
export const toneLength = (steps: ToneStep[]): number =>
  steps.length ? LEAD_S + Math.max(...steps.map((s) => s.at + s.dur + TAIL_S)) : 0;

/** The steps as samples in [-1, 1]. */
export const renderSamples = (steps: ToneStep[], sampleRate = 22050): Float32Array => {
  const n = Math.ceil(toneLength(steps) * sampleRate);
  const out = new Float32Array(n);
  for (const s of steps) {
    const start = Math.round((LEAD_S + s.at) * sampleRate);
    const len = Math.ceil((s.dur + TAIL_S) * sampleRate);
    let phase = 0;
    for (let i = 0; i < len && start + i < n; i++) {
      const t = i / sampleRate;
      out[start + i] += wave(s.type, phase) * stepGain(s, t);
      phase += stepFrequency(s, Math.min(t, s.dur)) / sampleRate;
    }
  }
  for (let i = 0; i < n; i++) out[i] = Math.max(-1, Math.min(1, out[i]));
  return out;
};

/** The steps as a 16-bit mono PCM WAV file. */
export const renderWav = (steps: ToneStep[], sampleRate = 22050): Uint8Array => {
  const samples = renderSamples(steps, sampleRate);
  const data = samples.length * 2;
  const bytes = new Uint8Array(44 + data);
  const view = new DataView(bytes.buffer);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) bytes[o + i] = s.charCodeAt(i);
  };
  str(0, 'RIFF');
  view.setUint32(4, 36 + data, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  str(36, 'data');
  view.setUint32(40, data, true);
  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, Math.round(samples[i] * 32767), true);
  return bytes;
};

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Bytes as base64 (no Buffer or btoa in every React Native runtime). */
export const toBase64 = (bytes: Uint8Array): string => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    out += B64[a >> 2] + B64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += i + 1 < bytes.length ? B64[((b & 15) << 2) | ((c ?? 0) >> 6)] : '=';
    out += i + 2 < bytes.length ? B64[c & 63] : '=';
  }
  return out;
};

// ---------------------------------------------------------------------------
// Which new conversation rows are a message arriving
// ---------------------------------------------------------------------------

const AGENT_MESSAGES = new Set(['agent-message', 'agent-message-rich', 'agent-message-file', 'agent-message-audio']);

/**
 * A row that is a message arriving: a bot step's bubble (web displayStep
 * plays as each step is drawn) or a person's / the AI agent's message (web
 * agentListeners). Not the visitor's own, not join / leave lines, not the
 * frozen copy of choice buttons.
 */
export const isArrivingMessage = (item: any): boolean =>
  (item?.type === 'bot-message' && item?.shape !== 'bot-choice-buttons') || AGENT_MESSAGES.has(item?.type);

/** More new rows than this at once is a conversation put on screen whole (restored, the server's history), not news. */
export const BULK_ROWS = 3;

const rowId = (item: any): string => String(item?._id ?? item?.id ?? '');

/** Whether the rows added since `prevIds` include an arriving message (and are not a bulk restore). */
export const messageArrived = (prevIds: ReadonlySet<string>, next: any[]): boolean => {
  const added = (next || []).filter((item) => !prevIds.has(rowId(item)));
  return added.length > 0 && added.length <= BULK_ROWS && added.some(isArrivingMessage);
};

/** The ids of a conversation's rows, for the next messageArrived. */
export const rowIds = (rows: any[]): Set<string> => new Set((rows || []).map(rowId));
