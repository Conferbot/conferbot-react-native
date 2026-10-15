// The folder holding conferbot-widget and sdk/ (override with CONFERBOT_DEV).
const DEV = process.env.CONFERBOT_DEV || require('path').resolve(__dirname, '../../../../..');
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const W = `${DEV}/conferbot-widget/src/svg/launcher`;
const src = fs.readFileSync(`${W}/playful.ts`, 'utf8');
const icons = JSON.parse(src.slice(src.indexOf('/* ICONS:BEGIN */') + 17, src.indexOf('/* ICONS:END */')));
const party = icons.find((i) => i.anim === 'party');
const msrc = fs.readFileSync(`${W}/motion.ts`, 'utf8');
const CSS = JSON.parse(msrc.slice(msrc.indexOf('/* MOTION:BEGIN */') + 18, msrc.indexOf('/* MOTION:END */'))).join('\n');
(async () => {
  const b = await puppeteer.launch({ executablePath: require('../chrome'), args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setContent(`<style>${CSS}</style><svg class="cbl cbl--party" data-cbl="idle" viewBox="0 0 24 24" width="96" fill="none"><g class="cbl-r">${party.body.replace(/\{uid\}/g, 'x')}</g></svg>`);
  console.log(await p.evaluate(() => [...document.querySelectorAll('.cbl-conf > *')].map((e) => [e.getAttribute('class'), getComputedStyle(e).animationDelay, getComputedStyle(e).animationName, getComputedStyle(e).transformOrigin])));
  await b.close();
})();
