/**
 * The closed chat button as the web widget draws it on a phone
 * (conferbot-widget templates/shared.ts generateWidgetIcon,
 * ts/launcher/launcherStyle.ts, launcherShape.ts, layout/ownerLayout.ts and
 * the phone rules in css/liveChat/responsive*.css). Pure: the floating
 * widget reads the result.
 */
import { normalizeLauncherEntrance } from './launcherEntrance';
import type { LauncherEntrance } from './launcherEntrance';
import { normalizeLauncherAttention } from './launcherAttention';
import type { LauncherAttention } from './launcherAttention';
import { idleCallLine, normalizeIdleCallDelay, normalizeLauncherIdleCall } from './launcherIdleCall';
import type { LauncherIdleCall } from './launcherIdleCall';
import { mascotLookOf, mascotScaleOf, mixColor, type MascotLook } from './mascotArt';

export type LauncherShape = 'circle' | 'squircle' | 'bubble' | 'tab' | 'peek';
export type LauncherStyle = 'icon' | 'label' | 'avatar' | 'mascot';
export type LauncherAnimation = 'lively' | 'subtle' | 'off';

export const LAUNCHER_SHAPES: LauncherShape[] = ['circle', 'squircle', 'bubble', 'tab', 'peek'];
export const LAUNCHER_STYLES: LauncherStyle[] = ['icon', 'label', 'avatar', 'mascot'];
export const LAUNCHER_LABEL_MAX = 24;
export const DEFAULT_LAUNCHER_LABEL = 'Chat with us';
/** The web folds the label back to the round button at this width and under. */
export const LABEL_MIN_WIDTH = 480;

