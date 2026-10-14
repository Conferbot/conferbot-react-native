/**
 * The chat background as the web widget draws it (conferbot-widget
 * ts/chatBackground/chatBackground.ts): solid, gradient (linear, radial,
 * mesh, blur), image with an optional mask, or one of 13 pattern tiles.
 * Pure: resolveChatBackground() reads the settings, backgroundSvg() turns
 * gradients and patterns into SVG markup for react-native-svg.
 */

export const PATTERN_IDS = ['dots', 'grid', 'diagonal', 'waves', 'topography', 'confetti', 'doodles', 'paper', 'hexagons', 'rings', 'plus', 'zigzag', 'sparkles'] as const;
export type PatternId = (typeof PATTERN_IDS)[number];
export type GradientStyle = 'linear' | 'radial' | 'mesh' | 'blur';

export interface PatternShape {
  t: 'path' | 'circle' | 'rect';
  mode: 'fill' | 'stroke';
  sw?: number;
  d?: string;
  cx?: number;
  cy?: number;
  r?: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  rx?: number;
  rot?: [number, number, number];
}

/** The web's tiles as shapes (generated from chatBackground.ts PATTERNS). */
export const PATTERNS: Record<PatternId, { w: number; h: number; noise?: boolean; shapes: PatternShape[] }> = {"dots":{"w":18,"h":18,"shapes":[{"t":"circle","mode":"fill","cx":9,"cy":9,"r":1.6}]},"grid":{"w":24,"h":24,"shapes":[{"t":"path","mode":"stroke","sw":1,"d":"M24 .5H.5V24"}]},"diagonal":{"w":14,"h":14,"shapes":[{"t":"path","mode":"stroke","sw":1,"d":"M-3.5 3.5l7-7M0 14L14 0M10.5 17.5l7-7"}]},"waves":{"w":40,"h":16,"shapes":[{"t":"path","mode":"stroke","sw":1.2,"d":"M0 8q5-6 10 0t10 0 10 0 10 0"}]},"topography":{"w":220,"h":220,"shapes":[{"t":"path","mode":"stroke","sw":1,"d":"M60 40c30-18 72-10 84 18s-8 58-40 64-70-6-74-36 6-32 30-46z"},{"t":"path","mode":"stroke","sw":1,"d":"M70 58c20-10 48-4 56 14s-6 38-28 40-46-4-48-24 4-20 20-30z"},{"t":"path","mode":"stroke","sw":1,"d":"M84 74c10-4 24 0 26 8s-4 16-14 16-20-2-20-10 2-10 8-14z"},{"t":"path","mode":"stroke","sw":1,"d":"M150 150c26-6 58 6 62 30s-22 40-52 38-50-14-48-36 12-26 38-32z"},{"t":"path","mode":"stroke","sw":1,"d":"M158 166c16-2 34 4 36 18s-14 24-30 22-30-8-28-20 8-18 22-20z"},{"t":"path","mode":"stroke","sw":1,"d":"M-10 170c20-14 50-10 58 8s-8 40-32 44"},{"t":"path","mode":"stroke","sw":1,"d":"M210 30c-6 20-2 44 16 52"},{"t":"path","mode":"stroke","sw":1,"d":"M0 110c30 6 44 30 36 60M220 110c-30-4-50 10-56 34"}]},"confetti":{"w":90,"h":90,"shapes":[{"t":"rect","mode":"fill","x":10,"y":12,"w":7,"h":3,"rx":1.5,"rot":[30,13,13]},{"t":"rect","mode":"fill","x":58,"y":8,"w":7,"h":3,"rx":1.5,"rot":[-40,61,9]},{"t":"rect","mode":"fill","x":40,"y":52,"w":7,"h":3,"rx":1.5,"rot":[70,43,53]},{"t":"rect","mode":"fill","x":72,"y":66,"w":7,"h":3,"rx":1.5,"rot":[10,75,67]},{"t":"circle","mode":"fill","cx":34,"cy":26,"r":2.2},{"t":"circle","mode":"fill","cx":80,"cy":34,"r":1.6},{"t":"circle","mode":"fill","cx":16,"cy":70,"r":2},{"t":"circle","mode":"fill","cx":56,"cy":82,"r":1.4},{"t":"path","mode":"fill","d":"M24 44l3 5h-6z"},{"t":"path","mode":"fill","d":"M68 44l3 5h-6z","rot":[40,68,46]}]},"doodles":{"w":128,"h":128,"shapes":[{"t":"path","mode":"stroke","sw":1.4,"d":"M14 14h26a5 5 0 0 1 5 5v12a5 5 0 0 1-5 5H26l-7 6v-6h-5a5 5 0 0 1-5-5V19a5 5 0 0 1 5-5z"},{"t":"path","mode":"stroke","sw":1.4,"d":"M19 23h16M19 28h10"},{"t":"path","mode":"stroke","sw":1.4,"d":"M92 26c-3-5-11-4-11 3 0 6 11 12 11 12s11-6 11-12c0-7-8-8-11-3z"},{"t":"path","mode":"stroke","sw":1.4,"d":"M30 78l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"},{"t":"circle","mode":"stroke","sw":1.4,"cx":96,"cy":92,"r":11},{"t":"path","mode":"stroke","sw":1.4,"d":"M91 95q5 5 10 0"},{"t":"path","mode":"stroke","sw":1.4,"d":"M92 88v1M100 88v1"},{"t":"path","mode":"stroke","sw":1.4,"d":"M58 60l20-8-6 20-5-7zM67 65l11-13"},{"t":"path","mode":"stroke","sw":1.4,"d":"M60 110h.01M112 60h.01M8 58h.01M70 12h.01"}]},"paper":{"w":180,"h":180,"noise":true,"shapes":[]},"hexagons":{"w":24,"h":42,"shapes":[{"t":"path","mode":"stroke","sw":1,"d":"M12 0l12 7v14l-12 7-12-7V7zM12 28v14"}]},"rings":{"w":36,"h":36,"shapes":[{"t":"circle","mode":"stroke","sw":1.1,"cx":18,"cy":18,"r":9}]},"plus":{"w":26,"h":26,"shapes":[{"t":"path","mode":"stroke","sw":1.4,"d":"M13 9v8M9 13h8"}]},"zigzag":{"w":24,"h":14,"shapes":[{"t":"path","mode":"stroke","sw":1.2,"d":"M0 10l6-6 6 6 6-6 6 6"}]},"sparkles":{"w":72,"h":72,"shapes":[{"t":"path","mode":"fill","d":"M18 8c1 6 3 8 9 9-6 1-8 3-9 9-1-6-3-8-9-9 6-1 8-3 9-9z"},{"t":"path","mode":"fill","d":"M54 42c.7 4 2 5.3 6 6-4 .7-5.3 2-6 6-.7-4-2-5.3-6-6 4-.7 5.3-2 6-6z"},{"t":"circle","mode":"fill","cx":52,"cy":14,"r":1.4},{"t":"circle","mode":"fill","cx":16,"cy":56,"r":1.6}]}} as any;

