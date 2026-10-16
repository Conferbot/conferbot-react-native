import {
  mascotColorOf,
  mascotLayers,
  mascotLookOf,
  mascotOrigins,
  mascotPoint,
  mascotScaleOf,
  mixColor,
  MASCOT_ACCESSORIES,
  MASCOT_DEFAULT_NAMES,
  MASCOT_EYES,
  MASCOT_LAYER_ORDER,
  MASCOT_ORIGINS,
  MASCOT_SHAPES,
} from '../../src/core/mascotArt';
import { moodPlan, typingLabel, MASCOT_KEYFRAMES, TYPING_MASCOT } from '../../src/core/mascotMoods';
import {
  cardEnterTrack,
  cardLeaveTrack,
  createMascotDirector,
  figureAmp,
  gestureTrack,
  normalizeMascotMotion,
  ownsText,
  voicePlayMs,
  wordFade,
  ENTRANCE,
  IDLE_GAP_MIN,
  IDLE_GAP_SPREAD,
  PING_MS,
  SETTLE_AFTER,
} from '../../src/core/mascotMotion';
import { evaluate, tracksEnd } from '../../src/core/keyframes';
import { resolveCustomizations } from '../../src/core/customizations';
import { resolveLauncher } from '../../src/core/launcher';

/** Well-formed markup: every tag closed in order, attributes quoted, nothing between the tags. */
const wellFormed = (xml: string): boolean => {
  const stack: string[] = [];
  const re = /<(\/?)([a-zA-Z]+)((?:\s+[a-zA-Z0-9-:]+="[^"<>]*")*)\s*(\/?)>/g;
  let at = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (xml.slice(at, m.index).trim()) return false;
    at = re.lastIndex;
    if (m[1]) {
      if (stack.pop() !== m[2]) return false;
    } else if (!m[4]) stack.push(m[2]);
  }
  return at === xml.length && stack.length === 0;
};

describe('the owner\'s mascot (art3d mascotLookOf, mascotScaleOf)', () => {
  it('defaults to the classic blob and keeps only known values', () => {
    expect(mascotLookOf(undefined)).toEqual({ shape: 'blob', eyes: 'round', accessory: 'none', color: '', name: '' });
    expect(mascotLookOf({ mascotShape: 'dragon', mascotEyes: 'laser', mascotAccessory: 'cape', mascotColor: 'red', mascotName: 42 })).toEqual({ shape: 'blob', eyes: 'round', accessory: 'none', color: '', name: '' });
    expect(mascotLookOf({ mascotShape: 'fox', mascotEyes: 'star', mascotAccessory: 'crown', mascotColor: ' #F97316 ', mascotName: '  Pip   the  fox, the friendliest one ' })).toEqual({
      shape: 'fox',
      eyes: 'star',
      accessory: 'crown',
      color: '#F97316',
      name: 'Pip the fox, the fri',
    });
  });

  it('sizes the launcher mascot 70-150% of the button, 112 when unset', () => {
    expect(mascotScaleOf({})).toBe(112);
    expect(mascotScaleOf({ mascotLauncherScale: null })).toBe(112);
    expect(mascotScaleOf({ mascotLauncherScale: '' })).toBe(112);
    expect(mascotScaleOf({ mascotLauncherScale: 'big' })).toBe(112);
    expect(mascotScaleOf({ mascotLauncherScale: 10 })).toBe(70);
    expect(mascotScaleOf({ mascotLauncherScale: 999 })).toBe(150);
    expect(mascotScaleOf({ mascotLauncherScale: '120.4' })).toBe(120);
  });

  it('has 27 characters, each with its own name', () => {
    expect(MASCOT_SHAPES).toHaveLength(27);
    for (const s of MASCOT_SHAPES) expect(MASCOT_DEFAULT_NAMES[s]).toBeTruthy();
  });

  it('paints the owner\'s colour, cloud and ghost paler, a tooth pearly', () => {
    expect(mascotColorOf({ shape: 'cat', color: '#ff0000' }, '#0000ff')).toBe('#ff0000');
    expect(mascotColorOf({ shape: 'cat', color: '' }, '#0000ff')).toBe('#0000ff');
    expect(mascotColorOf({ shape: 'cloud', color: '' }, '#000000')).toBe(mixColor('#000000', 45, '#ffffff'));
    expect(mascotColorOf({ shape: 'ghost' }, '#000000')).toBe(mixColor('#000000', 22, '#ffffff'));
    expect(mascotColorOf({ shape: 'tooth' }, '#000000')).toBe(mixColor('#000000', 12, '#ffffff'));
  });
});

