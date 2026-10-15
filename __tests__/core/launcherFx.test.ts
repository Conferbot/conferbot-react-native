import * as fs from 'fs';
import * as path from 'path';
import { computedOffsets, evaluate, iterationProgress, REST } from '../../src/core/keyframes';
import { attentionTarget, attentionTracks, normalizeLauncherAttention, orbitPoint, ATTENTION_BASE } from '../../src/core/launcherAttention';
import {
  afterCall,
  callAllowed,
  idleCallGeometry,
  idleCallLine,
  idleCallPerformance,
  normalizeIdleCallDelay,
  normalizeLauncherIdleCall,
  MIN_GAP_MS,
  MASCOT_PART_BASE,
} from '../../src/core/launcherIdleCall';
import {
  entrancePlan,
  entranceStage,
  entranceTimeline,
  normalizeLauncherEntrance,
  shouldPlayEntrance,
  spriteFrame,
  LAUNCHER_ENTRANCES,
  SETTLE_REVEAL,
} from '../../src/core/launcherEntrance';
import type { FxSprite } from '../../src/core/launcherEntrance';
import { mascotLayers, mixColor } from '../../src/core/mascotArt';
import { resolveLauncher } from '../../src/core/launcher';

const golden = JSON.parse(fs.readFileSync(path.join(__dirname, '../../scripts/parity/launcherfx/golden.json'), 'utf8'));
const CH = ['tx', 'ty', 'txp', 'typ', 'sx', 'sy', 'r', 'rx', 'ry', 'o', 'od', 'dash', 'clip', 'left'] as const;
const inf = (tracks: any[]) => tracks.map((t) => ({ ...t, options: { ...t.options, iterations: t.options.iterations === -1 ? Infinity : t.options.iterations } }));
const json = (x: unknown) => JSON.parse(JSON.stringify(x, (_k, v) => (v === Infinity ? -1 : v)));

describe('launcher entrance, attention and idle call as Chrome plays them', () => {
  it('evaluates every golden case within a hair of Chrome', () => {
    const max: Record<string, number> = {};
    let samples = 0;
    for (const c of golden.cases) {
      const tracks = inf(c.tracks);
      for (const s of c.samples) {
        const want = { ...REST, ...s.v };
        const got = evaluate(tracks, s.t, c.base);
        for (const ch of CH) max[ch] = Math.max(max[ch] || 0, Math.abs(got[ch] - want[ch]));
        if (c.path && want.px !== undefined) {
          const f = spriteFrame({ x: c.box.x, y: c.box.y, w: c.box.w, h: c.box.h, tracks, path: { d: c.path, rotate: true } }, s.t, got);
          max.path = Math.max(max.path || 0, Math.hypot(c.box.x + c.box.w / 2 + f.tx - want.px, c.box.y + c.box.h / 2 + f.ty - want.py));
        }
        samples += 1;
      }
    }
    expect(samples).toBeGreaterThan(15000);
    for (const ch of ['tx', 'ty', 'txp', 'typ', 'r', 'rx', 'ry', 'od', 'dash', 'clip']) expect(max[ch]).toBeLessThan(0.01);
    for (const ch of ['sx', 'sy', 'o']) expect(max[ch]).toBeLessThan(0.001);
    // Chrome lays `left` out on a 1/64 px grid; the motion path is flattened.
    expect(max.left).toBeLessThan(0.05);
    expect(max.path).toBeLessThan(0.6);
  });

  it('builds the same tracks the golden was sampled from', () => {
    const want: Record<string, any> = {};
    for (const c of golden.cases) want[c.src] = c.tracks;
    const g = golden.geometry.right;
    const check = (src: string, tracks: unknown) => {
      expect(want[src]).toBeDefined();
      expect(json(tracks)).toEqual(want[src]);
    };
    for (const t of attentionTracks('wobble')) check(`attention:wobble:${t.part}`, [t]);
    for (const t of attentionTracks('pulse', false, true)) check(`attention:pulse-wide:${t.part}`, [t]);
    const knock = idleCallPerformance('knock', idleCallGeometry(g.width, g.height, 'right', false));
    check('idle:knock@right:self', knock.self);
    check('idle:knock@right:arm', knock.parts.arm);
    const stage = entranceStage(g);
    for (const m of LAUNCHER_ENTRANCES) {
      if (m === 'classic') continue;
      const p = entrancePlan(m, stage, golden.seed)!;
      check(`entrance:${m}@right:arrive`, [{ ...p.arrive, options: { ...p.arrive.options, delay: p.revealAt } }]);
      const walk = (sp: FxSprite, at: string) => {
        if (sp.tracks.length) check(`entrance:${m}@right:${at}`, sp.tracks);
        (sp.children || []).forEach((c, i) => walk(c, `${at}.${i}`));
      };
      p.sprites.forEach((sp, i) => walk(sp, `s${i}`));
    }
  });
});

