/**
 * The paints the launcher effects use on the web (CSS radial / linear /
 * conic gradients, as in conferbot-widget src/ts/launcher/entrance.ts and
 * attention.ts), drawn as SVG markup for react-native-svg; and a motion
 * path (CSS offset-path) as points along it. Pure.
 */

type RGBA = [number, number, number, number];

/** A CSS colour: #rgb, #rrggbb, rgb(), rgba(), "transparent" (null: unknown). */
export const parseColor = (c: string): RGBA | null => {
  const s = c.trim().toLowerCase();
  if (s === 'transparent') return [0, 0, 0, 0];
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s);
  if (m) {
    const h = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/.exec(s);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
  return null;
};

export interface Stop {
  color: string;
  /** 0..1; missing positions are spread evenly, as CSS does. */
  at?: number;
}

/** "rgba(1,2,3,.5) 30%" pieces, as a CSS gradient lists them. */
export const stops = (...list: (string | [string, number])[]): Stop[] =>
  list.map((x) => (Array.isArray(x) ? { color: x[0], at: x[1] / 100 } : { color: x }));

const spread = (list: Stop[]): { c: RGBA; at: number }[] => {
  const out = list.map((s) => ({ c: parseColor(s.color) || [0, 0, 0, 0], at: s.at as number | undefined }));
  if (out[0].at === undefined) out[0].at = 0;
  if (out[out.length - 1].at === undefined) out[out.length - 1].at = 1;
  for (let i = 1; i < out.length - 1; i++) {
    if (out[i].at !== undefined) continue;
    let j = i;
    while (out[j].at === undefined) j++;
    const a = out[i - 1].at as number;
    const b = out[j].at as number;
    for (let k = i; k < j; k++) out[k].at = a + ((b - a) * (k - i + 1)) / (j - i + 1);
  }
  // A fully transparent stop fades its neighbour's colour (CSS interpolates
  // premultiplied; SVG does not, so the colour is borrowed).
  return out.map((s, i) => {
    if (s.c[3] > 0) return { c: s.c, at: s.at as number };
    const near = out[i - 1] && out[i - 1].c[3] > 0 ? out[i - 1] : out[i + 1] && out[i + 1].c[3] > 0 ? out[i + 1] : out[i - 1] || out[i + 1];
    const n = near ? near.c : s.c;
    return { c: [n[0], n[1], n[2], s.c[3]] as RGBA, at: s.at as number };
  });
};

const stopTags = (list: Stop[]): string =>
  spread(list)
    .map((s) => `<stop offset="${+s.at.toFixed(4)}" stop-color="rgb(${Math.round(s.c[0])},${Math.round(s.c[1])},${Math.round(s.c[2])})" stop-opacity="${+s.c[3].toFixed(3)}"/>`)
    .join('');

const svg = (w: number, h: number, inner: string, vb = `0 0 ${+w.toFixed(2)} ${+h.toFixed(2)}`) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${+w.toFixed(2)}" height="${+h.toFixed(2)}" viewBox="${vb}">${inner}</svg>`;

/** radial-gradient(closest-side, ...) filling an ellipse in a w x h box. */
export const radialDisc = (w: number, h: number, list: Stop[]): string =>
  svg(w, h, `<defs><radialGradient id="g" cx="0.5" cy="0.5" r="0.5">${stopTags(list)}</radialGradient></defs><ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" fill="url(#g)"/>`);

/**
 * radial-gradient(ellipse rx ry at cx cy, ...) over a w x h box (a page
 * wash): the ellipse's radii in px.
 */
export const radialWash = (w: number, h: number, cx: number, cy: number, rx: number, ry: number, list: Stop[]): string =>
  svg(
    w,
    h,
    `<defs><radialGradient id="g" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${rx}" gradientTransform="translate(${cx} ${cy}) scale(1 ${ry / rx}) translate(${-cx} ${-cy})">${stopTags(list)}</radialGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/>`
  );

/** linear-gradient(<angle>, ...) in a w x h box with rounded corners (CSS angles: 180deg = to bottom). */
export const linearBox = (w: number, h: number, angle: number, list: Stop[], radius: number | [number, number, number, number] = 0): string => {
  const a = (angle * Math.PI) / 180;
  // The CSS gradient line: through the centre, long enough that the corners get the end colours.
  const len = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a));
  const dx = (Math.sin(a) * len) / 2;
  const dy = (-Math.cos(a) * len) / 2;
  const [tl, tr, br, bl] = Array.isArray(radius) ? radius : [radius, radius, radius, radius];
  const shape =
    tl || tr || br || bl
      ? `<path d="M${tl} 0 H${w - tr} A${tr} ${tr} 0 0 1 ${w} ${tr} V${h - br} A${br} ${br} 0 0 1 ${w - br} ${h} H${bl} A${bl} ${bl} 0 0 1 0 ${h - bl} V${tl} A${tl} ${tl} 0 0 1 ${tl} 0 Z" fill="url(#g)"/>`
      : `<rect width="${w}" height="${h}" fill="url(#g)"/>`;
  return svg(
    w,
    h,
    `<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="${w / 2 - dx}" y1="${h / 2 - dy}" x2="${w / 2 + dx}" y2="${h / 2 + dy}">${stopTags(list)}</linearGradient></defs>${shape}`
  );
};

const mixAt = (list: { c: RGBA; at: number }[], p: number): RGBA => {
  if (p <= list[0].at) return list[0].c;
  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i];
    const b = list[i + 1];
    if (p <= b.at) {
      const f = b.at > a.at ? (p - a.at) / (b.at - a.at) : 1;
      // Premultiplied, as CSS gradients interpolate.
      const al = a.c[3] + (b.c[3] - a.c[3]) * f;
      const ch = (k: number) => (al > 0 ? (a.c[k] * a.c[3] + (b.c[k] * b.c[3] - a.c[k] * a.c[3]) * f) / al : 0);
      return [ch(0), ch(1), ch(2), al];
    }
  }
  return list[list.length - 1].c;
};

