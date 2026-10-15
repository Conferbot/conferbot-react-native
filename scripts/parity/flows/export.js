#!/usr/bin/env node
// Real node data, as the builder saved it, from a Conferbot database.
// READ ONLY: it only runs find() on chatbots and flowversions.
//
//   MONGO_URL=mongodb://127.0.0.1:27017/conferbotStaging node export.js
//
// Writes samples/real-nodes.json: for every node type found, how many nodes
// have it, which data keys they carry (and how often), which source handles
// their edges leave by, and one example node with its outgoing edges.
// Secrets, credentials and e-mail addresses are scrubbed before writing.
const fs = require('fs');
const { OWN_BOTS, anonNode } = require('./anon');
const path = require('path');

const DEV = process.env.CONFERBOT_DEV || path.resolve(__dirname, '../../../../..');
const { MongoClient } = require(path.join(DEV, 'embed-server/node_modules/mongodb'));
const URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/conferbotStaging';
const OUT = path.join(__dirname, 'samples/real-nodes.json');
// Whole flows kept as they are saved (the QA bots that exercise every step).
const QA_BOTS = (process.env.QA_BOTS || '6ac12071ad600df5f50db1d6,65016d4143e3041d74a9053c,65b2808a3bb00a3a2d47166c,66e1a19cd2cb6db0354bace9,627217bd9454945bbbc90ece').split(',').filter(Boolean);

const SECRET = /(api_?key|password|secret|token|credential|authorization|cookie|webhookurl|privatekey)/i;
const scrub = (v, key = '') => {
  if (SECRET.test(key) && v !== '' && v !== null && typeof v !== 'object') return '<redacted>';
  if (Array.isArray(v)) return v.map((x) => scrub(x, key));
  if (v && typeof v === 'object') {
    if (v._bsontype === 'ObjectId' || v._bsontype === 'ObjectID') return String(v);
    if (v instanceof Date) return v.toISOString();
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = scrub(x, k);
    return o;
  }
  if (typeof v === 'string') {
    const s = v.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, 'visitor@example.com');
    return s.length > 600 ? `${s.slice(0, 600)}…` : s;
  }
  return v;
};

const groupOf = (elements) => {
  const el = Array.isArray(elements) ? elements[0] : elements;
  return el && Array.isArray(el.nodes) ? el : null;
};

(async () => {
  const client = new MongoClient(URL, { readPreference: 'secondaryPreferred' });
  await client.connect();
  const db = client.db();
  const types = {};
  const names = {};
  const visit = (source, botId, botName, group) => {
    const edges = Array.isArray(group.edges) ? group.edges : [];
    for (const n of group.nodes) {
      if (!n || !n.type) continue;
      const t = (types[n.type] = types[n.type] || { count: 0, keys: {}, handles: {}, example: null });
      t.count++;
      Object.keys(n.data || {}).forEach((k) => (t.keys[k] = (t.keys[k] || 0) + 1));
      const out = edges.filter((e) => e && e.source === n.id);
      out.forEach((e) => {
        const h = e.sourceHandle === undefined ? '(none)' : e.sourceHandle === null ? '(null)' : String(e.sourceHandle);
        t.handles[h] = (t.handles[h] || 0) + 1;
      });
      // The example: from a live bot first, with the most data keys.
      const score = (source === 'chatbots' ? 1000 : 0) + Object.keys(n.data || {}).length + out.length;
      if (!t.example || score > t.example.score) {
        // Our own QA bots keep their content; anyone else's node is anonymised
        // (anon.js): same keys, types, handles and structure, neutral text,
        // generic ids, no bot id or name.
        const own = OWN_BOTS.has(botId);
        const node = own ? scrub(n) : anonNode(scrub(n));
        const ids = new Map([[n.id, node.id]]);
        const edges = out.map((e, i) => {
          const x = scrub(e);
          if (own) return x;
          if (!ids.has(x.target)) ids.set(x.target, `target-${i + 1}`);
          return { ...x, id: `edge-${i + 1}`, source: node.id, target: ids.get(x.target) };
        });
        t.example = { score, source: own ? `QA bot "${botName}"` : 'real node shape (anonymised)', own, node, edges };
      }
    }
  };
  for await (const b of db.collection('chatbots').find({}, { projection: { elements: 1, name: 1 } })) {
    const g = groupOf(b.elements);
    names[String(b._id)] = b.name || '';
    if (g) visit('chatbots', String(b._id), b.name || '', g);
  }
  for await (const v of db.collection('flowversions').find({}, { projection: { elements: 1, chatbotId: 1, botId: 1 } })) {
    const g = groupOf(v.elements);
    if (g) visit('flowversions', String(v.chatbotId || v.botId || v._id), names[String(v.chatbotId || v.botId)] || '', g);
  }
  const { ObjectId } = require(path.join(DEV, 'embed-server/node_modules/mongodb'));
  for (const id of QA_BOTS) {
    const b = await db.collection('chatbots').findOne({ _id: new ObjectId(id) }, { projection: { elements: 1, name: 1 } });
    const g = b && groupOf(b.elements);
    if (!g) continue;
    const file = path.join(__dirname, `samples/bot-${id}.json`);
    fs.writeFileSync(file, `${JSON.stringify({ botId: id, name: b.name, nodes: scrub(g.nodes), edges: scrub(g.edges) }, null, 2)}\n`);
    console.log(`flow of "${b.name}" -> ${path.relative(process.cwd(), file)}`);
  }
  await client.close();
  const out = {};
  Object.keys(types)
    .sort()
    .forEach((t) => {
      const x = types[t];
      delete x.example.score;
      out[t] = {
        count: x.count,
        keys: Object.fromEntries(Object.entries(x.keys).sort((a, b) => b[1] - a[1])),
        handles: Object.fromEntries(Object.entries(x.handles).sort((a, b) => b[1] - a[1])),
        example: x.example,
      };
    });
  fs.writeFileSync(OUT, `${JSON.stringify({ generatedFrom: URL.replace(/\/\/[^@]*@/, '//'), types: out }, null, 2)}\n`);
  console.log(`${Object.keys(out).length} node types -> ${path.relative(process.cwd(), OUT)}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
