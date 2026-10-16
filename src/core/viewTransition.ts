/**
 * How the open chat moves between its views - the home screen, the
 * conversation and the help centre - from the owner's setting
 * (customizations.viewTransition, viewTransitionDirection). Ported from the
 * web widget: conferbot-widget src/ts/layout/viewTransition.ts
 * (VIEW_TRANSITIONS, normalizeViewTransition, VIEW_DIRECTIONS,
 * normalizeViewDirection, sweepVector, directionBetween and the "reduced",
 * "fade" and "slide" tracks of playViewTransition).
 *
 * The web lays a still copy of the old view (a "ghost") over the panel and
 * animates it away while the new view comes in. A native view has no ghost
 * to copy, so the app plays the new view's half only:
 *
 *   classic, none   the view switches at once (classic's header drop is the
 *                   old widget's own and is not played);
 *   fade            the new view fades up from 103.5% over 340ms, 40ms in;
 *   slide           it slides in from the sweep's side over 420ms;
 *   anything else   (honeycomb - the default -, iris, ripple, cards, blinds,
 *                   pixels, flip, mosaic, diamonds, bubbles, stripes, wave,
 *                   curtain, shutter): the slide, the calm move closest to
 *                   the web's sweeps;
 *   reduced motion  a 200ms fade, whatever the owner picked (as the web).
 *
 * Pure.
 */

export const VIEW_TRANSITIONS = [
  'classic',
  'none',
  'slide',
  'fade',
  'iris',
  'ripple',
  'honeycomb',
  'cards',
  'blinds',
  'pixels',
  'flip',
  'mosaic',
  'diamonds',
  'bubbles',
  'stripes',
  'wave',
  'curtain',
  'shutter',
] as const;
export type ViewTransition = (typeof VIEW_TRANSITIONS)[number];

/** Unset: the sliding honeycomb ("classic" stays the widget as it always was). */
export const DEFAULT_VIEW_TRANSITION: ViewTransition = 'honeycomb';
export const normalizeViewTransition = (value: unknown): ViewTransition =>
  VIEW_TRANSITIONS.includes(value as ViewTransition) ? (value as ViewTransition) : DEFAULT_VIEW_TRANSITION;

/**
 * Which way a transition sweeps. "auto" goes sideways by where the views
 * sit (deeper is to the right); the others are fixed, and coming back
 * plays them in reverse. "tap" (out from the tap) has no tap point here and
 * goes sideways as "auto".
 */
export const VIEW_DIRECTIONS = ['auto', 'ltr', 'rtl', 'ttb', 'btt', 'tap'] as const;
export type ViewSweep = (typeof VIEW_DIRECTIONS)[number];
export const normalizeViewDirection = (value: unknown): ViewSweep =>
  VIEW_DIRECTIONS.includes(value as ViewSweep) ? (value as ViewSweep) : 'auto';

/** The sweep as a unit vector for a move forward (+1) or back (-1). */
export const sweepVector = (sweep: unknown, dir: 1 | -1): { x: number; y: number } => {
  const s = normalizeViewDirection(sweep);
  const base = s === 'rtl' ? { x: -1, y: 0 } : s === 'ttb' ? { x: 0, y: 1 } : s === 'btt' ? { x: 0, y: -1 } : { x: 1, y: 0 };
  return { x: base.x * dir || 0, y: base.y * dir || 0 };
};

export type ViewDirection = 'forward' | 'back';

/** Where the views sit, left to right (the web's VIEW_ORDER; the app's help centre is "kb"). */
const VIEW_ORDER: Record<string, number> = { home: 0, initial_page: 0, chat: 1, kb: 2, help: 2, articles: 2, list: 3, article: 4 };
export const directionBetween = (from: string, to: string): ViewDirection =>
  (VIEW_ORDER[to] ?? 1) >= (VIEW_ORDER[from] ?? 1) ? 'forward' : 'back';

export type ViewMotion =
  | { kind: 'none' }
  /** The new view's opacity 0 -> 1, linear. */
  | { kind: 'reduced'; duration: number }
  /** Opacity 0 -> 1 and scale `scaleFrom` -> 1, after `delay`. */
  | { kind: 'fade'; duration: number; delay: number; scaleFrom: number }
  /** In from (dx, dy) times the view's size to its place. */
  | { kind: 'slide'; duration: number; dx: number; dy: number };

/** The web's easings (viewTransition.ts EASE, EASE_IO) as cubic-bezier points. */
export const VIEW_EASE = [0.22, 0.8, 0.24, 1] as const;
export const VIEW_EASE_IO = [0.6, 0, 0.25, 1] as const;

/** How the new view comes in when the chat moves from one view to another. */
export const viewMotion = (
  kind: unknown,
  sweep: unknown,
  from: string,
  to: string,
  reduced = false
): ViewMotion => {
  if (from === to) return { kind: 'none' };
  const k = normalizeViewTransition(kind);
  if (k === 'classic' || k === 'none') return { kind: 'none' };
  if (reduced) return { kind: 'reduced', duration: 200 };
  if (k === 'fade') return { kind: 'fade', duration: 340, delay: 40, scaleFrom: 1.035 };
  const v = sweepVector(sweep, directionBetween(from, to) === 'back' ? -1 : 1);
  return { kind: 'slide', duration: 420, dx: v.x, dy: v.y };
};
