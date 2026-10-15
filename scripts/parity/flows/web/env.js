// The web widget's own flow code, loaded in Node so the fixtures can be run
// through it: displayStep.ts, the step handlers (ts/chat/handlers/*),
// richNodesView.ts, flowControlRun.ts and the pure modules, unchanged.
//
// What is NOT the widget's code:
//   - src/index.ts (the engine with sockets, storage, the page) is replaced by
//     ./runtime.js, a line-by-line copy of its flow functions with citations;
//   - src/core/socket.ts is a fake socket (./fakeSocket.js);
//   - the DOM is jsdom, fetch is scripted per fixture, and the clock is
//     virtual (setTimeout / setInterval / Date), so delays are measured exactly.
//
// Paths: CONFERBOT_DEV is the folder holding conferbot-widget, client and sdk/.
const path = require('path');
const fs = require('fs');
const Module = require('module');

const DEV = process.env.CONFERBOT_DEV || path.resolve(__dirname, '../../../../../..');
const W = path.join(DEV, 'conferbot-widget/src');
const req = (name, ...dirs) => {
  for (const d of dirs) {
    try {
      return require(path.join(DEV, d, 'node_modules', name));
    } catch (e) {
      /* next */
    }
  }
  return require(name);
};
const ts = req('typescript', 'conferbot-widget', 'client', 'sdk/conferbot-react-native');
const { JSDOM } = req('jsdom', 'client', 'conferbot-widget');

// ----- Virtual clock -----
// 2026-10-15 10:00 UTC, a Thursday: business-hours and date cases depend on it.
const BASE = Date.UTC(2026, 9, 15, 10, 0, 0);
const RealDate = Date;
const clock = { now: 0, seq: 0, timers: new Map() };
const addTimer = (fn, ms, args, every) => {
  const id = ++clock.seq;
  const wait = Math.max(0, Number(ms) || 0);
  clock.timers.set(id, { id, at: clock.now + wait, fn, args, every: every ? Math.max(1, wait) : 0 });
  return id;
};
const fakeTimers = {
  setTimeout: (fn, ms, ...args) => addTimer(fn, ms, args, false),
  setInterval: (fn, ms, ...args) => addTimer(fn, ms, args, true),
  clearTimeout: (id) => clock.timers.delete(id),
  clearInterval: (id) => clock.timers.delete(id),
};
class FakeDate extends RealDate {
  constructor(...a) {
    if (a.length === 0) super(BASE + clock.now);
    else super(...a);
  }
  static now() {
    return BASE + clock.now;
  }
}
FakeDate.UTC = RealDate.UTC;
FakeDate.parse = RealDate.parse;

const realImmediate = setImmediate;
const flushMicro = async (n = 6) => {
  for (let i = 0; i < n; i++) await new Promise((r) => realImmediate(r));
};

/**
 * Let the widget run until it waits for the visitor: every timeout is run in
 * time order; when only repeating timers are left (a resend countdown, a
 * payment status poll) it stops - the visitor acts then. With `waitMs`
 * (a "wait" input) time runs on, intervals included, for that long.
 */
