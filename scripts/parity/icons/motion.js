// The folder holding conferbot-widget and sdk/ (override with CONFERBOT_DEV).
const DEV = process.env.CONFERBOT_DEV || require('path').resolve(__dirname, '../../../../..');
// The launcher motion sheet (conferbot-widget src/svg/launcher/motion.ts) as data:
//   keyframes: name -> [{ at: 0..1, tx, ty, sx, sy, r, o }]  (missing = untouched)
//   families:  fam  -> { idle: [rule], msg: [rule], awake?: {...} }
//   rule = { part, kf, dur, delay, iter (-1 = infinite), ease: [x1,y1,x2,y2], fill }
//   origins:   "fam part" -> [fx, fy] (fractions of the part's box; default centre)
// Hover has no counterpart on a phone, so only idle and msg (new message) are kept.
const fs = require('fs');
const src = fs.readFileSync(`${DEV}/conferbot-widget/src/svg/launcher/motion.ts`, 'utf8');
const lines = JSON.parse(src.slice(src.indexOf('/* MOTION:BEGIN */') + 18, src.indexOf('/* MOTION:END */')));

const EASE = { linear: [0, 0, 1, 1], ease: [0.25, 0.1, 0.25, 1], 'ease-in': [0.42, 0, 1, 1], 'ease-out': [0, 0, 0.58, 1], 'ease-in-out': [0.42, 0, 0.58, 1] };
const time = (t) => (t.endsWith('ms') ? parseFloat(t) / 1000 : parseFloat(t));

// --- keyframes ---
const keyframes = {};
const parseTransform = (v, out) => {
  v = v.replace(/var\(--dx\)/g, 'DX').replace(/var\(--dy\)/g, 'DY');
  v.replace(/(translate[XY]?|scale[XY]?|rotate)\(([^)]*)\)/g, (_, fn, args) => {
    const a = args.split(',').map((x) => x.trim());
    const px = (x) => (x === 'DX' ? 'dx' : x === 'DY' ? 'dy' : parseFloat(x));
    if (fn === 'translate') { out.tx = px(a[0]); out.ty = a[1] !== undefined ? px(a[1]) : 0; }
    if (fn === 'translateX') out.tx = px(a[0]);
    if (fn === 'translateY') out.ty = px(a[0]);
    if (fn === 'scale') { out.sx = parseFloat(a[0]); out.sy = a[1] !== undefined ? parseFloat(a[1]) : parseFloat(a[0]); }
    if (fn === 'scaleX') out.sx = parseFloat(a[0]);
    if (fn === 'scaleY') out.sy = parseFloat(a[0]);
    if (fn === 'rotate') out.r = parseFloat(a[0]);
  });
  if (v.trim() === 'none') { out.tx = 0; out.ty = 0; out.sx = 1; out.sy = 1; out.r = 0; }
  // A transform list sets every function it does not name back to identity.
  for (const [k, d] of [['tx', 0], ['ty', 0], ['sx', 1], ['sy', 1], ['r', 0]]) if (out[k] === undefined) out[k] = d;
};
for (const l of lines.filter((x) => x.startsWith('@keyframes'))) {
  const name = /@keyframes\s+([a-z0-9-]+)/.exec(l)[1];
  const body = l.slice(l.indexOf('{') + 1, l.lastIndexOf('}'));
  const frames = [];
  body.replace(/([0-9.%,\sfromto]+)\{([^}]*)\}/g, (_, sel, decl) => {
    const ats = sel.split(',').map((s) => s.trim()).filter(Boolean).map((s) => (s === 'from' ? 0 : s === 'to' ? 1 : parseFloat(s) / 100));
    const f = {};
    decl.split(';').forEach((d) => {
      const i = d.indexOf(':'); if (i < 0) return;
      const k = d.slice(0, i).trim(), v = d.slice(i + 1).trim();
      if (k === 'transform') parseTransform(v, f);
      if (k === 'opacity') f.o = parseFloat(v);
    });
    ats.forEach((at) => frames.push({ at, ...f }));
  });
  frames.sort((a, b) => a.at - b.at);
  keyframes[name] = frames;
}

