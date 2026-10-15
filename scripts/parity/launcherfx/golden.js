// The launcher entrance / attention / idle call, as Chrome plays them: every
// case of ./cases.js is a div given the same static values and the same
// element.animate() tracks, paused at each sample time; its computed
// translate, scale, rotate, opacity, offset-distance, stroke-dashoffset,
// clip-path, left and transform are read back into golden.json. The RN
// evaluator (src/core/keyframes.ts) is tested against it, and so are the
// Kotlin, Swift and Dart ports.
//
// golden.json: { geometry, seed, cases: [{ src, box, base, tracks, samples: [{ t, v }] }] }
//   v: { tx, ty, txp, typ, sx, sy, r, rx, ry, o, od, dash, clip, left } (+ px, py: the
//   box's centre in the stage, on a motion path)
//   v holds only the channels away from rest (tx 0, sx 1, o 1...), to 4 decimals;
//   tracks are as the web wrote them; iterations -1 = Infinity.
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { GEOMETRY, LEFT, SEED, cases } = require('./cases');

const all = cases();
const REST = { tx: 0, ty: 0, txp: 0, typ: 0, sx: 1, sy: 1, r: 0, rx: 0, ry: 0, o: 1, od: 0, dash: 0, clip: 0, left: 0 };
const json = (x) => JSON.parse(JSON.stringify(x, (k, v) => (v === Infinity ? -1 : v)));

