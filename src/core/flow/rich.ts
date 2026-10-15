/**
 * The rich steps' rules, the pure half - ported from the web widget
 * (conferbot-widget/src/ts/chat/richNodes.ts) with its English texts.
 * Only the i18n import differs; keep it in step with the web file.
 */
/* eslint-disable no-control-regex, no-misleading-character-class */
/**
 * Rich flow nodes, the pure half: dynamic choices, hidden fields, consent,
 * product card, slider, date/time picker, ranking and verification code. What each node shows,
 * the value it saves and the checks it runs - no DOM, no imports, so
 * tests/richNodes.test.js loads this file on its own. The DOM half is
 * richNodesView.ts; the styles live in src/css/nodes/.
 *
 * Every rule here has a twin in embed-server
 * (services/omnichannel/nodeHandlers/richNodes.js), the server's save check
 * (server utils/richNodeSchemas.js) and the builder
 * (client builder/utils/richNodes.ts). Keep them in step.
 */

import { t } from "./i18nEn";

type I18nKey = string;
const widgetLanguage = (): string => "en";
const widgetLocale = (): string => "en-US";
export const RICH_NODE_TYPES = [
  "dynamic-choices-node",
  "hidden-fields-node",
  "consent-node",
  "product-card-node",
  "slider-node",
  "datetime-node",
  "ranking-node",
  "otp-node",
  "address-node",
  "matrix-node",
  "ai-extract-node",
  "ai-route-node",
  "kb-answer-node",
  "signature-node",
  "payment-node",
  // Loops and sub-flows (flowControl.ts): logic, nothing shown.
  "loop-node",
  "subflow-node",
  "run-subflow-node",
  "subflow-return-node",
] as const;

/** Rich nodes that show nothing and move straight on. */
export const RICH_LOGIC_TYPES = ["hidden-fields-node", "loop-node", "subflow-node", "run-subflow-node", "subflow-return-node"];

export const isRichNode = (type: any): boolean => (RICH_NODE_TYPES as readonly string[]).includes(type);
export const isRichDisplayNode = (type: any): boolean => isRichNode(type) && !RICH_LOGIC_TYPES.includes(type);

/** Escape a string for HTML text or a double-quoted attribute. */
export const escHtml = (value: any): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Visible text of a stored HTML fragment. */
export const plainText = (value: any): string =>
  String(value ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[^>]+(>|$)/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

// ---------------------------------------------------------------------------
// Paths into data ("data.items", "items[0].name")
// ---------------------------------------------------------------------------

/** A path the editor accepts: dotted keys, with [n] indexes. Empty is fine. */
export const PATH_RE = /^[A-Za-z_$][\w$-]*(\[\d+\])*(\.[A-Za-z_$][\w$-]*(\[\d+\])*)*$/;
export const isValidPath = (path: any): boolean => {
  const p = String(path ?? "").trim();
  return p === "" || PATH_RE.test(p);
};

/** Read a dotted path; undefined when any step is missing. */
export const getPath = (value: any, path: any): any => {
  const p = String(path ?? "").trim();
  if (!p) return value;
  const parts = p.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let cur = value;
  for (const key of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== "object") return undefined;
    cur = cur[key];
  }
  return cur;
};

/** A variable's value as data: JSON text (a webhook reply saved as text) is parsed. */
export const asData = (value: any): any => {
  if (typeof value !== "string") return value;
  const t = value.trim();
  if (!(t.startsWith("[") || t.startsWith("{"))) return value;
  try {
    return JSON.parse(t);
  } catch (e) {
    return value;
  }
};

// ---------------------------------------------------------------------------
// (1) Dynamic choices
// ---------------------------------------------------------------------------

export const DYNAMIC_MAX_OPTIONS = 50;
export const DYNAMIC_DEFAULT_MAX = 10;

export interface DynamicOption {
  id: string;
  label: string;
  /** What is saved: the item's value as it came (number, text, boolean). */
  value: any;
}

/** The variable a dynamic choice node reads its list from. */
export const dynamicSourceVariable = (data: any): string =>
  String(data?.sourceVariable ?? "").trim();

const scalar = (v: any) => v === null || ["string", "number", "boolean"].includes(typeof v);

/**
 * The options a dynamic choice node offers, from the value of its source
 * variable (a list of strings or objects, or an object holding one at
 * `listPath`). Objects read their label and value from `labelField` /
 * `valueField`, or from the usual names (label, name, title, text / value,
 * id). Empty labels are dropped, repeats shown once, at most `maxOptions`.
 */
export const dynamicOptions = (data: any, sourceValue: any): DynamicOption[] => {
  const root = asData(sourceValue);
  let list = getPath(root, data?.listPath);
  list = asData(list);
  if (!Array.isArray(list)) return [];
  const labelField = String(data?.labelField ?? "").trim();
  const valueField = String(data?.valueField ?? "").trim();
  const max = Math.max(
    1,
    Math.min(DYNAMIC_MAX_OPTIONS, Math.floor(Number(data?.maxOptions)) || DYNAMIC_DEFAULT_MAX)
  );
  const seen = new Set<string>();
  const out: DynamicOption[] = [];
  for (const item of list) {
    if (out.length >= max) break;
    let label: any;
    let value: any;
    if (scalar(item)) {
      if (item === null) continue;
      label = item;
      value = item;
    } else if (item && typeof item === "object") {
      label = labelField
        ? getPath(item, labelField)
        : item.label ?? item.name ?? item.title ?? item.text;
      value = valueField ? getPath(item, valueField) : item.value ?? item.id ?? label;
    } else {
      continue;
    }
    const text = plainText(scalar(label) ? label : "");
    if (!text) continue;
    if (!scalar(value) || value === null || value === undefined) value = text;
    const key = `${text}\u0000${String(value)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: `opt-${out.length}`, label: text, value });
  }
  return out;
};

/** The handle a dynamic choice leaves by: picked ("source") or empty list. */
export const DYNAMIC_EMPTY_HANDLE = "source-empty";

// ---------------------------------------------------------------------------
// (2) Hidden fields / URL parameters
// ---------------------------------------------------------------------------

export const HIDDEN_MAX_VALUE = 500;

export interface HiddenParam {
  name: string;
  variable: string;
}

/** The parameters a hidden fields node reads (named, with a variable). */
export const hiddenParamsOf = (data: any): HiddenParam[] =>
  (Array.isArray(data?.params) ? data.params : [])
    .map((p: any) => ({ name: String(p?.name ?? "").trim(), variable: String(p?.variable ?? "").trim() }))
    .filter((p: HiddenParam) => p.name && p.variable);

const clip = (v: any) => String(v ?? "").trim().slice(0, HIDDEN_MAX_VALUE);

/** A page address worth keeping: http(s) only (not about:srcdoc, file:, blob:). */
export const isWebAddress = (v: any): boolean => /^https?:\/\//i.test(String(v ?? ""));

/**
 * What a hidden fields node captures: { variable: value } for each
 * parameter present in the page's query (the current page first, then the
 * page the visitor landed on), plus the page URL and the referrer when asked
 * for. Missing parameters are left out, so "is empty" conditions work.
 */
export const captureHiddenFields = (
  data: any,
  page: { href?: string; referrer?: string; landingSearch?: string }
): Record<string, string> => {
  const out: Record<string, string> = {};
  const read = (search: string) => {
    try {
      return new URLSearchParams(search || "");
    } catch (e) {
      return new URLSearchParams("");
    }
  };
  let current = new URLSearchParams("");
  try {
    current = page.href ? new URL(page.href).searchParams : current;
  } catch (e) {
    /* not a URL */
  }
  const landing = read(page.landingSearch || "");
  hiddenParamsOf(data).forEach(({ name, variable }) => {
    const v = current.get(name) ?? landing.get(name);
    if (v !== null && v !== undefined && clip(v) !== "") out[variable] = clip(v);
  });
  const pageVar = String(data?.pageUrlVariable ?? "").trim();
  if (data?.capturePageUrl !== false && pageVar && isWebAddress(page.href)) out[pageVar] = clip(page.href);
  const refVar = String(data?.referrerVariable ?? "").trim();
  if (data?.captureReferrer !== false && refVar && isWebAddress(page.referrer)) out[refVar] = clip(page.referrer);
  return out;
};

// ---------------------------------------------------------------------------
// (3) Consent - markdown-lite text
// ---------------------------------------------------------------------------

/** A link the consent text may carry: http(s) or mailto only. */
export const safeLink = (url: any): string => {
  const raw = String(url ?? "").trim();
  if (/^(https?:\/\/|mailto:)\S+$/i.test(raw)) return raw;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(raw)) return `https://${raw}`;
  return "";
};

const MD_LINK = /\[([^\]\n]{1,200})\]\(((?:[^()\s]|\([^()\s]*\)){1,500})\)/g;