describe('the Web Animations evaluator', () => {
  it('spaces missing offsets evenly', () => {
    expect(computedOffsets([{}, {}, { offset: 0.5 }, {}, {}])).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it('keeps delay, iterations and fill', () => {
    const o = { duration: 1000, delay: 500, iterations: 2 };
    expect(iterationProgress(o, 100)).toBeNull();
    expect(iterationProgress({ ...o, fill: 'backwards' }, 100)).toBe(0);
    expect(iterationProgress(o, 1750)).toBeCloseTo(0.25, 6);
    expect(iterationProgress(o, 2600)).toBeNull();
    expect(iterationProgress({ ...o, fill: 'forwards' }, 9000)).toBe(1);
    expect(iterationProgress({ duration: 1000, iterations: Infinity }, 123456)).toBeCloseTo(0.456, 6);
  });

  it('lets the later animation win, over the element’s own values', () => {
    const a = { keyframes: [{ scale: 1 }, { scale: 2 }], options: { duration: 100, fill: 'forwards' as const } };
    const b = { keyframes: [{ scale: 3 }, { scale: 3 }], options: { duration: 100, delay: 50 } };
    expect(evaluate([a, b], 75).sx).toBe(3);
    expect(evaluate([a, b], 200).sx).toBe(2);
    expect(evaluate([b], 0, { sx: -1, o: 0 })).toMatchObject({ sx: -1, o: 0 });
  });
});

describe('settings, defaults and rules', () => {
  it('defaults to off / classic and normalises junk', () => {
    expect(normalizeLauncherEntrance(undefined)).toBe('classic');
    expect(normalizeLauncherEntrance('rocket')).toBe('rocket');
    expect(normalizeLauncherAttention('spin')).toBe('off');
    expect(normalizeLauncherIdleCall('knock')).toBe('knock');
    expect(normalizeIdleCallDelay(undefined)).toBe(12);
    expect(normalizeIdleCallDelay(1)).toBe(5);
    expect(normalizeIdleCallDelay('500')).toBe(120);
    const l = resolveLauncher({});
    expect([l.entrance, l.attention, l.idleCall, l.idleCallDelay]).toEqual(['classic', 'off', 'off', 12]);
    const on = resolveLauncher({ launcherEntrance: 'portal', launcherAttention: 'orbit', launcherIdleCall: 'tap', launcherIdleCallText: '  Need   a hand?  ' });
    expect([on.entrance, on.attention, on.idleCall, on.idleCallText]).toEqual(['portal', 'orbit', 'tap', 'Need a hand?']);
  });

  it('picks the bubble line: the owner’s (24 characters) or the style’s', () => {
    expect(idleCallLine('psst', '')).toBe('Psst!');
    expect(idleCallLine('wave', 'x'.repeat(40))).toHaveLength(24);
    expect(idleCallLine('off', 'hi')).toBe('');
  });

  it('plays an entrance once, never over an open chat or with reduced motion', () => {
    const base = { mode: 'drop' as const, reducedMotion: false, chatOpen: false, played: false };
    expect(shouldPlayEntrance(base)).toBe(true);
    expect(shouldPlayEntrance({ ...base, mode: 'classic' })).toBe(false);
    expect(shouldPlayEntrance({ ...base, played: true })).toBe(false);
    expect(shouldPlayEntrance({ ...base, chatOpen: true })).toBe(false);
    expect(shouldPlayEntrance({ ...base, reducedMotion: true })).toBe(false);
  });

  it('lands, then fades the rest up 150ms later for 0.9s', () => {
    const p = entrancePlan('rocket', entranceStage(golden.geometry.right), 1)!;
    expect(entranceTimeline(p)).toEqual({ landAt: 1330, landedAt: 1850, settleAt: 2000, endAt: 2960 });
    expect(evaluate([SETTLE_REVEAL], 0)).toMatchObject({ o: 0, ty: 10 });
    // The launcher is back at rest when it has landed.
    expect(evaluate([p.arrive], p.arrive.options.duration + 1)).toMatchObject({ o: 1, sx: 1, tx: 0 });
  });

  it('paces idle calls: twice a session, 3 minutes apart, then rest', () => {
    const t = 1_000_000;
    expect(callAllowed({ n: 0, at: 0 }, 0, t)).toBe(true);
    const one = afterCall({ n: 0, at: 0 }, t);
    expect(one.rest).toBe(false);
    expect(callAllowed(one.visit, 0, t + 1000)).toBe(false);
    expect(callAllowed(one.visit, 0, t + MIN_GAP_MS)).toBe(true);
    expect(afterCall(one.visit, t + MIN_GAP_MS).rest).toBe(true);
    expect(callAllowed({ n: 0, at: 0, quiet: true }, 0, t)).toBe(false);
    expect(callAllowed({ n: 0, at: 0 }, t + 1, t)).toBe(false);
  });

  it('moves the launcher or the card, per mode', () => {
    expect(attentionTarget('off')).toBeNull();
    expect(attentionTarget('float')).toBe('greeting');
    expect(attentionTarget('heartbeat')).toBe('launcher');
    // Each loop is one beat then stillness: the last third of a lap is at rest.
    const [self] = attentionTracks('heartbeat');
    expect(evaluate([self], 1500 + 3000 * 0.7)).toMatchObject({ sx: 1, sy: 1 });
    expect(ATTENTION_BASE.shine).toEqual({ txp: -160, r: 18 });
  });

  it('runs the orbit round the button, 7px outside it', () => {
    const top = orbitPoint(50, 50, 0);
    expect(top).toEqual({ x: 25, y: -7 });
    const right = orbitPoint(50, 50, 0.25);
    expect(right.x).toBeCloseTo(57, 6);
    expect(right.y).toBeCloseTo(25, 6);
    expect(orbitPoint(50, 50, 2)).toEqual(top);
  });

  it('slides the mascot out from behind the launcher, toward the screen', () => {
    const right = idleCallPerformance('wave', idleCallGeometry(50, 50, 'right', false));
    expect(right.mascot.size).toBe(60);
    expect(right.front).toBe(false);
    expect(right.talks).toBe(true);
    const out = evaluate(right.self, right.total / 2, right.mascot.base);
    expect(out.tx).toBeLessThan(0);
    expect(out.o).toBe(1);
    expect(evaluate(right.self, right.total, right.mascot.base).o).toBe(0);
    const tap = idleCallPerformance('tap', idleCallGeometry(50, 50, 'left', true));
    expect(tap.front).toBe(true);
    expect(tap.talks).toBe(false);
    expect(tap.ripples).toHaveLength(2);
    expect(MASCOT_PART_BASE.lid).toEqual({ sy: 0 });
  });

  it('draws the blob mascot in layers, its arm in front when it reaches', () => {
    expect(mixColor('#000000', 50, '#ffffff')).toBe('#808080');
    expect(mascotLayers('#4f46e5', 'knock').armFront).toContain('<svg');
    expect(mascotLayers('#4f46e5', 'knock').armBack).toBeNull();
    expect(mascotLayers('#4f46e5', 'wave').armBack).toContain('<svg');
  });

  it('builds every entrance on a stage, and ends it', () => {
    const stage = entranceStage(golden.geometry.right);
    expect(stage).toMatchObject({ unit: 50, inward: -1, rect: { left: 324, top: 778 } });
    expect(entrancePlan('classic', stage)).toBeNull();
    for (const m of LAUNCHER_ENTRANCES) {
      if (m === 'classic') continue;
      const p = entrancePlan(m, stage, 7)!;
      expect(p.sprites.length).toBeGreaterThan(0);
      const tl = entranceTimeline(p);
      // Nothing still showing on screen once the stage goes (the saucer has flown off the top).
      const shown = (sp: FxSprite): boolean => {
        const f = spriteFrame(sp, tl.endAt);
        return f.o > 0.02 && !!(sp.svg || sp.fill) && sp.y + f.ty + sp.h > -stage.rect.top;
      };
      expect(p.sprites.filter(shown)).toHaveLength(0);
    }
  });
});
