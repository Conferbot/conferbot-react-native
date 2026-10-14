/**
 * The widget theme as the web widget applies it (conferbot-widget
 * src/ts/theme/themeTokens.ts, base.css and the theme sheets):
 *
 *   widgetTheme      one of 27 themes ("classic" when unset or unknown)
 *   themeAppearance  light | dark | auto (auto follows the phone)
 *   themeColors      brand (the owner's colours) | theme (the theme's palette)
 *
 * Classic in light is the widget as it always was: no tokens, no shape.
 * Classic in dark repaints the surfaces only. Every other theme brings its
 * surfaces, text colours and shape; an owner setting (bubble radius, option
 * radius, a chat background of their own) still wins over the theme. Pure.
 */
import { WIDGET_THEMES_DATA } from './widgetThemes.data';

export type ThemeAppearance = 'light' | 'dark' | 'auto';
export type ThemeScheme = 'light' | 'dark';
export type ThemeColorsMode = 'brand' | 'theme';

export const WIDGET_THEMES: string[] = Object.keys(WIDGET_THEMES_DATA);

/** Surfaces and text, every value a six-digit hex (rgba flattened onto the surface). */
export interface ThemeTokens {
  /** Panel, conversation, composer and footer. */
  bg: string;
  /** Canvas: home screen, help centre. */
  bg2: string;
  /** Cards, menus, chips. */
  card: string;
  /** Quiet fills: search field, tags. */
  card2: string;
  /** The composer's field. */
  field: string;
  menu: string;
  ink: string;
  text: string;
  muted: string;
  faint: string;
  line: string;
  line2: string;
}

export interface ThemeShape {
  rBubble: number;
  rTail: number;
  /** Option buttons (999 is a pill). */
  rCtl: number;
  /** The composer's field. */
  rField: number;
  rCard: number;
  /** An outline round every bubble (cartoon, neo-brutal, sketch...), or null. */
  bubbleBorder: { width: number; color: string } | null;
  displayWeight: number;
}

export interface ResolvedWidgetTheme {
  id: string;
  label: string;
  appearance: ThemeAppearance;
  scheme: ThemeScheme;
  colors: ThemeColorsMode;
  /** Null for classic in light: nothing changes. */
  tokens: ThemeTokens | null;
  /** Null for classic: radii stay the widget's. */
  shape: ThemeShape | null;
  /** The theme's font family (Google Fonts name) and what it covers, when it has one. */
  font: string | null;
  fontRole: 'body' | 'display' | null;
}

const lower = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

export const normalizeTheme = (v: unknown): string => (WIDGET_THEMES_DATA[lower(v)] ? lower(v) : 'classic');
export const normalizeAppearance = (v: unknown): ThemeAppearance =>
  lower(v) === 'dark' || lower(v) === 'auto' ? (lower(v) as ThemeAppearance) : 'light';
export const normalizeThemeColors = (v: unknown): ThemeColorsMode => (lower(v) === 'theme' ? 'theme' : 'brand');

/** Light or dark: always-dark themes, then the appearance (auto: the phone's setting). */
export const resolveScheme = (theme: string, appearance: ThemeAppearance, prefersDark: boolean): ThemeScheme => {
  if (WIDGET_THEMES_DATA[theme]?.alwaysDark) return 'dark';
  if (appearance === 'dark') return 'dark';
  if (appearance === 'auto') return prefersDark ? 'dark' : 'light';
  return 'light';
};

type RGBA = [number, number, number, number];

/** "#abc", "#aabbcc", "#aabbccdd", "rgb(1,2,3)", "rgba(1,2,3,.5)", white, black. */
export const parseColor = (value: unknown): RGBA | null => {
  const v = lower(value);
  if (v === 'white') return [255, 255, 255, 1];
  if (v === 'black') return [0, 0, 0, 1];
  let m = /^#([0-9a-f]{3,8})$/.exec(v);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), a];
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/.exec(v);
  if (m) {
    const c = (n: string) => Math.max(0, Math.min(255, Math.round(Number(n))));
    return [c(m[1]), c(m[2]), c(m[3]), m[4] !== undefined ? Math.max(0, Math.min(1, Number(m[4]))) : 1];
  }
  return null;
};

const hex = (c: RGBA | [number, number, number]) =>
  `#${[c[0], c[1], c[2]].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`;

const mixRGBA = (a: RGBA, b: RGBA, t: number): RGBA => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
  a[3] + (b[3] - a[3]) * t,
];