/**
 * Markdown-lite to HTML: [text](url) links (new tab), **bold**, *italic* or
 * _italic_, and line breaks. Everything else is escaped text, so the owner's
 * words can never inject markup; a link that isn't http(s)/mailto stays text.
 */
export const markdownLiteHtml = (md: any): string => {
  const links: string[] = [];
  // Links first (escaped separately), parked behind a placeholder.
  const parked = String(md ?? "").replace(MD_LINK, (whole, text, url) => {
    const href = safeLink(url);
    if (!href) return whole;
    links.push(
      `<a href="${escHtml(href)}" target="_blank" rel="noopener noreferrer">${escHtml(text)}<span class="cb-sr-only"> ${t("common.opensNewTab")}</span></a>`
    );
    return `\u0000${links.length - 1}\u0000`;
  });
  return escHtml(parked)
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, "$1<em>$2</em>")
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?:;]|$)/g, "$1<em>$2</em>")
    .replace(/\r?\n/g, "<br>")
    .replace(/\u0000(\d+)\u0000/g, (_, i) => links[Number(i)] || "");
};

/** The text as plain words: "I agree to the Terms and Privacy Policy". */
export const markdownLitePlain = (md: any): string =>
  String(md ?? "")
    .replace(MD_LINK, "$1")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,!?:;]|$)/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();

/** The documents a consent text links to: ["Terms", "Privacy Policy"]. */
export const consentDocuments = (md: any): string[] => {
  const out: string[] = [];
  String(md ?? "").replace(MD_LINK, (_, text, url) => {
    const t = String(text).trim();
    if (t && safeLink(url) && !out.includes(t)) out.push(t);
    return "";
  });
  return out;
};

