/**
 * The rules behind the logic steps, ported unchanged from the web widget:
 * conferbot-widget/src/ts/chat/handlers/conditionEval.ts (condition-node) and
 * handlers/logicValues.ts (math, boolean, variable, random split, jump-to,
 * business hours). Pure: the variable lookup, clock and random number are
 * passed in. The embed server and the builder preview keep copies too -
 * keep them in step.
 */

export type VariableLookup = (key: string) => any;

export interface ConditionData {
  isNumber?: boolean;
  operator?: string;
  leftValue?: any;
  rightValue?: any;
  customLeftValue?: boolean;
  customRightValue?: boolean;
  caseInsensitive?: boolean;
}

const stringify = (value: any): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

// "${name}" / "{name}" typed into the variable field still means `name`
const variableKey = (raw: any): string => {
  const key = stringify(raw).trim();
  const wrapped = key.match(/^\$?\{(\w+)\}$/);
  return wrapped ? wrapped[1] : key;
};

/** Fill `${name}` placeholders in a typed value; unknown names stay as written. */
export const interpolate = (text: any, lookup: VariableLookup): string =>
  stringify(text).replace(/\$\{(\w+)\}/g, (match, key) => {
    const value = lookup(key);
    return value === null || value === undefined ? match : stringify(value);
  });

// A number or a quoted word, as typed: never an answer variable's name.
const literalOf = (raw: any): string | undefined => {
  const text = stringify(raw).trim();
  if (/^[-+]?\d+(?:\.\d+)?$/.test(text)) return text;
  const quoted = text.match(/^"(.*)"$|^'(.*)'$/);
  return quoted ? quoted[1] ?? quoted[2] : undefined;
};

/**
 * One side of the rule: the typed literal, or the variable's value. A plain
 * number (or a "quoted" word) left in the variable field is what the owner
 * meant to compare with - "greater than 3" - so when no answer has that
 * name it is taken as typed instead of as an empty variable.
 */
export const resolveOperand = (raw: any, isCustom: any, lookup: VariableLookup): any => {
  if (isCustom) return interpolate(raw, lookup);
  const value = lookup(variableKey(raw));
  if (value !== undefined && value !== null) return value;
  const literal = literalOf(raw);
  return literal !== undefined ? literal : value;
};

const OPERATOR_ALIASES: Record<string, string> = {
  "==": "=",
  equals: "=",
  not_equals: "!=",
  greater_than: ">",
  less_than: "<",
  greater_than_or_equal: ">=",
  less_than_or_equal: "<=",
  not_contains: "does not contain",
  starts_with: "starts with",
  ends_with: "ends with",
  does_not_match: "does not match",
};

const asNumber = (value: any): number => {
  if (typeof value === "number") return value;
  // Keeps the long-standing Number(...) reading (empty/missing → 0)
  return Number(typeof value === "string" ? value.trim() : value);
};

const isNumeric = (value: any): boolean => {
  if (typeof value === "number") return Number.isFinite(value);
  const text = stringify(value).trim();
  return text !== "" && Number.isFinite(Number(text));
};

const safeRegExp = (pattern: string, flags = ""): RegExp | null => {
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
};

/**
 * Ratings used to be stored as their emoji ("⭐⭐⭐", "😊"); they are now
 * stored as the number. A rule an owner wrote against the old emoji keeps
 * working: a value made only of stars, or one of the five faces (same order
 * as nodeKit FACE_VALUES), reads as its number.
 */
const RATING_FACES = ["😡", "😐", "😊", "😀", "😁"];
export const ratingAlias = (value: any): any => {
  if (typeof value !== "string") return value;
  const v = value.trim();
  if (/^(⭐)+$/u.test(v)) return String([...v].length);
  const face = RATING_FACES.indexOf(v);
  return face >= 0 ? String(face + 1) : value;
};