/** A colour with alpha laid over an opaque one. */
const over = (top: RGBA, under: RGBA): RGBA => mixRGBA(under, [top[0], top[1], top[2], 1], top[3]);

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const luminance = (c: RGBA) => 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
const contrast = (a: RGBA, b: RGBA) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** The brand lightened until it reads on a dark surface (4.5:1 on #14161c), as the web's accentOnDark. */
export const accentOnDark = (brand: RGBA): RGBA => {
  const surface: RGBA = [20, 22, 28, 1];
  let c = brand;
  for (let t = 0; t <= 1.0001 && contrast(c, surface) < 4.5; t += 0.05) {
    c = mixRGBA(brand, [255, 255, 255, 1], t).map(Math.round) as RGBA;
    c[3] = 1;
  }
  return c;
};

/** A token value: hex / rgb(a), "mix:N:<colour>" or "accent:<alpha>". */
const tokenColor = (value: string, brand: RGBA): RGBA | null => {
  let m = /^mix:([\d.]+):(.+)$/.exec(value);
  if (m) {
    const base = parseColor(m[2]);
    return base ? mixRGBA(base, brand, Number(m[1]) / 100) : null;
  }
  m = /^accent:([\d.]+)$/.exec(value);
  if (m) {
    const a = accentOnDark(brand);
    return [a[0], a[1], a[2], Number(m[1])];
  }
  return parseColor(value);
};

/**
 * The owner's chat background counts as theirs (the theme leaves it alone)
 * unless it is the default plain white; gradients, patterns and images
 * always are.
 */
export const ownsChatBackground = (c: Record<string, any> | null | undefined): boolean => {
  const type = lower(c?.chatBgType) || 'solid';
  if (type === 'image' || type === 'gradient' || type === 'pattern') return true;
  const color = parseColor(c?.chatBgColor);
  if (!color) return false;
  return !(color[0] >= 250 && color[1] >= 250 && color[2] >= 250);
};

/** The colours the palette replaces, from the theme's palette for the scheme. */
const paletteFor = (theme: string, colors: ThemeColorsMode, scheme: ThemeScheme): Record<string, string> | null => {
  if (theme === 'classic' || colors !== 'theme') return null;
  const p = WIDGET_THEMES_DATA[theme]?.palette;
  return p ? p[scheme] || p.light : null;
};

/**
 * The customizations with the theme's palette in place of the owner's
 * colours (themeColors "theme", any theme but classic); otherwise the same
 * object back. The chat background goes back to plain white, which the
 * theme paints with its own surface. Logo, avatar and texts stay the owner's.
 */
export function withThemePalette<T extends Record<string, any> | null | undefined>(c: T, prefersDark: boolean): T {
  if (!c) return c;
  const theme = normalizeTheme(c.widgetTheme);
  const scheme = resolveScheme(theme, normalizeAppearance(c.themeAppearance), prefersDark);
  const p = paletteFor(theme, normalizeThemeColors(c.themeColors), scheme);
  if (!p) return c;
  return {
    ...c,
    headerBgColor: p.headerBg,
    headerTextColor: p.headerText,
    botMsgColor: p.botBg,
    botTextColor: p.botText,
    userMsgColor: p.userBg,
    userTextColor: p.userText,
    optionBubbleMsgColor: p.optionBg,
    optionBubbleTextColor: p.optionText,
    chatBgType: 'solid',
    chatBgColor: '#ffffff',
    widgetIconThemeType: p.launcher2 ? 'Gradient' : 'Solid',
    widgetIconBgColor: p.launcher,
    widgetGradientBgOne: p.launcher,
    widgetGradientBgTwo: p.launcher2 || p.launcher,
    themeAccent: p.accent,
    themeOnAccent: p.onAccent,
  } as T;
}

/** The theme in force for these customizations, with every colour concrete. */
export function resolveWidgetTheme(c: Record<string, any> | null | undefined, prefersDark: boolean): ResolvedWidgetTheme {
  const theme = normalizeTheme(c?.widgetTheme);
  const appearance = normalizeAppearance(c?.themeAppearance);
  const colors = normalizeThemeColors(c?.themeColors);
  const scheme = resolveScheme(theme, appearance, prefersDark);
  const data = WIDGET_THEMES_DATA[theme];
  const palette = paletteFor(theme, colors, scheme);
  const brand: RGBA =
    parseColor(palette?.brand) || parseColor(c?.headerBgColor) || parseColor(c?.botMsgColor) || [27, 85, 243, 1];

  let tokens: ThemeTokens | null = null;
  const raw = theme === 'classic' && scheme === 'light' ? null : data[scheme] || data.light;
  if (raw) {
    const fallback: RGBA = scheme === 'dark' ? [20, 22, 28, 1] : [255, 255, 255, 1];
    const bgRGBA = tokenColor(raw.bg, brand) || fallback;
    const surface = over(bgRGBA, fallback);
    const flat = (v: string) => hex(over(tokenColor(v, brand) || surface, surface));
    tokens = {
      bg: hex(surface),
      bg2: flat(raw.bg2),
      card: flat(raw.card),
      card2: flat(raw.card2),
      field: flat(raw.field),
      menu: flat(raw.menu),
      ink: flat(raw.ink),
      text: flat(raw.text),
      muted: flat(raw.muted),
      faint: flat(raw.faint),
      line: flat(raw.line),
      line2: flat(raw.line2),
    };
  }

  let shape: ThemeShape | null = null;
  if (data.shape) {
    const s = data.shape;
    const border = s.bubbleBorderWidth > 0 ? parseColor(s.bubbleBorderColor) : null;
    shape = {
      rBubble: s.rBubble ?? 18,
      rTail: s.rTail ?? 6,
      rCtl: s.rCtl ?? 12,
      rField: s.rField ?? 22,
      rCard: s.rCard ?? 16,
      bubbleBorder: border
        ? { width: s.bubbleBorderWidth, color: hex(tokens ? over(border, parseColor(tokens.bg) as RGBA) : border) }
        : null,
      displayWeight: s.displayWeight || 700,
    };
  }

  return {
    id: theme,
    label: data.label,
    appearance,
    scheme,
    colors,
    tokens,
    shape,
    font: data.font || null,
    fontRole: data.fontRole || null,
  };
}