/** "Terms and Privacy Policy", "A, B and C". */
export const joinAnd = (items: string[]): string =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} ${t("common.and")} ${items[items.length - 1]}`;

/** What the visitor's reply says: "Agreed to Terms and Privacy Policy" / "Didn't agree". */
export const consentReply = (md: any, agreed: boolean): string => {
  if (!agreed) return t("consent.declined");
  const docs = consentDocuments(md);
  return docs.length ? t("consent.agreedTo", { docs: joinAnd(docs) }) : t("consent.agreed");
};

export const consentContinueLabel = (data: any): string => String(data?.continueLabel ?? "").trim() || t("common.continue");

/** Required unless the owner made it optional. */
export const consentRequired = (data: any): boolean => data?.required !== false;

// ---------------------------------------------------------------------------
// (4) Product card - one carousel card with a price
// ---------------------------------------------------------------------------

export const PRODUCT_CARD_ID = "product";

/** The product as carousel data, so the carousel's renderer draws it. */
export const productCarouselData = (data: any) => ({
  cards: [
    {
      id: PRODUCT_CARD_ID,
      image: data?.image ?? "",
      title: data?.title ?? "",
      description: data?.description ?? "",
      price: data?.price ?? "",
      buttons: Array.isArray(data?.buttons) ? data.buttons.slice(0, 3) : [],
    },
  ],
});

/** A product card's text for the transcript: "Pro plan · $49/mo". */
export const productSummary = (data: any): string =>
  [String(data?.title ?? "").trim(), String(data?.price ?? "").trim()].filter(Boolean).join(" · ");

// ---------------------------------------------------------------------------
// (5a) Slider
// ---------------------------------------------------------------------------

const numOr = (v: any, d: number) => (v === "" || v === null || v === undefined || !Number.isFinite(Number(v)) ? d : Number(v));

export interface SliderConfig {
  min: number;
  max: number;
  step: number;
  start: number;
  unit: string;
  unitPosition: "prefix" | "suffix";
}

const decimalsOf = (n: number) => {
  const s = String(n);
  return s.includes(".") ? s.split(".")[1].length : 0;
};

/** Onto the step grid (counted from min), inside the range. */
export const snapToStep = (value: number, cfg: { min: number; max: number; step: number }): number => {
  const steps = Math.round((value - cfg.min) / cfg.step);
  const v = Math.min(cfg.max, Math.max(cfg.min, cfg.min + steps * cfg.step));
  return Number(v.toFixed(Math.max(decimalsOf(cfg.step), decimalsOf(cfg.min))));
};

/** The slider's settings, made safe (max above min, a step that fits, a start on the grid). */
export const sliderConfig = (data: any): SliderConfig => {
  const min = numOr(data?.min, 0);
  let max = numOr(data?.max, 100);
  if (max <= min) max = min + 1;
  let step = numOr(data?.step, 1);
  if (!(step > 0) || step > max - min) step = Math.min(1, max - min) || 1;
  const wanted = numOr(data?.defaultValue, (min + max) / 2);
  const base = { min, max, step };
  return {
    ...base,
    start: snapToStep(wanted, base),
    unit: String(data?.unit ?? "").trim(),
    unitPosition: data?.unitPosition === "prefix" ? "prefix" : "suffix",
  };
};

/** "50 kg", "$50". */
export const sliderLabel = (value: any, cfg: { unit: string; unitPosition: string }): string => {
  if (!cfg.unit) return String(value);
  return cfg.unitPosition === "prefix" ? `${cfg.unit}${value}` : `${value} ${cfg.unit}`;
};

export const submitLabel = (data: any): string => String(data?.submitLabel ?? "").trim() || t("common.send");

// ---------------------------------------------------------------------------
// (5b) Date / time picker
// ---------------------------------------------------------------------------

export type DateMode = "date" | "time" | "datetime";
export const dateMode = (data: any): DateMode =>
  data?.mode === "time" || data?.mode === "datetime" ? data.mode : "date";

const pad2 = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** A weekday's name in the visitor's language (0 = Sunday). */
export const weekdayName = (wd: number): string => {
  if (widgetLanguage() === "en") return WEEKDAYS[wd];
  try {
    // 2023-01-01 was a Sunday.
    return new Intl.DateTimeFormat(widgetLocale(), { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2023, 0, 1 + wd)));
  } catch (e) {
    return WEEKDAYS[wd];
  }
};
/** "Saturdays" in English; the plain day name elsewhere ("zaterdag"). */
const weekdaysName = (wd: number): string => (widgetLanguage() === "en" ? `${WEEKDAYS[wd]}s` : weekdayName(wd));

export const validYmd = (s: any): boolean => {
  const m = String(s ?? "").match(DATE_RE);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
};

/** A bound as a date: "2026-10-05", "today", "+7" / "-3" (days from today). */
export const resolveDateBound = (bound: any, today = new Date()): string | null => {
  const b = String(bound ?? "").trim().toLowerCase();
  if (!b) return null;
  if (b === "today") return ymd(today);
  const rel = b.match(/^([+-])(\d{1,4})$/);
  if (rel) {
    return ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() + (rel[1] === "-" ? -1 : 1) * Number(rel[2])));
  }
  return validYmd(b) ? b : null;
};

export const disabledWeekdaysOf = (data: any): number[] =>
  (Array.isArray(data?.disabledWeekdays) ? data.disabledWeekdays : [])
    .map(Number)
    .filter((n: number) => Number.isInteger(n) && n >= 0 && n <= 6);

/** Why an ISO value isn't allowed, or null. Same rules as the channels'. */
export const dateTimeError = (data: any, iso: any, today = new Date()): string | null => {
  const mode = dateMode(data);
  const s = String(iso ?? "");
  const [datePart, timePart] = mode === "datetime" ? s.split("T") : mode === "time" ? ["", s] : [s, ""];
  if (mode !== "time") {
    if (!validYmd(datePart)) return t("dates.pickDate");
    const min = resolveDateBound(data?.minDate, today);
    const max = resolveDateBound(data?.maxDate, today);
    if (min && datePart < min) return t("dates.onOrAfter", { date: min });
    if (max && datePart > max) return t("dates.onOrBefore", { date: max });
    const [y, m, d] = datePart.split("-").map(Number);
    const wd = new Date(y, m - 1, d).getDay();
    if (disabledWeekdaysOf(data).includes(wd)) return t("dates.dayUnavailable", { day: weekdaysName(wd) });
  }
  if (mode !== "date") {
    if (!TIME_RE.test(String(timePart || ""))) return t("dates.pickTime");
    if (data?.minTime && TIME_RE.test(data.minTime) && timePart < data.minTime) return t("dates.timeFrom", { time: data.minTime });
    if (data?.maxTime && TIME_RE.test(data.maxTime) && timePart > data.maxTime) return t("dates.timeUntil", { time: data.maxTime });
  }
  return null;
};

/** A browser input's value as our ISO ("2026-10-05T14:30:00" -> "2026-10-05T14:30"). */
export const isoFromInput = (mode: DateMode, value: any): string => {
  const v = String(value ?? "").trim();
  if (mode === "time") return v.slice(0, 5);
  if (mode === "datetime") return v.slice(0, 16);
  return v.slice(0, 10);
};

/** The picked value for people, in the node's locale (or the visitor's own). */
export const dateTimeDisplay = (data: any, iso: any, fallbackLocale?: string): string => {
  const mode = dateMode(data);
  const locale = String(data?.locale ?? "").trim() || fallbackLocale || undefined;
  try {
    if (mode === "time") {
      const [h, m] = String(iso).split(":").map(Number);
      return new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(new Date(2000, 0, 1, h, m));
    }
    const [dp, tp] = String(iso).split("T");
    const [y, mo, d] = dp.split("-").map(Number);
    const [h, mi] = (tp || "00:00").split(":").map(Number);
    return new Intl.DateTimeFormat(
      locale,
      mode === "date" ? { dateStyle: "medium" } : { dateStyle: "medium", timeStyle: "short" }
    ).format(new Date(y, mo - 1, d, h, mi));
  } catch (e) {
    return String(iso);
  }
};

/** The attributes the browser's own picker takes: min / max / step. */
export const dateInputAttrs = (data: any, today = new Date()) => {
  const mode = dateMode(data);
  const minD = resolveDateBound(data?.minDate, today);
  const maxD = resolveDateBound(data?.maxDate, today);
  const minT = TIME_RE.test(String(data?.minTime || "")) ? data.minTime : "";
  const maxT = TIME_RE.test(String(data?.maxTime || "")) ? data.maxTime : "";
  const stepMin = Math.min(720, Math.max(1, Math.floor(numOr(data?.timeStep, 30))));
  if (mode === "date") return { type: "date", min: minD || "", max: maxD || "", step: "" };
  if (mode === "time") return { type: "time", min: minT, max: maxT, step: String(stepMin * 60) };
  return {
    type: "datetime-local",
    min: minD ? `${minD}T${minT || "00:00"}` : "",
    max: maxD ? `${maxD}T${maxT || "23:59"}` : "",
    step: String(stepMin * 60),
  };
};

/** "Closed on Saturdays and Sundays" - said up front, under the picker. */
export const closedDaysNote = (data: any): string => {
  const days = disabledWeekdaysOf(data).sort();
  if (!days.length || dateMode(data) === "time") return "";
  return t("dates.closedOn", { days: joinAnd(days.map(weekdaysName)) });
};

// ---------------------------------------------------------------------------
// (6) Ranking
// ---------------------------------------------------------------------------

export const RANKING_MAX = 10;

export interface RankItem {
  id: string;
  text: string;
}

/** The items to rank, in their starting order (at most ten, each with text). */
export const rankingItems = (data: any): RankItem[] =>
  (Array.isArray(data?.items) ? data.items : [])
    .map((it: any, i: number) => ({ id: String(it?.id ?? i), text: plainText(it?.text) }))
    .filter((it: RankItem) => it.text)
    .slice(0, RANKING_MAX);

/** Move one item (by drag, arrow key or the move buttons); out-of-range is a no-op. */
export const moveItem = <T>(list: T[], from: number, to: number): T[] => {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

/** "1. Price · 2. Speed · 3. Support" - the visitor's reply. */
export const rankingText = (order: RankItem[]): string => order.map((it, i) => `${i + 1}. ${it.text}`).join(" · ");

/** What a screen reader hears after a move. */
export const rankingAnnouncement = (item: RankItem, index: number, total: number): string =>
  t("ranking.moved", { item: item.text, n: index + 1, total });

/** A landing page's query worth remembering (it has parameters at all). */
export const landingSearchToKeep = (search: any): string =>
  typeof search === "string" && search.length > 1 && search.startsWith("?") ? search.slice(0, 2000) : "";

// ---------------------------------------------------------------------------
// (7) Verification code (OTP) - the code is made and checked on the server
// (embed-server services/chatbot/otpService.js); these are the UI rules.
// ---------------------------------------------------------------------------

export const OTP_LENGTH = 6;
export const OTP_RESEND_SECONDS = 30;
/** The code the builder's preview accepts (no email is sent there). */
export const OTP_PREVIEW_CODE = "123456";

const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:"]{2,}$/;
export const isEmailAddress = (v: any): boolean => typeof v === "string" && v.length <= 254 && EMAIL_RE.test(v.trim());

/** "p***@acme.io" */
export const maskEmail = (email: any): string => {
  const e = String(email ?? "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  return at < 1 ? "***" : `${e[0]}***${e.slice(at)}`;
};

/** The digits of a pasted / typed code, at most six ("123 456" -> "123456"). */
export const digitsFromPaste = (text: any, length = OTP_LENGTH): string =>
  String(text ?? "")
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, "")
    .slice(0, length);

/** Put `text`'s digits into the boxes from `start`; returns the boxes and where focus goes next. */
export const fillDigits = (boxes: string[], start: number, text: any): { boxes: string[]; next: number } => {
  const digits = digitsFromPaste(text, boxes.length);
  const out = boxes.slice();
  const from = digits.length >= boxes.length ? 0 : Math.max(0, Math.min(start, boxes.length - 1));
  let i = from;
  for (const d of digits) {
    if (i >= out.length) break;
    out[i++] = d;
  }
  return { boxes: out, next: Math.min(i, out.length - 1) };
};

/** "Resend in 0:27" / "Resend code" */
export const resendLabel = (seconds: number): string => {
  const s = Math.max(0, Math.ceil(Number(seconds) || 0));
  return s > 0 ? t("otp.resendIn", { time: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` }) : t("otp.resend");
};

