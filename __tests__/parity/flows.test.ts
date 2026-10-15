/**
 * The shared flow-node spec, run through this SDK's NodeFlowEngine and
 * handlers (scripts/parity/flows: nodes.spec.json + 156 fixtures whose
 * outcomes come from running the web widget's own code).
 *
 * Compared, per the fixtures README ("SDK tests should"):
 *   path (node, type, via), ports, variables (key + value), end,
 *   errors (count + node), answers (shape + value fields), rendered plain
 *   text, emits, unsupported, http (path + body keys), flowVariables, and
 *   the typing pace between shown steps (+-50 ms) where it is not skipped
 *   on purpose (TIMING_SKIP).
 *
 * Cases for node types this SDK does not run yet are listed in PENDING and
 * skipped - every other case, the engine rules included, must pass.
 */
import { runFixture, Fixture } from './flowDriver';

const DIR = '../../scripts/parity/flows/fixtures';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const index = require(`${DIR}/index.json`);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const load = (file: string): Fixture => require(`${DIR}/${file}`);

/** Node types not run by this SDK yet: their cases are pending (#52). */
export const PENDING_TYPES = new Set<string>([]);

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

const pendingReason = (fx: Fixture): string | null => {
  const types = new Set<string>([...(fx.covers || []), ...fx.flow.nodes.map((n: any) => n.type)]);
  const pending = [...types].filter((t) => PENDING_TYPES.has(t));
  return pending.length ? pending.join(', ') : null;
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

describe('flow-node spec fixtures', () => {
  const all: Fixture[] = index.cases.map((c: any) => load(c.file));
  const active = all.filter((fx) => !pendingReason(fx)).map((fx) => [fx.id, fx] as [string, Fixture]);
  const pending = all.filter((fx) => pendingReason(fx)).map((fx) => [`${fx.id} (pending: ${pendingReason(fx)})`, fx] as [string, Fixture]);

  test.each(active)('%s', async (id: string, fx: Fixture) => {
    const { outcome, problems } = await runFixture(fx);
    const diffs = [...problems.map((p) => `problem: ${p}`), ...compare(fx, outcome)];
    if (diffs.length) throw new Error(`${id}\n  ${diffs.join('\n  ')}`);
  });

  if (pending.length) test.skip.each(pending)('%s', () => undefined);

  test('every pending type is still missing from the registry', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { NodeHandlerRegistry } = require('../../src/core/nodes/NodeHandlerRegistry');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { registerAllHandlers } = require('../../src/core/nodes/handlers');
    const registry = new NodeHandlerRegistry();
    registerAllHandlers(registry, {});
    [...PENDING_TYPES].forEach((t) => expect(registry.hasHandler(t)).toBe(false));
    expect(active.length + pending.length).toBe(index.cases.length);
  });
});
