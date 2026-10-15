// The folder holding conferbot-widget and sdk/ (override with CONFERBOT_DEV).
const DEV = process.env.CONFERBOT_DEV || require('path').resolve(__dirname, '../../../../..');
// Our motion frames vs the web's CSS animation, paused at the same instant.
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const { iconFrame } = require('./js/launcherMotion');
const { launcherIconSvg, launcherIconById } = require('./js/launcherIcons');
const { LAUNCHER_ICONS } = require('./js/launcherIcons.data');
const W = `${DEV}/conferbot-widget/src/svg/launcher`;
const orig = {};
for (const f of ['bubbles', 'faces', 'characters', 'playful', 'classic']) {
  const src = fs.readFileSync(`${W}/${f}.ts`, 'utf8');
  JSON.parse(src.slice(src.indexOf('/* ICONS:BEGIN */') + 17, src.indexOf('/* ICONS:END */'))).forEach((i) => (orig[i.id] = i));
}
const msrc = fs.readFileSync(`${W}/motion.ts`, 'utf8');
const CSS = JSON.parse(msrc.slice(msrc.indexOf('/* MOTION:BEGIN */') + 18, msrc.indexOf('/* MOTION:END */'))).join('\n');
const INK = '#ffffff', BG = '#0F766E';
const TIMES = [0.25, 0.55, 0.9, 1.3, 1.75, 2.2];
// One icon per animation family (plus a few more).
const pick = [];
const seen = new Set();
for (const i of LAUNCHER_ICONS) if (!seen.has(i.anim)) { seen.add(i.anim); pick.push(i.id); }
const cases = [];
for (const id of pick) for (const st of ['idle', 'msg']) for (const t of TIMES) cases.push({ id, st, t });
(async () => {
  const b = await puppeteer.launch({ executablePath: require('../chrome'), args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1400, height: 3000 });
  let html = `<html><body style="margin:0;background:#fff"><style>${CSS}</style>`;
  cases.forEach((c, k) => {
    const o = orig[c.id];
    const web = `<svg class="cbl cbl--${o.anim}" data-cbl="${c.st}" viewBox="0 0 24 24" width="96" height="96" fill="none" style="color:${INK};--cbl-bg:${BG};overflow:visible"><g class="cbl-r">${o.body.replace(/\{uid\}/g, 'k' + k)}</g></svg>`;
    let ours = launcherIconSvg(c.id, INK, BG, 96, iconFrame(launcherIconById(c.id), c.st, c.t));
    ours = ours.replace(/id="(g|c)(\d+)"/g, `id="o${k}$1$2"`).replace(/url\(#(g|c)(\d+)\)/g, `url(#o${k}$1$2)`).replace('<svg ', '<svg style="overflow:visible" ');
    html += `<div class="case" data-t="${c.t}" style="display:inline-block;margin:6px"><div style="background:${BG};width:96px;height:96px;display:inline-block;margin:2px">${web}</div><div style="background:${BG};width:96px;height:96px;display:inline-block;margin:2px">${ours}</div></div>`;
  });
  await p.setContent(html + '</body></html>');
  await new Promise((r) => setTimeout(r, 300));
  await p.evaluate(() => {
    document.querySelectorAll('.case').forEach((el) => {
      const t = parseFloat(el.dataset.t) * 1000;
      el.getAnimations({ subtree: true }).forEach((a) => { a.pause(); a.currentTime = t; });
    });
  });
  await new Promise((r) => setTimeout(r, 300));
  const boxes = await p.evaluate(() => [...document.querySelectorAll('.case')].map((el) => [...el.children].map((d) => { const r = d.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y)]; })));
  await p.screenshot({ path: 'mcompare.png', fullPage: true });
  fs.writeFileSync('mcases.json', JSON.stringify({ cases, boxes }));
  await b.close();
})();
