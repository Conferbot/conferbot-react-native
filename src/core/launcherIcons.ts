/**
 * The launcher icon as SVG markup, drawn as the web widget draws it
 * (svg/WidgetIconBubble.ts getWidgetBubbleIconSVG): the icon in the
 * launcher's ink, its cut-outs in the launcher's own colour, at rest (the
 * motion moments come separately). Pure.
 */
import { LAUNCHER_ICONS } from './launcherIcons.data';
import type { IconPaint, LauncherIconData } from './launcherIcons.data';

/** The icon a bot without one (or with an unknown id) draws, as on the web. */
export const DEFAULT_LAUNCHER_ICON = 'WidgetBubbleIcon40';

const BY_ID = new Map(LAUNCHER_ICONS.map((i) => [i.id, i]));

export const launcherIconById = (id?: string | null): LauncherIconData =>
  (id && BY_ID.get(id)) || (BY_ID.get(DEFAULT_LAUNCHER_ICON) as LauncherIconData);

const escapeAttr = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/** The icon's markup for a 24x24 viewBox, in `ink` with cut-outs in `bg`. */
export function launcherIconSvg(id: string | null | undefined, ink: string, bg: string, size = 24): string {
  const icon = launcherIconById(id);
  const color = (p: { c?: string }) => escapeAttr(p.c === 'ink' ? ink : p.c === 'bg' ? bg : p.c || '#000000');
  let defs = '';
  icon.grads.forEach((g, i) => {
    const stops = g.stops.map((s) => `<stop offset="${s.o}" stop-color="${color(s)}" stop-opacity="${s.a}"/>`).join('');
    defs += g.t === 'l'
      ? `<linearGradient id="g${i}" x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}">${stops}</linearGradient>`
      : `<radialGradient id="g${i}" cx="${g.cx}" cy="${g.cy}" r="${g.r}">${stops}</radialGradient>`;
  });
  const paint = (p: IconPaint) => (p.g !== undefined ? `url(#g${p.g})` : color(p));
  let body = '';
  icon.ops.forEach((o, i) => {
    if (o.op === 0) return; // parts that only show while animating
    let clip = '';
    if (o.clip) {
      defs += `<clipPath id="c${i}"><path d="${o.clip}"/></clipPath>`;
      clip = ` clip-path="url(#c${i})"`;
    }
    body +=
      `<path d="${o.d}"` +
      (o.m ? ` transform="matrix(${o.m.join(' ')})"` : '') +
      ` fill="${o.fill ? paint(o.fill) : 'none'}"` +
      (o.fill && o.fill.a !== 1 ? ` fill-opacity="${o.fill.a}"` : '') +
      (o.stroke
        ? ` stroke="${paint(o.stroke)}" stroke-width="${o.sw ?? 1}"` +
          (o.stroke.a !== 1 ? ` stroke-opacity="${o.stroke.a}"` : '') +
          (o.cap ? ` stroke-linecap="${o.cap}"` : '') +
          (o.join ? ` stroke-linejoin="${o.join}"` : '')
        : '') +
      (o.op !== undefined ? ` opacity="${o.op}"` : '') +
      (o.rule ? ' fill-rule="evenodd"' : '') +
      (o.strokeFirst ? ' paint-order="stroke"' : '') +
      clip +
      '/>';
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}"><defs>${defs}</defs>${body}</svg>`;
}
