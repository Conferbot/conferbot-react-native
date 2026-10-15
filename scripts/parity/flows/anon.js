// Customer-free stand-ins for real node data, of the same shape.
//
// This repo is public. Node data from bots that are not our own QA bots is
// rewritten before anything reaches a committed file. Every rewrite is
// deterministic (a hash of the original), so regenerating gives the same bytes.
//   - words (any script) -> neutral filler words of the same length, first-letter case kept
//   - HTML tags, entities, {var} / ${var} / {{var}} placeholders, numbers, punctuation -> kept
//   - URLs -> https://cdn.example.com/media/<hash>.<same extension>; e-mails -> visitor@example.com
//   - variable names a customer chose -> var_<hash> (the builder's own defaults are kept)
//   - structural values (ids, handles, operators, modes, enums, times...) -> kept
const crypto = require('crypto');

/** Our own QA / test bots: their content may stay as it is. */
const OWN_BOTS = new Set([
  '6ac12071ad600df5f50db1d6', // QA - All Nodes
  '627217bd9454945bbbc90ece', // testing (legacy quiz)
  '65016d4143e3041d74a9053c', // all nodes test
  '65b2808a3bb00a3a2d47166c', // Condition Node Test
  '66e1a19cd2cb6db0354bace9', // Answer Vars Test
  '65b77d9cdb05758adbd997f5', // Math Op Test
]);

const hash = (s, n = 8) => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, n);

const FILLER = ['alpha', 'bravo', 'cedar', 'delta', 'ember', 'fable', 'grove', 'harbor', 'island', 'juniper', 'kettle', 'lumen', 'meadow', 'north', 'orbit', 'pebble', 'quartz', 'river', 'summit', 'timber', 'umber', 'violet', 'willow', 'yonder', 'zephyr'];
const fillerWord = (w) => {
  const pick = FILLER[parseInt(hash(w.toLowerCase(), 6), 16) % FILLER.length];
  let out = pick.repeat(Math.ceil(w.length / pick.length) + 1).slice(0, w.length);
  if (/^\p{Lu}/u.test(w)) out = out[0].toUpperCase() + out.slice(1);
  if (w.length > 1 && w === w.toUpperCase() && /\p{L}/u.test(w)) out = out.toUpperCase();
  return out;
};

/** Variable names the builder itself gives (store/dndNodes.ts, utils/richNodes.ts): not customer text. */
const GENERIC_VARS = new Set([
  'name', 'email', 'phone', 'mobile', 'phone_number', 'number', 'url', 'location', 'answer', 'file', 'calendar_answer',
  'selected_options', 'selected_option', 'selected_choice', 'selected_image', 'rating_choice', 'yes_no_answer', 'opinion_scale',
  'carousel_choice', 'math_operations', 'navigate_choice', 'webhookresponse', 'sheets_data', 'calendar_data', 'meet_data',
  'docs_data', 'drive_data', 'slack_data', 'discord_data', 'notion_data', 'airtable_data', 'zohocrm_result', 'hubspot_data',
  'mailchimp_member_id', 'salesforce_record_id', 'stripe_result', 'dynamic_choice', 'consent', 'product_action', 'slider_value',
  'picked_date', 'ranking', 'verified_email', 'address', 'matrix', 'extracted', 'intent', 'kb_answer', 'signature', 'payment',
  'page_url', 'referrer', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'loop', 'string', 'quiz',
]);
const anonVar = (v) => {
  const s = String(v);
  if (!s.trim() || GENERIC_VARS.has(s.trim())) return v;
  return `var_${hash(s.trim(), 6)}`;
};

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s"'<>)\]]+/gi;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const anonUrl = (u) => {
  const ext = (String(u).split(/[?#]/)[0].match(/\.([a-z0-9]{2,5})$/i) || [])[1];
  return `https://cdn.example.com/media/${hash(u)}${ext ? `.${ext.toLowerCase()}` : ''}`;
};

/** Text with its words replaced; markup, placeholders, numbers and punctuation kept. */
const TOKEN = /(<[^>]*>)|(&#?\w+;)|((?:\$\$|\$)?\{\{?\s*(?:ANSWERS\.)?[\w.]+\s*\}?\})|((?:https?:\/\/|www\.)[^\s"'<>)\]]+)|([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})|(\p{L}[\p{L}\p{M}']*)/gu;
const anonText = (s) =>
  String(s).replace(TOKEN, (m, tag, ent, ph, url, mail, word) => {
    if (tag) return tag.replace(/(href|src)\s*=\s*"([^"]*)"/gi, (x, a, v) => `${a}="${/^https?:/i.test(v) ? anonUrl(v) : v}"`);
    if (ent) return ent;
    if (ph) return ph.replace(/([\w.]+)(\s*\}?\})$/, (x, key, close) => `${key.startsWith('ANSWERS.') ? `ANSWERS.${anonVar(key.slice(8))}` : anonVar(key)}${close}`);
    if (url) return anonUrl(url);
    if (mail) return 'visitor@example.com';
    return fillerWord(word);
  });

