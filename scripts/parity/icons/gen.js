// The folder holding conferbot-widget and sdk/ (override with CONFERBOT_DEV).
const DEV = process.env.CONFERBOT_DEV || require('path').resolve(__dirname, '../../../../..');
// The web widget's launcher icons as flat draw operations for the mobile SDKs.
// Each icon: { id, anim, ops: [ { d, m (2x3 matrix), fill, stroke, sw, cap, join, op, rule, clip, part } ] }
// Paint: null (none) | { c: 'ink' | 'bg' | '#rrggbb', a } | { g: index into grads }
const fs = require('fs');
const W = `${DEV}/conferbot-widget/src/svg/launcher`;
const icons = [];
for (const f of ['bubbles', 'faces', 'characters', 'playful', 'classic']) {
  const src = fs.readFileSync(`${W}/${f}.ts`, 'utf8');
  const json = src.slice(src.indexOf('/* ICONS:BEGIN */') + 17, src.indexOf('/* ICONS:END */'));
  icons.push(...JSON.parse(json));
}

// --- a tiny XML parser (the bodies are well formed) ---
const parse = (xml) => {
  const root = { tag: 'root', attrs: {}, kids: [] };
  const stack = [root];
  const re = /<(\/?)([a-zA-Z]+)((?:\s+[a-zA-Z0-9:-]+="[^"]*")*)\s*(\/?)>/g;
  let m;
  while ((m = re.exec(xml))) {
    const [, close, tag, rawAttrs, self] = m;
    if (close) { stack.pop(); continue; }
    const attrs = {};
    rawAttrs.replace(/([a-zA-Z0-9:-]+)="([^"]*)"/g, (_, k, v) => { attrs[k] = v; });
    if (attrs.style) attrs.style.split(';').forEach((kv) => { const i = kv.indexOf(':'); if (i > 0) attrs[kv.slice(0, i).trim()] = kv.slice(i + 1).trim(); });
    const node = { tag, attrs, kids: [] };
    stack[stack.length - 1].kids.push(node);
    if (!self) stack.push(node);
  }
  return root;
};

const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
const I = [1, 0, 0, 1, 0, 0];
const transform = (t) => {
  let m = I;
  if (!t) return m;
  t.replace(/(translate|rotate|scale|matrix)\(([^)]*)\)/g, (_, fn, args) => {
    const a = args.split(/[\s,]+/).filter(Boolean).map(Number);
    let n = I;
    if (fn === 'translate') n = [1, 0, 0, 1, a[0], a[1] || 0];
    if (fn === 'scale') n = [a[0], 0, 0, a[1] ?? a[0], 0, 0];
    if (fn === 'matrix') n = a;
    if (fn === 'rotate') {
      const r = (a[0] * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
      n = [c, s, -s, c, 0, 0];
      if (a.length === 3) n = mul(mul([1, 0, 0, 1, a[1], a[2]], n), [1, 0, 0, 1, -a[1], -a[2]]);
    }
    m = mul(m, n);
  });
  return m;
};
const f = (n) => Math.round(n * 1000) / 1000;
const ellipse = (cx, cy, rx, ry) => `M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0z`;
const rect = (x, y, w, h, rx, ry) => {
  rx = Math.min(rx || ry || 0, w / 2); ry = Math.min(ry || rx || 0, h / 2);
  if (!rx) return `M${x} ${y}h${w}v${h}h${-w}z`;
  return `M${f(x + rx)} ${y}h${f(w - 2 * rx)}a${rx} ${ry} 0 0 1 ${rx} ${ry}v${f(h - 2 * ry)}a${rx} ${ry} 0 0 1 ${-rx} ${ry}h${f(-(w - 2 * rx))}a${rx} ${ry} 0 0 1 ${-rx} ${-ry}v${f(-(h - 2 * ry))}a${rx} ${ry} 0 0 1 ${rx} ${-ry}z`;
};
const num = (v, d = 0) => (v === undefined || v === '' ? d : parseFloat(v));
const pct = (v, d) => (v === undefined ? d : String(v).endsWith('%') ? parseFloat(v) / 100 : parseFloat(v));