/**
 * conic-gradient(from <from>deg, ...) in a circle of diameter d, as thin
 * wedges; `ring` keeps only the band between two shares of the radius
 * (the portal's ring mask).
 */
export const conicDisc = (d: number, from: number, list: Stop[], ring?: [number, number], slices = 48): string => {
  const s = spread(list);
  const r = d / 2;
  const [ri, ro] = ring ? [ring[0] * r, ring[1] * r] : [0, r];
  let out = '';
  for (let i = 0; i < slices; i++) {
    const p = (i + 0.5) / slices;
    const c = mixAt(s, p);
    if (c[3] <= 0.003) continue;
    // CSS: 0deg points up, clockwise.
    const a0 = ((from + (i / slices) * 360 - 90) * Math.PI) / 180;
    const a1 = ((from + ((i + 1.04) / slices) * 360 - 90) * Math.PI) / 180;
    const pt = (rad: number, a: number) => `${+(r + rad * Math.cos(a)).toFixed(2)} ${+(r + rad * Math.sin(a)).toFixed(2)}`;
    const path = ri > 0 ? `M${pt(ro, a0)} A${ro} ${ro} 0 0 1 ${pt(ro, a1)} L${pt(ri, a1)} A${ri} ${ri} 0 0 0 ${pt(ri, a0)} Z` : `M${r} ${r} L${pt(ro, a0)} A${ro} ${ro} 0 0 1 ${pt(ro, a1)} Z`;
    out += `<path d="${path}" fill="rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})" fill-opacity="${+c[3].toFixed(3)}"/>`;
  }
  return svg(d, d, out);
};

// ---- A motion path (offset-path: path("M ... C ... a ...")) ----

type Pt = [number, number];

/** The path flattened to points (M, L, C and a / A arcs, absolute or relative). */
export const flattenPath = (d: string, steps = 24): Pt[] => {
  const tok = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
  const pts: Pt[] = [];
  let i = 0;
  let cur: Pt = [0, 0];
  let cmd = '';
  const n = () => parseFloat(tok[i++]);
  while (i < tok.length) {
    if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (C === 'M' || C === 'L') {
      const x = n() + (rel ? cur[0] : 0);
      const y = n() + (rel ? cur[1] : 0);
      cur = [x, y];
      pts.push(cur);
      if (C === 'M') cmd = rel ? 'l' : 'L';
    } else if (C === 'C') {
      const o = rel ? cur : [0, 0];
      const p1: Pt = [n() + o[0], n() + o[1]];
      const p2: Pt = [n() + o[0], n() + o[1]];
      const p3: Pt = [n() + o[0], n() + o[1]];
      const p0 = cur;
      for (let k = 1; k <= steps; k++) {
        const t = k / steps;
        const u = 1 - t;
        pts.push([
          u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
          u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
        ]);
      }
      cur = p3;
    } else if (C === 'A') {
      let rx = Math.abs(n());
      let ry = Math.abs(n());
      const phi = (n() * Math.PI) / 180;
      const large = n() !== 0;
      const sweep = n() !== 0;
      const x2 = n() + (rel ? cur[0] : 0);
      const y2 = n() + (rel ? cur[1] : 0);
      const [x1, y1] = cur;
      // Endpoint to centre parameterisation (SVG implementation notes F.6.5).
      const cp = Math.cos(phi);
      const sp = Math.sin(phi);
      const dx = (x1 - x2) / 2;
      const dy = (y1 - y2) / 2;
      const x1p = cp * dx + sp * dy;
      const y1p = -sp * dx + cp * dy;
      const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
      if (lam > 1) {
        rx *= Math.sqrt(lam);
        ry *= Math.sqrt(lam);
      }
      const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
      const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
      let co = Math.sqrt(Math.max(0, num / den));
      if (large === sweep) co = -co;
      const cxp = (co * rx * y1p) / ry;
      const cyp = (-co * ry * x1p) / rx;
      const cx = cp * cxp - sp * cyp + (x1 + x2) / 2;
      const cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
      const ang = (ux: number, uy: number, vx: number, vy: number) => {
        const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
        return a;
      };
      const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
      let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
      if (!sweep && dt > 0) dt -= 2 * Math.PI;
      if (sweep && dt < 0) dt += 2 * Math.PI;
      const k = Math.max(steps, Math.ceil((Math.abs(dt) / (2 * Math.PI)) * steps * 3));
      for (let j = 1; j <= k; j++) {
        const t = t1 + (dt * j) / k;
        pts.push([cx + rx * Math.cos(t) * cp - ry * Math.sin(t) * sp, cy + rx * Math.cos(t) * sp + ry * Math.sin(t) * cp]);
      }
      cur = [x2, y2];
    } else {
      i++;
    }
  }
  return pts;
};

/** A point at a share (0..1) of a flattened path's length, and the path's direction there (deg). */
export const pointAlong = (pts: Pt[], share: number): { x: number; y: number; angle: number } => {
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    seg.push(l);
    total += l;
  }
  let d = Math.min(1, Math.max(0, share)) * total;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const f = seg[i] > 0 ? Math.min(1, d / seg[i]) : 0;
      const a = pts[i];
      const b = pts[i + 1];
      return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, angle: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI };
    }
    d -= seg[i];
  }
  const last = pts[pts.length - 1] || [0, 0];
  return { x: last[0], y: last[1], angle: 0 };
};
