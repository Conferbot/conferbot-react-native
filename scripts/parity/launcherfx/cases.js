// The cases the launcher entrance / attention / idle call are checked on:
// every animated element of every mode, at fixed geometries, built from the
// RN core (compiled to ./js by check.sh). Each case: where it comes from
// (src), its box, its own static values (base), its Web Animations tracks
// and the times (ms) to sample.
const { attentionTracks, ATTENTION_BASE, LAUNCHER_ATTENTIONS } = require('./js/launcherAttention');
const { idleCallPerformance, idleCallGeometry, MASCOT_PART_BASE, LAUNCHER_IDLE_CALLS } = require('./js/launcherIdleCall');
const { entrancePlan, entranceStage, entranceTimeline, LAUNCHER_ENTRANCES, SETTLE_REVEAL } = require('./js/launcherEntrance');

// A 50px launcher, 16px from the right and bottom of a 390 x 844 screen.
const GEOMETRY = { width: 50, height: 50, position: 'right', screenWidth: 390, screenHeight: 844, side: 16, bottom: 16, accent: '#4f46e5' };
const LEFT = { ...GEOMETRY, position: 'left' };
const SEED = 4242;

const grid = (from, to, n) => Array.from({ length: n + 1 }, (_, i) => Math.round((from + ((to - from) * i) / n) * 100) / 100);
const ends = (tracks) => tracks.reduce((m, t) => Math.max(m, (t.options.delay || 0) + t.options.duration * (t.options.iterations === Infinity ? 2 : t.options.iterations || 1)), 0);

function attentionCases() {
  const out = [];
  const add = (label, mode, clipped, wide) => {
    for (const t of attentionTracks(mode, clipped, wide)) {
      const L = t.options.duration;
      const S = t.options.delay || 0;
      out.push({ src: `attention:${label}:${t.part}`, box: t.part === 'shine' ? { w: 22.5, h: 80 } : { w: 50, h: 50 }, base: ATTENTION_BASE[t.part] || {}, tracks: [t], times: grid(0, S + 2 * L, 48) });
    }
  };
  for (const m of LAUNCHER_ATTENTIONS) if (m !== 'off') add(m, m, false, false);
  add('pulse-clipped', 'pulse', true, false);
  add('pulse-wide', 'pulse', false, true);
  return out;
}

function idleCases() {
  const out = [];
  for (const [label, geo] of [['right', GEOMETRY], ['left', LEFT]]) {
    for (const card of [false, true]) {
      for (const m of LAUNCHER_IDLE_CALLS) {
        if (m === 'off') continue;
        // The left side and the greeting-up variants for a few, to keep the file small.
        if ((label === 'left' || card) && m !== 'peek' && m !== 'knock') continue;
        const g = idleCallGeometry(geo.width, geo.height, geo.position, card);
        const p = idleCallPerformance(m, g);
        const times = grid(0, p.total, 48);
        const tag = `idle:${m}@${label}${card ? '+card' : ''}`;
        out.push({ src: `${tag}:self`, box: { w: p.mascot.size, h: p.mascot.size }, base: p.mascot.base, tracks: p.self, times });
        for (const [part, tracks] of Object.entries(p.parts)) out.push({ src: `${tag}:${part}`, box: { w: 100, h: 100 }, base: MASCOT_PART_BASE[part] || {}, tracks, times, transformScale: part === 'lid' });
        p.launcher.forEach((t, i) => out.push({ src: `${tag}:launcher${i}`, box: { w: 50, h: 50 }, base: {}, tracks: [t], times }));
        p.ripples.forEach((r, i) => out.push({ src: `${tag}:ripple${i}`, box: { w: r.d, h: r.d }, base: { o: 0 }, tracks: [r.track], times }));
        out.push({ src: `${tag}:bubble`, box: { w: 90, h: 32 }, base: {}, tracks: [p.bubble], times });
      }
    }
  }
  return out;
}

function entranceCases() {
  const out = [];
  for (const [label, geo] of [['right', GEOMETRY], ['left', LEFT]]) {
    const stage = entranceStage(geo);
    for (const m of LAUNCHER_ENTRANCES) {
      if (m === 'classic') continue;
      if (label === 'left' && !['ufo', 'confetti', 'magic', 'plane', 'meteor'].includes(m)) continue;
      const plan = entrancePlan(m, stage, SEED);
      const tl = entranceTimeline(plan);
      const times = grid(0, tl.endAt, 40);
      const tag = `entrance:${m}@${label}`;
      out.push({ src: `${tag}:arrive`, box: { w: 50, h: 50 }, base: {}, tracks: [{ ...plan.arrive, options: { ...plan.arrive.options, delay: plan.revealAt } }], times });
      const walk = (sp, path, parentW) => {
        if (sp.tracks.length) {
          const leftOf = sp.leftOf;
          out.push({ src: `${tag}:${path}`, box: { w: sp.w, h: sp.h, parentW: leftOf !== undefined ? leftOf : parentW, ...(sp.path ? { x: sp.x, y: sp.y } : {}) }, base: sp.base || {}, tracks: sp.tracks, times, path: sp.path ? sp.path.d : undefined });
        }
        (sp.children || []).forEach((c, i) => walk(c, `${path}.${i}`, sp.w));
      };
      plan.sprites.forEach((sp, i) => walk(sp, `s${i}`, stage.w));
    }
  }
  out.push({ src: 'entrance:settle', box: { w: 200, h: 80 }, base: {}, tracks: [SETTLE_REVEAL], times: grid(-100, 1000, 44) });
  return out;
}

module.exports = { GEOMETRY, LEFT, SEED, cases: () => [...attentionCases(), ...idleCases(), ...entranceCases()], ends };