export type ChatBackground =
  | { type: 'solid'; color: string }
  | { type: 'gradient'; color: string; stops: string[]; angle: number; style: GradientStyle }
  | { type: 'image'; color: string; url: string; mask: { color: string; alpha: number } | null }
  | { type: 'pattern'; color: string; pattern: PatternId; ink: string; alpha: number };

const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%/]+\)|hsla?\([\d\s.,%/a-z]+\)|[a-z]{3,20})$/i;

/** A colour we can use, else the fallback (as the web's safeColor). */
export const safeColor = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  const v = value.trim();
  return v && COLOR_RE.test(v) && !/url|expression/i.test(v) ? v : fallback;
};

const clampNum = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

/** The gradient's colours: the saved stops (2-4), else the legacy two. */
export const gradientStops = (c: Record<string, any>): string[] => {
  const raw = Array.isArray(c?.chatBgGradientStops) ? c.chatBgGradientStops : [];
  const stops = raw.map((s: unknown) => safeColor(s, '')).filter(Boolean).slice(0, 4);
  if (stops.length >= 2) return stops;
  return [safeColor(c?.gradientBgOne, '#fffcf1'), safeColor(c?.gradientBgTwo, '#1b55f3')];
};

export function resolveChatBackground(raw: Record<string, any> | null | undefined): ChatBackground {
  const c = raw || {};
  const type = String(c.chatBgType || 'solid').toLowerCase();
  const color = safeColor(c.chatBgColor, '#ffffff');
  if (type === 'gradient') {
    const styles: GradientStyle[] = ['linear', 'radial', 'mesh', 'blur'];
    return {
      type: 'gradient',
      color,
      stops: gradientStops(c),
      angle: Math.round(clampNum(c.chatBgGradientAngle, 0, 360, 180)),
      style: styles.includes(c.chatBgGradientStyle) ? c.chatBgGradientStyle : 'linear',
    };
  }
  if (type === 'pattern') {
    const id = (PATTERN_IDS as readonly string[]).includes(c.chatBgPattern) ? (c.chatBgPattern as PatternId) : 'dots';
    return { type: 'pattern', color, pattern: id, ink: safeColor(c.chatBgPatternColor, '#0f172a'), alpha: clampNum(c.chatBgPatternOpacity, 0, 100, 12) / 100 };
  }
  if (type === 'image') {
    const src = c.chatBgImage ?? c.chatBgImg;
    const url = typeof src === 'string' ? src.trim() : '';
    if (!url || /^\s*javascript:/i.test(url)) return { type: 'solid', color };
    const alpha = clampNum(c.chatBgMaskOpacity, 0, 90, 0) / 100;
    return { type: 'image', color, url, mask: alpha > 0 ? { color: safeColor(c.chatBgMaskColor, '#000000'), alpha } : null };
  }
  return { type: 'solid', color };
}

/** A point on the rim at deg (0 = top, clockwise), as a fraction of the box. */
export const rimPoint = (deg: number, reach = 50): [number, number] => {
  const r = ((deg - 90) * Math.PI) / 180;
  return [Math.round(50 + reach * Math.cos(r)) / 100, Math.round(50 + reach * Math.sin(r)) / 100];
};