/** true → the "yes" branch (source-0), false → "no" (source-1). */
export const evaluateCondition = (data: ConditionData, lookup: VariableLookup): boolean => {
  const isNumber = !!data?.isNumber;
  const rawOperator = stringify(data?.operator || "=").trim();
  const operator = OPERATOR_ALIASES[rawOperator] || rawOperator;

  const left = ratingAlias(resolveOperand(data?.leftValue, data?.customLeftValue, lookup));
  const right = ratingAlias(resolveOperand(data?.rightValue, data?.customRightValue, lookup));

  if (operator === "is_set") return stringify(left).trim() !== "";
  if (operator === "is_not_set") return stringify(left).trim() === "";

  const ci = !!data?.caseInsensitive;
  const text = (value: any) => (ci ? stringify(value).toLowerCase() : stringify(value));

  switch (operator) {
    case "=":
    case "!=": {
      const equal = isNumber
        ? asNumber(left) === asNumber(right)
        : isNumeric(left) && isNumeric(right)
        ? asNumber(left) === asNumber(right)
        : text(left) === text(right);
      return operator === "=" ? equal : !equal;
    }
    case "<":
    case ">":
    case "<=":
    case ">=": {
      // String mode only compares when both sides really are numbers
      if (!isNumber && !(isNumeric(left) && isNumeric(right))) return false;
      const l = asNumber(left);
      const r = asNumber(right);
      if (Number.isNaN(l) || Number.isNaN(r)) return false;
      if (operator === "<") return l < r;
      if (operator === ">") return l > r;
      if (operator === "<=") return l <= r;
      return l >= r;
    }
    case "contains":
      return !isNumber && text(left).includes(text(right));
    case "does not contain":
      return !isNumber && !text(left).includes(text(right));
    case "starts with":
      return !isNumber && text(left).startsWith(text(right));
    case "ends with":
      return !isNumber && text(left).endsWith(text(right));
    case "matches": {
      const re = safeRegExp(stringify(right), ci ? "i" : "");
      return !isNumber && !!re && re.test(stringify(left));
    }
    case "does not match": {
      const re = safeRegExp(stringify(right), ci ? "i" : "");
      return !isNumber && !!re && !re.test(stringify(left));
    }
    default:
      return false;
  }
};

// ----- handlers/logicValues.ts -----
const present = (v: any) => v !== null && v !== undefined;

/** A name that reads like a variable: "price", "order.total", "_tmp". */
const IDENTIFIER = /^[A-Za-z_][\w.]*$/;

/** Words that are typed values, never variable names. */
const BOOLEAN_WORDS = new Set(["true", "false", "yes", "no", "on", "off"]);

/** A ${name} or {name} placeholder (the "$" is optional). */
const PLACEHOLDER = /\$?\{([A-Za-z_][\w.]*)\}/g;

/** "${name}" or "{name}" as the whole text: the variable's name, else null. */
const wholePlaceholder = (text: string): string | null => {
  const m = text.match(/^\$?\{([A-Za-z_][\w.]*)\}$/);
  return m ? m[1] : null;
};

/** A saved value as text: lists read "a, b", other objects stay JSON. */
const asText = (value: any): string => {
  if (Array.isArray(value) && value.every((v) => v === null || typeof v !== "object")) return value.join(", ");
  return typeof value === "object" ? JSON.stringify(value) : String(value);
};

/** Fill ${name} and {name} from the variables; unknown ones stay as written. */
export const fillPlaceholders = (text: any, lookup: VariableLookup): string =>
  String(text ?? "").replace(PLACEHOLDER, (match, key) => {
    const value = lookup(key);
    return present(value) ? asText(value) : match;
  });

