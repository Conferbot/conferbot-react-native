/**
 * Headless driver for the shared flow-node fixtures
 * (scripts/parity/flows/fixtures, README "Using the fixtures in an SDK").
 *
 * One case = one fresh ChatState, registry (registerAllHandlers) and
 * NodeFlowEngine. The clock is virtual (setTimeout / setInterval / Date),
 * fetch answers from the case's `server.http`, and a fake socket answers
 * `execute-integration` and `initiate-handover` from `server.integration`
 * and `server.handover`. Each visitor action is played through
 * engine.submitResponse with the answer the SDK's UI would send for it.
 */
import { NodeFlowEngine, FlowTraceEvent } from '../../src/core/NodeFlowEngine';
import { ChatState } from '../../src/core/state/ChatState';
import { NodeHandlerRegistry } from '../../src/core/nodes/NodeHandlerRegistry';
import { registerAllHandlers } from '../../src/core/nodes/handlers';
import { plainText } from '../../src/core/flow/text';

// The visitor's time zone is UTC (fixtures README, "Fixed context").
process.env.TZ = 'UTC';

// ----- Virtual clock (web/env.js) -----
// 2026-10-15 10:00 UTC, a Thursday.
export const BASE = Date.UTC(2026, 9, 15, 10, 0, 0);
const RealDate: DateConstructor = Date;
// jest.setup.js turns fake timers on for every test: this driver keeps its
// own clock, so it runs on the real ones (captured in captureReal).
const real: any = {};
const captureReal = () => {
  jest.useRealTimers();
  Object.assign(real, {
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout,
    setInterval: global.setInterval,
    clearInterval: global.clearInterval,
    setImmediate: global.setImmediate,
    Date: global.Date,
    fetch: (global as any).fetch,
  });
};

interface Timer {
  id: number;
  at: number;
  fn: (...a: any[]) => void;
  args: any[];
  every: number;
}
const clock = { now: 0, seq: 0, timers: new Map<number, Timer>() };
const addTimer = (fn: any, ms: any, args: any[], every: boolean) => {
  const id = ++clock.seq;
  const wait = Math.max(0, Number(ms) || 0);
  clock.timers.set(id, { id, at: clock.now + wait, fn, args, every: every ? Math.max(1, wait) : 0 });
  return id as any;
};

class FakeDate extends RealDate {
  constructor(...a: any[]) {
    if (a.length === 0) super(BASE + clock.now);
    else super(...(a as [any]));
  }
  static now() {
    return BASE + clock.now;
  }
}
(FakeDate as any).UTC = RealDate.UTC;
(FakeDate as any).parse = RealDate.parse;

const install = () => {
  (global as any).setTimeout = (fn: any, ms?: any, ...args: any[]) => addTimer(fn, ms, args, false);
  (global as any).setInterval = (fn: any, ms?: any, ...args: any[]) => addTimer(fn, ms, args, true);
  (global as any).clearTimeout = (id: any) => clock.timers.delete(id);
  (global as any).clearInterval = (id: any) => clock.timers.delete(id);
  (global as any).Date = FakeDate;
};
const uninstall = () => {
  (global as any).setTimeout = real.setTimeout;
  (global as any).setInterval = real.setInterval;
  (global as any).clearTimeout = real.clearTimeout;
  (global as any).clearInterval = real.clearInterval;
  (global as any).Date = real.Date;
  (global as any).fetch = real.fetch;
};

const dbg = (m: string) => {
  if (process.env.FLOW_DEBUG) process.stdout.write(`${m}\n`);
};
const flushMicro = async (n = 12) => {
  for (let i = 0; i < n; i++) await new Promise((r) => real.setImmediate(r));
};

/**
 * Run until the engine waits for the visitor: every timeout in time order;
 * when only repeating timers are left (a resend countdown, a status poll)
 * it stops. With `waitMs`, time runs on - intervals included - that long.
 */
