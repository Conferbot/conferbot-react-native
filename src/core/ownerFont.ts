/**
 * The owner's font and the theme's font, as the web widget picks them.
 * Ported from conferbot-widget src/ts/fonts/ownerFont.ts (findCatalogFont,
 * the "CB Font " prefixed family, ownerFontUrl), src/ts/theme/themeTokens.ts
 * (isDefaultFont, parseFontFaces, themeFontUrl, the owner's font over the
 * theme's: --cb-o-font) and src/ts/theme/applyTheme.ts (loadThemeFont).
 *
 * Which font the chat's text uses:
 *   - the owner's font (customizations.font) when it is not a default
 *     ("", "Arial", "Gill Sans, sans-serif"): everything, body and headings;
 *   - else the theme's font: a "body" theme font for all text, a "display"
 *     one for headings only (the header's title, card titles);
 *   - else the platform's font.
 * A catalog web font (or a theme font) is fetched from Google Fonts at run
 * time and registered under a "CB Font <family>" name, so the app's own
 * text never picks it up; a system or unknown font is used by its family
 * name (the app may bundle it), and the platform font when it has none.
 *
 * In an app the faces are registered with expo-font (utils/fontLoader.ts).
 * Google Fonts sends TrueType files to a client that is not a browser,
 * which is what both platforms load. Pure.
 */
import { FONT_CATALOG, THEME_FONT_QUERIES, type CatalogFont } from './fonts.data';

export type { CatalogFont };
export { FONT_CATALOG };

export const OWNER_FONT_PREFIX = 'CB Font ';

/** Fonts that mean "the owner never picked one" (dashboard / model defaults). */
const DEFAULT_FONTS = ['', 'arial', 'gill sans, sans-serif', 'gill sans'];
const SYSTEM_SANS = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const bareFont = (font: unknown): string => {
  let v = typeof font === 'string' ? font.trim().replace(/[;\s]+$/, '').trim() : '';
  if (v === SYSTEM_SANS) return '';
  if (v.endsWith(`, ${SYSTEM_SANS}`)) v = v.slice(0, -(SYSTEM_SANS.length + 2)).trim();
  return v;
};

export const isDefaultFont = (font: unknown): boolean =>
  typeof font !== 'string' || DEFAULT_FONTS.includes(bareFont(font).replace(/["']/g, '').toLowerCase());

const unquote = (s: string): string => s.trim().replace(/^['"]+|['"]+$/g, '').trim();

/** The first family named in a font-family value, unquoted. */
export const firstFamily = (value: unknown): string => (typeof value === 'string' ? unquote(value.split(',')[0] || '') : '');

const BY_NAME: Record<string, CatalogFont> = FONT_CATALOG.reduce((acc, f) => {
  acc[f.family.toLowerCase()] = f;
  acc[f.id] = f;
  return acc;
}, {} as Record<string, CatalogFont>);

/** The catalog font a saved value names (by family, id, or our prefixed name), or null. */
export const findCatalogFont = (value: unknown): CatalogFont | null => {
  let name = firstFamily(value).toLowerCase();
  if (!name) return null;
  const prefix = OWNER_FONT_PREFIX.toLowerCase();
  if (name.startsWith(prefix)) name = name.slice(prefix.length);
  return BY_NAME[name] || null;
};

export const googleFontUrl = (query: string): string => `https://fonts.googleapis.com/css2?family=${query}&display=swap`;

export interface FontFace {
  weight: number;
  style: 'normal' | 'italic';
  url: string;
}

/**
 * A Google Fonts stylesheet's faces: each @font-face block's weight, style
 * and its TrueType / OpenType url (a woff2-only block is skipped: neither
 * platform registers woff2). Variable ranges ("100 900") read as their start.
 */
export const parseFontFaces = (css: string): FontFace[] => {
  const faces: FontFace[] = [];
  for (const block of String(css || '').match(/@font-face\s*{[^}]*}/g) || []) {
    const src = block.match(/src:\s*([^;]+);/)?.[1] || '';
    const url = src.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)\s*format\(\s*['"]?(truetype|opentype)['"]?\s*\)/i)?.[1];
    if (!url) continue;
    const weight = parseInt(block.match(/font-weight:\s*(\d+)/)?.[1] || '400', 10);
    const style = /font-style:\s*italic/.test(block) ? 'italic' : 'normal';
    faces.push({ weight, style, url });
  }
  return faces;
};

/** The family name a face is registered under: the 400 face plain, others with their weight. */
export const faceName = (family: string, weight: number): string =>
  weight === 400 ? `${OWNER_FONT_PREFIX}${family}` : `${OWNER_FONT_PREFIX}${family} ${weight}`;

export interface ChatFonts {
  /** The owner's or the body theme font: all of the chat's text. */
  body: FontPick | null;
  /** Headings: the owner's font, else the theme's (body or display). */
  display: FontPick | null;
}

export interface FontPick {
  family: string;
  /** The Google Fonts query to fetch it, or null (a system or unknown font, used by name). */
  google: string | null;
}

/**
 * The fonts the chat uses for the owner's settings and the theme's font
 * (core/widgetTheme.ts `font`, `fontRole`). The owner's own font wins over
 * the theme's for both (web themeTokens --cb-o-font / --cb-o-font-display).
 */
export const chatFontsFor = (ownerFont: unknown, theme?: { font?: string | null; fontRole?: string | null } | null): ChatFonts => {
  if (!isDefaultFont(ownerFont)) {
    const cat = findCatalogFont(ownerFont);
    const pick: FontPick | null = cat
      ? cat.google
        ? { family: cat.family, google: cat.google }
        : systemPick(cat.family)
      : systemPick(firstFamily(ownerFont));
    if (pick) return { body: pick, display: pick };
  }
  const tf = theme?.font || null;
  if (!tf) return { body: null, display: null };
  const pick: FontPick = { family: tf, google: THEME_FONT_QUERIES[tf] || findCatalogFont(tf)?.google || null };
  return theme?.fontRole === 'display' ? { body: null, display: pick } : { body: pick, display: pick };
};

// A system pick: "system-ui" is the platform font (nothing to set).
const systemPick = (family: string): FontPick | null => (!family || family === 'system-ui' ? null : { family, google: null });

/**
 * The registered face to draw `weight` with: the loaded weight nearest to
 * it (ties go heavier for bold text, lighter for normal), as a fontFamily.
 * null when nothing is loaded: the platform font draws it.
 */
export const fontFamilyFor = (pick: FontPick | null, loaded: number[] | null | undefined, weight: number = 400): string | null => {
  if (!pick) return null;
  if (!pick.google) return pick.family;
  if (!loaded || !loaded.length) return null;
  const best = [...loaded].sort((a, b) => {
    const d = Math.abs(a - weight) - Math.abs(b - weight);
    if (d !== 0) return d;
    return weight >= 600 ? b - a : a - b;
  })[0];
  return faceName(pick.family, best);
};

/** A style's fontWeight as a number ("bold" 700, "normal" / unset 400). */
export const weightOf = (w: unknown): number => {
  if (w === 'bold') return 700;
  const n = parseInt(String(w ?? ''), 10);
  return Number.isFinite(n) ? n : 400;
};