export const otpChannel = (data: any): "email" | "sms" => (data?.channel === "sms" ? "sms" : "email");

/** The address to verify without asking, when the step takes it from a variable. */
export const otpPresetEmail = (data: any, lookup: (key: string) => any): string => {
  if (data?.emailSource !== "variable") return "";
  const key = String(data?.emailVariable ?? "").trim();
  const v = key ? String(lookup(key) ?? "").trim() : "";
  return isEmailAddress(v) ? v.toLowerCase() : "";
};

/** What to tell the visitor for a server answer (send or verify). */
export const otpErrorText = (code: any, extra: { attemptsLeft?: number; retryAfter?: number } = {}): string => {
  switch (code) {
    case "invalid_email":
      return t("otp.invalidEmail");
    case "wrong_code": {
      const n = Number(extra.attemptsLeft);
      return Number.isFinite(n) ? t(n === 1 ? "otp.wrongLeft.one" : "otp.wrongLeft.other", { n }) : t("otp.wrong");
    }
    case "invalid_code":
      return t("otp.allDigits", { n: OTP_LENGTH });
    case "expired":
      return t("otp.expired");
    case "no_code":
      return t("otp.noCode");
    case "locked":
      return t("otp.locked");
    case "resend_wait":
      return t("otp.resendWait", { n: Math.max(1, Number(extra.retryAfter) || OTP_RESEND_SECONDS) });
    case "too_many_sends":
    case "rate_limited":
      return t("otp.tooMany");
    case "sms_unavailable":
      return t("otp.smsUnavailable");
    default:
      return t("common.somethingWrong");
  }
};

/** Failures that end the step on its "not verified" path. */
export const otpEndsStep = (code: any): boolean => ["locked", "sms_unavailable", "node_not_found", "send_failed"].includes(String(code));

/** The visitor's reply bubble for a finished step. */
export const otpReplyText = (verified: boolean, email?: string): string =>
  verified ? t("otp.verifiedAs", { email: String(email ?? "") }) : t("otp.notVerified");

// ---------------------------------------------------------------------------
// (8) Address - search (server-proxied geocoder), my location, manual entry
// ---------------------------------------------------------------------------

export const ADDRESS_DEBOUNCE_MS = 300;
export const ADDRESS_MIN_CHARS = 3;

export interface AddressValue {
  formatted: string;
  line1: string;
  city: string;
  region: string;
  postal: string;
  country: string;
  countryCode: string;
  lat: number | null;
  lng: number | null;
}