export interface LauncherCorners {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

export interface ResolvedLauncher {
  position: 'left' | 'right';
  /** The button's height (and width, except for tab, peek and the label pill). */
  size: number;
  /** Width of the button: the size, or the tab's narrower width. */
  width: number;
  /** Distance from the bottom and from the screen side (0 for tab and peek). */
  bottom: number;
  side: number;
  /** Peek: how far the tab is tucked off screen. */
  tucked: number;
  shape: LauncherShape;
  corners: LauncherCorners;
  /** A solid colour, or the two stops of a left-to-right gradient. */
  background: { type: 'solid'; color: string } | { type: 'gradient'; colors: [string, string] };
  /** The launcher's own colour as one solid (a gradient's first stop). */
  solid: string;
  /** Icon ink: dark on a light launcher, else white. */
  ink: string;
  /** The soft glow round the button: the header colour. */
  glow: string;
  /** The style drawn: an uploaded image or a missing avatar fall back to the icon. */
  style: LauncherStyle;
  label: string;
  avatar: string | null;
  /**
   * The "mascot" style (launcherStyle.ts): the owner's mascot, its bust at
   * `scale`% of the button, centred and lifted 6% so its ears and hat peek
   * over the rim, in `accent` (widgetIconBgColor, else the header's), on a
   * soft light button (`glow`: a radial white to the launcher colour at 14%
   * from 35% 30%). Open, the button is the brand colour with its cross.
   */
  mascot: { look: MascotLook; scale: number; accent: string; light: string };
  imageUrl: string | null;
  iconId: string | null;
  /** Icon size inside the button (the glyph). */
  glyph: number;
  animation: LauncherAnimation;
  /** How it arrives (core/launcherEntrance), its "look here" loop (core/launcherAttention) and the idle call (core/launcherIdleCall): classic / off by default. */
  entrance: LauncherEntrance;
  attention: LauncherAttention;
  idleCall: LauncherIdleCall;
  idleCallDelay: number;
  idleCallText: string;
  /** The greeting next to the button, when the owner turned it on. */
  ctaText: string | null;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown): number | null => {
  if (v === undefined || v === null || typeof v === 'boolean') return null;
  if (typeof v === 'string' && !v.trim()) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
/** A number in [min, max] (clamped, rounded), or null when unset / junk (ownerLayout ownerRange). */
const range = (v: unknown, min: number, max: number): number | null => {
  const n = num(v);
  return n === null ? null : Math.min(max, Math.max(min, Math.round(n)));
};

const rgbOf = (value: unknown): [number, number, number] | null => {
  const v = str(value).toLowerCase();
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (m) {
    const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(v);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};
const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const luminance = ([r, g, b]: [number, number, number]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

/** The shape: unset is the speech bubble, unless the owner rounded the button (a radius under 50) themselves. */
export const normalizeLauncherShape = (value: unknown, radius?: unknown): LauncherShape => {
  if (LAUNCHER_SHAPES.includes(value as LauncherShape)) return value as LauncherShape;
  const r = num(radius);
  return r !== null && r < 50 ? 'circle' : 'bubble';
};

export const normalizeLauncherLabel = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, LAUNCHER_LABEL_MAX) : '';

export function resolveLauncher(raw: Record<string, any> | null | undefined, screenWidth = 0): ResolvedLauncher {
  const c = raw || {};
  const position: 'left' | 'right' = c.widgetPosition === 'left' ? 'left' : 'right';
  // Phones: the owner's phone size and offsets, else the launcher's size at 16px from the edges.
  const size = range(c.mobileWidgetSize, 36, 80) ?? (num(c.widgetSize) && num(c.widgetSize)! > 0 ? num(c.widgetSize)! : 50);
  const bottom = range(c.mobileOffsetBottom, 0, 400) ?? 16;
  const sideOffset = range(c.mobileOffsetSide, 0, 400) ?? 16;
  const shape = normalizeLauncherShape(c.launcherShape, c.widgetBorderRadius);

  const gradient = c.widgetIconThemeType === 'Gradient' && !!str(c.widgetGradientBgOne) && !!str(c.widgetGradientBgTwo);
  const solidRaw = gradient ? c.widgetGradientBgOne : c.widgetIconBgColor;
  const solid = rgbOf(solidRaw) ? str(solidRaw) : str(c.headerBgColor) || '#1b55f3';
  const rgb = rgbOf(solid);
  const ink = rgb && luminance(rgb) > 0.6 ? '#111827' : '#ffffff';

  const imageUrl = c.widgetIconType === 'Image' && str(c.widgetIconImage) ? str(c.widgetIconImage) : null;
  const avatar = str(c.avatar) || str(c.logo) || null;
  let style: LauncherStyle = LAUNCHER_STYLES.includes(c.launcherStyle) ? c.launcherStyle : 'icon';
  if (imageUrl || (style === 'avatar' && !avatar)) style = 'icon';
  // The label folds back to the round button on phones, as on the web.
  if (style === 'label' && !(screenWidth > LABEL_MIN_WIDTH)) style = 'icon';

  const half = Math.round(size / 2);
  let corners: LauncherCorners;
  let width = size;
  let side = sideOffset;
  let tucked = 0;
  if (shape === 'squircle') {
    corners = { topLeft: Math.round(size * 0.3), topRight: Math.round(size * 0.3), bottomRight: Math.round(size * 0.3), bottomLeft: Math.round(size * 0.3) };
  } else if (shape === 'bubble') {
    // The corner nearest the screen corner pinched into a tail.
    const tail = Math.max(4, Math.round(size * 0.12));
    corners = position === 'left'
      ? { topLeft: half, topRight: half, bottomRight: half, bottomLeft: tail }
      : { topLeft: half, topRight: half, bottomRight: tail, bottomLeft: half };
  } else if (shape === 'tab' || shape === 'peek') {
    // Flush to the screen edge, rounded on its inner side.
    width = Math.round(size * 0.82);
    side = 0;
    const round = Math.round(size * 0.3);
    corners = position === 'left'
      ? { topLeft: 0, topRight: round, bottomRight: round, bottomLeft: 0 }
      : { topLeft: round, topRight: 0, bottomRight: 0, bottomLeft: round };
    if (shape === 'peek') tucked = Math.round(width * 0.42);
  } else {
    // The round button: the owner's corner radius, capped at half the size.
    const r = num(c.widgetBorderRadius);
    const radius = r === null ? half : Math.min(half, Math.max(0, r));
    corners = { topLeft: radius, topRight: radius, bottomRight: radius, bottomLeft: radius };
  }

  const iconId = str(c.widgetIconSVG) || null;
  // Only when the owner turned the greeting on (templates/shared.ts: no chatIconCta, no bubble).
  const ctaText = c.chatIconCta === true ? str(c.chatIconCtaText) || null : null;

  return {
    position,
    size,
    width,
    bottom,
    side,
    tucked,
    shape,
    corners,
    background: gradient
      ? { type: 'gradient', colors: [str(c.widgetGradientBgOne), str(c.widgetGradientBgTwo)] }
      : { type: 'solid', color: solid },
    solid,
    ink,
    glow: str(c.headerBgColor) || solid,
    style,
    label: normalizeLauncherLabel(c.launcherLabel) || DEFAULT_LAUNCHER_LABEL,
    avatar,
    mascot: {
      look: mascotLookOf(c),
      scale: mascotScaleOf(c),
      accent: str(c.widgetIconBgColor) || str(c.headerBgColor) || '#4f46e5',
      light: mixColor(solid, 14, '#ffffff'),
    },
    imageUrl,
    iconId,
    // The icon at 70% of the round button (css/liveChat/index.css), 50% of a tab.
    glyph: Math.round(size * (shape === 'tab' || shape === 'peek' ? 0.5 : 0.7)),
    animation: c.launcherAnimation === 'lively' || c.launcherAnimation === 'off' ? c.launcherAnimation : 'subtle',
    entrance: normalizeLauncherEntrance(c.launcherEntrance),
    attention: normalizeLauncherAttention(c.launcherAttention),
    idleCall: normalizeLauncherIdleCall(c.launcherIdleCall),
    idleCallDelay: normalizeIdleCallDelay(c.launcherIdleCallDelay),
    idleCallText: idleCallLine(normalizeLauncherIdleCall(c.launcherIdleCall), c.launcherIdleCallText),
    ctaText,
  };
}