const settle = async (waitMs?: number) => {
  const explicit = typeof waitMs === 'number';
  const limit = clock.now + (explicit ? (waitMs as number) : 30 * 60 * 1000);
  for (let guard = 0; guard < 200000; guard++) {
    await flushMicro();
    let next: Timer | null = null;
    for (const t of clock.timers.values()) {
      if (!explicit && t.every) continue;
      if (!next || t.at < next.at || (t.at === next.at && t.id < next.id)) next = t;
    }
    if (!next || next.at > limit) {
      if (explicit) clock.now = Math.max(clock.now, limit);
      await flushMicro();
      return;
    }
    if (process.env.FLOW_DEBUG && guard > 0 && guard % 500 === 0) {
      // eslint-disable-next-line no-console
      process.stdout.write(`settle ${guard} t=${clock.now} timers=${clock.timers.size} next=${String(next.fn).slice(0, 200)}\n`);
    }
    clock.now = Math.max(clock.now, next.at);
    if (next.every) next.at = clock.now + next.every;
    else clock.timers.delete(next.id);
    try {
      next.fn(...(next.args || []));
    } catch (e) {
      errors.push(String((e as any)?.stack || e));
    }
  }
};

const errors: string[] = [];

// ----- Fixture types -----
export interface Fixture {
  id: string;
  title: string;
  covers: string[];
  flow: { nodes: any[]; edges: any[] };
  inputs?: any[];
  server?: any;
  random?: number[];
  customizations?: Record<string, any>;
  expect: any;
}

// ----- The fake socket (web/fakeSocket.js) -----
const makeSocket = (server: any) => {
  const listeners = new Map<string, Set<(p: any) => void>>();
  const emits: string[] = [];
  const socket = {
    connected: true,
    isConnected: () => true,
    on(event: string, fn: (p: any) => void) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(fn);
      return () => socket.off(event, fn);
    },
    off(event: string, fn?: (p: any) => void) {
      if (!listeners.has(event)) return;
      if (fn) listeners.get(event)!.delete(fn);
      else listeners.delete(event);
    },
    fire(event: string, payload: any) {
      [...(listeners.get(event) || [])].forEach((fn) => fn(payload));
    },
    emitToServer(event: string, payload: any) {
      // The record resend and the room join are transport, not flow events.
      if (event !== 'response-record' && event !== 'join-chat-room-visitor') emits.push(event);
      const s = server || {};
      if (event === 'execute-integration') {
        const r = (s.integration && (s.integration[payload.nodeId] || s.integration[payload.nodeType])) || { success: true };
        if (r !== 'none') setTimeout(() => socket.fire('integration-result', { nodeId: payload.nodeId, ...r }), r.delayMs || 50);
      }
      if (event === 'initiate-handover') {
        if (s.handover === 'no-agents') setTimeout(() => socket.fire('no-agents-available', { chatSessionId: payload?.chatSessionId }), 1000);
      }
    },
    sendResponseRecord() {},
    emailNodeTrigger(payload: any) {
      socket.emitToServer('email-node-trigger', payload);
    },
    zapierNodeTrigger(payload: any) {
      socket.emitToServer('zapier-node-trigger', payload);
    },
    calendarSlotSelectionRecord(payload: any) {
      socket.emitToServer('calendar-slot-selection-record', payload);
    },
    initiateHandover(payload: any) {
      socket.emitToServer('initiate-handover', payload);
    },
    getUserId: () => 'qa-visitor',
  };
  // A real socket.io client is full of cycles (socket.io.nsps, ...): nothing
  // the flow saves may hold it (#87).
  (socket as any).self = socket;
  return { socket, emits };
};

