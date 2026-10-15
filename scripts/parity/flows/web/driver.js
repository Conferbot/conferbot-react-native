// Runs one fixture through the widget's code and returns what happened.
// A visitor action is played the way a visitor does it: a click on the
// button the widget drew, text sent from the composer, a file picked.
const env = require('./env');
const socket = require('./fakeSocket');
const R = require('./runtime');

const S = R.S;
let fixture = null;

// ----- fetch, scripted by fixture.server.http: { "<path after /bot/:id/>": { status, body } | [ ...one per call ] } -----
const calls = {};
global.fetch = env.win.fetch = async (url, opts = {}) => {
  const u = String(url);
  const m = u.match(/\/api\/v1\/bot\/[^/]+\/(.+?)(\?|$)/);
  const key = m ? m[1] : u;
  calls[key] = (calls[key] || 0) + 1;
  let body = null;
  try {
    body = opts.body && typeof opts.body === 'string' ? JSON.parse(opts.body) : null;
  } catch (e) {
    body = null;
  }
  R.trace({ kind: 'http', path: key, body: key === 'media' ? undefined : body });
  const http = (fixture.server && fixture.server.http) || {};
  let r = http[key];
  if (Array.isArray(r)) r = r[Math.min(calls[key] - 1, r.length - 1)];
  if (r === undefined && key === 'media') r = { status: 200, body: { url: 'https://api.test/media/qa-file' } };
  if (r === undefined || r === 'network') throw new TypeError('Failed to fetch');
  const status = r.status ?? 200;
  return { ok: status >= 200 && status < 300, status, json: async () => r.body ?? null };
};

