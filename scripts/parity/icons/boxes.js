// The folder holding conferbot-widget and sdk/ (override with CONFERBOT_DEV).
const DEV = process.env.CONFERBOT_DEV || require('path').resolve(__dirname, '../../../../..');
// The exact bounding box of every animated group (transform-box: fill-box)
// and of the whole icon (the .cbl-r root), measured in Chrome, added to icons.json.
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const W = `${DEV}/conferbot-widget/src/svg/launcher`;
const orig = [];
for (const f of ['bubbles', 'faces', 'characters', 'playful', 'classic']) {
  const src = fs.readFileSync(`${W}/${f}.ts`, 'utf8');
  orig.push(...JSON.parse(src.slice(src.indexOf('/* ICONS:BEGIN */') + 17, src.indexOf('/* ICONS:END */'))));
}
const icons = require('./icons.json');
(async () => {
  const b = await puppeteer.launch({ executablePath: require('../chrome'), args: ['--no-sandbox'] });
  const p = await b.newPage();
  const html = orig.map((o, i) => `<svg id="s${i}" viewBox="0 0 24 24" width="24" height="24" fill="none" style="color:#fff"><g class="cbl-r">${o.body.replace(/\{uid\}/g, 'x' + i)}</g></svg>`).join('');
  await p.setContent(`<html><body>${html}</body></html>`);
  const boxes = await p.evaluate((n) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const svg = document.getElementById('s' + i);
      const root = svg.querySelector('.cbl-r');
      const r = root.getBBox();
      const b = { 0: [r.x, r.y, r.width, r.height] };
      // Document order = the generator's walk order (pre-order, defs skipped).
      let gid = 0;
      root.querySelectorAll('*').forEach((el) => {
        if (el.closest('defs')) return;
        const cls = (el.getAttribute('class') || '').split(/\s+/).filter((c) => c.startsWith('cbl-'));
        const parentCls = (el.parentElement.getAttribute('class') || '').split(/\s+/);
        if (!cls.length && !parentCls.includes('cbl-conf')) return;
        gid += 1;
        const bb = el.getBBox();
        b[gid] = [bb.x, bb.y, bb.width, bb.height];
      });
      out.push(b);
    }
    return out;
  }, orig.length);
  const round = (v) => Math.round(v * 1000) / 1000;
  icons.forEach((icon, i) => {
    icon.boxes = Object.fromEntries(Object.entries(boxes[i]).map(([k, v]) => [k, v.map(round)]));
    const maxGid = Math.max(0, ...icon.ops.flatMap((o) => (o.parts || []).map((p) => p.g)));
    if (maxGid && !icon.boxes[maxGid]) console.error('box mismatch', icon.id, maxGid);
  });
  // In the widget the <svg> has class "cbl", so ".cbl [class]{transform-box:
  // fill-box;transform-origin:center}" makes a classed element's own
  // transform attribute turn about the centre of its box, not the origin.
  const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  const I = [1, 0, 0, 1, 0, 0];
  icons.forEach((icon) => {
    const pivotedByGid = {};
    for (const op of icon.ops) {
      for (const p of op.parts || []) {
        if (!p.t) continue;
        if (!pivotedByGid[p.g]) {
          const b = icon.boxes[p.g];
          const cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2;
          pivotedByGid[p.g] = mul(mul([1, 0, 0, 1, cx, cy], p.t), [1, 0, 0, 1, -cx, -cy]).map(round);
        }
        p.t = pivotedByGid[p.g];
      }
      // The resting matrix, rebuilt level by level with the pivoted transforms.
      if (op.parts && op.parts.some((p) => p.t)) {
        let m = I;
        for (const p of op.parts) { m = mul(m, p.pre || I); m = mul(m, p.t || I); }
        m = mul(m, op.post || I);
        op.m = m.map(round);
      }
    }
  });
  fs.writeFileSync('icons.json', JSON.stringify(icons));
  console.log('boxes added', JSON.stringify(icons.find((i) => i.anim === 'winky').boxes));
  await b.close();
})();