/** Drop one pair of matching quotes around a typed value. */
const unquote = (text: string): string => {
  const m = text.match(/^(["'])([\s\S]*)\1$/);
  return m ? m[2] : text;
};

/**
 * One side of a rule. A variable's value when `raw` names one that has a
 * value; null when it names a variable with no answer yet; otherwise the
 * typed text, with any placeholders inside it filled in.
 */
export const valueOf = (raw: any, lookup: VariableLookup): any => {
  if (!present(raw)) return null;
  if (typeof raw !== "string") return raw;
  const text = raw.trim();

  const wrapped = wholePlaceholder(text);
  const name = wrapped ?? text;
  if (name !== "") {
    const value = lookup(name);
    if (present(value)) return value;
  }

  // "${plan}" with no answer yet, or a bare name like "price": unanswered.
  if (wrapped !== null) return null;
  if (IDENTIFIER.test(text) && !BOOLEAN_WORDS.has(text.toLowerCase())) return null;

  return fillPlaceholders(unquote(text), lookup);
};

/** A value as a number: NaN when it isn't one (never 0 for empty). */
export const toNumber = (v: any): number => {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (!present(v) || typeof v !== "string") return NaN;
  let text = v.trim().replace(/\s+/g, "");
  if (text === "") return NaN;
  if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) text = text.replace(/,/g, "");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(text)) return NaN;
  return Number(text);
};

const FALSE_WORDS = new Set(["false", "no", "n", "0", "off", "none", "null", "undefined", ""]);

/** A value as true / false: "No", "off", "0" and empty are false. */
export const toBool = (v: any): boolean => {
  if (!present(v) || v === "") return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return !FALSE_WORDS.has(v.trim().toLowerCase());
  if (Array.isArray(v)) return v.length > 0;
  return true;
};

// ----- Math step -----

export const DEFAULT_MATH_VARIABLE = "math_operations";

/** The variable a math step saves its result under. */
export const mathVariableName = (data: any): string => {
  const name = String(data?.answerVariable ?? "").trim();
  return name || DEFAULT_MATH_VARIABLE;
};

/**
 * The math step's result, or "" when it can't be worked out (a side that
 * isn't a number, an unanswered variable, a divide by zero).
 */
export const mathResult = (data: any, lookup: VariableLookup): number | "" => {
  const l = toNumber(valueOf(data?.leftValue, lookup));
  const r = toNumber(valueOf(data?.rightValue, lookup));
  if (Number.isNaN(l) || Number.isNaN(r)) return "";
  const op = String(data?.operator ?? "").trim() || "+";
  let x: number;
  if (op === "+") x = l + r;
  else if (op === "-") x = l - r;
  else if (op === "*") x = l * r;
  else if (op === "/") {
    if (r === 0) return "";
    x = l / r;
  } else return "";
  if (!Number.isFinite(x)) return "";
  return Number(x.toFixed(10));
};

// ----- Boolean step -----

/** The boolean step's answer: true takes source-0, false source-1. */
export const booleanResult = (data: any, lookup: VariableLookup): boolean => {
  const l = toBool(valueOf(data?.leftValue, lookup));
  const r = toBool(valueOf(data?.rightValue, lookup));
  const op = String(data?.operator ?? "").trim().toUpperCase() || "AND";
  switch (op) {
    case "AND":
      return l && r;
    case "OR":
      return l || r;
    case "NOT":
      // "left NOT right": true when left is true and right is false
      return l && !r;
    case "XOR":
      return l !== r;
    case "NAND":
      return !(l && r);
    case "NOR":
      return !(l || r);
    case "XNOR":
      return l === r;
    default:
      return false;
  }
};

// ----- Variable step -----

/** The value a variable step stores: placeholders filled, a number when asked. */
export const variableValue = (data: any, lookup: VariableLookup): any => {
  const text = fillPlaceholders(data?.value ?? "", lookup);
  if (data?.isNumber) {
    const n = toNumber(text);
    if (!Number.isNaN(n)) return n;
  }
  return text;
};

// ----- Saving a variable -----

export interface LogicAnswerVariable {
  nodeId: any;
  key: string;
  value: any;
}

/**
 * Save a value under a variable's name: every entry with that name gets the
 * new value (so every read sees it); with none, one entry is added. Never a
 * duplicate, so "total = total + 1" in a loop counts 1, 2, 3...
 */
export const saveVariableByName = (list: LogicAnswerVariable[], key: string, value: any, nodeId?: any): LogicAnswerVariable[] => {
  const matches = list.filter((item) => item?.key === key);
  if (matches.length) matches.forEach((item) => (item.value = value));
  else list.push({ nodeId: present(nodeId) ? nodeId : `variable_${key}`, key, value });
  return list;
};

// ----- Random split -----

/** A handle no edge uses: routing to it ends the flow. */
export const NO_PATH = "__no_path__";

const weightOf = (b: any): number => {
  const n = toNumber(b?.weight);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Pick one of `items` by weight; all zero is an even split. `rand` in [0, 1). */
const pickWeighted = <T>(items: T[], weights: number[], rand: number): T => {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return items[Math.min(items.length - 1, Math.floor(rand * items.length))];
  const target = rand * total;
  let acc = 0;
  for (let i = 0; i < items.length; i++) {
    acc += weights[i];
    if (weights[i] > 0 && target < acc) return items[i];
  }
  // rand at the very top: the last branch with any weight
  for (let i = items.length - 1; i >= 0; i--) if (weights[i] > 0) return items[i];
  return items[items.length - 1];
};

/**
 * The handle a random split leaves by, or null when no branch has a line
 * (the flow ends). Branches are matched by id (source-<id>); a branch with
 * no line is skipped and the others share its weight. Position handles
 * (source-0..n) are only used by flows saved before branches had ids, when
 * no edge from this node uses an id handle.
 */
export const pickRandomHandle = (branches: any, edgeHandles: any[], rand: number): string | null => {
  const list: any[] = Array.isArray(branches) ? branches : [];
  const wired = new Set((edgeHandles || []).filter(present).map(String));
  const idOf = (b: any) => (present(b?.id) && b.id !== "" ? String(b.id) : null);

  const byId = list.filter((b) => idOf(b) !== null && wired.has(`source-${idOf(b)}`));
  if (byId.length) {
    const picked = pickWeighted(byId, byId.map(weightOf), rand);
    return `source-${idOf(picked)}`;
  }

  // Legacy: every edge uses the branch's position.
  const byPosition = list.map((b, i) => ({ b, i })).filter(({ i }) => wired.has(`source-${i}`));
  if (byPosition.length) {
    const picked = pickWeighted(byPosition, byPosition.map(({ b }) => weightOf(b)), rand);
    return `source-${picked.i}`;
  }
  return null;
};

// ----- Jump to -----

/** The step a jump-to goes to ("" when none is set). */
export const jumpTargetOf = (data: any): string => {
  const target = [data?.nodeId, data?.targetNodeId, data?.jumpTo].find((v) => present(v) && String(v).trim() !== "");
  return present(target) ? String(target).trim() : "";
};

// ----- Business hours -----

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const validZone = (zone: any): string | null => {
  const z = String(zone ?? "").trim();
  if (!z) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: z });
    return z;
  } catch {
    return null;
  }
};

