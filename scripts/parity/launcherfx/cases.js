// The cases the launcher entrance / attention / idle call are checked on:
// every animated element of every mode, at fixed geometries, built from the
// RN core (compiled to ./js by check.sh). Each case: where it comes from
// (src), its box, its own static values (base), its Web Animations tracks
// and the times (ms) to sample.
const { attentionTracks, ATTENTION_BASE, LAUNCHER_ATTENTIONS } = require('./js/launcherAttention');
const { idleCallPerformance, idleCallGeometry, MASCOT_PART_BASE, LAUNCHER_IDLE_CALLS } = require('./js/launcherIdleCall');
const { entrancePlan, entranceStage, entranceTimeline, LAUNCHER_ENTRANCES, SETTLE_REVEAL } = require('./js/launcherEntrance');
const { cssTrack, MASCOT_KEYFRAMES, moodPlan, TYPING_MASCOT, TYPING_PENCIL } = require('./js/mascotMoods');
const { CARD_KEYFRAMES, cardEnterTrack, cardLeaveTrack, gestureTrack, talkTrack, BREATH, PING, wordFade } = require('./js/mascotMotion');

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

// The mascot: its moods and the typing mascot (CSS @keyframes, played by
// Chrome as CSS animations from the web's own text: `css`), the greeting
// card's figure gestures (element.animate) and the card's own CSS moves.
// A transform list is read back as its matrix (`matrix`).
function mascotCases() {
  const out = [];
  const span = (tr) => {
    const o = tr.options;
    const d = o.delay || 0;
    return d + o.duration * (o.iterations === Infinity ? 2 : o.iterations || 1) + 120;
  };
  const css = (src, name, keyframes, tr, base, box, fill = 'none') => {
    const o = tr.options;
    const timing = tr.keyframes[0].easing;
    out.push({
      src,
      box,
      base,
      tracks: [tr],
      times: grid(0, span(tr), 60),
      css: { name, body: keyframes[name], duration: o.duration, timing, delay: o.delay || 0, iterations: o.iterations === Infinity ? 'infinite' : o.iterations || 1, fill: o.fill || fill },
      ...(name.includes('blink') ? { transformScale: true } : tr.keyframes.some((k) => k.transform !== undefined) ? { matrix: true } : {}),
    });
  };
  // Moods: wave (an arm drawn waving, and a resting arm lifting first), think, happy, the blink.
  const moods = [
    ['wave', { arm: 'wave', waveCount: 2 }],
    ['wave', { arm: 'down' }],
    ['think', {}],
    ['happy', { arm: 'down' }],
  ];
  for (const [mood, o] of moods) {
    const plan = moodPlan(mood, o);
    for (const [part, tracks] of Object.entries(plan.parts)) {
      tracks.forEach((tr) => {
        const name =
          part === 'lid' ? 'cb-m-blink' : part === 'arm' ? (mood === 'happy' ? 'cb-m-cheer' : o.arm === 'down' ? 'cb-m-wave-up' : 'cb-m-wave') :
          part === 'body' ? (mood === 'happy' ? 'cb-m-hop' : 'cb-m-bob') : part === 'shadow' ? 'cb-m-hop-shadow' : part === 'look' ? 'cb-m-glance' : 'cb-m-ponder';
        if (part === 'lid' && mood !== 'wave') return;
        css(`mascot:mood-${mood}${o.arm ? `@${o.arm}` : ''}:${part}`, name, MASCOT_KEYFRAMES, tr, part === 'lid' ? { sy: 0 } : {}, { w: 22, h: 26 });
      });
    }
  }
  // The typing mascot and the pencil.
  css('mascot:typing:sway', 'cb-typing-sway', MASCOT_KEYFRAMES, TYPING_MASCOT.sway, {}, { w: 32, h: 32 });
  css('mascot:typing:blink', 'cb-typing-blink', MASCOT_KEYFRAMES, TYPING_MASCOT.blink, { sy: 0 }, { w: 22, h: 26 });
  css('mascot:typing:glance', 'cb-typing-glance', MASCOT_KEYFRAMES, TYPING_MASCOT.glance, {}, { w: 20, h: 20 });
  TYPING_MASCOT.dots.forEach((d, i) => css(`mascot:typing:dot${i}`, 'cb-typing-dot', MASCOT_KEYFRAMES, d.track, { o: 0.25 }, { w: d.d, h: d.d }));
  css('mascot:pencil:line', 'cb-typing-write', MASCOT_KEYFRAMES, TYPING_PENCIL.write, { dash: 60 }, { w: 44, h: 16 });
  css('mascot:pencil:pencil', 'cb-typing-pencil', MASCOT_KEYFRAMES, TYPING_PENCIL.pencil, {}, { w: 16, h: 16 });
  // The card: in (lively / the rest), out, the collapse, the ping, a word.
  css('mascot:card:spring', 'cb-greet-spring', CARD_KEYFRAMES, cardEnterTrack('lively', 'card'), {}, { w: 296, h: 120 });
  css('mascot:card:in', 'cb-greet-in', CARD_KEYFRAMES, cardEnterTrack('subtle', 'card'), {}, { w: 296, h: 120 });
  css('mascot:card:collapse', 'cb-greet-collapse', CARD_KEYFRAMES, cardLeaveTrack('lively', 'open'), {}, { w: 296, h: 120 });
  css('mascot:card:out', 'cb-greet-out', CARD_KEYFRAMES, cardLeaveTrack('off', 'close'), {}, { w: 296, h: 120 });
  css('mascot:card:ping-dot', 'cb-mm-dot', CARD_KEYFRAMES, PING.dot, {}, { w: 7, h: 7 });
  css('mascot:card:ping-ring', 'cb-mm-ring', CARD_KEYFRAMES, PING.ring, {}, { w: 7, h: 7 });
  css('mascot:card:word3', 'cb-mm-word', CARD_KEYFRAMES, wordFade('Hi there, how can we help you today?').tracks[3], {}, { w: 40, h: 18 });
  // The figure's gestures (Web Animations), at full and a photo's amplitude.
  for (const amp of [1, 0.75, 0.55]) {
    for (const g of ['pop', 'rise', 'fadeIn', 'wave', 'tilt', 'nod', 'hop', 'handoff', 'bow']) {
      if (amp !== 1 && (g === 'rise' || g === 'fadeIn')) continue;
      const tr = gestureTrack(g, g === 'fadeIn' ? 0 : amp, g === 'pop' ? 140 : g === 'rise' ? 80 : 0, g === 'handoff' ? { x: -40, y: 60 } : undefined);
      out.push({ src: `mascot:gesture:${g}@${amp}`, box: { w: 40, h: 40 }, base: {}, tracks: [tr], times: grid(0, span(tr), 48), matrix: true });
    }
    const t = talkTrack(amp);
    out.push({ src: `mascot:gesture:talk@${amp}`, box: { w: 40, h: 40 }, base: {}, tracks: [t], times: grid(0, span(t), 48), matrix: true });
  }
  out.push({ src: 'mascot:gesture:breath', box: { w: 40, h: 40 }, base: {}, tracks: [BREATH], times: grid(0, span(BREATH), 48) });
  return out;
}

module.exports = { GEOMETRY, LEFT, SEED, cases: () => [...attentionCases(), ...idleCases(), ...entranceCases(), ...mascotCases()], ends };
