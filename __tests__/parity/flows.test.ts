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
import { compare } from './flowCompare';

const DIR = '../../scripts/parity/flows/fixtures';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const index = require(`${DIR}/index.json`);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const load = (file: string): Fixture => require(`${DIR}/${file}`);

/** Node types not run by this SDK yet: their cases are pending (#52). */
export const PENDING_TYPES = new Set<string>([]);

const pendingReason = (fx: Fixture): string | null => {
  const types = new Set<string>([...(fx.covers || []), ...fx.flow.nodes.map((n: any) => n.type)]);
  const pending = [...types].filter((t) => PENDING_TYPES.has(t));
  return pending.length ? pending.join(', ') : null;
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