// ----- fetch, scripted by server.http (web/driver.js) -----
const makeFetch = (server: any, http: any[]) => {
  const calls: Record<string, number> = {};
  return async (url: any, opts: any = {}) => {
    const u = String(url);
    const m = u.match(/\/api\/v1\/bot\/[^/]+\/(.+?)(\?|$)/);
    const key = m ? m[1] : u;
    calls[key] = (calls[key] || 0) + 1;
    let body: any = null;
    try {
      body = opts.body && typeof opts.body === 'string' ? JSON.parse(opts.body) : null;
    } catch {
      body = null;
    }
    http.push({ path: key, ...(key === 'media' || !body ? {} : { body }) });
    const scripted = (server && server.http) || {};
    let r = scripted[key];
    if (Array.isArray(r)) r = r[Math.min(calls[key] - 1, r.length - 1)];
    if (r === undefined && key === 'media') r = { status: 200, body: { url: 'https://api.test/media/qa-file' } };
    if (r === undefined || r === 'network') throw new TypeError('Failed to fetch');
    const status = r.status ?? 200;
    return { ok: status >= 200 && status < 300, status, json: async () => r.body ?? null, headers: { get: () => 'application/json' } } as any;
  };
};

// ----- Visitor actions -> the answer the SDK UI sends -----
const buttonsOf = (ui: any): any[] => (Array.isArray(ui?.buttons) ? ui.buttons : Array.isArray(ui?.choices) ? ui.choices : Array.isArray(ui?.options) ? ui.options : []);

const answerFor = (a: any, ui: any, memo: Record<string, any>, nodeId: string): { response?: any; local?: boolean } => {
  switch (a.do) {
    case 'text':
      return { response: String(a.value) };
    case 'choose': {
      if (a.buttonId !== undefined) return { response: { buttonId: a.buttonId } };
      if (a.value !== undefined) return { response: { value: a.value } };
      const list = buttonsOf(ui);
      if (a.id !== undefined) {
        const b = list.find((x: any) => String(x.id) === String(a.id));
        if (!b) throw new Error(`no shown option with id ${a.id}`);
        return { response: { buttonId: b.id, label: b.label, value: b.value } };
      }
      if (a.index !== undefined) {
        const b = list[a.index];
        if (!b) throw new Error(`no shown option at index ${a.index}`);
        return { response: { buttonId: b.id, label: b.label, value: b.value, index: a.index } };
      }
      // carousel / product card: Continue
      return { response: { action: 'continue' } };
    }
    case 'check':
      return { response: { buttonIds: a.ids } };
    case 'file':
      return { response: { file: { name: a.name, size: a.size, type: a.type, uri: `file:///tmp/${a.name}` } } };
    case 'skip':
      return { response: { skip: true } };
    case 'navigateLink':
      return { response: { action: 'link', index: a.index } };
    case 'navigateDone':
      return { response: { action: 'done' } };
    case 'date':
      return { response: String(a.value) };
    case 'calendar':
      return { response: { date: a.date, slot: a.slot } };
    case 'consent':
      return { response: { agreed: !!a.agreed } };
    case 'slider':
    case 'datetime':
      return { response: { value: a.value } };
    case 'rankingMove': {
      const order: string[] = memo[nodeId]?.order || (ui?.items || []).map((x: any) => String(x.id));
      const i = order.indexOf(String(a.id));
      const j = i + Number(a.dir);
      if (i >= 0 && j >= 0 && j < order.length) [order[i], order[j]] = [order[j], order[i]];
      memo[nodeId] = { order };
      return { local: true };
    }
    case 'rankingSubmit':
      return { response: { order: memo[nodeId]?.order || (ui?.items || []).map((x: any) => String(x.id)) } };
    case 'matrix': {
      const cells = { ...(memo[nodeId]?.cells || {}) };
      for (const [row, cols] of Object.entries(a.cells || {})) {
        const list = ([] as any[]).concat(cols);
        if (ui?.mode === 'multiple') cells[row] = Array.from(new Set([...(cells[row] || []), ...list]));
        else cells[row] = list[list.length - 1];
      }
      memo[nodeId] = { cells };
      if (a.submit === false) return { local: true };
      return { response: { cells } };
    }
    case 'otpEmail':
      return { response: { action: 'send', email: a.email } };
    case 'otpCode':
      return { response: { action: 'verify', code: String(a.code) } };
    case 'otpSkip':
      return { response: { action: 'skip' } };
    case 'addressManual':
      return {
        response: { action: 'manual', line1: a.line1, city: a.city, region: a.region, postal: a.postal, country: a.country },
      };
    case 'addressSearch':
      return { response: { action: 'search', q: a.q } };
    case 'addressPick':
      return { response: { action: 'pick', index: a.index } };
    case 'signTyped':
      return { response: { action: 'sign', method: 'typed', name: a.name, fullName: a.fullName } };
    case 'signEmpty':
      return { response: { action: 'sign', method: 'drawn', strokes: 0 } };
    case 'payOpen':
      return { response: { action: 'open' } };
    case 'payCancel':
      return { response: { action: 'cancel' } };
    case 'wait':
      return { local: true };
    default:
      throw new Error(`unknown action ${a.do}`);
  }
};