const esc = (s: string) => s.replace(/[<>&"]/g, '');

const shapeSvg = (s: PatternShape, ink: string, alpha: number): string => {
  const paint = s.mode === 'fill'
    ? `fill="${ink}" fill-opacity="${alpha}"`
    : `fill="none" stroke="${ink}" stroke-opacity="${alpha}" stroke-width="${s.sw ?? 1.2}" stroke-linecap="round" stroke-linejoin="round"`;
  const rot = s.rot ? ` transform="rotate(${s.rot[0]} ${s.rot[1]} ${s.rot[2]})"` : '';
  if (s.t === 'circle') return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" ${paint}${rot}/>`;
  if (s.t === 'rect') return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.rx}" ${paint}${rot}/>`;
  return `<path d="${s.d}" ${paint}${rot}/>`;
};

/** Seeded speckles for the paper tile (the web uses an SVG noise filter). */
export const paperSpeckles = (count = 260): Array<{ x: number; y: number; r: number; a: number }> => {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const out = [];
  for (let i = 0; i < count; i++) out.push({ x: rand() * 180, y: rand() * 180, r: 0.4 + rand() * 0.7, a: 0.3 + rand() * 0.7 });
  return out;
};

/**
 * Gradients and patterns as an SVG document filling width x height
 * (react-native-svg SvgXml markup). Solid and image backgrounds draw natively.
 */
export function backgroundSvg(bg: ChatBackground, width: number, height: number): string | null {
  const open = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  if (bg.type === 'pattern') {
    const tile = PATTERNS[bg.pattern];
    const ink = esc(bg.ink);
    const body = tile.noise
      ? paperSpeckles().map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.r.toFixed(2)}" fill="${ink}" fill-opacity="${Math.min(1, bg.alpha * 1.6 * p.a).toFixed(3)}"/>`).join('')
      : tile.shapes.map((s) => shapeSvg(s, ink, bg.alpha)).join('');
    return `${open}<defs><pattern id="p" patternUnits="userSpaceOnUse" width="${tile.w}" height="${tile.h}">${body}</pattern></defs>` +
      `<rect width="${width}" height="${height}" fill="${esc(bg.color)}"/><rect width="${width}" height="${height}" fill="url(#p)"/></svg>`;
  }
  if (bg.type !== 'gradient') return null;
  const stops = bg.stops.map(esc);
  const offsets = stops.map((s, i) => `<stop offset="${stops.length > 1 ? i / (stops.length - 1) : 0}" stop-color="${s}"/>`).join('');
  if (bg.style === 'radial') {
    const [x, y] = rimPoint(bg.angle, 35);
    const far = Math.max(Math.hypot(x, y), Math.hypot(1 - x, y), Math.hypot(x, 1 - y), Math.hypot(1 - x, 1 - y));
    return `${open}<defs><radialGradient id="g" cx="${x * width}" cy="${y * height}" r="${far * Math.max(width, height)}" gradientUnits="userSpaceOnUse">${offsets}</radialGradient></defs>` +
      `<rect width="${width}" height="${height}" fill="url(#g)"/></svg>`;
  }
  if (bg.style === 'mesh' || bg.style === 'blur') {
    // Soft colour fields over a base: the web's mesh (and, approximately, its blur).
    const mesh = bg.style === 'mesh';
    const base = mesh ? stops[stops.length - 1] : stops[0];
    const colours = mesh ? stops : stops.slice(1).length ? stops.slice(1) : [stops[0]];
    const fields = colours.map((s, i) => {
      const [x, y] = rimPoint(bg.angle + (i * 360) / colours.length + (mesh ? 0 : 20), mesh ? 50 : 34);
      return { id: `f${i}`, s, cx: x * width, cy: y * height, r: (mesh ? 0.6 : 0.75) * Math.max(width, height) };
    });
    const defs = fields.map((f) => `<radialGradient id="${f.id}" cx="${f.cx}" cy="${f.cy}" r="${f.r}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${f.s}" stop-opacity="1"/><stop offset="1" stop-color="${f.s}" stop-opacity="0"/></radialGradient>`).join('');
    return `${open}<defs>${defs}</defs><rect width="${width}" height="${height}" fill="${base}"/>` +
      fields.map((f) => `<rect width="${width}" height="${height}" fill="url(#${f.id})"/>`).join('') + '</svg>';
  }
  // Linear: the CSS angle (0 = to top, 180 = to bottom) across the box.
  const a = (bg.angle * Math.PI) / 180;
  const dx = Math.sin(a) / 2;
  const dy = -Math.cos(a) / 2;
  const f = (n: number) => Math.round(n * 10000) / 10000;
  return `${open}<defs><linearGradient id="g" x1="${f(0.5 - dx)}" y1="${f(0.5 - dy)}" x2="${f(0.5 + dx)}" y2="${f(0.5 + dy)}">${offsets}</linearGradient></defs>` +
    `<rect width="${width}" height="${height}" fill="url(#g)"/></svg>`;
}
