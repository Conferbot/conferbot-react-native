/**
 * The chat's sounds (web ts/chat/messageSound.ts, index.ts _playToggleSound).
 */
import {
  BULK_ROWS,
  MIN_GAP_MS,
  PACK_GAP_MS,
  SOUND_EVENTS,
  SOUND_PACKS,
  createSoundGate,
  cueFor,
  hasAnySound,
  isArrivingMessage,
  messageArrived,
  normalizeMessageSound,
  normalizeSoundPack,
  packRecipe,
  renderSamples,
  renderWav,
  rowIds,
  soundEnabledFrom,
  soundRecipe,
  stepFrequency,
  stepGain,
  toBase64,
  toggleSoundUrl,
  toneLength,
} from '../../src/core/messageSound';

describe('message sounds', () => {
  it('has the web\'s three message sounds, off by default', () => {
    expect(soundRecipe('off')).toEqual([]);
    expect(soundRecipe(undefined)).toEqual([]);
    expect(soundRecipe('ding')).toEqual([]);
    expect(soundRecipe('pop')).toEqual([{ at: 0, from: 520, to: 880, dur: 0.09, type: 'sine', gain: 0.18 }]);
    expect(soundRecipe('chime').map((s) => s.from)).toEqual([880, 1318.5]);
    expect(soundRecipe('bubble').map((s) => [s.from, s.to])).toEqual([[380, 760], [520, 1040]]);
    expect(normalizeMessageSound('chime')).toBe('chime');
    expect(normalizeMessageSound('loud')).toBe('off');
  });

  it('has five packs with all four moments, quiet and short', () => {
    expect(SOUND_PACKS).toEqual(['off', 'soft', 'playful', 'retro', 'bubbly', 'premium']);
    expect(normalizeSoundPack('nope')).toBe('off');
    for (const pack of SOUND_PACKS.filter((p) => p !== 'off')) {
      for (const ev of SOUND_EVENTS) {
        const steps = packRecipe(pack, ev);
        expect(steps.length).toBeGreaterThan(0);
        steps.forEach((s) => expect(s.gain).toBeLessThanOrEqual(0.2));
        expect(toneLength(steps)).toBeLessThan(0.5);
      }
    }
    expect(packRecipe('retro', 'send')).toEqual([{ at: 0, from: 660, to: 660, dur: 0.04, type: 'square', gain: 0.04 }]);
    expect(packRecipe('playful', 'open').map((s) => s.at)).toEqual([0, 0.065, 0.13]);
    expect(packRecipe('off', 'open')).toEqual([]);
  });

  it('plays the launcher file for open and close, unless a pack plays them', () => {
    const c = { enableWidgetToggleSound: true, checkedSoundTab: 'choose', widgetToggleSound: 'https://cdn.conferbot.com/sounds/sound-1.mp3' };
    expect(toggleSoundUrl(c)).toBe('https://cdn.conferbot.com/sounds/sound-1.mp3');
    expect(toggleSoundUrl({ ...c, checkedSoundTab: undefined })).toBe('https://cdn.conferbot.com/sounds/sound-1.mp3');
    expect(toggleSoundUrl({ ...c, checkedSoundTab: 'upload', customWidgetSoundUrl: 'https://x.test/a.wav' })).toBe('https://x.test/a.wav');
    expect(toggleSoundUrl({ ...c, enableWidgetToggleSound: false })).toBe('');
    expect(toggleSoundUrl({ ...c, soundPack: 'soft' })).toBe('');
    expect(toggleSoundUrl({ ...c, widgetToggleSound: 'javascript:alert(1)' })).toBe('');
    expect(cueFor(c, 'open')).toEqual({ kind: 'url', url: c.widgetToggleSound });
    expect(cueFor(c, 'close')).toEqual({ kind: 'url', url: c.widgetToggleSound });
    expect(cueFor(c, 'send')).toBeNull();
    expect(cueFor(c, 'message')).toBeNull();
  });

  it('picks the pack over the single message sound', () => {
    expect(cueFor({ messageSound: 'pop' }, 'message')).toMatchObject({ kind: 'tone', key: 'message.pop' });
    expect(cueFor({ messageSound: 'pop', soundPack: 'retro' }, 'message')).toMatchObject({ kind: 'tone', key: 'retro.message' });
    expect(cueFor({ soundPack: 'retro' }, 'send')).toMatchObject({ kind: 'tone', key: 'retro.send' });
    expect(cueFor({}, 'message')).toBeNull();
    expect(hasAnySound({})).toBe(false);
    expect(hasAnySound({ messageSound: 'chime' })).toBe(true);
    expect(hasAnySound({ soundPack: 'soft' })).toBe(true);
  });

  it('keeps the web\'s gaps: a message at most every 800 ms, each pack moment its own', () => {
    const gate = createSoundGate();
    const c = { messageSound: 'pop' };
    expect(gate.allow(c, 'message', 1000)).toBe(true);
    expect(gate.allow(c, 'message', 1000 + MIN_GAP_MS - 1)).toBe(false);
    expect(gate.allow(c, 'message', 1000 + MIN_GAP_MS)).toBe(true);
    // The launcher file plays on every toggle.
    expect(gate.allow(c, 'open', 1000)).toBe(true);
    expect(gate.allow(c, 'open', 1001)).toBe(true);
    const p = { soundPack: 'soft' };
    const g2 = createSoundGate();
    expect(g2.allow(p, 'send', 0)).toBe(true);
    expect(g2.allow(p, 'send', PACK_GAP_MS.send - 1)).toBe(false);
    expect(g2.allow(p, 'open', 10)).toBe(true);
    expect(g2.allow(p, 'send', PACK_GAP_MS.send)).toBe(true);
  });

  it('reads the visitor\'s switch as the web does: only "false" is off', () => {
    expect(soundEnabledFrom('false')).toBe(false);
    expect(soundEnabledFrom('true')).toBe(true);
    expect(soundEnabledFrom(null)).toBe(true);
    expect(soundEnabledFrom(undefined)).toBe(true);
  });

  it('renders a tone as Web Audio does: exponential glides, a 12 ms attack, a quiet tail', () => {
    const [pop] = soundRecipe('pop');
    expect(stepFrequency(pop, 0)).toBeCloseTo(520);
    expect(stepFrequency(pop, pop.dur)).toBeCloseTo(880);
    expect(stepFrequency(pop, pop.dur / 2)).toBeCloseTo(Math.sqrt(520 * 880));
    expect(stepGain(pop, 0)).toBeCloseTo(0.0001, 6);
    expect(stepGain(pop, 0.012)).toBeCloseTo(0.18);
    expect(stepGain(pop, pop.dur)).toBeCloseTo(0.0001, 6);
    expect(stepGain(pop, pop.dur + 0.05)).toBe(0);
    const samples = renderSamples(soundRecipe('pop'), 8000);
    expect(samples.length).toBe(Math.ceil(toneLength(soundRecipe('pop')) * 8000));
    const peak = Math.max(...Array.from(samples).map(Math.abs));
    expect(peak).toBeGreaterThan(0.1);
    expect(peak).toBeLessThanOrEqual(0.18 + 1e-6);
  });

  it('writes a valid 16-bit mono WAV, about 20 KB for the longest sound', () => {
    const wav = renderWav(packRecipe('premium', 'open'));
    const text = (o: number, n: number) => String.fromCharCode(...Array.from(wav.slice(o, o + n)));
    const view = new DataView(wav.buffer);
    expect(text(0, 4)).toBe('RIFF');
    expect(text(8, 4)).toBe('WAVE');
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(22050);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(wav.length - 44);
    expect(wav.length).toBeLessThan(25_000);
  });

  it('encodes base64 without Buffer', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253]);
    expect(toBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
    expect(toBase64(new Uint8Array([77]))).toBe('TQ==');
    expect(toBase64(new Uint8Array([77, 97]))).toBe('TWE=');
  });

  it('hears a message arriving, not the visitor\'s own nor a restored conversation', () => {
    expect(isArrivingMessage({ type: 'bot-message', shape: 'bot-text-message' })).toBe(true);
    expect(isArrivingMessage({ type: 'bot-message', shape: 'bot-choice-buttons' })).toBe(false);
    expect(isArrivingMessage({ type: 'agent-message' })).toBe(true);
    expect(isArrivingMessage({ type: 'agent-joined-message' })).toBe(false);
    expect(isArrivingMessage({ type: 'user-message' })).toBe(false);
    const before = [{ _id: 'a', type: 'bot-message' }];
    expect(messageArrived(rowIds(before), [...before, { _id: 'b', type: 'bot-message' }])).toBe(true);
    expect(messageArrived(rowIds(before), [...before, { _id: 'u', type: 'user-message' }])).toBe(false);
    const restored = Array.from({ length: BULK_ROWS + 1 }, (_, i) => ({ _id: `r${i}`, type: 'bot-message' }));
    expect(messageArrived(new Set(), restored)).toBe(false);
    expect(messageArrived(new Set(), [{ _id: 'w', type: 'bot-message' }])).toBe(true);
  });
});
