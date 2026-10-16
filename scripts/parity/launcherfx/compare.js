// The evaluator (./js, compiled from src/core) against Chrome's golden.json:
// the largest difference per feature and channel, and the worst cases.
const fs = require('fs');
const path = require('path');
const { evaluate, transformMatrix, transformOrder } = require('./js/keyframes');
const { spriteFrame } = require('./js/launcherEntrance');

const g = JSON.parse(fs.readFileSync(path.join(__dirname, 'golden.json'), 'utf8'));
const CH = ['tx', 'ty', 'txp', 'typ', 'sx', 'sy', 'r', 'rx', 'ry', 'o', 'od', 'dash', 'clip', 'left'];
const inf = (tr) => tr.map((t) => ({ ...t, options: { ...t.options, iterations: t.options.iterations === -1 ? Infinity : t.options.iterations } }));
const REST = { tx: 0, ty: 0, txp: 0, typ: 0, sx: 1, sy: 1, r: 0, rx: 0, ry: 0, o: 1, od: 0, dash: 0, clip: 0, left: 0, ma: 1, mb: 0, mc: 0, md: 1, me: 0, mf: 0 };
const M = ['ma', 'mb', 'mc', 'md', 'me', 'mf'];
const max = {};
const worst = [];
for (const c of g.cases) {
  const feature = c.src.split(':')[0];
  const tracks = inf(c.tracks);
  for (const s0 of c.samples) {
    const s = { t: s0.t, v: { ...REST, ...s0.v } };
    const v = evaluate(tracks, s.t, c.base);
    // A transform list: its matrix (and the opacity, the dash) against Chrome's.
    if (c.matrix) {
      const m = transformMatrix(v, transformOrder(tracks[0]));
      M.forEach((ch, i) => {
        const e = Math.abs(m[i] - s.v[ch]);
        const k = `${feature} ${ch}`;
        if (!(max[k] >= e)) max[k] = e;
        if (e > 0.01) worst.push({ src: c.src, t: s.t, ch, ours: +m[i].toFixed(4), chrome: s.v[ch] });
      });
    }
    for (const ch of c.matrix ? ['o', 'dash'] : CH) {
      const e = Math.abs(v[ch] - s.v[ch]);
      const k = `${feature} ${ch}`;
      if (!(max[k] >= e)) max[k] = e;
      if (e > 0.01) worst.push({ src: c.src, t: s.t, ch, ours: +v[ch].toFixed(4), chrome: s.v[ch] });
    }
    if (c.path && s.v.px !== undefined) {
      const f = spriteFrame({ x: c.box.x, y: c.box.y, w: c.box.w, h: c.box.h, tracks, path: { d: c.path, rotate: true } }, s.t, v);
      const ex = Math.hypot(c.box.x + c.box.w / 2 + f.tx - s.v.px, c.box.y + c.box.h / 2 + f.ty - s.v.py);
      if (!(max[`${feature} path`] >= ex)) max[`${feature} path`] = ex;
      if (ex > 0.5) worst.push({ src: c.src, t: s.t, ch: 'path', ours: [c.box.x + c.box.w / 2 + f.tx, c.box.y + c.box.h / 2 + f.ty].map((x) => +x.toFixed(2)), chrome: [s.v.px, s.v.py] });
    }
  }
}
console.log(g.cases.length, 'cases,', g.cases.reduce((n, c) => n + c.samples.length, 0), 'samples');
console.log('max |ours - chrome| per feature and channel (px, %, deg, opacity):');
for (const [k, v] of Object.entries(max).sort()) if (v > 0) console.log(' ', k.padEnd(22), +v.toFixed(5));
console.log(worst.length, 'values off by more than 0.01');
worst.slice(0, 25).forEach((w) => console.log(' ', JSON.stringify(w)));