const clip200 = (v: any) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
const finiteOrNull = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** "12 Al Marsa St, Dubai, Dubai 00000, United Arab Emirates" from the parts. */
export const formatAddress = (v: Partial<AddressValue>): string => {
  const city = clip200(v?.city);
  const region = clip200(v?.region);
  const postal = clip200(v?.postal);
  const cityLine = [city, [region !== city ? region : "", postal].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [clip200(v?.line1), cityLine, clip200(v?.country)].filter(Boolean).join(", ");
};

/** Any address the server or the visitor gave, cleaned into one shape. */
export const normalizeAddress = (v: any): AddressValue => {
  const out: AddressValue = {
    formatted: clip200(v?.formatted),
    line1: clip200(v?.line1),
    city: clip200(v?.city),
    region: clip200(v?.region),
    postal: clip200(v?.postal),
    country: clip200(v?.country),
    countryCode: /^[a-z]{2}$/i.test(String(v?.countryCode ?? "").trim()) ? String(v.countryCode).trim().toLowerCase() : "",
    lat: finiteOrNull(v?.lat),
    lng: finiteOrNull(v?.lng),
  };
  if (out.lat === null || out.lng === null || Math.abs(out.lat) > 90 || Math.abs(out.lng) > 180) {
    out.lat = null;
    out.lng = null;
  }
  if (!out.formatted) out.formatted = formatAddress(out);
  return out;
};

/** The visitor's own entry (Street, City, Region, Postal code, Country); null when not enough. */
export const manualAddress = (fields: { line1?: any; city?: any; region?: any; postal?: any; country?: any }): AddressValue | null => {
  const v = normalizeAddress({ ...fields, formatted: "", countryCode: "", lat: null, lng: null });
  if (!v.line1) return null;
  v.formatted = formatAddress(v);
  return v;
};

const ADDRESS_SUFFIXES: [keyof AddressValue, string][] = [
  ["line1", "line1"],
  ["city", "city"],
  ["region", "region"],
  ["postal", "postal"],
  ["country", "country"],
  ["countryCode", "country_code"],
  ["lat", "lat"],
  ["lng", "lng"],
];

/** The variables an address saves: { k: formatted, k_line1, k_city, ... } (empty parts left out). */
export const addressVariables = (key: any, value: AddressValue): Record<string, any> => {
  const k = String(key ?? "").trim();
  const out: Record<string, any> = {};
  if (!k) return out;
  out[k] = value.formatted;
  ADDRESS_SUFFIXES.forEach(([field, suffix]) => {
    const v = value[field];
    if (v === null || v === undefined || v === "") return;
    out[`${k}_${suffix}`] = v;
  });
  return out;
};

/**
 * The OpenStreetMap tile holding a point, and where the point sits in it
 * (Web Mercator, 256px tiles): to draw a small static map with a pin.
 */
export const osmTile = (lat: number, lng: number, zoom = 16) => {
  const z = Math.max(0, Math.min(19, Math.floor(zoom)));
  const n = 2 ** z;
  const la = Math.max(-85.0511, Math.min(85.0511, lat));
  const x = ((lng + 180) / 360) * n;
  const rad = (la * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  const tx = Math.min(n - 1, Math.max(0, Math.floor(x)));
  const ty = Math.min(n - 1, Math.max(0, Math.floor(y)));
  return {
    z,
    x: tx,
    y: ty,
    url: `https://tile.openstreetmap.org/${z}/${tx}/${ty}.png`,
    offsetX: Math.round((x - tx) * 256),
    offsetY: Math.round((y - ty) * 256),
  };
};

/**
 * A map tile through our server (embed-server /api/v1/geo/tile): OSM blocks
 * tiles hot-linked from customer sites, and asks heavy users to cache.
 */
export const tileSrc = (backend: string, z: number, x: number, y: number): string =>
  `${String(backend || "").replace(/\/+$/, "")}/api/v1/geo/tile/${z}/${x}/${y}.png`;

/** "View on the map" link for a point. */
export const osmLink = (lat: number, lng: number): string =>
  `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lng.toFixed(6)}#map=17/${lat.toFixed(6)}/${lng.toFixed(6)}`;

/** The builder preview's stand-in results (no network there). */
export const ADDRESS_PREVIEW_SAMPLES: AddressValue[] = [
  { formatted: "Marina Walk, Dubai Marina, Dubai, United Arab Emirates", line1: "Marina Walk", city: "Dubai", region: "Dubai", postal: "", country: "United Arab Emirates", countryCode: "ae", lat: 25.0805, lng: 55.1403 },
  { formatted: "1 Sheikh Mohammed bin Rashid Blvd, Downtown Dubai, Dubai, United Arab Emirates", line1: "1 Sheikh Mohammed bin Rashid Blvd", city: "Dubai", region: "Dubai", postal: "", country: "United Arab Emirates", countryCode: "ae", lat: 25.1972, lng: 55.2744 },
  { formatted: "221B Baker Street, London, NW1 6XE, United Kingdom", line1: "221B Baker Street", city: "London", region: "England", postal: "NW1 6XE", country: "United Kingdom", countryCode: "gb", lat: 51.5238, lng: -0.1586 },
  { formatted: "350 5th Avenue, New York, NY 10118, United States", line1: "350 5th Avenue", city: "New York", region: "New York", postal: "10118", country: "United States", countryCode: "us", lat: 40.7484, lng: -73.9857 },
];

/** Preview search: the samples matching any word of the query (all of them when none match). */
export const previewAddressResults = (q: any): AddressValue[] => {
  const words = String(q ?? "").toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
  const hits = ADDRESS_PREVIEW_SAMPLES.filter((a) => words.some((w) => a.formatted.toLowerCase().includes(w)));
  return hits.length ? hits : ADDRESS_PREVIEW_SAMPLES.slice();
};

/** What to tell the visitor when a lookup fails. */
export const addressErrorText = (code: any): string => {
  switch (code) {
    case "denied":
      return t("address.denied");
    case "unavailable":
      return t("address.unavailable");
    case "busy":
    case "rate_limited":
      return t("address.busy");
    case "no_results":
      return t("address.noResults");
    default:
      return t("address.failed");
  }
};

// ---------------------------------------------------------------------------
// (9) Matrix / Likert grid
// ---------------------------------------------------------------------------

export const MATRIX_MAX_ROWS = 12;
export const MATRIX_MAX_COLUMNS = 7;

export interface MatrixItem {
  id: string;
  text: string;
}
export type MatrixMode = "single" | "multiple";
/** What the visitor ticked: row id -> column ids (one for single). */
export type MatrixSelection = Record<string, string[]>;

const matrixItems = (list: any, max: number, prefix: string): MatrixItem[] => {
  const seen = new Set<string>();
  const out: MatrixItem[] = [];
  (Array.isArray(list) ? list : []).forEach((it: any, i: number) => {
    const text = plainText(it?.text);
    if (!text || out.length >= max) return;
    let id = String(it?.id ?? `${prefix}${i}`);
    if (seen.has(id)) id = `${id}_${i}`;
    seen.add(id);
    out.push({ id, text });
  });
  return out;
};

/** The statements (rows), cleaned: text only, at most twelve. */
export const matrixRows = (data: any): MatrixItem[] => matrixItems(data?.rows, MATRIX_MAX_ROWS, "r");
/** The scale (columns), cleaned: text only, at most seven. */
export const matrixColumns = (data: any): MatrixItem[] => matrixItems(data?.columns, MATRIX_MAX_COLUMNS, "c");
export const matrixMode = (data: any): MatrixMode => (data?.mode === "multiple" ? "multiple" : "single");
export const matrixRequireAll = (data: any): boolean => data?.requireAll !== false;

/** Tick / untick one cell. Single mode keeps one column per row. */
export const matrixToggle = (
  sel: MatrixSelection,
  rowId: string,
  colId: string,
  mode: MatrixMode,
  on = true
): MatrixSelection => {
  const cur = sel[rowId] || [];
  let next: string[];
  if (mode === "single") next = on ? [colId] : cur.filter((c) => c !== colId);
  else next = on ? (cur.includes(colId) ? cur : [...cur, colId]) : cur.filter((c) => c !== colId);
  const out = { ...sel };
  if (next.length) out[rowId] = next;
  else delete out[rowId];
  return out;
};

/** The rows still without an answer. */
export const matrixMissing = (sel: MatrixSelection, rows: MatrixItem[]): MatrixItem[] =>
  rows.filter((r) => !(sel[r.id] && sel[r.id].length));

/** The saved value: { row: column } or { row: [columns] } (columns in scale order); unanswered rows left out. */
export const matrixValue = (sel: MatrixSelection, rows: MatrixItem[], cols: MatrixItem[], mode: MatrixMode) => {
  const out: Record<string, string | string[]> = {};
  rows.forEach((r) => {
    const picked = cols.filter((c) => (sel[r.id] || []).includes(c.id)).map((c) => c.text);
    if (!picked.length) return;
    out[r.text] = mode === "single" ? picked[0] : picked;
  });
  return out;
};

/** Per row, for the record: { id, text, answer }. */
export const matrixRowAnswers = (sel: MatrixSelection, rows: MatrixItem[], cols: MatrixItem[], mode: MatrixMode) =>
  rows.map((r) => {
    const picked = cols.filter((c) => (sel[r.id] || []).includes(c.id)).map((c) => c.text);
    return { id: r.id, text: r.text, answer: picked.length ? (mode === "single" ? picked[0] : picked) : null };
  });

/** "Speed: Good · Price: Fair, Poor" - the visitor's reply. */
export const matrixDisplay = (value: Record<string, string | string[]>): string =>
  Object.entries(value || {})
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
    .join(" · ");

/** "2 of 4 answered". */
export const matrixProgress = (sel: MatrixSelection, rows: MatrixItem[]): string =>
  t("matrix.progress", { n: rows.length - matrixMissing(sel, rows).length, total: rows.length });

/** What blocks Submit, or "". */
export const matrixError = (sel: MatrixSelection, rows: MatrixItem[], requireAll: boolean): string => {
  const missing = matrixMissing(sel, rows);
  if (requireAll && missing.length) return t("matrix.everyRow", { n: missing.length });
  if (missing.length === rows.length) return t("matrix.oneRow");
  return "";
};

// ---------------------------------------------------------------------------
// (10) AI extract / AI intent router - the server runs the AI with the
// owner's key (embed-server aiNodeService.js); these are the widget's rules.
// ---------------------------------------------------------------------------

export const AI_NODE_TYPES = ["ai-extract-node", "ai-route-node"];
export const isAiNode = (type: any): boolean => AI_NODE_TYPES.includes(type);

/** Least time the "thinking" dots show, so a fast answer doesn't flicker. */
export const AI_MIN_THINK_MS = 500;
/** The widget gives up a little after the server's own 12 s timeout. */
export const AI_CLIENT_TIMEOUT_MS = 15000;
export const AI_MAX_INPUT = 2000;

export type AiSource = "ask" | "last_message" | "variable";
export const aiSourceOf = (data: any): AiSource =>
  data?.source === "last_message" || data?.source === "variable" ? data.source : "ask";

/**
 * The text a step reads without asking: the visitor's latest message, or a
 * variable (objects as JSON). null = ask; "" = nothing there yet (ask too).
 */
export const aiPresetText = (data: any, lastUserText: any, variableValue: any): string | null => {
  const source = aiSourceOf(data);
  if (source === "ask") return null;
  const v = source === "variable" ? variableValue : lastUserText;
  if (v === null || v === undefined) return "";
  return (typeof v === "object" ? JSON.stringify(v) : String(v)).trim().slice(0, AI_MAX_INPUT);
};

/** The visitor's latest message in the transcript ([{ by, message }]). */
export const lastUserMessage = (transcript: any): string => {
  const list = Array.isArray(transcript) ? transcript : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i];
    if (e?.by === "user" && typeof e.message === "string" && plainText(e.message)) return plainText(e.message);
  }
  return "";
};

