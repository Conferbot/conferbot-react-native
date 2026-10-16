/**
 * The bot's customizations as the web widget applies them
 * (conferbot-widget core/customizations.ts buildCustomizationsRef, the
 * polish and owner sheets): defaults, the values that count as unset, and
 * what each one turns into on screen. Pure: the components read the result.
 */
import { ownsChatBackground } from './widgetTheme';
import type { ResolvedWidgetTheme } from './widgetTheme';
import { mascotLookOf, mascotScaleOf, type MascotLook } from './mascotArt';
import { normalizeMascotMotion, type MascotMotion } from './mascotMotion';

export interface Corners {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

export interface ResolvedCustomizations {
  /** "Powered by Conferbot" hidden (the server forces false on Free/Starter). */
  hideBrand: boolean;
  /** The owner's footer text instead of "Powered by", when turned on. */
  customBrand: string | null;
  /** Header title: logoText (or the bot name), cut to 18 characters. */
  title: string;
  /** Header logo: the owner's, else the Conferbot logo (as the web). */
  logo: string;
  hideLogo: boolean;
  /** Under the title: the tagline when turned on, else "Online" (unless hidden). */
  tagline: string | null;
  showOnline: boolean;
  /** Bot avatar beside messages (the logo when no avatar of its own). */
  avatar: string;
  hideAvatar: boolean;
  avatarSize: number;
  avatarRadius: number;
  avatarShape: 'circle' | 'rounded' | 'square';
  /** Bubble corners: the web's 18/6 shapes unless the owner set a radius. */
  botBubble: Corners;
  userBubble: Corners;
  optionRadius: number;
  /** An outline round each bubble, from the theme (cartoon, neo-brutal...), or null. */
  bubbleBorder: { width: number; color: string } | null;
  /** The composer field's corner radius: 25 (a pill) unless the theme has its own. */
  fieldRadius: number;
  /** The chat surface the theme paints when the owner kept the default white, else null. */
  surface: string | null;
  /** Message text size: 14.5 unless the owner set something other than 14. */
  fontSize: number;
  /** The owner's font, or null for the platform font (Arial / unset). */
  fontFamily: string | null;
  /** Send button and accents: the header colour. */
  accent: string;
  /** Ink on the accent: the theme palette's, else null (picked for contrast). */
  accentInk: string | null;
  typingStyle: 'dots' | 'wave' | 'shimmer' | 'pencil' | 'mascot';
  /** The owner's mascot (art3d mascotLookOf): the idle call, the mascot typing and launcher styles, the greeting card. */
  mascot: MascotLook;
  /** The colour it is drawn in when the owner chose none: the launcher's (widgetIconBgColor, else the header's). */
  mascotAccent: string;
  /** The mascot greets on the greeting card, by its name, in place of the avatar. */
  mascotInGreeting: boolean;
  /** How the greeting card's figure moves: lively (absent), subtle or off. */
  mascotMotion: MascotMotion;
  /** The mascot's size in the launcher, % of the button (70-150, default 112). */
  mascotLauncherScale: number;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const usableUrl = (v: unknown): string | null => {
  const s = str(v);
  return /^(https?:)?\/\//i.test(s) || /^data:image\//i.test(s) ? s : null;
};
const all = (r: number): Corners => ({ topLeft: r, topRight: r, bottomRight: r, bottomLeft: r });

/** The web widget's default logo (utils/constants BOT_LOGO): header and bot avatar. */
export const DEFAULT_LOGO = 'https://www.conferbot.com/img/logo/conferbot-logo.png';

const UNSET_FONTS = new Set(['', 'arial', 'gill sans']);
const TYPING = new Set(['dots', 'wave', 'shimmer', 'pencil', 'mascot']);

/** "Live chat test (tem..." - 18 characters, as the header cuts it. */
export const headerTitle = (name: string): string => (name.length > 18 ? `${name.slice(0, 18)}...` : name);

/** The avatar's corner radius for its shape: circle 50%, rounded 28%, square 4px. */
export const avatarRadiusFor = (shape: unknown, size: number): number => {
  if (shape === 'square') return 4;
  if (shape === 'rounded') return Math.round(size * 0.28);
  return size / 2;
};

export function resolveCustomizations(
  raw: Record<string, any> | null | undefined,
  botName = '',
  theme?: ResolvedWidgetTheme | null
): ResolvedCustomizations {
  const c = raw || {};
  const name = str(c.logoText) || str(c.botName) || botName || 'Chat';
  const tagline = c.enableTagline === true && str(c.tagline) ? str(c.tagline) : null;

  const avatarSet = num(c.avatarSize);
  const avatarSize = avatarSet && avatarSet !== 40 ? avatarSet : 32;

  const bubbleSet = num(c.bubbleBorderRadius);
  const ownBubble = bubbleSet !== null && bubbleSet !== 10;
  const optionSet = num(c.optionBubbleBorderRadius);
  // A theme other than classic brings its own radii; the owner's still win.
  const shape = theme?.shape || null;
  const r = shape ? shape.rBubble : 18;
  const tail = shape ? shape.rTail : 6;
  const ownsBg = ownsChatBackground(c);

  const fontSet = num(c.fontSize);
  const font = str(c.font);

  return {
    hideBrand: c.hideBrand === true,
    customBrand: c.enableCustomBrand === true && str(c.customBrand) ? str(c.customBrand) : null,
    title: headerTitle(name),
    logo: usableUrl(c.logo) || DEFAULT_LOGO,
    hideLogo: c.hideLogo === true,
    tagline,
    showOnline: !tagline && c.hideOnlineStatus !== true,
    avatar: usableUrl(c.avatar) || usableUrl(c.logo) || DEFAULT_LOGO,
    hideAvatar: c.hideAvatar === true,
    avatarSize,
    avatarRadius: avatarRadiusFor(c.avatarShape, avatarSize),
    avatarShape: c.avatarShape === 'square' || c.avatarShape === 'rounded' ? c.avatarShape : 'circle',
    botBubble: ownBubble ? all(bubbleSet as number) : { topLeft: r, topRight: r, bottomRight: r, bottomLeft: tail },
    userBubble: ownBubble ? all(bubbleSet as number) : { topLeft: r, topRight: r, bottomRight: tail, bottomLeft: r },
    optionRadius: optionSet !== null && (optionSet !== 10 || !shape) ? optionSet : shape ? shape.rCtl : 10,
    bubbleBorder: shape?.bubbleBorder || null,
    fieldRadius: shape ? shape.rField : 25,
    surface: theme?.tokens && !ownsBg ? theme.tokens.bg : null,
    fontSize: fontSet && fontSet !== 14 ? fontSet : 14.5,
    fontFamily: UNSET_FONTS.has(font.toLowerCase()) ? null : font,
    // The theme palette's accent when it supplied the colours, else the header colour.
    accent: str(c.themeAccent) || str(c.headerBgColor) || '#0b4eb8',
    accentInk: str(c.themeOnAccent) || null,
    typingStyle: TYPING.has(c.typingStyle) ? c.typingStyle : 'dots',
    mascot: mascotLookOf(c),
    mascotAccent: str(c.widgetIconBgColor) || str(c.headerBgColor) || '#4f46e5',
    mascotInGreeting: c.mascotInGreeting === true,
    mascotMotion: normalizeMascotMotion(c.mascotMotion),
    mascotLauncherScale: mascotScaleOf(c),
  };
}
