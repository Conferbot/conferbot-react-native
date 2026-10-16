/**
 * What the flow fixtures compare (scripts/parity/flows README, "SDK tests
 * should"), shared by the fixture run (flows.test.ts) and the step views'
 * run (components/FlowStepViews.test.tsx).
 */
import type { Fixture } from './flowDriver';

/**
 * Cases whose typing pace differs on purpose, with the reason. Everything
 * else in them is still compared.
 */
export const TIMING_SKIP: Record<string, string> = {
  // In the web harness the visitor's next action is played once every timer
  // has run, the card's own UI timers included (focus 30-50 ms, a debounce,
  // an animation). They move the web clock, not the flow; this SDK's cards
  // are native views with no such timers.
  'navigate.links-then-done': 'web link-click timers before Done (420 ms)',
  'rating-choice.smiley-and-ten': 'web rating animation before the next pick (300 ms)',
  'otp.verified': 'web OTP card focus timers (50 + 30 ms)',
  'otp.wrong-code-then-locked': 'web OTP card focus timers (50 + 30 ms)',
  'address.search-and-pick': 'web address search debounce and focus (300 + 50 ms)',
  'payment.paid': 'web payment card focus timer (60 ms)',
  'real.qa-all-nodes-tour': 'the card timers above, added up over the tour',
};

const pick = (o: any, keys: string[]) => {
  const out: any = {};
  keys.forEach((k) => (out[k] = o?.[k]));
  return out;
};

const bodyKeys = (h: any) => ({ path: h.path, keys: h.body ? Object.keys(h.body).sort() : [] });

/**
 * A time the visitor acted at ("consent_at", "signature_at"): it depends on
 * when the driver plays the action - the web harness's card timers (focus,
 * animations) move its clock first - so it is compared as a timestamp.
 */
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const stamp = (v: any): any => (typeof v === 'string' && ISO_TIME.test(v) ? '<timestamp>' : v);
const stampsIn = (text: any): any =>
  typeof text === 'string' ? text.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '<timestamp>') : text;

/** The differences between what the web did and what this SDK did. */
export const compare = (fx: Fixture, got: any): string[] => {
  const exp = fx.expect;
  const diffs: string[] = [];
  const eq = (label: string, a: any, b: any) => {
    const ja = JSON.stringify(a);
    const jb = JSON.stringify(b);
    if (ja !== jb) diffs.push(`${label}\n    web: ${ja}\n    sdk: ${jb}`);
  };

  eq('path', exp.path.map((p: any) => pick(p, ['node', 'type', 'via'])), got.path.map((p: any) => pick(p, ['node', 'type', 'via'])));
  eq('ports', exp.ports, got.ports);
  const vars = (list: any[]) => list.map((v: any) => ({ key: v.key, value: stamp(v.value) }));
  eq('variables', vars(exp.variables), vars(got.variables));
  const endKeys = exp.end.crashed ? ['ended', 'crashed', 'at'] : exp.end.ended ? ['ended'] : ['ended', 'waitingAt'];
  eq('end', pick(exp.end, endKeys), pick(got.end, endKeys));
  eq('errors (node)', exp.errors.map((e: any) => e.node), got.errors.map((e: any) => e.node));
  // answers: the shape and the value fields the web recorded
  if (exp.answers.length !== got.answers.length) eq('answers', exp.answers, got.answers);
  else exp.answers.forEach((a: any, i: number) => eq(`answers[${i}]`, a, pick(got.answers[i], Object.keys(a))));
  // rendered: each step's own text with the variables filled in
  const plainOf = (list: any[]) => list.map((r: any) => ({ node: r.node, plain: stampsIn(r.plain) }));
  eq('rendered', plainOf(exp.rendered), plainOf(got.rendered));
  eq('emits', exp.emits, got.emits);
  eq('unsupported', exp.unsupported, got.unsupported);
  eq('http', exp.http.map(bodyKeys), got.http.map(bodyKeys));
  if (exp.flowVariables) eq('flowVariables', exp.flowVariables, got.flowVariables);

  if (!TIMING_SKIP[fx.id]) {
    eq('shown (order)', exp.shown.map((s: any) => s.node), got.shown.map((s: any) => s.node));
    const gaps = (list: any[]) => list.slice(1).map((s: any, i: number) => s.t - list[i].t);
    const ge = gaps(exp.shown);
    const gg = gaps(got.shown);
    if (ge.length === gg.length && ge.some((g: number, i: number) => Math.abs(g - gg[i]) > 50)) {
      diffs.push(`shown (pace)\n    web: ${JSON.stringify(exp.shown)}\n    sdk: ${JSON.stringify(got.shown)}`);
    }
  }
  return diffs;
};
