#!/usr/bin/env node
// Builds the flow-node conformance data shared by the 4 SDKs:
//
//   nodes.spec.json   from spec.src.js; every citation's line is found again
//                     in the widget source by its anchor text, so the
//                     file:line references stay right when the widget moves.
//   fixtures/*.json   from cases.src.js; every "executed" case is run through
//                     the widget's own code (web/*) and its outcome becomes
//                     the case's `expect`.
//
//   node gen.js                 write everything
//   node gen.js --check         rebuild in memory, exit 1 if a committed file differs
//   node gen.js --only <text>   run only the cases whose id contains <text> (prints, writes nothing)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { scrubUrls } = require('./anon');

const DEV = process.env.CONFERBOT_DEV || path.resolve(__dirname, '../../../../..');
const HERE = __dirname;
const FIX = path.join(HERE, 'fixtures');
const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

// ---------------------------------------------------------------------------
// Citations: { f: "<path under the dev folder>", a: "<text on that line>", n?: <nth match> }
// ---------------------------------------------------------------------------
const fileCache = {};
const lines = (f) => (fileCache[f] = fileCache[f] || fs.readFileSync(path.join(DEV, f), 'utf8').split('\n'));
const problems = [];
const cite = (c) => {
  if (typeof c === 'string') return c;
  const ls = lines(c.f);
  let seen = 0;
  for (let i = 0; i < ls.length; i++) {
    if (ls[i].includes(c.a) && ++seen === (c.n || 1)) return `${c.f}:${i + 1}`;
  }
  problems.push(`citation not found: ${c.f} "${c.a}"${c.n ? ` #${c.n}` : ''}`);
  return `${c.f}:?`;
};
const resolveCites = (v) => {
  if (Array.isArray(v)) return v.map(resolveCites);
  if (v && typeof v === 'object') {
    if (typeof v.f === 'string' && typeof v.a === 'string' && Object.keys(v).every((k) => ['f', 'a', 'n'].includes(k))) return cite(v);
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = resolveCites(x);
    return o;
  }
  return v;
};

const stable = (v) => `${JSON.stringify(v, null, 2)}\n`;
const writeOrCheck = (file, text, changed) => {
  const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (prev === text) return;
  changed.push(path.relative(HERE, file));
  if (!CHECK) fs.writeFileSync(file, text);
};

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------
const runCase = (c) =>
  new Promise((resolve) => {
    const tmp = path.join(os.tmpdir(), `cb-flow-${process.pid}-${c.id}.json`);
    fs.writeFileSync(tmp, JSON.stringify(c));
    execFile(process.execPath, [path.join(HERE, 'web/runOne.js'), tmp], { env: { ...process.env, CONFERBOT_DEV: DEV }, maxBuffer: 64 << 20 }, (err, stdout, stderr) => {
      fs.unlinkSync(tmp);
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        resolve({ fatal: `${err || ''} ${stderr || ''} ${stdout.slice(0, 500)}` });
      }
    });
  });

const pool = async (items, n, fn) => {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    })
  );
  return out;
};

const FIXTURE_KEYS = ['id', 'title', 'covers', 'provenance', 'source', 'notes', 'customizations', 'server', 'random', 'visitorTimeZone', 'calendarBookings', 'integrationWebhooks', 'flow', 'inputs', 'expect'];