// ----- Outcome (web/driver.js `outcome`) -----
const STRIP = new Set(['time', 'at', 'agreedAt', 'options', 'choices', 'images', 'carousel', '_id']);
const clean = (o: any): any => {
  if (Array.isArray(o)) return o.map(clean);
  if (!o || typeof o !== 'object') return o;
  const out: any = {};
  for (const [k, v] of Object.entries(o)) if (!STRIP.has(k) && v !== undefined) out[k] = clean(v);
  return out;
};

export interface RunResult {
  outcome: any;
  problems: string[];
}

/**
 * A visitor action answered by something other than the driver - the SDK's
 * own step views (FlowStepViews.test.tsx): the answer the view sent, or
 * `local` for an action that stays in the view. Null: the driver answers.
 */
export type ViewAnswer = (
  a: any,
  ui: any,
  memo: Record<string, any>,
  nodeId: string
) => { response?: any; local?: boolean } | null;

export const runFixture = async (fx: Fixture, opts: { answer?: ViewAnswer } = {}): Promise<RunResult> => {
  errors.length = 0;
  clock.now = 0;
  clock.seq = 0;
  clock.timers.clear();
  const problems: string[] = [];
  const trace: Array<FlowTraceEvent & { t: number }> = [];
  const http: any[] = [];
  const { socket, emits } = makeSocket(fx.server || {});
  captureReal();
  install();
  (global as any).fetch = makeFetch(fx.server || {}, http);
  const randoms = [...(fx.random || [])];
  const warn = console.warn;
  const err = console.error;
  console.warn = () => {};
  console.error = () => {};
  try {
    dbg('begin');
    const state = new ChatState('qa-session', 'qa-bot');
    state.setVariable('_visitorId', 'qa-visitor');
    const registry = new NodeHandlerRegistry();
    registerAllHandlers(registry, { socketClient: socket });
    const engine = new NodeFlowEngine(state, registry, {
      socketClient: socket,
      apiOrigin: 'https://api.test',
      visitorTimeZone: (fx as any).visitorTimeZone || 'UTC',
      customizations: { ...(fx.customizations || {}) },
      page: { url: 'https://shop.example/pricing?utm_source=newsletter&utm_campaign=fall', referrer: 'https://www.google.com/' },
      random: () => (randoms.length > 1 ? randoms.shift()! : randoms.length ? randoms[0] : 0.5),
      onTrace: (e) => trace.push({ ...(e as any), t: clock.now }),
    });
    dbg('engine made');
    engine.loadFlow(JSON.parse(JSON.stringify(fx.flow)));
    dbg('loaded');
    engine.start().catch((e) => problems.push(`start: ${e?.message || e}`));
    dbg('started');
    await settle();
    dbg('settled');

    const memo: Record<string, any> = {};
    for (const [i, a] of (fx.inputs || []).entries()) {
      const s = engine.getState();
      const at = s.currentNodeId;
      if (a.do !== 'serverEvent') {
        if (a.at && a.at !== at) problems.push(`input ${i}: waiting at ${at}, fixture expected ${a.at}`);
        if (!s.isWaitingForInput && a.do !== 'wait') problems.push(`input ${i} (${a.do}): engine is not waiting (at ${at})`);
      }
      try {
        if (a.do === 'serverEvent') socket.fire(a.event, a.payload);
        else {
          const { response, local } = opts.answer?.(a, s.currentUIState, memo, String(at)) ?? answerFor(a, s.currentUIState, memo, String(at));
          if (!local) engine.submitResponse(response).catch((e) => problems.push(`input ${i}: ${e?.message || e}`));
        }
      } catch (e: any) {
        problems.push(`input ${i} (${a.do}): ${e.message}`);
      }
      await settle(a.waitMs);
      if (a.waitMs !== undefined) await settle();
    }

    const enters = trace.filter((e) => e.kind === 'enter') as any[];
    const shownAt: Record<string, number> = {};
    const shownOrder: string[] = [];
    trace
      .filter((e) => e.kind === 'shown')
      .forEach((e: any) => {
        if (shownAt[e.node] === undefined) {
          shownAt[e.node] = e.t;
          shownOrder.push(e.node);
        }
      });
    const record = state.getRecord() as any[];
    try {
      JSON.stringify(record);
    } catch (e: any) {
      problems.push(`the record does not serialize (it is sent with every response-record): ${e.message}`);
    }
    const nodeRecords = record.filter((r) => r && r.type && !r.shape && r.source === undefined && r.renderedText !== undefined);
    const st = engine.getState();
    const crash = trace.find((e) => e.kind === 'crash') as any;
    const endEvent = trace.find((e) => e.kind === 'end');
    const flowVariables: Record<string, any> = {};
    Object.entries(state.getAllVariables()).forEach(([k, v]) => {
      if (!k.startsWith('_')) flowVariables[k] = v;
    });
    const outcome: any = {
      path: enters.map((e) => ({ node: e.node, type: e.type, via: e.via, t: e.t })),
      shown: shownOrder.map((node) => ({ node, t: shownAt[node] })),
      rendered: nodeRecords.map((r) => ({ node: r.id, html: r.renderedText, plain: plainText(r.renderedText) })),
      ports: trace.filter((e) => e.kind === 'port').map((e: any) => ({ node: e.node, handle: e.handle, wired: e.wired })),
      answers: record
        .filter((r) =>
          r && (r.shape ? String(r.shape).startsWith('user') : String(r.type || '').startsWith('user') && !r.data && !r.position)
        )
        .map((r) => clean(r)),
      variables: state.getAnswerVariables().map((v) => ({ key: v.variableName, value: v.value, nodeId: v.nodeId })),
      ...(Object.keys(flowVariables).length ? { flowVariables } : {}),
      errors: trace.filter((e) => e.kind === 'error').map((e: any) => ({ node: e.node, message: e.message })),
      http,
      emits,
      unsupported: trace.filter((e) => e.kind === 'unsupported').map((e: any) => ({ node: e.node, type: e.type })),
      end: engine.isEnded()
        ? { ended: true, t: (endEvent as any)?.t }
        : { ended: false, waitingAt: st.currentNodeId, type: st.currentNodeId ? engine.getNode(st.currentNodeId)?.type ?? null : null },
      transcript: state.getTranscript().map((x) => ({ by: x.type, message: x.text })),
    };
    if (crash) outcome.end = { ended: false, crashed: true, at: crash.node, reason: crash.reason };
    if (errors.length) problems.push(...errors.map((e) => `uncaught: ${e}`));
    return { outcome, problems };
  } finally {
    console.warn = warn;
    console.error = err;
    clock.timers.clear();
    uninstall();
  }
};
