/**
 * Loops and sub-flows, the pure half - ported unchanged from the web widget
 * (conferbot-widget/src/ts/chat/flowControl.ts). The engine runs them
 * (NodeFlowEngine runFlowControl). Twins: embed-server
 * services/omnichannel/nodeHandlers/flowControl.js, the builder's
 * utils/flowControl.ts. Keep them in step.
 */

export const LOOP_TYPE = "loop-node";
export const SUBFLOW_TYPE = "subflow-node";
export const RUN_SUBFLOW_TYPE = "run-subflow-node";
export const SUBFLOW_RETURN_TYPE = "subflow-return-node";
export const FLOW_CONTROL_TYPES = [LOOP_TYPE, SUBFLOW_TYPE, RUN_SUBFLOW_TYPE, SUBFLOW_RETURN_TYPE];
export const isFlowControlType = (type: any): boolean => FLOW_CONTROL_TYPES.includes(type);

export const LOOP_BODY_HANDLE = "source-loop";
export const LOOP_DONE_HANDLE = "source-done";
export const RUN_ERROR_HANDLE = "source-error";

export const LOOP_DEFAULT_CAP = 20;
export const LOOP_HARD_CAP = 100;
export const SUBFLOW_MAX_DEPTH = 5;
const VAR_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export type Lookup = (key: string) => any;

export interface LoopState {
  /** Rounds started so far. */
  i: number;
  total: number;
  items: any[] | null;
  /** The list or count was longer than the cap. */
  capped: boolean;
}

export interface CallFrame {
  runNodeId: string;
  subflowId: string;
  name: string;
  outputs: { from: string; to: string }[];
  depth: number;
}

export interface FlowControlState {
  loops: Record<string, LoopState>;
  stack: CallFrame[];
}

export const emptyFlowControl = (): FlowControlState => ({ loops: {}, stack: [] });

/** A saved state, checked (it comes back from the visitor's storage). */
export const restoreFlowControl = (saved: any): FlowControlState => {
  const out = emptyFlowControl();
  if (!saved || typeof saved !== "object") return out;
  if (saved.loops && typeof saved.loops === "object") {
    for (const [id, s] of Object.entries<any>(saved.loops)) {
      if (s && Number.isFinite(s.i) && Number.isFinite(s.total)) {
        out.loops[id] = { i: s.i, total: s.total, items: Array.isArray(s.items) ? s.items : null, capped: !!s.capped };
      }
    }
  }
  if (Array.isArray(saved.stack)) {
    out.stack = saved.stack
      .filter((f: any) => f && typeof f.runNodeId === "string" && typeof f.subflowId === "string")
      .slice(0, SUBFLOW_MAX_DEPTH)
      .map((f: any) => ({
        runNodeId: f.runNodeId,
        subflowId: f.subflowId,
        name: String(f.name || ""),
        outputs: Array.isArray(f.outputs) ? f.outputs.filter((o: any) => o && o.from && o.to) : [],
        depth: Number(f.depth) || 1,
      }));
  }
  return out;
};

const str = (v: any) => (v === null || v === undefined ? "" : String(v));
const clean = (v: any) =>
  str(v)
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();

/** Fill {var} placeholders from the lookup ("" for unknown ones). */
export const fillText = (text: any, lookup: Lookup): string =>
  str(text).replace(/\$?\{(\w+)\}/g, (_m, key) => {
    const v = lookup(key);
    if (v === null || v === undefined) return "";
    return typeof v === "object" ? JSON.stringify(v) : String(v);
  });

/** The loop's variable name: data.variable, else "loop". */
export const loopVarName = (data: any): string => {
  const v = clean(data?.variable);
  return VAR_RE.test(v) ? v : "loop";
};

/** The cap: data.maxIterations, 1..100, default 20. */
export const loopCap = (data: any): number => {
  const n = Math.floor(Number(data?.maxIterations));
  if (!Number.isFinite(n) || n < 1) return LOOP_DEFAULT_CAP;
  return Math.min(LOOP_HARD_CAP, n);
};

/**
 * A list from a variable's value: an array, a JSON array, or a comma /
 * new-line separated text. Anything else is no list.
 */
export const listOf = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  if (typeof value === "object") return [];
  const t = String(value).trim();
  if (!t) return [];
  if (t.startsWith("[")) {
    try {
      const parsed = JSON.parse(t);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      /* not JSON: a plain list below */
    }
  }
  return t
    .split(/\s*(?:,|\n)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
};