// ----- "shown": the moment a step's content is drawn (after the typing dots) -----
const sound = env.widgetRequire('ts/chat/messageSound.ts');
const realPlay = sound.playMessageFor;
sound.playMessageFor = (...a) => {
  const steps = S.shadowDOM && S.shadowDOM.querySelector('#steps');
  R.trace({ kind: 'shown', node: S.steps[S.currentIndex]?.id, from: steps ? steps.children.length : 0 });
  return realPlay(...a);
};
/** What a step drew: the bot side of #steps from its "shown" mark to the next one (visitor bubbles left out). */
const drawnText = (from, to) => {
  const steps = S.shadowDOM.querySelector('#steps');
  const kids = Array.from(steps.children).slice(from, to);
  return kids
    .map((k) => {
      const c = k.cloneNode(true);
      c.querySelectorAll('.user, #typing, [aria-hidden="true"], svg, style, script, .cb-sr-only').forEach((x) => x.remove());
      if (k.style && k.style.textAlign === 'right') return '';
      const parts = [];
      const walk = env.win.document.createTreeWalker(c, 4 /* text */);
      while (walk.nextNode()) if (walk.currentNode.nodeValue.trim()) parts.push(walk.currentNode.nodeValue.trim());
      return parts.join(' ');
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// "#id" by id (ids from node ids may start with a digit: not valid CSS).
const $ = (sel) => (/^#[^\s.[>:]+$/.test(sel) ? S.shadowDOM.getElementById(sel.slice(1)) : S.shadowDOM.querySelector(sel));
const $$ = (sel) => Array.from(S.shadowDOM.querySelectorAll(sel));
const ci = () => S.currentIndex;
const step = () => S.steps[S.currentIndex];
const click = (el) => {
  if (!el) throw new Error('no such control');
  el.dispatchEvent(new env.win.MouseEvent('click', { bubbles: true }));
};
const setValue = (el, v) => {
  if (!el) throw new Error('no such field');
  el.value = String(v);
  el.dispatchEvent(new env.win.Event('input', { bubbles: true }));
  el.dispatchEvent(new env.win.Event('change', { bubbles: true }));
};
const notBlank = (v) => String(v ?? '').trim() !== '';

/** The composer's send (index.ts:2440-2535): trimmed, empty ignored, routed by the step. */
const sendText = (value) => {
  const H = R.mods().handlers;
  const text = String(value).trim();
  if (text === '') return;
  const input = $('#inputField');
  input.value = text;
  const t = step().type;
  const d = step().data || {};
  if (t === 'user-input-node') H._handleUserInputSubmit(S.shadowDOM, S.embedType, S.customizationsRef, text);
  else if (t === 'user-range-node') H._handleUserRangeSubmit(S.shadowDOM, S.embedType, S.customizationsRef);
  else if (t === 'ask-multiple-questions-node') H._handleAskMultipleQuestionsSubmit(S.shadowDOM, S.embedType, S.customizationsRef, text);
  else if (t === 'human-handover-node' && d.enablePreChatQuestions && S.isPreChatQuestionSubmit) H._handlePreChatQuestionsSubmit(S.shadowDOM, S.embedType, S.customizationsRef, text);
  else if (t === 'human-handover-node' && d.enablePostChatSurveyQuestions && S.isPostChatSurveyQuestionSubmit) H._handlePostChatSurveyQuestionsSubmit(S.shadowDOM, S.embedType, S.customizationsRef, text);
  else if (t === 'human-handover-node' && !S.isPreChatQuestionSubmit && !S.isPostChatSurveyQuestionSubmit) H._handleHumanHandoverInputSubmit(S.shadowDOM, S.embedType, S.customizationsRef, text);
  else H._handleAskQuestionInputSubmit(S.shadowDOM, S.embedType, S.customizationsRef, text);
};

/** A picked file (index.ts:2914): legacy input, ask-file, else handover. */
const pickFile = (f) => {
  const H = R.mods().handlers;
  const file = new env.win.File(['x'], f.name || 'file.pdf', { type: f.type || '' });
  Object.defineProperty(file, 'size', { value: f.size ?? 1000 });
  const t = step().type;
  if (t === 'user-input-node') H._handleFileUpload(S.shadowDOM, S.embedType, S.customizationsRef, file);
  else if (t === 'ask-file-node') H._handleAskFileUpload(S.shadowDOM, S.embedType, S.customizationsRef, file);
  else H._handleHumanHandoverFileUpload(S.shadowDOM, S.embedType, S.customizationsRef, file);
};

/** Index of an item by id among the ones the widget shows (blank ones dropped). */
const shownIndex = (list, id, textKey) => {
  const shown = (Array.isArray(list) ? list : []).filter((x) => notBlank(x?.[textKey]));
  const i = shown.findIndex((x) => String(x.id) === String(id));
  if (i < 0) throw new Error(`no shown item with id ${id}`);
  return i;
};

const ACTIONS = {
  text: (a) => sendText(a.value),
  file: (a) => pickFile(a),
  skip: () => click($('[data-action="skip"]')),
  choose: (a) => {
    const n = step();
    const d = n.data || {};
    switch (n.type) {
      case 'two-choices-node':
        return click($(`#2choiceText${a.index + 1}_${ci()}`));
      case 'three-choices-node':
        return click($(`#3choiceText${a.index + 1}_${ci()}`));
      case 'select-option-node':
        return click($(`#selectOption${a.index + 1}_${ci()}`));
      case 'quiz-node':
        return click($(`#quizOption${a.index + 1}_${ci()}`));
      case 'user-rating-node':
        return click($(`#selectRating_${ci()}_${a.value}`));
      case 'n-select-option-node':
        return click($(`#nOptionText_${shownIndex(d.options, a.id, 'optionText')}_${ci()}`));
      case 'n-choices-node':
        return click($(`#nChoiceText_${shownIndex(d.choices, a.id, 'choiceText')}_${ci()}`));
      case 'image-choice-node':
        return click($$(`.cb-imgchoice__pick[data-image-id="${a.id}"]`).pop());
      case 'yes-or-no-choice-node':
        return click($(`#yesNoOption_${d.options.findIndex((o) => String(o.id) === String(a.id))}_${ci()}`));
      case 'rating-choice-node':
        return click($$('.cb-rate').filter((b) => b.id.endsWith(`_${ci()}`)).find((b) => b.dataset.value === String(a.value)));
      case 'opinion-scale-choice-node': {
        const { from } = R.mods().display && env.widgetRequire('ts/chat/nodeKit.ts').scaleRange(d.from, d.to);
        return click($(`#opinionScaleChoice_${a.value - from}_${ci()}`));
      }
      case 'carousel-node':
      case 'product-card-node': {
        const sel = a.buttonId ? `.cb-carousel__btn--path[data-button-id="${a.buttonId}"]` : '.cb-carousel__continue';
        return click($$(sel).pop());
      }
      case 'dynamic-choices-node':
        return click($(`#dynChoice_${a.index}_${ci()}`));
      default:
        throw new Error(`choose: not a choice step (${n.type})`);
    }
  },
  check: (a) => {
    const d = step().data || {};
    for (const id of a.ids) {
      const i = shownIndex(d.options, id, 'optionText');
      click($(`#nCheckOptionText_${i}_${ci()}`).closest(`.${S.embedType}__chat__check_option__bubble`));
    }
    click($(`#nCheckOptionsDone_${ci()}`));
  },
  navigateLink: (a) => click($(`#navigateOption_${a.index}_${ci()}`)),
  navigateDone: () => click($(`#doneNavigatingText_${ci()}`)),
  date: (a) => {
    // legacy user-input type=date: the browser's date box
    setValue($(`#date__input_${ci()}`), a.value);
  },
  calendar: (a) => {
    click($$(`.${S.embedType}__calendar-day[data-date="${a.date}"]`).pop());
    if (a.slot) click($$(`.${S.embedType}__time-slot`).filter((el) => el.dataset.start === a.slot).pop());
  },
  consent: (a) => {
    const box = $(`#consentBox_${ci()}`);
    if (a.agreed) {
      box.checked = true;
      box.dispatchEvent(new env.win.Event('change', { bubbles: true }));
    }
    click($(`#consentGo_${ci()}`));
  },
  slider: (a) => {
    setValue($(`#slider_${ci()}`), a.value);
    click($(`#sliderGo_${ci()}`));
  },
  datetime: (a) => {
    setValue($(`#dt_${ci()}`), a.value);
    click($(`#dtGo_${ci()}`));
  },
  rankingMove: (a) => {
    // the move buttons on an item ("data-dir" -1 up / 1 down)
    const li = Array.from($(`#rkList_${ci()}`).querySelectorAll('.cb-ranking__item')).find((el) => el.dataset.id === String(a.id));
    click(li.querySelector(`.cb-ranking__move[data-dir="${a.dir}"]`));
  },
  rankingSubmit: () => click($(`#rkGo_${ci()}`)),
  matrixSubmit: () => click($(`#mxGo_${ci()}`)),
  matrix: (a) => {
    for (const [row, cols] of Object.entries(a.cells || {}))
      for (const col of [].concat(cols)) {
        const el = Array.from($(`#mxCard_${ci()}`).querySelectorAll('.cb-matrix__input')).find((x) => x.dataset.row === row && x.dataset.col === col);
        if (!el) throw new Error(`no matrix cell ${row}/${col}`);
        el.checked = true;
        el.dispatchEvent(new env.win.Event('change', { bubbles: true }));
      }
    if (a.submit !== false) click($(`#mxGo_${ci()}`));
  },
  otpEmail: (a) => {
    setValue($(`#otpEmail_${ci()}`), a.email);
    click($(`#otpSend_${ci()}`));
  },
  otpCode: (a) => {
    // typed into the first box like a paste: six digits verify by themselves
    const box = $(`#otpD_${ci()}_0`);
    box.value = String(a.code);
    box.dispatchEvent(new env.win.Event('input', { bubbles: true }));
  },
  addressManual: (a) => {
    click($(`#adManual_${ci()}`));
    for (const f of ['line1', 'city', 'region', 'postal', 'country']) if (a[f] !== undefined) setValue($(`#adM_${f}_${ci()}`), a[f]);
    click($(`#adManualGo_${ci()}`));
  },
  addressSearch: (a) => setValue($(`#adInput_${ci()}`), a.q),
  addressPick: (a) => {
    click($(`#adOpt_${ci()}_${a.index}`));
    if (a.confirm !== false) click($(`#adConfirm_${ci()}`));
  },
  signTyped: (a) => {
    const mode = $(`#sigMode_${ci()}`);
    if (mode && mode.getAttribute('aria-expanded') !== 'true') click(mode);
    if (a.fullName !== undefined) setValue($(`#sigName_${ci()}`), a.fullName);
    setValue($(`#sigTyped_${ci()}`), a.name);
    click($(`#sigGo_${ci()}`));
  },
  signEmpty: () => click($(`#sigGo_${ci()}`)),
  otpSkip: () => click($(`#otpCard_${ci()}`).querySelector('.cb-otp__skip')),
  payCancel: () => click($(`#payCancel_${ci()}`)),
  payOpen: () => {
    // "Pay now": opens Stripe Checkout in a new tab and starts waiting for the result
    const go = $(`#payGo_${ci()}`);
    go.addEventListener('click', (e) => e.preventDefault(), { once: true });
    click(go);
  },
  serverEvent: (a) => socket.fire(a.event, a.payload),
  wait: () => {},
};

const plain = (html) => env.widgetRequire('ts/chat/richNodes.ts').plainText(html);
// Times, and copies of the step's own data the widget puts on an answer.
const STRIP = new Set(['time', 'at', 'agreedAt', 'options', 'choices', 'images', 'carousel']);
const clean = (o) => {
  if (Array.isArray(o)) return o.map(clean);
  if (!o || typeof o !== 'object') return o;
  const out = {};
  for (const [k, v] of Object.entries(o)) if (!STRIP.has(k) && v !== undefined) out[k] = clean(v);
  return out;
};

/** Messages a rich card shows inside itself (date out of range, consent not ticked...), as errors. */
const CARD_ERRORS = '.cb-rich-error, .cb-consent__hint, .cb-upload-card__rules[role="alert"]';
let seenCardErrors = new Set();
const cardErrors = (node) => {
  for (const el of $$(CARD_ERRORS)) {
    const text = (el.textContent || '').trim();
    const key = `${node}\u0000${text}`;
    if (text && !seenCardErrors.has(key)) {
      seenCardErrors.add(key);
      R.trace({ kind: 'error', node, message: text, card: true });
    }
  }
};

const run = async (fx) => {
  seenCardErrors = new Set();
  fixture = fx;
  for (const k of Object.keys(calls)) delete calls[k];
  env.clock.now = 0;
  env.clock.timers.clear();
  env.errors.length = 0;
  env.warnings.length = 0;
  socket.reset(fx.server || {});
  R.reset(fx);
  R.mods();
  const problems = [];
  try {
    R._findAndDisplayNode();
  } catch (e) {
    problems.push(`start: ${e.message}`);
  }
  await env.settle();
  for (const [i, a] of (fx.inputs || []).entries()) {
    const at = step()?.id;
    if (a.at && a.at !== at) problems.push(`input ${i}: waiting at ${at}, fixture expected ${a.at}`);
    try {
      R.trace({ kind: 'input', node: at, action: a.do });
      ACTIONS[a.do](a);
    } catch (e) {
      problems.push(`input ${i} (${a.do}): ${e.message}`);
    }
    await env.settle(a.waitMs);
    if (a.waitMs !== undefined) await env.settle();
    cardErrors(at);
  }
  const tr = S.trace;
  const entered = tr.filter((e) => e.kind === 'enter');
  const shownAt = {};
  tr.filter((e) => e.kind === 'shown').forEach((e) => shownAt[e.node] === undefined && (shownAt[e.node] = e.t));
  const last = step();
  const marks = tr.filter((e) => e.kind === 'shown');
  const drawn = marks.map((m, i) => ({ node: m.node, text: drawnText(m.from, i + 1 < marks.length ? marks[i + 1].from : undefined) }));
  const nodeRecords = S.record.filter((r) => r && r.type && !r.shape && r.source === undefined && r.renderedText !== undefined);
  const outcome = {
    path: entered.map((e) => ({ node: e.node, type: e.type, via: e.via, t: e.t })),
    shown: Object.entries(shownAt).map(([node, t]) => ({ node, t })),
    // The step's bubble(s) and controls as text (prompt, option labels, card text).
    drawn,
    // renderedText: the step's own text with the variables filled in, as the
    // visitor saw it (index.ts:4138). `plain` is the same without markup.
    rendered: nodeRecords.map((r) => ({ node: r.id, html: r.renderedText, plain: plain(r.renderedText) })),
    ports: tr.filter((e) => e.kind === 'port').map((e) => ({ node: e.node, handle: e.handle, wired: e.wired })),
    transcript: S.transcript.map((x) => ({ by: x.by, message: typeof x.message === 'string' ? x.message : x.message === undefined ? null : x.message })),
    // The visitor's side of the record: entries whose shape (or, with no
    // shape, type) starts with "user" - not the step records (user-input-node...).
    answers: S.record.filter((r) => r && (r.shape ? String(r.shape).startsWith('user') : String(r.type || '').startsWith('user') && !r.data && !r.position)).map((r) => clean(r)),
    variables: S.answerVariables.map((v) => ({ key: v.key, value: v.value, nodeId: v.nodeId })),
    // index.ts `variables`: a separate map only the legacy quiz score and variable-node write.
    ...(Object.keys(S.variables).length ? { flowVariables: S.variables } : {}),
    errors: tr.filter((e) => e.kind === 'error').map((e) => ({ node: e.node, message: e.message })),
    http: tr.filter((e) => e.kind === 'http').map((e) => ({ path: e.path, ...(e.body ? { body: e.body } : {}) })),
    emits: socket.emits.filter((e) => e.event !== 'response-record').map((e) => e.event),
    unsupported: tr.filter((e) => e.kind === 'unsupported').map((e) => ({ node: e.node, type: e.type })),
    end: S.ended ? { ended: true, t: (tr.find((e) => e.kind === 'end') || {}).t } : { ended: false, waitingAt: last?.id ?? null, type: last?.type ?? null },
  };
  const crash = tr.find((e) => e.kind === 'crash');
  if (crash) outcome.end = { ended: false, crashed: true, at: crash.node, reason: crash.reason };
  if (env.errors.length) problems.push(...env.errors.map((e) => `uncaught: ${e}`));
  return { outcome, problems, missingExports: [...R.missing] };
};

module.exports = { run };