// --- rules ---
const families = {};
const origins = {};
const delays = {}; // "fam|* part" -> seconds
const overrides = []; // { fam, state, part, prop, value }
const fam = (f) => (families[f] = families[f] || { idle: [], msg: [], awake: [] });
const statesOf = (sel) => {
  if (/\[data-cbl=idle\]/.test(sel)) return ['idle'];
  if (/\[data-cbl=msg\]/.test(sel)) return ['msg'];
  if (/\[data-cbl=hover\]/.test(sel)) return ['hover'];
  if (/:is\(([^)]*)\)/.test(sel)) {
    const inner = /:is\(([^)]*)\)/.exec(sel)[1];
    const out = [];
    if (inner.includes('data-cbl-awake')) out.push('awake');
    if (inner.includes('data-cbl=hover')) out.push('hover');
    if (inner.includes('data-cbl=msg')) out.push('msg');
    return out;
  }
  if (/\[data-cbl\]/.test(sel)) return ['any'];
  return ['rest'];
};
const parseAnimation = (v) => {
  const tokens = v.trim().split(/\s+(?![^(]*\))/);
  const r = { kf: null, dur: 0, delay: 0, iter: 1, ease: EASE.ease, fill: 'none' };
  let timesSeen = 0;
  for (const t of tokens) {
    if (/^cbl-/.test(t)) r.kf = t;
    else if (/^-?[\d.]+m?s$/.test(t)) { if (timesSeen++ === 0) r.dur = time(t); else r.delay = time(t); }
    else if (t === 'infinite') r.iter = -1;
    else if (/^\d+$/.test(t)) r.iter = parseInt(t, 10);
    else if (EASE[t]) r.ease = EASE[t];
    else if (/^cubic-bezier/.test(t)) r.ease = t.slice(13, -1).split(',').map(Number);
    else if (['forwards', 'backwards', 'both', 'none'].includes(t)) r.fill = t;
  }
  return r;
};
for (const l of lines.filter((x) => !x.startsWith('@keyframes'))) {
  const sel = l.slice(0, l.indexOf('{'));
  const decls = l.slice(l.indexOf('{') + 1, l.lastIndexOf('}'));
  for (const one of sel.split(/,(?![^(]*\))/)) {
    const fm = /\.cbl--([a-z]+)/.exec(one);
    const famName = fm ? fm[1] : '*';
    const partM = /\s(?::is\()?\.?(cbl-[a-z0-9-]+)(?:,\.?(cbl-[a-z0-9-]+))?\)?\s*$/.exec(one.trim().replace(/^\S+/, ' '));
    const parts = [];
    const tail = one.trim().split(/\s+/).slice(1).join(' ');
    // ".cbl-conf>*": the group's children (the generator tags them "cbl-conf>*").
    if (tail) tail.replace(/\.(cbl-[a-z0-9-]+)(>\*)?/g, (_, c, kids) => parts.push(kids ? `${c}>*` : c));
    if (!parts.length) continue;
    const states = statesOf(one);
    decls.split(/;(?![^(]*\))/).forEach((d) => {
      const i = d.indexOf(':'); if (i < 0) return;
      const k = d.slice(0, i).trim(), v = d.slice(i + 1).trim();
      for (const part of parts) {
        if (k === 'animation') {
          for (const st of states) if (st === 'idle' || st === 'msg' || st === 'awake') fam(famName)[st].push({ part, ...parseAnimation(v) });
        } else if (k === 'transform-origin') {
          const [x, y] = v.split(/\s+/).map((p) => (p === 'center' ? 0.5 : p.endsWith('%') ? parseFloat(p) / 100 : parseFloat(p) === 0 ? 0 : NaN));
          origins[`${famName} ${part}`] = [x, y === undefined ? 0.5 : y];
        } else if (k === 'animation-delay') {
          // Hover has no counterpart on a phone: its delays stay out.
          if (states.some((x) => x === 'any' || x === 'idle' || x === 'msg')) delays[`${famName} ${part}`] = time(v);
        } else if (k.startsWith('animation-') || k === 'opacity') {
          for (const st of states) overrides.push({ fam: famName, st, part, k, v });
        }
      }
    });
  }
}
// Overrides (animation-name / -duration / -iteration-count for a state; resting opacity when awake).
for (const o of overrides) {
  const f = families[o.fam];
  if (!f) continue;
  if (o.k === 'opacity') { (f.awakeOpacity = f.awakeOpacity || {})[o.part] = parseFloat(o.v); continue; }
  if (!f[o.st]) continue;
  let r = f[o.st].find((x) => x.part === o.part);
  if (!r) { r = { part: o.part, kf: null, dur: 0, delay: 0, iter: 1, ease: EASE.ease, fill: 'none' }; f[o.st].push(r); }
  if (o.k === 'animation-name') r.kf = o.v;
  if (o.k === 'animation-duration') r.dur = time(o.v);
  if (o.k === 'animation-iteration-count') r.iter = o.v === 'infinite' ? -1 : parseInt(o.v, 10);
}
// Delays for a part (".cbl[data-cbl] .cbl-d2" applies to every family).
for (const [f, def] of Object.entries(families)) {
  for (const st of ['idle', 'msg', 'awake']) for (const r of def[st]) {
    const d = delays[`${f} ${r.part}`] ?? delays[`* ${r.part}`];
    if (d !== undefined && !r.delay) r.delay = d;
  }
  for (const st of ['idle', 'msg', 'awake']) def[st] = def[st].filter((r) => r.kf && keyframes[r.kf]);
}
delete families['*'];
const missing = new Set();
for (const def of Object.values(families)) for (const st of ['idle', 'msg', 'awake']) for (const r of def[st]) if (!keyframes[r.kf]) missing.add(r.kf);
if (missing.size) console.error('missing keyframes', [...missing]);
// Delays set on an element's other classes (".cbl[data-cbl] .cbl-d2") are
// looked up per element at play time: "fam part" or "* part" -> seconds.
fs.writeFileSync('motion.json', JSON.stringify({ keyframes, families, origins, delays }));
console.log(Object.keys(keyframes).length, 'keyframes;', Object.entries(families).map(([k, v]) => `${k}:${v.idle.length}/${v.msg.length}`).join(' '));