export interface AiExtractResult {
  values: Record<string, any>;
  missing: string[];
  ok: boolean;
  error?: string;
}
export interface AiRouteResult {
  intentId: string | null;
  intent: string | null;
  confidence: number;
  fallback: boolean;
  error?: string;
}

const AI_VAR_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const AI_FIELD_TYPES = ["text", "number", "email", "phone", "date", "boolean", "list"];

export const aiFieldsOf = (data: any) =>
  (Array.isArray(data?.fields) ? data.fields : [])
    .map((f: any) => ({
      name: String(f?.name ?? "").trim(),
      type: AI_FIELD_TYPES.includes(f?.type) ? f.type : "text",
      description: plainText(f?.description),
      required: f?.required === true,
    }))
    .filter((f: any, i: number, all: any[]) => AI_VAR_RE.test(f.name) && all.findIndex((g) => g.name === f.name) === i)
    .slice(0, 15);

export const aiIntentsOf = (data: any) =>
  (Array.isArray(data?.intents) ? data.intents : [])
    .map((it: any, i: number) => ({ id: String(it?.id ?? i), name: plainText(it?.name).slice(0, 40), description: plainText(it?.description) }))
    .filter((it: any) => it.name)
    .slice(0, 10);

/** What a server reply (or a failed request) means: always a path to follow. */
export const aiExtractResultOf = (data: any, json: any, failed?: string): AiExtractResult => {
  const required = aiFieldsOf(data).filter((f: any) => f.required).map((f: any) => f.name);
  if (failed || !json || typeof json !== "object") return { values: {}, missing: required, ok: false, error: failed || "bad_reply" };
  const values = json.values && typeof json.values === "object" && !Array.isArray(json.values) ? json.values : {};
  const missing = Array.isArray(json.missing) ? json.missing.map(String) : required.filter((n: string) => values[n] === undefined);
  return { values, missing, ok: json.ok === true && !missing.length, ...(json.error ? { error: String(json.error) } : {}) };
};

export const aiRouteResultOf = (json: any, failed?: string): AiRouteResult => {
  if (failed || !json || typeof json !== "object" || json.fallback || !json.intentId) {
    return { intentId: null, intent: null, confidence: Number(json?.confidence) || 0, fallback: true, error: failed || json?.error || "no_match" };
  }
  return { intentId: String(json.intentId), intent: String(json.intent ?? ""), confidence: Number(json.confidence) || 0, fallback: false };
};

/** The variables an extract saves: each field, the whole object, and what's missing. */
export const aiExtractVariables = (data: any, r: AiExtractResult): Record<string, any> => {
  const out: Record<string, any> = {};
  const names = new Set(aiFieldsOf(data).map((f: any) => f.name));
  Object.entries(r.values || {}).forEach(([k, v]) => {
    if (names.has(k)) out[k] = v;
  });
  const key = String(data?.answerVariable ?? "").trim();
  if (key) {
    out[key] = { ...out };
    out[`${key}_missing`] = r.missing || [];
  }
  return out;
};

/** The variables a route saves: the intent's name ("" on no match) and the confidence. */
export const aiRouteVariables = (data: any, r: AiRouteResult): Record<string, any> => {
  const key = String(data?.answerVariable ?? "").trim();
  if (!key) return {};
  return { [key]: r.fallback ? "" : r.intent || "", [`${key}_confidence`]: Math.round((r.confidence || 0) * 100) / 100 };
};

// --- Builder preview: no server, a small local stand-in so it still branches.

const PREVIEW_PATTERNS: Record<string, RegExp> = {
  email: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/,
  phone: /\+?\d[\d\s().-]{6,}\d/,
  number: /-?\d+(?:\.\d+)?/,
  date: /\d{4}-\d{2}-\d{2}/,
};