/** How many rounds: a number, or a {var} holding one. */
export const loopCount = (data: any, lookup: Lookup): number => {
  const raw = data?.count;
  const n = typeof raw === "number" ? raw : Number(fillText(raw, lookup).trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

/** First arrival: how many rounds and over which items. */
export const startLoop = (data: any, lookup: Lookup): LoopState => {
  const cap = loopCap(data);
  if (data?.mode === "each") {
    const key = clean(data?.listVariable).replace(/^\{|\}$/g, "");
    const items = listOf(key ? lookup(key) : null);
    return { i: 0, total: Math.min(items.length, cap), items: items.slice(0, cap), capped: items.length > cap };
  }
  const n = loopCount(data, lookup);
  return { i: 0, total: Math.min(n, cap), items: null, capped: n > cap };
};

/** An item as variable text ({x_item}): plain values as they are, objects as JSON. */
export const itemValue = (item: any): any => (item !== null && typeof item === "object" ? JSON.stringify(item) : item);

export interface LoopStep {
  handle: typeof LOOP_BODY_HANDLE | typeof LOOP_DONE_HANDLE;
  /** Variables to set (empty on Done). */
  vars: Record<string, any>;
  /** What the inbox shows for this arrival. */
  trail: { iteration: number; total: number; item?: any; done?: boolean; capped?: boolean; variable: string };
}

/**
 * The loop step: start the next round or leave by Done. Mutates `state`
 * (the per-loop entry is created, advanced, then dropped on Done).
 */
export const stepLoop = (nodeId: string, data: any, state: FlowControlState, lookup: Lookup): LoopStep => {
  const name = loopVarName(data);
  let s = state.loops[nodeId];
  if (!s) s = state.loops[nodeId] = startLoop(data, lookup);
  if (s.i < s.total) {
    s.i += 1;
    const item = s.items ? s.items[s.i - 1] : s.i;
    return {
      handle: LOOP_BODY_HANDLE,
      vars: { [`${name}_index`]: s.i, [`${name}_item`]: itemValue(item), [`${name}_count`]: s.total },
      trail: { iteration: s.i, total: s.total, item: s.items ? itemValue(item) : undefined, variable: name },
    };
  }
  delete state.loops[nodeId];
  return {
    handle: LOOP_DONE_HANDLE,
    vars: {},
    trail: { iteration: s.i, total: s.total, done: true, capped: s.capped || undefined, variable: name },
  };
};

/** "Loop 3 of 5 · Apples", "Loop done · 5 rounds", for trails. */
export const loopTrailText = (t: LoopStep["trail"]): string => {
  if (t.done) {
    const rounds = `${t.total} round${t.total === 1 ? "" : "s"}`;
    return t.capped ? `Loop stopped at the safety cap · ${rounds}` : `Loop done · ${rounds}`;
  }
  const item = t.item === undefined || t.item === null || t.item === "" ? "" : ` · ${String(t.item).slice(0, 60)}`;
  return `Loop ${t.iteration} of ${t.total}${item}`;
};

// ---------------------------------------------------------------------------
// Sub-flows
// ---------------------------------------------------------------------------

export const subflowName = (node: any): string => clean(node?.data?.name) || "Sub-flow";

export interface SubflowCall {
  ok: boolean;
  /** "missing" (no such start), "depth" (too deep), "recursion" (calls itself). */
  error?: "missing" | "depth" | "recursion";
  startId?: string;
  name?: string;
  vars: Record<string, any>;
  frame?: CallFrame;
}

/**
 * Run sub-flow: find the start, check depth / recursion, fill the inputs.
 * Pushes the call frame onto `state.stack` when it can run.
 */
export const callSubflow = (runNode: any, nodes: any[], state: FlowControlState, lookup: Lookup): SubflowCall => {
  const d = runNode?.data || {};
  const target = (Array.isArray(nodes) ? nodes : []).find(
    (n: any) => n && String(n.id) === str(d.subflowId) && n.type === SUBFLOW_TYPE
  );
  if (!target) return { ok: false, error: "missing", vars: {} };
  const name = subflowName(target);
  if (state.stack.length >= SUBFLOW_MAX_DEPTH) return { ok: false, error: "depth", name, vars: {} };
  if (state.stack.some((f) => f.subflowId === String(target.id))) return { ok: false, error: "recursion", name, vars: {} };
  const vars: Record<string, any> = {};
  (Array.isArray(d.inputs) ? d.inputs : []).forEach((m: any) => {
    const key = clean(m?.name);
    if (VAR_RE.test(key)) vars[key] = fillText(m?.value, lookup);
  });
  const outputs = (Array.isArray(d.outputs) ? d.outputs : [])
    .map((m: any) => ({ from: clean(m?.name), to: clean(m?.variable) || clean(m?.name) }))
    .filter((m: any) => VAR_RE.test(m.from) && VAR_RE.test(m.to));
  const frame: CallFrame = {
    runNodeId: String(runNode.id),
    subflowId: String(target.id),
    name,
    outputs,
    depth: state.stack.length + 1,
  };
  state.stack.push(frame);
  return { ok: true, startId: String(target.id), name, vars, frame };
};

export interface SubflowReturn {
  frame: CallFrame;
  vars: Record<string, any>;
}

/** The sub-flow ended: pop the frame and read its outputs. null when not in one. */
export const returnFromSubflow = (state: FlowControlState, lookup: Lookup): SubflowReturn | null => {
  const frame = state.stack.pop();
  if (!frame) return null;
  const vars: Record<string, any> = {};
  frame.outputs.forEach((o) => {
    const v = lookup(o.from);
    vars[o.to] = v === undefined || v === null ? "" : v;
  });
  return { frame, vars };
};

export const SUBFLOW_ERRORS: Record<string, string> = {
  missing: "The sub-flow it runs no longer exists",
  depth: `Sub-flows can call each other at most ${SUBFLOW_MAX_DEPTH} deep`,
  recursion: "A sub-flow can't run itself",
};
