// Stands in for src/core/socket.ts. Records every emit; answers the events
// the flow waits on from the fixture's `server` script:
//   execute-integration -> "integration-result" ({ nodeId, success, ... })
//   initiate-handover   -> fixture.server.handover: "accepted" | "no-agents" | (none: keep waiting)
const env = require('./env');

const listeners = new Map();
const socket = {
  connected: true,
  active: true,
  emits: [],
  server: {},
  on(ev, fn) {
    if (!listeners.has(ev)) listeners.set(ev, new Set());
    listeners.get(ev).add(fn);
    return socket;
  },
  once(ev, fn) {
    const w = (...a) => {
      socket.off(ev, w);
      fn(...a);
    };
    return socket.on(ev, w);
  },
  off(ev, fn) {
    if (!listeners.has(ev)) return socket;
    if (fn) listeners.get(ev).delete(fn);
    else listeners.delete(ev);
    return socket;
  },
  removeListener(ev, fn) {
    return socket.off(ev, fn);
  },
  connect() {},
  disconnect() {},
  io: { opts: {} },
  /** Server -> widget. */
  fire(ev, payload) {
    [...(listeners.get(ev) || [])].forEach((fn) => fn(payload));
  },
  emit(ev, payload, ack) {
    // The record is resent on every change: keep the event, not the payload.
    socket.emits.push(ev === 'response-record' ? { event: ev } : { event: ev, payload: JSON.parse(JSON.stringify(payload ?? null)) });
    const s = socket.server || {};
    if (ev === 'execute-integration') {
      const r = (s.integration && (s.integration[payload.nodeId] || s.integration[payload.nodeType])) || { success: true };
      if (r !== 'none') setTimeout(() => socket.fire('integration-result', { nodeId: payload.nodeId, ...r }), r.delayMs || 50);
    }
    if (ev === 'initiate-handover') {
      if (s.handover === 'no-agents') setTimeout(() => socket.fire('no-agents-available', { chatSessionId: payload.chatSessionId }), 1000);
    }
    if (typeof ack === 'function') ack({ ok: true });
    return socket;
  },
  reset(server) {
    listeners.clear();
    socket.emits = [];
    socket.server = server || {};
  },
};
env.socket = socket;
module.exports = socket;