const settle = async (waitMs) => {
  const explicit = typeof waitMs === 'number';
  const limit = clock.now + (explicit ? waitMs : 30 * 60 * 1000);
  for (let guard = 0; guard < 200000; guard++) {
    await flushMicro();
    let next = null;
    for (const t of clock.timers.values()) {
      if (!explicit && t.every) continue;
      if (!next || t.at < next.at || (t.at === next.at && t.id < next.id)) next = t;
    }
    if (!next || next.at > limit) {
      if (explicit) clock.now = Math.max(clock.now, limit);
      return;
    }
    clock.now = Math.max(clock.now, next.at);
    if (next.every) next.at = clock.now + next.every;
    else clock.timers.delete(next.id);
    try {
      next.fn(...(next.args || []));
    } catch (e) {
      env.errors.push(String(e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
    }
  }
};

// ----- DOM -----
const dom = new JSDOM('<!doctype html><html><head><title>Site</title></head><body></body></html>', {
  url: 'https://shop.example/pricing?utm_source=newsletter&utm_campaign=fall',
  referrer: 'https://www.google.com/',
  pretendToBeVisual: true,
});
const win = dom.window;
Object.assign(win, fakeTimers);
win.Date = FakeDate;
win.HTMLElement.prototype.scrollIntoView = function () {};
win.HTMLElement.prototype.scrollBy = function () {};
win.HTMLElement.prototype.scrollTo = function () {};
win.scrollTo = () => {};
win.HTMLMediaElement.prototype.play = function () {
  return Promise.resolve();
};
win.HTMLMediaElement.prototype.pause = function () {};
win.HTMLMediaElement.prototype.load = function () {};
// A 2D context that draws nothing, and a PNG it can always hand back: the
// signature step exports through it (jsdom has no canvas).
const ctx2d = new Proxy(
  {},
  {
    get: (t, k) => (k === 'measureText' ? (s) => ({ width: String(s).length * 8 }) : k in t ? t[k] : () => undefined),
    set: (t, k, v) => ((t[k] = v), true),
  }
);
win.HTMLCanvasElement.prototype.getContext = function () {
  return ctx2d;
};
win.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,iVBORw0KGgo=';
win.HTMLCanvasElement.prototype.toBlob = function (cb, type) {
  cb(new win.Blob(['png'], { type: type || 'image/png' }));
};
win.open = () => null;
win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
if (!win.CSS) win.CSS = {};
if (!win.CSS.escape) win.CSS.escape = (s) => String(s).replace(/["\\\]\[]/g, '\\$&');

const GLOBALS = [
  'window', 'document', 'DOMParser', 'Node', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement',
  'Element', 'Event', 'CustomEvent', 'KeyboardEvent', 'MouseEvent', 'InputEvent', 'sessionStorage', 'localStorage',
  'getComputedStyle', 'CSS', 'MutationObserver', 'File', 'Blob', 'FormData', 'DataTransfer', 'requestAnimationFrame',
  'cancelAnimationFrame', 'ShadowRoot', 'DocumentFragment', 'Image', 'URL', 'URLSearchParams', 'AbortController',
];
for (const k of GLOBALS) {
  if (k in win) {
    try {
      global[k] = win[k];
    } catch (e) {
      Object.defineProperty(global, k, { value: win[k], configurable: true, writable: true });
    }
  }
}
global.window = win;
global.requestAnimationFrame = (fn) => fakeTimers.setTimeout(() => fn(clock.now), 16);
global.cancelAnimationFrame = (id) => fakeTimers.clearTimeout(id);
Object.assign(global, fakeTimers);
global.Date = FakeDate;
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
global.IntersectionObserver = global.ResizeObserver;
win.ResizeObserver = global.ResizeObserver;
global.__CONFERBOT_API_BASE__ = 'https://api.test';
console.warn = (...a) => env.warnings.push(a.join(' '));
const quiet = console.log;
console.error = (...a) => env.consoleErrors.push(a.map((x) => (x && x.message) || String(x)).join(' '));

// ----- Module loading: the widget's .ts files, transpiled as they load -----
const CACHE = path.join(require('os').tmpdir(), 'conferbot-flow-parity-ts');
const INDEX = path.join(W, 'index.ts');
const SOCKET = path.join(W, 'core/socket.ts');
const I18N = path.join(W, 'ts/i18n.ts');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (parent && parent.filename && parent.filename.startsWith(W) && request.startsWith('.')) {
    const base = path.resolve(path.dirname(parent.filename), request);
    for (const c of [base + '.ts', base, path.join(base, 'index.ts')]) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return resolve.call(this, request, parent, ...rest);
};
const env = {
  DEV,
  W,
  win,
  dom,
  clock,
  settle,
  flushMicro,
  BASE,
  errors: [],
  warnings: [],
  consoleErrors: [],
  runtime: null, // set by runtime.js (stands in for src/index.ts)
  socket: null, // set by fakeSocket.js (stands in for src/core/socket.ts)
  log: quiet,
};
require.extensions['.ts'] = (mod, filename) => {
  if (filename === INDEX) {
    mod.exports = env.runtime.exportsProxy;
    return;
  }
  if (filename === SOCKET) {
    mod.exports = { socket: env.socket, engagementGate: { hold() {}, release() {} }, initSocket() {} };
    return;
  }
  // Transpiled once per file version (a fresh process runs each case).
  const source = fs.readFileSync(filename, 'utf8');
  const key = require('crypto').createHash('sha1').update(`${ts.version}\0${filename}\0${source}`).digest('hex');
  const cached = path.join(CACHE, `${key}.js`);
  let outputText;
  try {
    outputText = fs.readFileSync(cached, 'utf8');
  } catch (e) {
    outputText = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true },
      fileName: filename,
    }).outputText;
    try {
      fs.mkdirSync(CACHE, { recursive: true });
      fs.writeFileSync(cached, outputText);
    } catch (err) {
      /* no cache: still runs */
    }
  }
  mod._compile(outputText, filename);
};
for (const ext of ['.css', '.scss', '.svg', '.png', '.gif', '.mp3', '.json5']) require.extensions[ext] = (m) => (m.exports = {});
// socket.io-client is never needed (the socket module is replaced).
const widgetRequire = (rel) => require(path.join(W, rel));
env.widgetRequire = widgetRequire;
env.I18N = I18N;
module.exports = env;