// Keys whose string values are structure, not content: kept as they are.
const KEEP = new Set([
  'id', '_id', 'type', 'action', 'operator', 'mode', 'source', 'channel', 'emailSource', 'currency', 'unitPosition', 'ratingType',
  'timeZone', 'timezone', 'dayName', 'start', 'end', 'operation', 'assignmentType', 'agentAssignmentStrategy', 'assignmentMethod',
  'correctAnswer', 'method', 'sourceHandle', 'targetHandle', 'condition', 'priority', 'format', 'minVal', 'maxVal', 'from', 'to',
  'minDate', 'maxDate', 'minTime', 'maxTime', 'locale', 'penColor', 'writeMode', 'role', 'accessType', 'entryPointAccess', 'status',
  'selectedModel', 'countryCodes', 'amountMode', 'listPath', 'labelField', 'valueField', 'subflowId', 'nodeId', 'targetNodeId', 'jumpTo',
  'checkedSoundTab', 'selectedSound', 'dataType', 'inputType',
]);
const VARS = new Set(['answerVariable', 'sourceVariable', 'emailVariable', 'amountVariable', 'variable', 'listVariable', 'pageUrlVariable', 'referrerVariable', 'responseVariable', 'varName']);
const IDENT = /^[A-Za-z_][\w.]*$/;
const SECRET = /(api_?key|password|secret|token|credential|authorization|cookie|webhookurl|privatekey)/i;

/** A node's data, customer content replaced (same keys, types and structure). */
const anonValue = (v, key = '', parent = null) => {
  if (Array.isArray(v)) return v.map((x) => anonValue(x, key, parent));
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = anonValue(x, k, v);
    return o;
  }
  if (typeof v !== 'string' || v === '') return v;
  if (SECRET.test(key)) return '<redacted>';
  if (KEEP.has(key)) return v;
  if (VARS.has(key)) return anonVar(v);
  // variable-node name, math / condition operands: a variable name is a variable name
  if ((key === 'name' && parent && 'value' in parent && 'isNumber' in parent) || ((key === 'leftValue' || key === 'rightValue') && IDENT.test(v.trim())))
    return anonVar(v);
  if (/^-?\d+([.,]\d+)?$/.test(v.trim())) return v;
  if (/^\s*(https?:\/\/|www\.)\S+\s*$/i.test(v)) return anonUrl(v.trim());
  return anonText(v);
};

/** A whole node from someone else's bot: data rewritten, id made generic. */
const anonNode = (node, newId) => ({ ...node, id: newId ?? `${node.type}-${hash(node.id, 6)}`, data: anonValue(node.data || {}) });

/** S3 object URLs of the test buckets (customer folder ids in the path) -> example URLs. Used on every case. */
const S3_RE = /https?:\/\/[a-z0-9.-]*\.s3[.-][a-z0-9.-]*amazonaws\.com\/[^\s"'<>)]+/gi;
const BUILDER_DEFAULTS = /^https:\/\/botdefaults\.s3\.ap-south-1\.amazonaws\.com\/[\w.-]+$/i; // Conferbot's own default assets
const scrubUrls = (v) => {
  if (Array.isArray(v)) return v.map(scrubUrls);
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = scrubUrls(x);
    return o;
  }
  return typeof v === 'string' ? v.replace(S3_RE, (u) => (BUILDER_DEFAULTS.test(u) ? u : anonUrl(u))) : v;
};

module.exports = { OWN_BOTS, anonValue, anonNode, anonText, anonUrl, anonVar, scrubUrls, hash };