describe('the mascot drawn in layers', () => {
  it('draws every character, eyes and accessory as valid SVG react-native-svg can read', () => {
    let drawn = 0;
    for (const shape of MASCOT_SHAPES) {
      for (const eyes of MASCOT_EYES) {
        for (const accessory of MASCOT_ACCESSORIES) {
          if (eyes !== 'round' && accessory !== 'none' && shape !== 'robot') continue;
          for (const bust of [false, true]) {
            const l = mascotLayers('#4f46e5', 'wave', { shape, eyes, accessory }, { bust });
            for (const k of MASCOT_LAYER_ORDER) {
              const xml = l[k];
              if (xml === null) continue;
              expect(wellFormed(xml)).toBe(true);
              // No CSS react-native-svg would drop: no style, class, filter or color-mix().
              expect(xml).not.toMatch(/style=|class=|filter=|color-mix|undefined|NaN/);
              drawn += 1;
            }
          }
        }
      }
    }
    expect(drawn).toBeGreaterThan(1500);
  });

  it('keeps the arm behind or in front by its pose, and the bust without arms, tail or shadow', () => {
    expect(mascotLayers('#4f46e5', 'knock').armFront).toContain('<svg');
    expect(mascotLayers('#4f46e5', 'knock').armBack).toBeNull();
    expect(mascotLayers('#4f46e5', 'wave').armBack).toContain('<svg');
    const cat = mascotLayers('#4f46e5', 'wave', { shape: 'cat' });
    expect(cat.tail).toContain('<path');
    const bust = mascotLayers('#4f46e5', 'wave', { shape: 'cat' }, { bust: true });
    expect([bust.shadow, bust.tail, bust.armBack, bust.armFront]).toEqual([null, null, null, null]);
    expect(bust.body).toContain('viewBox="4 0 92 96"');
    // The body's left arm goes with the arms.
    expect(cat.body.length).toBeGreaterThan(bust.body.length);
  });

  it('draws the owner\'s eyes and accessory where they belong', () => {
    const sleepy = mascotLayers('#4f46e5', 'down', { eyes: 'sleepy' });
    expect(sleepy.face).toContain('<path');
    expect(mascotLayers('#4f46e5', 'down').face).toBeNull();
    const shades = mascotLayers('#4f46e5', 'down', { eyes: 'shades' });
    expect(shades.cover).toContain('#0b1020');
    // Glasses and hats on top of everything; a robot's LED eyes without whites.
    expect(mascotLayers('#4f46e5', 'down', { accessory: 'glasses' }).top).toContain('stroke="#1f2937"');
    expect(mascotLayers('#4f46e5', 'down', { accessory: 'crown' }).top).toContain('#facc15');
    const robot = mascotLayers('#4f46e5', 'down', { shape: 'robot' });
    expect(robot.body).not.toContain('url(#me)');
    expect(robot.cover).toBeNull();
    // An industry character's props are on top, in their own paints.
    expect(mascotLayers('#4f46e5', 'down', { shape: 'medic' }).top).toContain('url(#mr)');
    expect(mascotLayers('#4f46e5', 'down', { shape: 'medic' }).top).toContain('id="mr"');
  });

  it('colours the body in the owner\'s colour and the pupils\' rim in the launcher\'s', () => {
    const l = mascotLayers('#000000', 'down', { color: '#ff0000' });
    expect(l.body).toContain('stop-color="#ff0000"');
    expect(l.look).toContain(mixColor('#000000', 45, '#0b1020'));
  });

  it('turns each part about its joint, the lids at the character\'s eyes', () => {
    expect(MASCOT_ORIGINS).toMatchObject({ body: [50, 94], arm: [80, 64], lid: [50, 39], look: [50, 54], brow: [50, 36] });
    // The car's eyes are high and small: eyeY 40, scale 0.62.
    expect(mascotOrigins({ shape: 'car' }).lid[1]).toBeCloseTo(40 - 13 * 0.62, 6);
    // The bust's 92 x 96 viewBox fitted in a square box.
    expect(mascotPoint([4, 0], 96, true)).toEqual([2, 0]);
    expect(mascotPoint([50, 94], 100, false)).toEqual([50, 94]);
  });

  it('is one svg per layer', () => {
    const body = mascotLayers('#4f46e5', 'down', { shape: 'owl' }).body;
    expect(body.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">')).toBe(true);
    expect(wellFormed('<svg><g></svg>')).toBe(false);
  });
});

describe('the moods (art3d MASCOT_ANIM_CSS)', () => {
  it('blinks always, and adds the mood\'s own moves', () => {
    expect(Object.keys(moodPlan('idle').parts)).toEqual(['lid']);
    expect(Object.keys(moodPlan('wave', { arm: 'wave' }).parts).sort()).toEqual(['arm', 'lid']);
    expect(Object.keys(moodPlan('think').parts).sort()).toEqual(['body', 'brow', 'lid', 'look']);
    expect(Object.keys(moodPlan('happy', { arm: 'down' }).parts).sort()).toEqual(['arm', 'body', 'lid', 'shadow']);
    expect(moodPlan('happy').grin).toBe(true);
    // The bust (launcher, typing) has no arm.
    expect(moodPlan('happy', { bust: true }).parts.arm).toBeUndefined();
  });

  it('lifts a resting arm before it waves, and waves a set number of times', () => {
    const up = moodPlan('wave', { arm: 'down' }).parts.arm![0];
    expect(up.options.duration).toBe(3200);
    expect(evaluate([up], 3200 * 0.24).r).toBeCloseTo(-132, 4);
    const two = moodPlan('wave', { arm: 'wave', waveCount: 2 });
    expect(tracksEnd(two.parts.arm!)).toBe(5600);
    // The loop starts on a whole blink after the two waves.
    expect(two.settle).toBe(6400);
    expect(two.period).toBe(6400);
  });

  it('hops twice when happy, then blinks on', () => {
    const p = moodPlan('happy', { arm: 'down' });
    expect(evaluate(p.parts.body!, 900 * 0.45).ty).toBeCloseTo(-8, 4);
    expect(tracksEnd(p.parts.body!)).toBe(1800);
  });

  it('loops think as one lap of all its parts', () => {
    expect(moodPlan('think').period).toBe(19200);
  });

  it('keeps the smile and nothing else under reduced motion', () => {
    expect(moodPlan('happy', { reduced: true })).toEqual({ parts: {}, grin: true, settle: 0, period: 0 });
  });

  it('types: sways about 50% 90%, blinks, glances, three dots 0.2s apart', () => {
    expect(TYPING_MASCOT.origin).toEqual([16, 28.8]);
    expect(evaluate([TYPING_MASCOT.sway], 1200).r).toBeCloseTo(4, 6);
    expect(TYPING_MASCOT.dots.map((d) => d.track.options.delay || 0)).toEqual([0, 200, 400]);
    expect(TYPING_MASCOT.period % 2400).toBe(0);
    expect(TYPING_MASCOT.period % 3400).toBe(0);
    expect(MASCOT_KEYFRAMES['cb-typing-blink']).toContain('95%');
    expect(typingLabel('mascot', 'Pip')).toBe('Pip is typing');
    expect(typingLabel('dots', 'Pip')).toBe('Typing');
  });
});

// ---------- The greeting card's figure (mascotMotion.ts), on a fake clock ----------

const clock = () => {
  let t = 0;
  let next = 1;
  const queue = new Map<number, { at: number; fn: () => void }>();
  return {
    timers: {
      set: (fn: () => void, ms: number) => {
        const id = next++;
        queue.set(id, { at: t + ms, fn });
        return id;
      },
      clear: (id: unknown) => queue.delete(id as number),
    },
    now: () => t,
    pending: () => queue.size,
    advance(ms: number) {
      const end = t + ms;
      for (;;) {
        let id: number | null = null;
        let at = Infinity;
        queue.forEach((v, k) => {
          if (v.at <= end && v.at < at) {
            at = v.at;
            id = k;
          }
        });
        if (id === null) break;
        const { fn } = queue.get(id)!;
        queue.delete(id);
        t = at;
        fn();
      }
      t = end;
    },
  };
};

const make = (opts: Record<string, any> = {}) => {
  const c = clock();
  const log: any[][] = [];
  const stage = {
    play: (g: string, amp: number, delay?: number) => log.push([`play:${g}`, amp, delay || 0]),
    breathe: (on: boolean) => log.push([on ? 'breathe' : 'exhale']),
    talk: (on: boolean, amp: number) => log.push([on ? 'talk' : 'quiet', amp]),
    lean: (x: number, amp: number) => log.push(['lean', x, amp]),
    ping: (on: boolean) => log.push([on ? 'ping' : 'ping-off']),
    words: () => log.push(['words']),
    reset: () => log.push(['reset']),
  };
  const d = createMascotDirector({ mode: 'lively', stage, timers: c.timers, now: c.now, random: () => 0.5, ...opts });
  return { c, d, log, names: () => log.map((e) => e[0]) };
};
const IDLE_GAP = IDLE_GAP_MIN + 0.5 * IDLE_GAP_SPREAD;

describe('the greeting card\'s figure, alive (home/mascotMotion.ts)', () => {
  it('is lively unless the owner chose subtle or off', () => {
    expect(normalizeMascotMotion(undefined)).toBe('lively');
    expect(normalizeMascotMotion('wild')).toBe('lively');
    expect(normalizeMascotMotion('subtle')).toBe('subtle');
    expect(normalizeMascotMotion('off')).toBe('off');
  });

  it('lively: words, pop, wave, ping, nod, then a breath', () => {
    const { c, d, log, names } = make();
    d.show();
    expect(names()).toEqual(['reset', 'words', 'play:pop']);
    expect(log[2][2]).toBe(ENTRANCE.lively.pop);
    c.advance(ENTRANCE.lively.wave);
    expect(names().pop()).toBe('play:wave');
    c.advance(ENTRANCE.lively.ping - ENTRANCE.lively.wave);
    expect(names().pop()).toBe('ping');
    c.advance(ENTRANCE.lively.nod - ENTRANCE.lively.ping);
    expect(names().pop()).toBe('play:nod');
    c.advance(ENTRANCE.lively.idle - ENTRANCE.lively.nod);
    expect(d.state).toBe('living');
    expect(names()).toContain('breathe');
    c.advance(PING_MS);
    expect(names()).toContain('ping-off');
  });

  it('three idle gestures at most, then still for good with no timer left', () => {
    const { c, d, names } = make();
    d.show();
    c.advance(ENTRANCE.lively.idle);
    for (let i = 0; i < 6; i += 1) c.advance(IDLE_GAP);
    expect(d.gestures).toBe(3);
    c.advance(SETTLE_AFTER);
    expect(d.state).toBe('settled');
    expect(names().pop()).toBe('exhale');
    expect(c.pending()).toBe(0);
    c.advance(120000);
    expect(d.gestures).toBe(3);
  });

  it('subtle: a rise, the ping, one tilt; no words, no wave', () => {
    const { c, d, names } = make({ mode: 'subtle' });
    d.show();
    c.advance(ENTRANCE.subtle.idle);
    for (let i = 0; i < 4; i += 1) c.advance(IDLE_GAP);
    c.advance(SETTLE_AFTER);
    const n = names();
    expect(n).toEqual(expect.arrayContaining(['play:rise', 'ping', 'play:tilt']));
    expect(n).not.toContain('words');
    expect(n).not.toContain('play:wave');
    expect(d.state).toBe('settled');
  });

  it('reduced motion: a fade, nothing else; off: nothing at all', () => {
    const r = make({ reduced: () => true });
    r.d.show();
    r.d.hide('open');
    r.c.advance(60000);
    expect(r.names()).toEqual(['reset', 'play:fadeIn', 'reset']);
    const off = make({ mode: 'off' });
    off.d.show();
    off.c.advance(60000);
    expect(off.names()).toEqual(['reset']);
  });

  it('a voice note: talks in place of the wave, then quiet', () => {
    const { c, d, names } = make();
    d.show();
    d.talkFor(3600);
    c.advance(ENTRANCE.lively.wave);
    expect(names().pop()).toBe('talk');
    c.advance(3600 - ENTRANCE.lively.wave);
    expect(names().pop()).toBe('quiet');
  });

  it('hands off when the chat opens from the card, bows at the x, nothing more after', () => {
    const open = make();
    open.d.show();
    open.d.hide('open');
    expect(open.names().pop()).toBe('play:handoff');
    expect(open.c.pending()).toBe(0);
    const close = make({ mode: 'subtle' });
    close.d.show();
    close.d.hide('close');
    expect(close.log.pop()).toEqual(['play:bow', 0.6, 0]);
  });

  it('waits in the background, and gives way to the card leaving', () => {
    const { c, d } = make();
    d.show();
    c.advance(ENTRANCE.lively.idle);
    d.pageHidden(true);
    c.advance(60000);
    expect(d.gestures).toBe(0);
    d.pageHidden(false);
    c.advance(IDLE_GAP);
    expect(d.gestures).toBe(1);
    let alive = true;
    const gone = make({ alive: () => alive });
    gone.d.show();
    alive = false;
    gone.c.advance(ENTRANCE.lively.wave);
    expect(gone.d.state).toBe('destroyed');
    expect(gone.c.pending()).toBe(0);
  });

  it('moves a mascot all the way, a photo and initials less', () => {
    expect([figureAmp('mascot'), figureAmp('avatar'), figureAmp('initials'), figureAmp(null)]).toEqual([1, 0.75, 0.55, 1]);
    expect(ownsText('typewriter') && ownsText('imessage') && !ownsText('card')).toBe(true);
  });
});

describe('the greeting card\'s own moves (polish-home.css)', () => {
  it('springs up when lively, comes in as always otherwise; the notification and neon keep theirs', () => {
    expect(cardEnterTrack('lively', 'card')!.options.duration).toBe(620);
    expect(cardEnterTrack('subtle', 'card')!.options.duration).toBe(450);
    expect(cardEnterTrack('off', 'note')!.options.duration).toBe(450);
    expect(cardEnterTrack('lively', 'notification')).toBeNull();
    expect(cardEnterTrack('lively', 'neon')).toBeNull();
    expect(cardEnterTrack('lively', 'card', true)).toBeNull();
    const spring = cardEnterTrack('lively', 'card')!;
    expect(evaluate([spring], 0)).toMatchObject({ o: 0, ty: 14, sx: 0.94 });
    expect(evaluate([spring], 620)).toMatchObject({ o: 1, ty: 0, sx: 1 });
  });

  it('collapses toward the launcher when opened from the card, fades when closed', () => {
    expect(cardLeaveTrack('lively', 'open')!.options).toMatchObject({ duration: 240, delay: 40 });
    expect(cardLeaveTrack('off', 'open')!.options.duration).toBe(220);
    expect(cardLeaveTrack('subtle', 'close')!.options.duration).toBe(220);
    expect(cardLeaveTrack('lively', 'open', true)).toBeNull();
  });

  it('fades the words up within a second', () => {
    expect(wordFade('Hi')).toBeNull();
    const f = wordFade('Hi there, how can we help you today?')!;
    expect(f.words).toHaveLength(8);
    expect(f.step).toBe(55);
    const long = wordFade(Array.from({ length: 40 }, (_, i) => `w${i}`).join(' '))!;
    expect(long.step).toBe(13);
    expect(tracksEnd([long.tracks[39]])).toBeLessThan(1250);
    expect(voicePlayMs()).toBe(3660);
  });

  it('plays each gesture as the web does: the leaving ones hold their end', () => {
    expect(gestureTrack('handoff', 1).options.fill).toBe('forwards');
    expect(gestureTrack('pop', 1, 140).options).toMatchObject({ delay: 140, fill: 'backwards' });
    expect(evaluate([gestureTrack('pop', 1, 140)], 0)).toMatchObject({ o: 0, sx: 0.3 });
  });
});

describe('the mascot settings, resolved', () => {
  it('reads them into the customizations and the launcher', () => {
    const c = { mascotShape: 'owl', mascotInGreeting: true, mascotMotion: 'subtle', mascotLauncherScale: 130, widgetIconBgColor: '#123456', launcherStyle: 'mascot' };
    const r = resolveCustomizations(c as any);
    expect(r.mascot.shape).toBe('owl');
    expect(r).toMatchObject({ mascotInGreeting: true, mascotMotion: 'subtle', mascotLauncherScale: 130, mascotAccent: '#123456' });
    expect(resolveCustomizations({} as any)).toMatchObject({ mascotInGreeting: false, mascotMotion: 'lively', mascotLauncherScale: 112 });
    const l = resolveLauncher(c, 390);
    expect(l.style).toBe('mascot');
    expect(l.mascot).toMatchObject({ scale: 130, accent: '#123456', light: mixColor('#123456', 14, '#ffffff') });
    expect(l.mascot.look.shape).toBe('owl');
  });
});
