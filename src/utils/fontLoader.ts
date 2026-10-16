/**
 * Registers the chat's web font (core/ownerFont.ts) at run time.
 *
 * React Native cannot load a font file by itself: a family must be bundled
 * with the app, or registered at run time by a native module. The lightest
 * correct option is expo-font (`Font.loadAsync({ name: uri })`), which apps
 * on Expo already have and bare apps can add with `npx expo install
 * expo-font`; it is an optional peer here, nothing is added. Without it,
 * a catalog web font is not fetched and the chat keeps the platform font
 * (a system or unknown owner font is still used by name, so an app that
 * bundles the family gets it). This mirrors the web: a font that cannot be
 * loaded falls back, it never breaks the chat.
 *
 * One stylesheet fetch per family; a failed fetch or load is forgotten so
 * a later open retries.
 */
import { faceName, googleFontUrl, parseFontFaces, type FontPick } from '../core/ownerFont';

let expoFont: any = null;
try {
  // Optional peer dependency: Metro allows a require in try/catch to be missing.
  expoFont = require('expo-font');
} catch {
  expoFont = null;
}

/** Whether web fonts can be registered in this app. */
export const canLoadFonts = (): boolean => typeof expoFont?.loadAsync === 'function';

const pending = new Map<string, Promise<number[]>>();

/**
 * Fetch and register `pick`'s upright faces. Resolves the weights now
 * registered ([] when nothing could be: no expo-font, offline, a bad file).
 */
export const loadChatFont = (pick: FontPick | null): Promise<number[]> => {
  if (!pick?.google || !canLoadFonts() || typeof fetch !== 'function') return Promise.resolve([]);
  const key = pick.family;
  let p = pending.get(key);
  if (!p) {
    p = (async () => {
      const res = await fetch(googleFontUrl(pick.google as string));
      const css = res.ok ? await res.text() : '';
      const faces = parseFontFaces(css).filter((f) => f.style === 'normal');
      if (!faces.length) return [];
      const map: Record<string, string> = {};
      faces.forEach((f) => (map[faceName(pick.family, f.weight)] = f.url));
      await expoFont.loadAsync(map);
      return [...new Set(faces.map((f) => f.weight))];
    })().catch(() => [] as number[]);
    p.then((weights) => {
      if (!weights.length) pending.delete(key);
    });
    pending.set(key, p);
  }
  return p;
};