export const previewExtract = (data: any, text: string): AiExtractResult => {
  const t = String(text || "");
  const values: Record<string, any> = {};
  aiFieldsOf(data).forEach((f: any) => {
    let v: any;
    if (f.type === "email" || f.type === "phone" || f.type === "date") v = (t.match(PREVIEW_PATTERNS[f.type]) || [])[0];
    else if (f.type === "number") {
      const m = t.match(PREVIEW_PATTERNS.number);
      v = m ? Number(m[0]) : undefined;
    } else if (f.type === "boolean") v = /\b(yes|yeah|sure|ok)\b/i.test(t) ? true : /\b(no|nope)\b/i.test(t) ? false : undefined;
    else if (/name/i.test(f.name)) v = (t.match(/(?:i'm|i am|my name is|this is)\s+([A-Z][\w'-]+(?:\s[A-Z][\w'-]+)?)/i) || [])[1];
    if (v !== undefined && v !== "") values[f.name] = typeof v === "string" ? v.trim() : v;
  });
  const missing = aiFieldsOf(data).filter((f: any) => f.required && values[f.name] === undefined).map((f: any) => f.name);
  return { values, missing, ok: missing.length === 0 };
};

const words = (s: string) =>
  String(s || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);

export const previewRoute = (data: any, text: string): AiRouteResult => {
  const said = new Set(words(text));
  let best: any = null;
  let bestScore = 0;
  aiIntentsOf(data).forEach((it: any) => {
    const score = words(`${it.name} ${it.description}`).filter((w) => said.has(w) || [...said].some((s) => s.length > 3 && (w.startsWith(s) || s.startsWith(w)))).length;
    if (score > bestScore) {
      best = it;
      bestScore = score;
    }
  });
  const min = Number.isFinite(Number(data?.minConfidence)) ? Number(data.minConfidence) : 0.5;
  const confidence = best ? Math.min(0.95, 0.6 + 0.15 * bestScore) : 0.2;
  if (!best || confidence < min) return { intentId: null, intent: null, confidence, fallback: true, error: "no_match" };
  return { intentId: best.id, intent: best.name, confidence, fallback: false };
};

// ---------------------------------------------------------------------------
// (11) Knowledge-base answer - the server retrieves from the bot's published
// knowledge and writes a grounded answer (embed-server kbAnswerService.js);
// these are the widget's rules for what comes back.
// ---------------------------------------------------------------------------

export const KB_NODE_TYPE = "kb-answer-node";
export const isKbNode = (type: any): boolean => type === KB_NODE_TYPE;
/** Steps that read the visitor's reply from the normal composer. */
export const isComposerRichNode = (type: any): boolean => isAiNode(type) || isKbNode(type);
/** A little after the server's own 15 s timeout. */
export const KB_CLIENT_TIMEOUT_MS = 18000;
export const KB_MAX_ANSWER = 700;
export const KB_DEFAULT_NOT_FOUND = "<p>I couldn't find that in our help articles.</p>";

export interface KbSource {
  title: string;
  url: string;
  articleId?: string;
  type: "article" | "page";
}
export interface KbResult {
  found: boolean;
  answer: string;
  sources: KbSource[];
  error?: string;
}

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

export const kbMaxSources = (data: any): number => {
  const n = Math.floor(Number(data?.maxSources));
  return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 3;
};

/** The server's reply, made safe: plain answer text, at most maxSources https / article sources. */
export const kbResultOf = (data: any, json: any, errorCode?: string): KbResult => {
  const answer = plainText(json?.answer).slice(0, KB_MAX_ANSWER + 1);
  if (!json || json.found !== true || !answer) {
    return { found: false, answer: "", sources: [], error: errorCode || (typeof json?.error === "string" ? json.error : "not_found") };
  }
  const seen = new Set<string>();
  const sources: KbSource[] = [];
  if (data?.showSources !== false) {
    for (const s of Array.isArray(json.sources) ? json.sources : []) {
      if (sources.length >= kbMaxSources(data)) break;
      const url = /^https?:\/\//i.test(String(s?.url || "")) ? String(s.url) : "";
      const articleId = OBJECT_ID_RE.test(String(s?.articleId || "")) ? String(s.articleId) : "";
      const key = articleId ? `a:${articleId}` : url;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      sources.push({ title: plainText(s?.title).slice(0, 160) || (url ? url.replace(/^https?:\/\//, "") : t("kb.helpArticle")), url, ...(articleId ? { articleId } : {}), type: articleId ? "article" : "page" });
    }
  }
  return { found: true, answer, sources };
};

/** What the step saves: {k} the answer, {k}_found, {k}_sources [{ title, url }]. */
export const kbVariables = (data: any, r: KbResult): Record<string, any> => {
  const k = String(data?.answerVariable ?? "").trim();
  if (!k) return {};
  return {
    [k]: r.found ? r.answer : "",
    [`${k}_found`]: !!r.found,
    [`${k}_sources`]: r.found ? r.sources.map((s) => ({ title: s.title, url: s.url })) : [],
  };
};

/** The bot's not-found words (the owner's HTML is rendered like any bot text). */
export const kbNotFoundHtml = (data: any): string => (plainText(data?.notFoundMessage) ? String(data.notFoundMessage) : `<p>${t("kb.notFound")}</p>`);

/**
 * Builder preview: no network. A clearly simulated answer with one sample
 * source, or not found when the question says "xyzzy" (so both paths can be tried).
 */
export const previewKb = (data: any, text: string): KbResult => {
  const q = String(text || "").trim();
  if (!q || /xyzzy/i.test(q)) return { found: false, answer: "", sources: [], error: "no_match" };
  return kbResultOf(
    data,
    {
      found: true,
      answer: `Here's what our help articles say about "${q.slice(0, 60)}${q.length > 60 ? "…" : ""}". On the live bot this answer comes from your published knowledge base.`,
      sources: [{ title: "Getting started with Conferbot", url: "https://www.conferbot.com/" }],
    },
    undefined
  );
};


// ---------------------------------------------------------------------------
// (12) Signature - a canvas pad (or a typed name), saved as a PNG
// ---------------------------------------------------------------------------

export const SIG_EXPORT_MAX_W = 1200;
export const SIG_EXPORT_PAD = 16;
export const SIG_EXPORT_INK = "#111827";
/** Script-like faces most systems have, then a cursive fallback. */
export const SIG_FONT_STACK = '"Segoe Script", "Bradley Hand", "Brush Script MT", "Snell Roundhand", "Apple Chancery", "URW Chancery L", cursive';

export interface SigPoint {
  x: number;
  y: number;
  p: number;
}
export type SigStroke = SigPoint[];

export const isHexColor = (v: any): boolean => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(v ?? "").trim());

export const signatureConfig = (data: any) => ({
  allowTyped: data?.allowTyped !== false,
  requireName: data?.requireName === true,
  penColor: isHexColor(data?.penColor) ? String(data.penColor).trim() : "auto",
  submitLabel: String(data?.submitLabel ?? "").trim().slice(0, 30) || t("signature.sign"),
  consentText: String(data?.consentText ?? "").trim(),
});

/** A name that can stand as a signature: 2+ characters with at least one letter. */
const LETTER_RE = (() => {
  try {
    return new RegExp("\\p{L}", "u");
  } catch (e) {
    return /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u0590-\u06FF\u0900-\u097F\u3040-\u30FF\u4E00-\u9FFF]/;
  }
})();
export const isSignatureName = (v: any): boolean => {
  const t = String(v ?? "").replace(/\s+/g, " ").trim();
  return t.length >= 2 && t.length <= 120 && LETTER_RE.test(t);
};
export const cleanSignatureName = (v: any): string => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 120);

/** Line width for a point: pen pressure when the device reports it, else the base. */
export const strokeWidthAt = (pressure: number, base = 2.4): number => {
  const p = Number.isFinite(pressure) && pressure > 0 && pressure !== 0.5 ? pressure : 0.5;
  return Math.round(base * (0.55 + p * 0.9) * 100) / 100;
};

/**
 * The smooth path through a stroke's points: a quadratic curve from each
 * midpoint to the next, with the real point as the control. A one-point
 * stroke is a dot.
 */
export const smoothSegments = (pts: { x: number; y: number }[]) => {
  if (!pts.length) return { start: null as null | { x: number; y: number }, segs: [] as { cx: number; cy: number; x: number; y: number }[] };
  if (pts.length < 3) {
    return { start: { x: pts[0].x, y: pts[0].y }, segs: pts.slice(1).map((q) => ({ cx: q.x, cy: q.y, x: q.x, y: q.y })) };
  }
  const segs: { cx: number; cy: number; x: number; y: number }[] = [];
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    segs.push({ cx: pts[i].x, cy: pts[i].y, x: mx, y: my });
  }
  const last = pts[pts.length - 1];
  segs.push({ cx: last.x, cy: last.y, x: last.x, y: last.y });
  return { start: { x: pts[0].x, y: pts[0].y }, segs };
};

/** The ink's bounding box (with half the widest line), or null when empty. */
export const strokeBounds = (strokes: SigStroke[], lineWidth = 3) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  strokes.forEach((s) =>
    s.forEach((pt) => {
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    })
  );
  if (!Number.isFinite(minX)) return null;
  const h = lineWidth / 2;
  return { minX: minX - h, minY: minY - h, maxX: maxX + h, maxY: maxY + h };
};

/** The export rectangle: the ink plus padding, kept inside the pad. */
export const trimRect = (b: { minX: number; minY: number; maxX: number; maxY: number }, pad: number, w: number, h: number) => {
  const x = Math.max(0, Math.floor(b.minX - pad));
  const y = Math.max(0, Math.floor(b.minY - pad));
  const x2 = Math.min(w, Math.ceil(b.maxX + pad));
  const y2 = Math.min(h, Math.ceil(b.maxY + pad));
  return { x, y, w: Math.max(1, x2 - x), h: Math.max(1, y2 - y) };
};

/** Scale for the exported PNG: crisp (2x) but never wider than the max. */
export const exportScale = (w: number, maxW = SIG_EXPORT_MAX_W, want = 2): number => Math.max(0.1, Math.min(want, maxW / Math.max(1, w)));

/** A typed name drawn as a signature: the size that fits the pad. */
export const typedSignatureFont = (name: string, width: number, height: number) => {
  const len = Math.max(1, cleanSignatureName(name).length);
  const size = Math.round(Math.max(18, Math.min(height * 0.42, 54, (width * 0.86 * 1.9) / len)));
  return { size, font: `italic ${size}px ${SIG_FONT_STACK}` };
};

/** The variables a signature fills. */
export const signatureVariables = (k: string, v: { url: string; at: string; name?: string; method: "drawn" | "typed" }) => {
  const key = String(k ?? "").trim();
  if (!key) return {} as Record<string, any>;
  const out: Record<string, any> = { [key]: v.url, [`${key}_at`]: v.at, [`${key}_method`]: v.method };
  if (v.name) out[`${key}_name`] = v.name;
  return out;
};

// ---------------------------------------------------------------------------
// Payment (payment-node) - Stripe Checkout, run on the server
// (embed-server services/chatbot/paymentService.js). The widget shows a pay
// card, opens Checkout in a new tab and waits for the server to say how it
// ended: paid -> "source", cancelled / failed -> "source-failed", timed out
// -> "source-timeout". The amount is the server's, never the page's.
// ---------------------------------------------------------------------------

export const PAYMENT_NODE_TYPE = "payment-node";
export const PAYMENT_FAILED_HANDLE = "source-failed";
export const PAYMENT_TIMEOUT_HANDLE = "source-timeout";
export const PAYMENT_DEFAULT_TIMEOUT_MIN = 15;
/** How often the open card asks the server (our record only, no Stripe call). */
export const PAYMENT_PEEK_MS = 5000;
/** At most one "ask Stripe" per this, when the visitor comes back to the tab. */
export const PAYMENT_CHECK_GAP_MS = 10000;

const PAY_ZERO_DECIMAL = ["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"];
const PAY_THREE_DECIMAL = ["bhd", "jod", "kwd", "omr", "tnd"];
export const paymentDecimals = (currency: any): number => {
  const c = String(currency ?? "").toLowerCase();
  return PAY_ZERO_DECIMAL.includes(c) ? 0 : PAY_THREE_DECIMAL.includes(c) ? 3 : 2;
};

/** Minor units -> "$25.00" in the visitor's locale (falls back to "USD 25.00"). */
export const paymentAmountText = (minor: any, currency: any, locale?: string): string => {
  const c = String(currency ?? "").trim().toUpperCase();
  const n = Number(minor);
  if (!/^[A-Z]{3}$/.test(c) || !Number.isFinite(n)) return "";
  const major = n / 10 ** paymentDecimals(c);
  try {
    return new Intl.NumberFormat(locale || undefined, { style: "currency", currency: c }).format(major);
  } catch (e) {
    return `${c} ${major.toFixed(paymentDecimals(c))}`;
  }
};

/** Major units the builder stored ("25", 19.99) -> minor units, for the preview. */
export const paymentMinorOf = (amount: any, currency: any): number | null => {
  const raw = String(amount ?? "");
  if (raw.includes("-")) return null;
  const n = Number(raw.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 10 ** paymentDecimals(currency));
};

export const paymentTimeoutMs = (data: any): number => {
  const n = Math.floor(Number(data?.timeoutMinutes));
  return (Number.isFinite(n) && n >= 1 ? Math.min(n, 1440) : PAYMENT_DEFAULT_TIMEOUT_MIN) * 60 * 1000;
};

export type PaymentOutcome = "paid" | "failed" | "timeout";
const PAY_OUTCOME: Record<string, PaymentOutcome> = { paid: "paid", failed: "failed", cancelled: "failed", timeout: "timeout", expired: "timeout" };
export const paymentOutcomeOf = (status: any): PaymentOutcome | null => PAY_OUTCOME[String(status ?? "")] || null;
export const paymentHandleOf = (outcome: PaymentOutcome): string =>
  outcome === "paid" ? "source" : outcome === "timeout" ? PAYMENT_TIMEOUT_HANDLE : PAYMENT_FAILED_HANDLE;

/** "12:05" / "0:42" left before the step times out. */
export const paymentCountdown = (ms: number): string => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

/** Only a Stripe-hosted page may be opened from the card. */
export const isCheckoutUrl = (url: any): boolean => /^https:\/\/([a-z0-9-]+\.)*stripe\.com\//i.test(String(url ?? ""));
export const isReceiptUrl = (url: any): boolean => /^https:\/\/([a-z0-9-]+\.)*stripe\.com\//i.test(String(url ?? ""));

export interface PaymentResult {
  status: string;
  amount: number | null;
  currency: string;
  receiptUrl: string;
  paymentId: string;
}

/** The variables a settled payment writes (mirror of paymentService.paymentVariables). */
export const paymentVariables = (key: any, r: PaymentResult): Record<string, any> => {
  const k = String(key ?? "").trim();
  if (!k) return {};
  const amount = r.amount === null || !Number.isFinite(Number(r.amount)) ? null : Number(r.amount) / 10 ** paymentDecimals(r.currency);
  const currency = String(r.currency || "").toUpperCase();
  const receiptUrl = isReceiptUrl(r.receiptUrl) ? r.receiptUrl : "";
  return {
    [k]: { status: r.status, amount, currency, receiptUrl, paymentId: r.paymentId || "" },
    [`${k}_status`]: r.status,
    [`${k}_amount`]: amount,
    [`${k}_currency`]: currency,
    [`${k}_receipt_url`]: receiptUrl,
  };
};

const PAY_DONE: Record<PaymentOutcome, I18nKey> = { paid: "pay.paid", failed: "pay.cancelled", timeout: "pay.timedOut" };
/** The visitor's side of the transcript once the payment ended. */
export const paymentReplyText = (outcome: PaymentOutcome, amountText = ""): string =>
  outcome === "paid" && amountText ? t("pay.paidAmount", { amount: amountText }) : t(PAY_DONE[outcome]);

/** Server error codes -> what the card says. */
export const paymentErrorText = (code: any): string =>
  code === "not_configured"
    ? t("pay.notConfigured")
    : code === "invalid_amount"
    ? t("pay.invalidAmount")
    : code === "rate_limited"
    ? t("pay.rateLimited")
    : code === "network" || code === "timeout"
    ? t("pay.network")
    : t("pay.failed");

