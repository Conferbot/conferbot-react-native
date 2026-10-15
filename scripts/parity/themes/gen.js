// The folder holding conferbot-widget and sdk/ (override with CONFERBOT_DEV).
const DEV = process.env.CONFERBOT_DEV || require('path').resolve(__dirname, '../../../../..');
// Theme tokens for the mobile SDKs, from the widget's theme sheets.
const fs = require('fs');
const W = `${DEV}/conferbot-widget/src`;
const css = (n) => fs.readFileSync(`${W}/css/themes/${n}.css`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const block = (src, sel) => {
  const i = src.indexOf(sel + ' {');
  if (i < 0) return {};
  const body = src.slice(i + sel.length + 2, src.indexOf('}', i));
  const out = {};
  body.replace(/--(t-[a-z0-9-]+)\s*:\s*([^;]+);/g, (_, k, v) => { out[k] = v.trim().replace(/\s+/g, ' '); });
  return out;
};
const base = css('base');
const baseLight = block(base, ':host(:where([data-cb-tokens]))');
const baseDark = block(base, ':host(:where([data-cb-tokens][data-cb-scheme="dark"]))');
const baseShape = block(base, ':host(:where([data-cb-shape]))');
const reg = fs.readFileSync(`${W}/ts/theme/registry.ts`, 'utf8');
const themes = [...reg.matchAll(/\{ id: "([a-z0-9]+)", label: "([^"]+)",\s*font: (null|font\("([^"]+)")[^}]*?fontRole: (null|"(body|display)"), alwaysDark: (true|false)/g)]
  .map((m) => ({ id: m[1], label: m[2], font: m[4] || null, fontRole: m[6] || null, alwaysDark: m[7] === 'true' }));
const resolve = (set, v, depth = 0) => {
  if (depth > 6 || typeof v !== 'string') return v;
  return v.replace(/var\(--(t-[a-z0-9-]+)(?:,\s*([^()]+|[^()]*\([^()]*\)[^()]*))?\)/g, (m, k, fb) => set[k] !== undefined ? resolve(set, set[k], depth + 1) : (fb ? resolve(set, fb.trim(), depth + 1) : m));
};
const px = (v) => { const m = /^(-?[\d.]+)px(?:\s|$)/.exec(String(v || '').trim()); return m ? Number(m[1]) : null; };
const pick = (set) => {
  const r = (k) => resolve(set, set[k]);
  const border = r('t-bubble-border');
  const bm = /^([\d.]+)px\s+solid\s+(.+)$/.exec(border || '');
  return {
    bg: r('t-bg'), bg2: r('t-bg-2'), card: r('t-card'), card2: r('t-card-2'),
    field: r('t-field'), menu: r('t-menu'),
    ink: r('t-ink'), text: r('t-text'), muted: r('t-muted'), faint: r('t-faint'),
    line: r('t-line'), line2: r('t-line-2'),
  };
};
const shape = (set) => {
  const r = (k) => resolve(set, set[k]);
  const border = r('t-bubble-border') || '';
  const bm = /^([\d.]+)px\s+solid\s+(.+)$/.exec(border);
  return {
    rBubble: px(r('t-r-bubble')), rTail: px(r('t-r-tail')), rCtl: px(r('t-r-ctl')), rField: px(r('t-r-field')), rCard: px(r('t-r-card')),
    bubbleBorderWidth: bm ? Number(bm[1]) : 0, bubbleBorderColor: bm ? bm[2].trim() : null,
    displayWeight: Number(r('t-display-weight')) || 700,
  };
};
// Values the SDKs can read: hex / rgb(a), or "mix:N:<colour>" (N% of the
// bot's brand over the colour) and "accent:<alpha>" (the brand lifted for
// dark surfaces, at that alpha).
const simplify = (v, scheme, id, key, set) => {
  if (v === 'transparent') {
    // Glass is see-through over the host page; an app has nothing behind
    // it, so it takes the sheet's own opaque fallback. Others: the surface.
    if (id === 'glass') return scheme === 'dark' ? '#14171f' : '#fafbfd';
    return set.bg && set.bg !== 'transparent' ? simplify(set.bg, scheme, id, 'bg', {}) : (scheme === 'dark' ? '#14161c' : '#ffffff');
  }
  let m = /^color-mix\(in (?:srgb|oklab), rgb\(var\(--cb-o-brand-rgb\)\) ([\d.]+)%, (.+)\)$/.exec(v);
  if (m) return `mix:${m[1]}:${m[2]}`;
  m = /^color-mix\(in srgb, rgb\(var\(--p\)\) ([\d.]+)%, (.+)\)$/.exec(v);
  if (m) {
    const p = scheme === 'dark' ? [110, 255, 150] : [21, 110, 52];
    const b = m[2].replace('#', '').match(/../g).map((h) => parseInt(h, 16));
    const t = Number(m[1]) / 100;
    return '#' + p.map((c, i) => Math.round(c * t + b[i] * (1 - t)).toString(16).padStart(2, '0')).join('');
  }
  if (v === 'rgb(var(--p))') return scheme === 'dark' ? 'rgb(110, 255, 150)' : 'rgb(21, 110, 52)';
  m = /^rgba\(var\(--p\), ([\d.]+)\)$/.exec(v);
  if (m) return `rgba(${scheme === 'dark' ? '110, 255, 150' : '21, 110, 52'}, ${m[1]})`;
  m = /^rgba\(var\(--cb-o-accent-dark-rgb\), ([\d.]+)\)$/.exec(v);
  if (m) return `accent:${m[1]}`;
  return v;
};
const tidy = (colors, scheme, id) => {
  const o = {};
  for (const [k, v] of Object.entries(colors)) o[k] = simplify(v, scheme, id, k, colors);
  return o;
};
const PALETTES = JSON.parse(fs.readFileSync(`${W}/ts/theme/palettes.json`, 'utf8'));
const out = {};
for (const t of themes) {
  const src = t.id === 'classic' ? '' : css(t.id);
  const own = block(src, `:host([data-cb-theme="${t.id}"])`);
  const ownDark = block(src, `:host([data-cb-theme="${t.id}"][data-cb-scheme="dark"])`);
  const light = { ...baseLight, ...baseShape, ...own };
  const dark = { ...baseLight, ...baseShape, ...baseDark, ...own, ...ownDark };
  const entry = { label: t.label, font: t.font ? t.font.replace(/^CB /, '') : null, fontRole: t.fontRole, alwaysDark: t.alwaysDark };
  if (t.id !== 'classic') { entry.shape = shape(light); entry.light = tidy(pick(light), 'light', t.id); }
  entry.dark = tidy(pick(dark), 'dark', t.id);
  if (t.alwaysDark) entry.light = entry.dark;
  if (PALETTES[t.id]) entry.palette = PALETTES[t.id];
  out[t.id] = entry;
}
// Unresolved values are a bug in this generator.
const bad = JSON.stringify(out).match(/var\(--[^"]*/g);
if (bad) console.error('unresolved', [...new Set(bad)].slice(0, 10));
fs.writeFileSync('themes.json', JSON.stringify(out, null, 1));
console.log(themes.length, 'themes');
