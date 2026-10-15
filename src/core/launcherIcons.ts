/**
 * The launcher icon as SVG markup, drawn as the web widget draws it
 * (svg/WidgetIconBubble.ts getWidgetBubbleIconSVG): the icon in the
 * launcher's ink, its cut-outs in the launcher's own colour, at rest (the
 * motion moments come separately). Pure.
 */
import { LAUNCHER_ICONS } from './launcherIcons.data';
import type { IconPaint, LauncherIconData } from './launcherIcons.data';
import type { OpFrame } from './launcherMotion';

/** The icon a bot without one (or with an unknown id) draws, as on the web. */
export const DEFAULT_LAUNCHER_ICON = 'WidgetBubbleIcon40';

const BY_ID = new Map(LAUNCHER_ICONS.map((i) => [i.id, i]));

export const launcherIconById = (id?: string | null): LauncherIconData =>
  (id && BY_ID.get(id)) || (BY_ID.get(DEFAULT_LAUNCHER_ICON) as LauncherIconData);

const mul6 = (a: number[], b: number[]) => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];

const invert6 = (m: number[]) => {
  const det = m[0] * m[3] - m[1] * m[2];
  if (!det) return [1, 0, 0, 1, 0, 0];
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
};

const escapeAttr = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/**
 * The icon's markup for a 24x24 viewBox, in `ink` with cut-outs in `bg`;
 * with a motion frame (launcherMotion iconFrame), the moving parts in place.
 */
export function launcherIconSvg(id: string | null | undefined, ink: string, bg: string, size = 24, frame?: (OpFrame | null)[]): string {
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
  // Animated opacity fades a whole group as one layer: <g opacity> round the
  // run of shapes in that group (shapes of a group are consecutive).
  const open: { g: number; o: number }[] = [];
  const sameLayer = (a: { g: number; o: number }, b: { g: number; o: number }) => a.g === b.g;
  icon.ops.forEach((o, i) => {
    const f = frame ? frame[i] : null;
    const layers = (f && f.layers) || [];
    // A layer that is the shape's own element replaces its own opacity.
    const ownGroup = o.self && o.parts && o.parts.length ? o.parts[o.parts.length - 1].g : -1;
    const ownLayer = layers.length && layers[layers.length - 1].g === ownGroup ? layers[layers.length - 1] : null;
    const groupLayers = ownLayer ? layers.slice(0, -1) : layers;
    let keep = 0;
    while (keep < open.length && keep < groupLayers.length && sameLayer(open[keep], groupLayers[keep])) keep++;
    while (open.length > keep) { body += '</g>'; open.pop(); }
    for (let k = keep; k < groupLayers.length; k++) {
      body += `<g opacity="${Math.round(groupLayers[k].o * 1000) / 1000}">`;
      open.push(groupLayers[k]);
    }
    // At rest the shape's opacity is op. Moving, each animated part's opacity
    // replaces that part's own (as a layer above); the rest multiply as before.
    let opacity: number | undefined = o.op;
    if (layers.length) {
      const animated = new Set(layers.map((l) => l.g));
      opacity = o.opRest ?? (o.parts && o.parts.some((p) => p.o !== undefined) ? 1 : o.op ?? 1);
      for (const p of o.parts || []) if (!animated.has(p.g) && p.o !== undefined) opacity *= p.o;
      if (ownLayer) opacity *= ownLayer.o;
      if (opacity === 1) opacity = undefined;
    }
    if (opacity === 0) return; // parts that only show while animating
    const m = f ? f.m : o.m;
    let clip = '';
    if (o.clip) {
      // The clip in its own space: undo the shape's transform, apply the clip's.
      const clipT = f && f.clipM && m ? mul6(invert6(m), f.clipM) : null;
      defs += `<clipPath id="c${i}"><path d="${o.clip}"${clipT ? ` transform="matrix(${clipT.map((n) => Math.round(n * 10000) / 10000).join(' ')})"` : ''}/></clipPath>`;
      clip = ` clip-path="url(#c${i})"`;
    }
    body +=
      `<path d="${o.d}"` +
      (m ? ` transform="matrix(${m.map((n) => Math.round(n * 10000) / 10000).join(' ')})"` : '') +
      ` fill="${o.fill ? paint(o.fill) : 'none'}"` +
      (o.fill && o.fill.a !== 1 ? ` fill-opacity="${o.fill.a}"` : '') +
      (o.stroke
        ? ` stroke="${paint(o.stroke)}" stroke-width="${o.sw ?? 1}"` +
          (o.stroke.a !== 1 ? ` stroke-opacity="${o.stroke.a}"` : '') +
          (o.cap ? ` stroke-linecap="${o.cap}"` : '') +
          (o.join ? ` stroke-linejoin="${o.join}"` : '')
        : '') +
      (opacity !== undefined ? ` opacity="${Math.round(opacity * 1000) / 1000}"` : '') +
      (o.rule ? ' fill-rule="evenodd"' : '') +
      (o.strokeFirst ? ' paint-order="stroke"' : '') +
      clip +
      '/>';
  });
  while (open.length) { body += '</g>'; open.pop(); }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}"><defs>${defs}</defs>${body}</svg>`;
}
