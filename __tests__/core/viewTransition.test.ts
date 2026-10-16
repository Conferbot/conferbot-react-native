/**
 * The owner's view transition between home, chat and help centre
 * (src/core/viewTransition.ts; web ts/layout/viewTransition.ts).
 */
import { directionBetween, normalizeViewDirection, normalizeViewTransition, sweepVector, viewMotion } from '../../src/core/viewTransition';

describe('viewTransition', () => {
  it('unset is the honeycomb; unknown values too', () => {
    expect(normalizeViewTransition(undefined)).toBe('honeycomb');
    expect(normalizeViewTransition('nope')).toBe('honeycomb');
    expect(normalizeViewTransition('fade')).toBe('fade');
    expect(normalizeViewDirection('x')).toBe('auto');
  });

  it('deeper views are forward; coming back reverses the sweep', () => {
    expect(directionBetween('home', 'chat')).toBe('forward');
    expect(directionBetween('chat', 'home')).toBe('back');
    expect(directionBetween('home', 'help')).toBe('forward');
    expect(directionBetween('help', 'home')).toBe('back');
    expect(sweepVector('auto', 1)).toEqual({ x: 1, y: 0 });
    expect(sweepVector('auto', -1)).toEqual({ x: -1, y: 0 });
    expect(sweepVector('rtl', 1)).toEqual({ x: -1, y: 0 });
    expect(sweepVector('ttb', -1)).toEqual({ x: 0, y: -1 });
  });

  it('classic and none switch at once; the same view does not move', () => {
    expect(viewMotion('classic', 'auto', 'home', 'chat')).toEqual({ kind: 'none' });
    expect(viewMotion('none', 'auto', 'home', 'chat')).toEqual({ kind: 'none' });
    expect(viewMotion('fade', 'auto', 'chat', 'chat')).toEqual({ kind: 'none' });
  });

  it("fade and slide are the web's; the rest slide; reduced motion is a short fade", () => {
    expect(viewMotion('fade', 'auto', 'home', 'chat')).toEqual({ kind: 'fade', duration: 340, delay: 40, scaleFrom: 1.035 });
    expect(viewMotion('slide', 'auto', 'home', 'chat')).toEqual({ kind: 'slide', duration: 420, dx: 1, dy: 0 });
    expect(viewMotion('slide', 'auto', 'chat', 'home')).toEqual({ kind: 'slide', duration: 420, dx: -1, dy: 0 });
    expect(viewMotion(undefined, 'btt', 'home', 'chat')).toEqual({ kind: 'slide', duration: 420, dx: 0, dy: -1 });
    expect(viewMotion('iris', 'auto', 'home', 'help', true)).toEqual({ kind: 'reduced', duration: 200 });
    expect(viewMotion('classic', 'auto', 'home', 'help', true)).toEqual({ kind: 'none' });
  });
});
