/**
 * Plays the chat's sounds (core/messageSound.ts) on the phone.
 *
 * React Native has no audio of its own, so this uses expo-av when the app
 * has it (the SDK's voice messages use it too; an optional peer, nothing
 * added). Tones the web synthesises with Web Audio are rendered once into a
 * small WAV (renderWav) and written to the cache with expo-file-system when
 * that is installed, else played from a data: URI (Android's player reads
 * those; iOS's does not, so iOS needs expo-file-system for the tones). The
 * owner's launcher sound is a file URL and needs only expo-av. Without
 * expo-av the chat is silent, as before.
 *
 * Silent and mute: the audio mode is left as the app set it. expo-av's
 * default on iOS follows the ring / silent switch (playsInSilentModeIOS
 * false); on Android the sounds play on the media stream, at its volume.
 * The visitor's own Sound off (chat menu) is checked before every sound.
 */
import { renderWav, toBase64, type SoundCue } from '../core/messageSound';
import { loadExpoAv } from '../optional/expoAv';
import { loadExpoFileSystemLegacy } from '../optional/expoFileSystemLegacy';
import { loadExpoFileSystem } from '../optional/expoFileSystem';

let expoAV: any = null;
let fileSystem: any = null;
try {
  // Optional peer dependencies, null when the app does not have them (src/optional).
  expoAV = loadExpoAv();
} catch {
  expoAV = null;
}
fileSystem = loadExpoFileSystemLegacy() || loadExpoFileSystem();

/** Whether this app can play the chat's sounds at all. */
export const canPlaySounds = (): boolean => !!expoAV?.Audio?.Sound?.createAsync;

const uris = new Map<string, Promise<string | null>>();

/** A tone's playable URI, rendered once per sound. */
const toneUri = (key: string, cue: Extract<SoundCue, { kind: 'tone' }>): Promise<string | null> => {
  let pending = uris.get(key);
  if (!pending) {
    pending = (async () => {
      const b64 = toBase64(renderWav(cue.steps));
      const dir = fileSystem?.cacheDirectory;
      if (dir && typeof fileSystem?.writeAsStringAsync === 'function') {
        const path = `${dir}conferbot-sound-${key.replace(/[^a-z0-9.-]/gi, '_')}.wav`;
        await fileSystem.writeAsStringAsync(path, b64, { encoding: fileSystem.EncodingType?.Base64 || 'base64' });
        return path;
      }
      return `data:audio/wav;base64,${b64}`;
    })().catch(() => null);
    pending.then((u) => {
      if (!u) uris.delete(key);
    });
    uris.set(key, pending);
  }
  return pending;
};

/** Play a cue; never throws, resolves false when nothing could play. */
export const playCue = async (cue: SoundCue | null): Promise<boolean> => {
  if (!cue || !canPlaySounds()) return false;
  try {
    const uri = cue.kind === 'url' ? cue.url : await toneUri(cue.key, cue);
    if (!uri) return false;
    const { sound } = await expoAV.Audio.Sound.createAsync({ uri }, { shouldPlay: true, volume: 1.0 });
    sound.setOnPlaybackStatusUpdate?.((s: any) => {
      if (s?.didJustFinish || (s && s.isLoaded === false)) sound.unloadAsync?.().catch(() => undefined);
    });
    return true;
  } catch {
    return false;
  }
};
