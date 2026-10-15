import { nextIdleDelay, cubicBezier, iconFrame, rippleRing, FIRST_IDLE_MS, MOMENT_MS } from '../../src/core/launcherMotion';
import { launcherIconById, launcherIconSvg } from '../../src/core/launcherIcons';
import { LAUNCHER_ICONS } from '../../src/core/launcherIcons.data';

describe('launcher motion as the web plays it', () => {
  it('paces idle moments like the web: subtle, lively, off', () => {
    expect(nextIdleDelay('subtle', 0)).toBe(FIRST_IDLE_MS);
    expect(nextIdleDelay('subtle', 1)).toBe(30000);
    expect(nextIdleDelay('subtle', 4)).toBeNull();
    expect(nextIdleDelay('lively', 3, () => 0.5)).toBe(24000);
    expect(nextIdleDelay('lively', 10)).toBeNull();
    expect(nextIdleDelay('off', 0)).toBeNull();
    expect(MOMENT_MS).toBe(2600);
  });

  it('solves CSS cubic-bezier timing, overshoot included', () => {
    expect(cubicBezier([0.42, 0, 0.58, 1], 0.5)).toBeCloseTo(0.5, 3);
    expect(cubicBezier([0, 0, 1, 1], 0.3)).toBeCloseTo(0.3, 3);
    expect(cubicBezier([0.2, 1.4, 0.4, 1], 0.5)).toBeGreaterThan(1);
    expect(cubicBezier([0.42, 0, 0.58, 1], 0)).toBe(0);
    expect(cubicBezier([0.42, 0, 0.58, 1], 1)).toBe(1);
  });

  it('moves a classic icon whole and leaves it at rest after the moment', () => {
    const glossy = launcherIconById('WidgetBubbleIcon40');
    const mid = iconFrame(glossy, 'msg', 0.2);
    expect(mid.some((f) => f && f.m.join() !== '1,0,0,1,0,0')).toBe(true);
    expect(iconFrame(glossy, 'idle', 9).every((f) => f === null)).toBe(true);
  });

  it('blinks the winky face on idle (eyes squash), and its svg changes', () => {
    const winky = LAUNCHER_ICONS.find((i) => i.anim === 'winky')!;
    const atRest = launcherIconSvg(winky.id, '#fff', '#000');
    const blink = launcherIconSvg(winky.id, '#fff', '#000', 24, iconFrame(winky, 'idle', 0.12 * 2.4));
    expect(blink).not.toEqual(atRest);
  });

  it('wakes the sleepy face on a message (open eyes show)', () => {
    const sleepy = LAUNCHER_ICONS.find((i) => i.anim === 'sleepy')!;
    const f = iconFrame(sleepy, 'msg', 0.3);
    const openIdx = sleepy.ops.findIndex((o) => (o.parts || []).some((p) => p.c.includes('cbl-open')));
    expect(f[openIdx]?.layers?.some((l) => l.o === 1)).toBe(true);
  });

  it('ripples two rings, the second 0.6s behind, then stops', () => {
    expect(rippleRing(2.0, 0)).toBeNull();
    const a = rippleRing(2.5 + 0.9, 0)!;
    expect(a.scale).toBeGreaterThan(1);
    expect(a.opacity).toBeLessThan(0.45);
    expect(rippleRing(2.7, 1)).toBeNull();
    expect(rippleRing(2.5 + 1.8 * 3 + 0.1, 0)).toBeNull();
  });
});