(async () => {
  const b = await puppeteer.launch({ executablePath: require('../chrome'), args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setContent('<html><body style="margin:0"></body></html>');
  const out = [];
  // In batches, so the page stays small.
  for (let i = 0; i < all.length; i += 40) {
    const batch = json(all.slice(i, i + 40));
    const res = await p.evaluate((batch) => {
      const inf = (o) => ({ ...o, iterations: o.iterations === -1 ? Infinity : o.iterations });
      const len = (s) => {
        // "12px", "50%", "calc(10% + 4px)", "0px" -> [px, %]
        s = s.trim();
        if (s.startsWith('calc(')) {
          let px = 0;
          let pc = 0;
          s.slice(5, -1).replace(/([+-]?)\s*(-?[\d.e-]+)(px|%)/g, (_m, sign, n, u) => {
            const x = (sign === '-' ? -1 : 1) * parseFloat(n);
            if (u === '%') pc += x;
            else px += x;
          });
          return [px, pc];
        }
        const n = parseFloat(s);
        return s.endsWith('%') ? [0, n] : [n, 0];
      };
      const read = (el, parentW) => {
        const cs = getComputedStyle(el);
        const v = { tx: 0, ty: 0, txp: 0, typ: 0, sx: 1, sy: 1, r: 0, rx: 0, ry: 0, o: parseFloat(cs.opacity), od: 0, dash: 0, clip: 0, left: 0 };
        if (cs.translate && cs.translate !== 'none') {
          const parts = cs.translate.split(/\s+(?![^(]*\))/);
          [v.tx, v.txp] = len(parts[0]);
          if (parts[1]) [v.ty, v.typ] = len(parts[1]);
        }
        if (cs.scale && cs.scale !== 'none') {
          const s = cs.scale.split(/\s+/).map(parseFloat);
          v.sx = s[0];
          v.sy = s.length > 1 ? s[1] : s[0];
        }
        if (cs.rotate && cs.rotate !== 'none') {
          const m = /^(?:([xyz])\s+)?(-?[\d.e-]+)deg$/.exec(cs.rotate.trim());
          const m3 = /^(-?[\d.e-]+)\s+(-?[\d.e-]+)\s+(-?[\d.e-]+)\s+(-?[\d.e-]+)deg$/.exec(cs.rotate.trim());
          if (m) {
            const a = parseFloat(m[2]);
            if (m[1] === 'x') v.rx = a;
            else if (m[1] === 'y') v.ry = a;
            else v.r = a;
          } else if (m3) {
            const [x, y, z, a] = m3.slice(1).map(parseFloat);
            if (Math.abs(x) > 0.5) v.rx = a * Math.sign(x);
            else if (Math.abs(y) > 0.5) v.ry = a * Math.sign(y);
            else v.r = a * Math.sign(z || 1);
          }
        }
        if (cs.transform && cs.transform !== 'none') {
          const m = /matrix\(([^)]*)\)/.exec(cs.transform);
          if (m) v.sy = parseFloat(m[1].split(',')[3]);
        }
        if (cs.offsetDistance) v.od = len(cs.offsetDistance)[1] || 0;
        v.dash = parseFloat(cs.strokeDashoffset) || 0;
        const cp = /inset\(([^)]*)\)/.exec(cs.clipPath || '');
        if (cp) {
          const q = cp[1].trim().split(/\s+/);
          v.clip = q.length >= 3 ? len(q[2])[1] : 0;
        }
        if (cs.left && cs.left !== 'auto' && !el.style.offsetPath) v.left = (parseFloat(cs.left) / parentW) * 100;
        // On a motion path: where the box's centre is, in the stage.
        if (el.style.offsetPath) {
          const r = el.getBoundingClientRect();
          const h = el.parentNode.getBoundingClientRect();
          v.px = r.x + r.width / 2 - h.x;
          v.py = r.y + r.height / 2 - h.y;
        }
        return v;
      };
      return batch.map((c) => {
        const holder = document.createElement('div');
        Object.assign(holder.style, { position: 'relative', width: `${c.box.parentW || c.box.w}px`, height: '10px' });
        const el = document.createElement('div');
        Object.assign(el.style, { position: 'absolute', width: `${c.box.w}px`, height: `${c.box.h}px` });
        const bs = c.base || {};
        if (bs.o !== undefined) el.style.opacity = String(bs.o);
        if (c.transformScale) el.style.transform = `scaleY(${bs.sy ?? 1})`;
        else if (bs.sx !== undefined || bs.sy !== undefined) el.style.scale = `${bs.sx ?? 1} ${bs.sy ?? 1}`;
        if (bs.r !== undefined) el.style.rotate = `${bs.r}deg`;
        if (bs.txp !== undefined || bs.tx !== undefined) el.style.translate = `calc(${bs.txp || 0}% + ${bs.tx || 0}px) 0`;
        if (bs.dash !== undefined) el.style.strokeDashoffset = String(bs.dash);
        if (c.path) {
          el.style.offsetPath = `path("${c.path}")`;
          el.style.left = `${c.box.x}px`;
          el.style.top = `${c.box.y}px`;
        }
        holder.appendChild(el);
        document.body.appendChild(holder);
        const anims = c.tracks.map((t) => el.animate(t.keyframes, inf(t.options)));
        anims.forEach((a) => a.pause());
        const samples = c.times.map((t) => {
          anims.forEach((a) => (a.currentTime = t));
          return { t, v: read(el, c.box.parentW || c.box.w) };
        });
        anims.forEach((a) => a.cancel());
        holder.remove();
        return samples;
      });
    }, batch);
    res.forEach((samples, k) => {
      const c = batch[k];
      // Kept small: 4 decimals, and only the channels away from rest.
      const small = samples.map(({ t, v }) => {
        const o = {};
        for (const [ch, x] of Object.entries(v)) if (Math.abs(x - (REST[ch] ?? 0)) > 1e-6) o[ch] = +x.toFixed(4);
        return { t, v: o };
      });
      out.push({ src: c.src, box: c.box, base: c.base, tracks: c.tracks, ...(c.transformScale ? { transformScale: true } : {}), ...(c.path ? { path: c.path } : {}), samples: small });
    });
  }
  await b.close();
  fs.writeFileSync(path.join(__dirname, 'golden.json'), JSON.stringify({ geometry: { right: GEOMETRY, left: LEFT }, seed: SEED, cases: out }));
  console.log(out.length, 'cases,', out.reduce((n, c) => n + c.samples.length, 0), 'samples');
})();
