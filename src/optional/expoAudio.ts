/**
 * The optional peer `expo-audio`, or null when the app does not have it.
 *
 * Expo SDK 55 removed `expo-av`; `expo-audio` is its replacement for
 * playback. Required from its own module while this module loads, for the
 * same Metro and release-build reasons as expoAv.ts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loaded: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  loaded = require('expo-audio');
} catch {
  loaded = null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadExpoAudio(): any {
  return loaded;
}