/** The visitor's own zone, or UTC when the browser won't say. */
const localZone = (): string => {
  try {
    return validZone(Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC";
  } catch {
    return "UTC";
  }
};

/** "9:00" -> "09:00"; null when it isn't a time. */
const hhmm = (t: any): string | null => {
  const m = String(t ?? "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return `${String(h % 24).padStart(2, "0")}:${m[2]}`;
};

/** "25-12-2026", "2026-12-25" (or with / or .) -> "2026-12-25"; else null. */
export const normaliseDate = (d: any): string | null => {
  const text = String(d ?? "").trim();
  let m = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
};

export interface ZonedNow {
  zone: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM, 00:00 - 23:59
  dayIndex: number; // 0 = Sunday
  dayName: string;
}

/** The time, date and weekday in a zone (an empty or invalid zone uses the fallback). */
export const zonedNow = (now: Date, zone: any, fallbackZone?: string): ZonedNow => {
  const z = validZone(zone) || validZone(fallbackZone) || localZone();
  const parts: Record<string, string> = {};
  new Intl.DateTimeFormat("en-US", {
    timeZone: z,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "long",
  } as any)
    .formatToParts(now)
    .forEach((p) => (parts[p.type] = p.value));
  const hour = parts.hour === "24" ? "00" : parts.hour;
  const dayIndex = DAY_NAMES.indexOf(parts.weekday);
  return {
    zone: z,
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${hour}:${parts.minute}`,
    dayIndex,
    dayName: parts.weekday,
  };
};

const previousDate = (ymd: string): string => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
};

/**
 * Whether the business is open at `now`, read in the owner's timezone.
 * Slot times are the owner's clock and are compared as "HH:MM" in that
 * zone. An overnight slot (22:00 - 02:00) is open from its start until
 * midnight and, the next day, until its end.
 */
export const isWithinBusinessHours = (data: any, now: Date = new Date(), fallbackZone?: string): boolean => {
  const at = zonedNow(now, data?.timezone, fallbackZone);
  const weekly: any[] = Array.isArray(data?.weeklyHours) ? data.weeklyHours : [];
  const excludedDays = new Set(
    (Array.isArray(data?.excludeDays) ? data.excludeDays : []).map((d: any) => String(d).trim().toLowerCase())
  );
  const excludedDates = new Set(
    (Array.isArray(data?.excludeDates) ? data.excludeDates : []).map(normaliseDate).filter(Boolean)
  );

  const isClosedDay = (dayName: string, date: string) =>
    excludedDays.has(dayName.toLowerCase()) || excludedDates.has(date);
  const hoursFor = (dayIndex: number) =>
    weekly.find((w) => String(w?.dayName ?? "").trim().toLowerCase() === DAY_NAMES[dayIndex].toLowerCase()) ||
    weekly.find((w) => Number(w?.day) === dayIndex && present(w?.day) && w?.day !== "");
  const slotsOf = (day: any) =>
    day && day.available && Array.isArray(day.slots)
      ? day.slots.map((s: any) => ({ start: hhmm(s?.start), end: hhmm(s?.end) })).filter((s: any) => s.start && s.end)
      : [];

  if (at.dayIndex < 0 || isClosedDay(at.dayName, at.date)) return false;

  // Today's slots
  for (const s of slotsOf(hoursFor(at.dayIndex))) {
    if (s.start <= s.end ? s.start <= at.time && at.time <= s.end : at.time >= s.start) return true;
  }

  // Yesterday's overnight slots running past midnight
  const yIndex = (at.dayIndex + 6) % 7;
  const yDate = previousDate(at.date);
  if (!isClosedDay(DAY_NAMES[yIndex], yDate)) {
    for (const s of slotsOf(hoursFor(yIndex))) {
      if (s.end < s.start && at.time <= s.end) return true;
    }
  }
  return false;
};