(async () => {
  const changed = [];
  // samples/ (export.js, local only - never committed) feeds cases.src.js.
  // Without it the committed fixtures are the cases: each one is run again
  // through the widget and must give the same outcome.
  const haveSamples = fs.existsSync(path.join(HERE, 'samples/real-nodes.json'));
  const fromFixtures = () =>
    require('./fixtures/index.json').cases.map((c) => {
      const f = JSON.parse(fs.readFileSync(path.join(FIX, c.file), 'utf8'));
      if (f.provenance === 'read') return f;
      const { expect, ...rest } = f;
      return rest;
    });
  if (!haveSamples) console.error('samples/ not found: re-running the committed fixtures (run export.js for a full rebuild)');
  // No customer data in committed files: S3 object URLs (customer folder ids) -> example URLs (anon.js).
  const cases = (haveSamples ? require('./cases.src.js') : fromFixtures()).map((c) => scrubUrls(c));
  const ids = new Set();
  for (const c of cases) {
    if (ids.has(c.id)) problems.push(`duplicate case id ${c.id}`);
    ids.add(c.id);
  }
  const todo = ONLY ? cases.filter((c) => c.id.includes(ONLY)) : cases;
  const runs = await pool(todo.filter((c) => c.provenance !== 'read'), Math.max(1, Math.min(6, os.cpus().length - 1)), runCase);
  const byId = {};
  todo.filter((c) => c.provenance !== 'read').forEach((c, i) => (byId[c.id] = runs[i]));

  const fixtures = todo.map((c) => {
    const r = byId[c.id];
    let expect = c.expect;
    if (c.provenance !== 'read') {
      if (!r || r.fatal) problems.push(`${c.id}: harness failed: ${r && r.fatal}`);
      else {
        (r.problems || []).forEach((p) => problems.push(`${c.id}: ${p}`));
        if ((r.missingExports || []).length) problems.push(`${c.id}: runtime.js lacks index.ts exports ${r.missingExports.join(', ')}`);
        expect = r.outcome;
      }
    }
    const f = { ...c, provenance: c.provenance || 'executed', expect };
    const out = {};
    FIXTURE_KEYS.forEach((k) => f[k] !== undefined && (out[k] = f[k]));
    return out;
  });

  if (ONLY) {
    fixtures.forEach((f) => console.log(stable({ id: f.id, expect: f.expect })));
    problems.forEach((p) => console.error(`! ${p}`));
    return;
  }

  // fixtures/<id>.json + fixtures/index.json
  fs.mkdirSync(FIX, { recursive: true });
  const keep = new Set(['index.json']);
  for (const f of fixtures) {
    const name = `${f.id}.json`;
    keep.add(name);
    writeOrCheck(path.join(FIX, name), stable(f), changed);
  }
  for (const old of fs.readdirSync(FIX)) {
    if (old.endsWith('.json') && !keep.has(old)) {
      changed.push(`fixtures/${old} (stale)`);
      if (!CHECK) fs.unlinkSync(path.join(FIX, old));
    }
  }
  const index = {
    note: 'One conformance case per file. See README.md for the format and how each SDK runs them.',
    count: fixtures.length,
    executed: fixtures.filter((f) => f.provenance === 'executed').length,
    read: fixtures.filter((f) => f.provenance === 'read').length,
    cases: fixtures.map((f) => ({ id: f.id, file: `${f.id}.json`, covers: f.covers, provenance: f.provenance })),
  };
  writeOrCheck(path.join(FIX, 'index.json'), stable(index), changed);

  // nodes.spec.json
  const spec = resolveCites(require('./spec.src.js'));
  const covered = {};
  fixtures.forEach((f) => (f.covers || []).forEach((t) => (covered[t] = covered[t] || []).push(f.id)));
  for (const [type, s] of Object.entries(spec.nodes)) {
    s.fixtures = covered[type] || [];
    if (!s.fixtures.length && !s.webOnly) problems.push(`spec: ${type} has no fixture`);
  }
  // Every type the widget dispatches must be in the spec (core/node-processors/nodeTypeCategories.ts, richNodes.ts, resultPaths.ts).
  const src = (f) => fs.readFileSync(path.join(DEV, 'conferbot-widget/src', f), 'utf8');
  const listed = new Set();
  const grab = (text, from, to) => {
    const part = text.slice(text.indexOf(from), to ? text.indexOf(to, text.indexOf(from)) : undefined);
    (part.match(/"([a-z0-9-]+-node)"/g) || []).forEach((m) => listed.add(m.slice(1, -1)));
  };
  grab(src('core/node-processors/nodeTypeCategories.ts'), 'DISPLAY_NODE_TYPES', 'export type');
  grab(src('ts/chat/richNodes.ts'), 'RICH_NODE_TYPES', 'RICH_LOGIC_TYPES');
  grab(src('ts/chat/handlers/resultPaths.ts'), 'RESULT_INTEGRATION_STEP_TYPES', 'SUCCESS_HANDLE');
  listed.add('welcome-node');
  for (const t of listed) if (!spec.nodes[t]) problems.push(`spec: widget handles ${t} but the spec has no entry`);
  spec.coverage = { nodeTypes: Object.keys(spec.nodes).length, fixtures: fixtures.length };
  writeOrCheck(path.join(HERE, 'nodes.spec.json'), stable(spec), changed);

  problems.forEach((p) => console.error(`! ${p}`));
  if (CHECK) {
    if (changed.length) console.error(`out of date:\n  ${changed.join('\n  ')}`);
    process.exit(changed.length || problems.length ? 1 : 0);
  }
  console.log(`${fixtures.length} fixtures (${index.executed} executed, ${index.read} read), ${Object.keys(spec.nodes).length} node types; ${changed.length} files written`);
  if (problems.length) process.exitCode = 1;
})();