// The motion classes of an element, plus "X>*" when its parent is a group
// whose children animate (motion.ts ".cbl-conf>*").
const CHILD_GROUPS = ['cbl-conf'];
const partClasses = (n, inherit) => {
  const own = (n.attrs.class || '').split(/\s+/).filter((c) => c.startsWith('cbl-'));
  const kids = (inherit.parentCls || []).filter((c) => CHILD_GROUPS.includes(c)).map((c) => `${c}>*`);
  return [...own, ...kids];
};
const out = [];
const unknown = new Set();
for (const icon of icons) {
  const body = icon.body.replace(/\{uid\}/g, 'u');
  const tree = parse(body);
  const grads = [];
  const gradIndex = {};
  const clips = {};
  const color = (v, alpha = 1) => {
    if (v === undefined || v === 'none' || v === 'transparent') return null;
    v = v.trim();
    if (v === 'currentColor') return { c: 'ink', a: alpha };
    if (/^var\(--cbl-bg/.test(v)) return { c: 'bg', a: alpha };
    if (/^#[0-9a-fA-F]{3,6}$/.test(v)) {
      let h = v.slice(1); if (h.length === 3) h = h.split('').map((c) => c + c).join('');
      return { c: '#' + h.toLowerCase(), a: alpha };
    }
    if (v === 'white') return { c: '#ffffff', a: alpha };
    if (v === 'black') return { c: '#000000', a: alpha };
    unknown.add(v);
    return null;
  };
  // Gradients and clip paths first (they may sit in <defs> anywhere).
  const collect = (n) => {
    if (n.tag === 'linearGradient' || n.tag === 'radialGradient') {
      const stops = n.kids.filter((k) => k.tag === 'stop').map((s) => {
        const c = color(s.attrs['stop-color'] || '#000', num(s.attrs['stop-opacity'], 1));
        return { o: pct(s.attrs.offset, 0), ...(c || { c: '#000000', a: 0 }) };
      });
      const g = n.tag === 'linearGradient'
        ? { t: 'l', x1: pct(n.attrs.x1, 0), y1: pct(n.attrs.y1, 0), x2: pct(n.attrs.x2, 1), y2: pct(n.attrs.y2, 0), stops }
        : { t: 'r', cx: pct(n.attrs.cx, 0.5), cy: pct(n.attrs.cy, 0.5), r: pct(n.attrs.r, 0.5), fx: pct(n.attrs.fx, pct(n.attrs.cx, 0.5)), fy: pct(n.attrs.fy, pct(n.attrs.cy, 0.5)), stops };
      if (n.attrs.gradientUnits === 'userSpaceOnUse') g.user = true;
      gradIndex[n.attrs.id] = grads.length;
      grads.push(g);
    }
    if (n.tag === 'clipPath') clips[n.attrs.id] = n;
    n.kids.forEach(collect);
  };
  collect(tree);
  const paint = (v, alpha) => {
    if (!v) return undefined;
    const m = /^url\(#([^)]+)\)$/.exec(v.trim());
    if (m) return gradIndex[m[1]] !== undefined ? { g: gradIndex[m[1]], a: alpha } : null;
    return color(v, alpha);
  };
  const shapeD = (n) => {
    const a = n.attrs;
    if (n.tag === 'path') return a.d;
    if (n.tag === 'circle') return ellipse(num(a.cx), num(a.cy), num(a.r), num(a.r));
    if (n.tag === 'ellipse') return ellipse(num(a.cx), num(a.cy), num(a.rx), num(a.ry));
    if (n.tag === 'rect') return rect(num(a.x), num(a.y), num(a.width), num(a.height), num(a.rx, undefined), num(a.ry, undefined));
    return null;
  };
  const ops = [];
  const walk = (n, inherit) => {
    if (['defs', 'linearGradient', 'radialGradient', 'clipPath', 'stop'].includes(n.tag)) return;
    const a = n.attrs;
    const isPart = partClasses(n, inherit).length > 0;
    const ownT = transform(a.transform);
    const st = {
      m: mul(inherit.m, ownT),
      // The static transform since the last animated part (that part's own
      // transform excluded: it sits in the part's slot, where an animation
      // replaces it).
      since: isPart ? I : mul(inherit.since, ownT),
      fill: a.fill !== undefined ? a.fill : inherit.fill,
      fo: a['fill-opacity'] !== undefined ? num(a['fill-opacity'], 1) : inherit.fo,
      stroke: a.stroke !== undefined ? a.stroke : inherit.stroke,
      so: a['stroke-opacity'] !== undefined ? num(a['stroke-opacity'], 1) : inherit.so,
      sw: a['stroke-width'] !== undefined ? num(a['stroke-width'], 1) : inherit.sw,
      cap: a['stroke-linecap'] || inherit.cap,
      join: a['stroke-linejoin'] || inherit.join,
      op: inherit.op * num(a.opacity, 1),
      // Opacity from elements that are not animated parts (multiplies, never replaced).
      opRest: inherit.opRest * (partClasses(n, inherit).length ? 1 : num(a.opacity, 1)),
      rule: a['fill-rule'] || inherit.rule,
      clip: a['clip-path'] ? /#([^)]+)/.exec(a['clip-path'])[1] : inherit.clip,
      clipDepth: inherit.clipDepth,
      // Every animated element above (and including) this one, outer first:
      // its classes, a group id (its bounding box is the transform origin's
      // box), and its --dx/--dy variables.
      parts: partClasses(n, inherit).length
        ? [...inherit.parts, { cls: partClasses(n, inherit), gid: ++gidCounter.n, dx: a['--dx'], dy: a['--dy'], own: a.transform ? transform(a.transform).map(f) : null, o: a.opacity !== undefined ? num(a.opacity, 1) : undefined, pre: inherit.since }]
        : inherit.parts,
      parentCls: (a.class || '').split(/\s+/).filter((c) => c.startsWith('cbl-')),
      paintOrder: a['paint-order'] || inherit.paintOrder,
    };
    // A clip lives in the declaring element's space: it moves with the
    // animated groups at and above that element only.
    if (a['clip-path']) st.clipDepth = st.parts.length;
    const d = shapeD(n);
    if (d) {
      const op = { d, m: st.m.map(f) };
      const fill = paint(st.fill, st.fo);
      const stroke = paint(st.stroke, st.so);
      if (fill) op.fill = fill;
      if (stroke) { op.stroke = stroke; op.sw = st.sw; if (st.cap) op.cap = st.cap; if (st.join) op.join = st.join; }
      if (st.op !== 1) op.op = f(st.op);
      if (st.parts.length && st.opRest !== st.op) op.opRest = f(st.opRest);
      // The static transform after the last part, down to the shape.
      if (st.parts.length && st.since.some((v, i) => Math.abs(v - I[i]) > 1e-9)) op.post = st.since.map(f);
      if (st.rule === 'evenodd') op.rule = 'evenodd';
      if (st.paintOrder && /^stroke/.test(st.paintOrder)) op.strokeFirst = true;
      if (st.clip && clips[st.clip]) {
        const c = clips[st.clip].kids.map(shapeD).filter(Boolean);
        if (c.length) { op.clip = c.join(''); op.clipDepth = st.clipDepth; }
      }
      // The shape itself is the innermost animated element: a CSS opacity on
      // it replaces its own opacity attribute (on a parent they multiply).
      if (partClasses(n, inherit).length) op.self = 1;
      if (st.parts.length) op.parts = st.parts.map((p) => {
        const o = { c: p.cls, g: p.gid };
        if (p.dx !== undefined) o.dx = parseFloat(p.dx);
        if (p.dy !== undefined) o.dy = parseFloat(p.dy);
        // The element's own transform attribute: a CSS animation on it replaces it.
        if (p.own) o.t = p.own;
        // The static transform between the previous part and this one.
        if (p.pre && p.pre.some((v, i) => Math.abs(v - I[i]) > 1e-9)) o.pre = p.pre.map(f);
        if (p.o !== undefined && p.o !== 1) o.o = p.o;
        // No class of its own (".cbl-conf>*" children): ".cbl [class]" does not
        // reach it, so it turns about the icon's origin, not its own centre.
        if (!p.cls.some((c) => !c.endsWith('>*'))) o.u = 1;
        return o;
      });
      if (op.fill || op.stroke) ops.push(op);
    }
    n.kids.forEach((k) => walk(k, st));
  };
  const gidCounter = { n: 0 };
  walk(tree, { m: I, since: I, fill: 'none', fo: 1, stroke: undefined, so: 1, sw: 1, op: 1, opRest: 1, parts: [], parentCls: [] });
  // Identity matrices drop out.
  ops.forEach((o) => { if (o.m.join() === '1,0,0,1,0,0') delete o.m; });
  out.push({ id: icon.id, anim: icon.anim, grads, ops });
}
if (unknown.size) console.error('unknown colours', [...unknown]);
fs.writeFileSync('icons.json', JSON.stringify(out));
console.log(out.length, 'icons', JSON.stringify(out).length, 'bytes');
