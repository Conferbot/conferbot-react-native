// The folder holding conferbot-widget and sdk/ (override with CONFERBOT_DEV).
const DEV = process.env.CONFERBOT_DEV || require('path').resolve(__dirname, '../../../../..');
// Render each original icon and its rebuilt-from-ops copy side by side.
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const W = `${DEV}/conferbot-widget/src/svg/launcher`;
const orig = [];
for (const f of ['bubbles', 'faces', 'characters', 'playful', 'classic']) {
  const src = fs.readFileSync(`${W}/${f}.ts`, 'utf8');
  orig.push(...JSON.parse(src.slice(src.indexOf('/* ICONS:BEGIN */') + 17, src.indexOf('/* ICONS:END */'))));
}
const ops = require('./icons.json');
const INK = '#ffffff', BG = '#0F766E';
const col = (p) => (p.c === 'ink' ? INK : p.c === 'bg' ? BG : p.c);
const rebuild = (icon, k) => {
  let defs = '';
  icon.grads.forEach((g, i) => {
    const stops = g.stops.map((s) => `<stop offset="${s.o}" stop-color="${col(s)}" stop-opacity="${s.a}"/>`).join('');
    defs += g.t === 'l'
      ? `<linearGradient id="k${k}g${i}" x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}"${g.user ? ' gradientUnits="userSpaceOnUse"' : ''}>${stops}</linearGradient>`
      : `<radialGradient id="k${k}g${i}" cx="${g.cx}" cy="${g.cy}" r="${g.r}" fx="${g.fx}" fy="${g.fy}"${g.user ? ' gradientUnits="userSpaceOnUse"' : ''}>${stops}</radialGradient>`;
  });
  let body = '';
  icon.ops.forEach((o, i) => {
    const p = (x) => (x.g !== undefined ? `url(#k${k}g${x.g})` : col(x));
    const pa = (x) => (x.g !== undefined ? '' : ` ${''}`);
    let clip = '';
    if (o.clip) { defs += `<clipPath id="k${k}c${i}"><path d="${o.clip}"/></clipPath>`; clip = ` clip-path="url(#k${k}c${i})"`; }
    body += `<path d="${o.d}"${o.m ? ` transform="matrix(${o.m.join(' ')})"` : ''} fill="${o.fill ? p(o.fill) : 'none'}"${o.fill ? ` fill-opacity="${o.fill.a}"` : ''}${o.stroke ? ` stroke="${p(o.stroke)}" stroke-opacity="${o.stroke.a}" stroke-width="${o.sw}"${o.cap ? ` stroke-linecap="${o.cap}"` : ''}${o.join ? ` stroke-linejoin="${o.join}"` : ''}` : ''}${o.op !== undefined ? ` opacity="${o.op}"` : ''}${o.rule ? ' fill-rule="evenodd"' : ''}${o.strokeFirst ? ' paint-order="stroke"' : ''}${clip}/>`;
  });
  return `<svg viewBox="0 0 24 24" width="96" height="96"><defs>${defs}</defs>${body}</svg>`;
};
const cell = (svg) => `<div style="background:${BG};width:96px;height:96px;display:inline-block;margin:2px">${svg}</div>`;
let html = '<html><body style="margin:0;background:#fff">';
orig.forEach((o, i) => {
  const a = `<svg viewBox="0 0 24 24" width="96" height="96" fill="none" style="color:${INK};--cbl-bg:${BG}">${o.body.replace(/\{uid\}/g, 'x' + i)}</svg>`;
  html += `<div id="r${i}" style="display:inline-block;margin:4px">${cell(a)}${cell(rebuild(ops[i], i))}</div>`;
});
html += '</body></html>';
fs.writeFileSync('compare.html', html);
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1600, height: 1200 });
  await p.goto('file://' + __dirname + '/compare.html');
  const boxes = await p.evaluate(() => [...document.querySelectorAll('[id^=r]')].map((el) => [...el.querySelectorAll('div')].map((d) => { const r = d.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y)]; })));
  fs.writeFileSync('boxes.json', JSON.stringify(boxes));
  await p.screenshot({ path: 'compare.png', fullPage: true });
  await b.close();
})();
