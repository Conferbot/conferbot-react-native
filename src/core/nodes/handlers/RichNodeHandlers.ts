/**
 * RichNodeHandlers.ts
 *
 * The rich steps (conferbot-widget/src/ts/chat/richNodes.ts and
 * richNodesView.ts), run headless: dynamic-choices, hidden-fields, consent,
 * product-card, slider, datetime, ranking, otp, address, matrix,
 * ai-extract, ai-route, kb-answer, signature and payment. The rules are the
 * web's, ported in core/flow/rich.ts; each step draws through the SDK's
 * existing UI states (buttons, carousel, slider, calendar, text input,
 * form) and takes the answer those send, or the explicit actions listed
 * on each handler.
 *
 * Gates stay gates: payment leaves by "source" only when the server says
 * paid, OTP only when otp/verify says verified (the web's documented
 * fallback aside), required consent only once agreed.
 */

import { BaseNodeHandler, NodeResult, NodeUIState, NodeHandler } from '../NodeHandler';
import { ChatState } from '../../state/ChatState';
import { NodeHandlerRegistry } from '../NodeHandlerRegistry';
import { ctxOf, FlowContext } from '../../flow/context';
import { t } from '../../flow/i18nEn';
import {
  AI_CLIENT_TIMEOUT_MS,
  AI_MAX_INPUT,
  AI_MIN_THINK_MS,
  AddressValue,
  DYNAMIC_EMPTY_HANDLE,
  KB_CLIENT_TIMEOUT_MS,
  MatrixSelection,
  OTP_LENGTH,
  PAYMENT_PEEK_MS,
  PaymentOutcome,
  addressErrorText,
  addressVariables,
  aiExtractResultOf,
  aiExtractVariables,
  aiPresetText,
  aiRouteResultOf,
  aiRouteVariables,
  aiSourceOf,
  captureHiddenFields,
  cleanSignatureName,
  consentContinueLabel,
  consentDocuments,
  consentReply,
  consentRequired,
  dateMode,
  dateTimeDisplay,
  dateTimeError,
  dynamicOptions,
  dynamicSourceVariable,
  isCheckoutUrl,
  isEmailAddress,
  isReceiptUrl,
  isSignatureName,
  kbNotFoundHtml,
  kbResultOf,
  kbVariables,
  isoFromInput,
  lastUserMessage,
  manualAddress,
  markdownLitePlain,
  matrixColumns,
  matrixDisplay,
  matrixError,
  matrixMode,
  matrixRequireAll,
  matrixRowAnswers,
  matrixRows,
  matrixToggle,
  matrixValue,
  normalizeAddress,
  otpChannel,
  otpEndsStep,
  otpErrorText,
  otpPresetEmail,
  otpReplyText,
  paymentAmountText,
  paymentErrorText,
  paymentHandleOf,
  paymentOutcomeOf,
  paymentReplyText,
  paymentTimeoutMs,
  paymentVariables,
  plainText,
  productCarouselData,
  rankingItems,
  rankingText,
  signatureConfig,
  signatureVariables,
  sliderConfig,
  sliderLabel,
  snapToStep,
  submitLabel,
} from '../../flow/rich';
import { carouselCards, CAROUSEL_CONTINUE } from './ChoiceNodeHandlers';
import { botSay, pickedId, pushAnswer, shownLabel, shownText, typedText, userSay } from './flowKit';

/** A server call as the rich steps read it (web richApi.ts richPost). */
interface RichReply {
  ok: boolean;
  status: number;
  data: any;
  code?: string;
}

const richPost = async (ctx: FlowContext, path: string, body: Record<string, any>, timeoutMs = 15000): Promise<RichReply> => {
  const r = await ctx.api(path, body, { timeoutMs });
  if (r.error) return { ok: false, status: 0, data: null, code: r.error };
  return {
    ok: r.ok,
    status: r.status,
    data: r.body,
    code: r.ok ? undefined : String(r.body?.code || (r.status === 429 ? 'rate_limited' : 'error')),
  };
};

/** Who a code / payment belongs to: the chat session (web richSessionId). */
const sessionOf = (state: ChatState): string => String(state.sessionId || state.getVariable('_visitorId') || 'anonymous').slice(0, 100);

/** A variable read the way the rich steps read it: the answers, by name. */
const lookup = (state: ChatState) => (key: string) => (state.hasAnswerVariable(key) ? state.getAnswer(key) : null);

/** Fills the step's own variable (registered when shown) and the rest by name. */
const saveVars = (state: ChatState, node: Record<string, any>, vars: Record<string, any>) => {
  const key = String(node.data?.answerVariable ?? '').trim();
  Object.entries(vars).forEach(([k, v]) => (k === key ? state.setAnswerVariable(node.id, v) : state.saveVariableByName(k, v)));
};

/** The visitor's answer (web richNodesView answer()): record, transcript, the step's variable. */
const answer = (state: ChatState, node: Record<string, any>, entry: Record<string, any>, text: string, value: any) => {
  pushAnswer(state, { id: node.id, ...entry });
  userSay(state, text, node.id);
  if (node.data?.answerVariable) state.setAnswerVariable(node.id, value);
};

abstract class RichHandler extends BaseNodeHandler {
  protected prompt(node: Record<string, any>, state: ChatState, fallback = ''): string {
    const q = node.data?.questionText;
    return shownText(state, plainText(q) ? q : fallback);
  }
}

// ========================================
// DYNAMIC CHOICES
// ========================================

/**
 * dynamic-choices-node: options from the list in data.sourceVariable
 * (labelField / valueField); saves the item's value and <var>_label when it
 * differs. Nothing to choose: emptyMessage and source-empty (or "source"
 * when only that is wired). "webhook" waits up to 8 s for the list.
 */
export class DynamicChoicesHandler extends RichHandler {
  readonly nodeType = 'dynamic-choices-node';

  private async sourceValue(node: Record<string, any>, state: ChatState, ctx: FlowContext): Promise<any> {
    const key = dynamicSourceVariable(node.data);
    const read = () => (key ? lookup(state)(key) : undefined);
    let v = read();
    if ((v !== null && v !== undefined) || node.data?.source !== 'webhook') return v;
    const started = Date.now();
    while (Date.now() - started <= 8000) {
      await ctx.delay(250);
      v = read();
      if (v !== null && v !== undefined) return v;
    }
    return v;
  }

  private ui(node: Record<string, any>, state: ChatState, options: any[]): NodeUIState.Buttons {
    return NodeUIState.buttons(
      node.id,
      this.prompt(node, state),
      options.map((o) => ({ id: o.id, label: o.label, value: o.value }))
    );
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const ctx = ctxOf(node, state);
    const options = dynamicOptions(node.data, await this.sourceValue(node, state, ctx));
    state.addRecord({ _id: node.id, id: node.id, type: node.type, options: options.map((o) => ({ label: o.label, value: o.value })) } as any);
    if (!options.length) {
      const empty = node.data?.emptyMessage || `<p>${t('rich.nothingToChoose')}</p>`;
      botSay(state, shownText(state, empty), node.id, this.nodeType);
      return NodeResult.port(DYNAMIC_EMPTY_HANDLE, 'source');
    }
    const ui = this.ui(node, state, options);
    botSay(state, ui.question, node.id, this.nodeType);
    state.setVariable(`_dyn_${node.id}`, options);
    return NodeResult.displayUI(ui);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const options: any[] = state.getVariable(`_dyn_${node.id}`) || [];
    const id = pickedId(response);
    const o = options.find((x) => x.id === id) ?? (Number.isInteger(response?.index) ? options[response.index] : undefined);
    if (!o) return NodeResult.displayUI(this.ui(node, state, options));
    answer(state, node, { shape: 'user-selected-dynamic-choice', selectedChoice: o.label, value: o.value }, o.label, o.value);
    const key = node.data?.answerVariable;
    if (key && String(o.value) !== o.label) state.saveVariableByName(`${key}_label`, o.label);
    state.deleteVariable(`_dyn_${node.id}`);
    return NodeResult.port('source');
  }
}

// ========================================
// HIDDEN FIELDS
// ========================================

/**
 * hidden-fields-node: shows nothing; saves the page's query parameters, its
 * URL and the referrer by name. An app has no page: the host app supplies
 * one (NodeFlowEngine config.page, e.g. a deep link) or nothing is captured.
 */
export class HiddenFieldsHandler extends RichHandler {
  readonly nodeType = 'hidden-fields-node';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const page = ctxOf(node, state).page || {};
    let captured: Record<string, string> = {};
    try {
      captured = captureHiddenFields(node.data, { href: page.url, referrer: page.referrer, landingSearch: '' });
    } catch {
      captured = {};
    }
    Object.entries(captured).forEach(([k, v]) => state.saveVariableByName(k, v));
    state.addRecord({ _id: node.id, id: node.id, type: node.type, captured } as any);
    return NodeResult.port('source');
  }
}

// ========================================
// CONSENT
// ========================================

/**
 * consent-node: the consent text and Continue. Answers: {agreed: boolean}
 * (the box ticked or not, then Continue), or the buttons "agree" /
 * "continue". Required and not agreed: "Please tick the box to continue."
 * and it waits. Saves true / false and <var>_at; always leaves by "source".
 */
export class ConsentHandler extends RichHandler {
  readonly nodeType = 'consent-node';

  private ui(node: Record<string, any>, state: ChatState): NodeUIState.Buttons {
    const data = node.data || {};
    const text = markdownLitePlain(data.consentText);
    const buttons: NodeUIState.Buttons['buttons'] = [{ id: 'agree', label: text ? `✓ ${text}` : 'I agree', value: true, style: 'primary' }];
    buttons.push({ id: 'continue', label: consentContinueLabel(data), value: false, style: 'outline' });
    return { ...NodeUIState.buttons(node.id, this.prompt(node, state), buttons), awaitInput: true, ...({ required: consentRequired(data), consentText: text } as any) };
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const ui = this.ui(node, state);
    if (ui.question) botSay(state, ui.question, node.id, this.nodeType);
    return NodeResult.displayUI(ui);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = node.data || {};
    const agreed = typeof response?.agreed === 'boolean' ? response.agreed : pickedId(response) === 'agree';
    const required = consentRequired(data);
    if (required && !agreed) return NodeResult.invalid(t('consent.tickBox'), this.ui(node, state), true);
    const at = new Date().toISOString();
    const reply = consentReply(data.consentText, agreed);
    answer(
      state,
      node,
      {
        shape: 'user-consent',
        agreed,
        agreedAt: agreed ? at : null,
        consentText: markdownLitePlain(data.consentText),
        documents: consentDocuments(data.consentText),
        required,
        selectedChoice: reply,
      },
      reply,
      agreed
    );
    const k = data.answerVariable;
    if (k && agreed) state.saveVariableByName(`${k}_at`, at);
    return NodeResult.port('source');
  }
}

// ========================================
// PRODUCT CARD
// ========================================

/**
 * product-card-node: one card (image, title, price, description) with up to
 * three buttons. A path button leaves by "source-" + its id and saves its
 * label; with only link buttons, Continue leaves by "source".
 */
export class ProductCardHandler extends RichHandler {
  readonly nodeType = 'product-card-node';

  private card(node: Record<string, any>) {
    return carouselCards(productCarouselData(node.data))[0];
  }

  private ui(node: Record<string, any>, state: ChatState): NodeUIState.Carousel {
    const card = this.card(node);
    const hasPath = !!card?.buttons.some((b: any) => b.action === 'path');
    return {
      type: 'carousel',
      nodeId: node.id,
      cards: card
        ? [
            {
              id: card.id,
              title: shownLabel(state, card.title),
              description: [card.price, card.description].filter(Boolean).join(' · ') || undefined,
              imageUrl: card.image || undefined,
              buttons: card.buttons.map((b: any) => ({ id: b.id, label: b.label, value: b.label, url: b.href || undefined })),
            },
          ]
        : [],
      ...({ question: this.prompt(node, state), showContinue: !hasPath } as any),
    };
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const ui = this.ui(node, state);
    const q = (ui as any).question;
    if (q) botSay(state, q, node.id, this.nodeType);
    return NodeResult.displayUI(ui);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const card = this.card(node);
    const id = response?.action === 'continue' ? undefined : pickedId(response);
    const button = card?.buttons.find((b: any) => b.id === id && b.action === 'path');
    if (id && !button) return NodeResult.displayUI(this.ui(node, state));
    if (button) {
      answer(
        state,
        node,
        { shape: 'user-selected-product-card', selectedChoice: button.label, selectedButtonId: button.id, product: { title: card.title, price: card.price || '' } },
        button.label,
        button.label
      );
      return NodeResult.port(`source-${button.id}`);
    }
    if (card?.buttons.some((b: any) => b.action === 'path')) return NodeResult.displayUI(this.ui(node, state));
    pushAnswer(state, { id: node.id, shape: 'user-selected-product-card', selectedChoice: CAROUSEL_CONTINUE, selectedButtonId: null });
    userSay(state, CAROUSEL_CONTINUE, node.id);
    return NodeResult.port('source');
  }
}

// ========================================
// SLIDER
// ========================================

/** slider-node: min / max / step / unit; the value snapped to the step, saved as a number. Answer {value}. */
export class SliderNodeHandler extends RichHandler {
  readonly nodeType = 'slider-node';

  private ui(node: Record<string, any>, state: ChatState): NodeUIState.Slider {
    const cfg = sliderConfig(node.data);
    return {
      type: 'slider',
      nodeId: node.id,
      question: this.prompt(node, state),
      min: cfg.min,
      max: cfg.max,
      step: cfg.step,
      defaultValue: cfg.start,
      variableName: node.data?.answerVariable,
      showValue: true,
      ...({ unit: cfg.unit, unitPosition: cfg.unitPosition, submitLabel: submitLabel(node.data) } as any),
    };
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const ui = this.ui(node, state);
    botSay(state, ui.question, node.id, this.nodeType);
    return NodeResult.displayUI(ui);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const cfg = sliderConfig(node.data);
    const raw = Number(typeof response === 'object' && response !== null ? response.value : response);
    if (!Number.isFinite(raw)) return NodeResult.displayUI(this.ui(node, state));
    const value = snapToStep(raw, cfg);
    const text = sliderLabel(value, cfg);
    answer(state, node, { shape: 'user-slider', value, display: text, min: cfg.min, max: cfg.max, unit: cfg.unit }, text, value);
    return NodeResult.port('source');
  }
}

// ========================================
// DATE / TIME
// ========================================

/**
 * datetime-node: mode date / time / datetime with minDate / maxDate,
 * disabledWeekdays, minTime / maxTime. A refused pick says why on the card.
 * Saves the ISO value and <var>_display. Answer {value} ("2026-10-19",
 * "14:30", "2026-10-19T14:30") or the calendar's {date, time}.
 */
export class DateTimeNodeHandler extends RichHandler {
  readonly nodeType = 'datetime-node';

  private ui(node: Record<string, any>, state: ChatState): NodeUIState.Calendar {
    return { type: 'calendar', nodeId: node.id, question: this.prompt(node, state), variableName: node.data?.answerVariable, mode: dateMode(node.data) };
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const ui = this.ui(node, state);
    botSay(state, ui.question, node.id, this.nodeType);
    return NodeResult.displayUI(ui);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const mode = dateMode(node.data);
    let raw: any = typeof response === 'object' && response !== null ? response.value ?? response.datetime : response;
    if (raw === undefined && response?.date) raw = mode === 'datetime' ? `${response.date}T${response.time || ''}` : response.date;
    if (raw === undefined && response?.time) raw = response.time;
    const iso = isoFromInput(mode, raw);
    const problem = dateTimeError(node.data, iso);
    if (problem) return NodeResult.invalid(problem, this.ui(node, state), true);
    const display = dateTimeDisplay(node.data, iso, 'en-US');
    answer(state, node, { shape: 'user-datetime', value: iso, display, mode }, display, iso);
    const k = node.data?.answerVariable;
    if (k) state.saveVariableByName(`${k}_display`, display);
    return NodeResult.port('source');
  }
}

// ========================================
// RANKING
// ========================================

/**
 * ranking-node: the items in the visitor's order. Answer {order: [ids]}, or
 * the multi-select buttons' ids in the order tapped (unpicked items follow).
 */
export class RankingNodeHandler extends RichHandler {
  readonly nodeType = 'ranking-node';

  private ui(node: Record<string, any>, state: ChatState) {
    const items = rankingItems(node.data);
    return {
      ...NodeUIState.buttons(node.id, this.prompt(node, state), items.map((it) => ({ id: it.id, label: it.text, value: it.text }))),
      multiSelect: true,
      awaitInput: true,
      items,
    } as NodeUIState.Buttons;
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const ui = this.ui(node, state);
    botSay(state, ui.question, node.id, this.nodeType);
    return NodeResult.displayUI(ui);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const items = rankingItems(node.data);
    const ids: string[] = (Array.isArray(response?.order) ? response.order : Array.isArray(response?.buttonIds) ? response.buttonIds : []).map(String);
    const picked = ids.map((id) => items.find((it) => it.id === id)).filter(Boolean) as typeof items;
    const order = [...picked, ...items.filter((it) => !picked.includes(it))];
    const text = rankingText(order);
    const values = order.map((it) => it.text);
    answer(state, node, { shape: 'user-ranking', order, value: values, display: text }, text, values);
    return NodeResult.port('source');
  }
}

// ========================================
// OTP
// ========================================

/**
 * otp-node: an e-mail, then a six-digit code checked on the server
 * (POST otp/send, otp/verify). Answers: {action: "send", email} (or the
 * typed e-mail), {action: "verify", code} (or six typed digits),
 * {action: "skip"} (allowSkip). Verified leaves by "source"; locked,
 * skipped, sms or a failed send by "source-failed" - or "source" when only
 * that edge is drawn (the web's goPort fallback). A network error says so
 * and keeps waiting.
 */
export class OtpNodeHandler extends RichHandler {
  readonly nodeType = 'otp-node';

  private key(node: Record<string, any>) {
    return `_otp_${node.id}`;
  }

  private ui(node: Record<string, any>, state: ChatState, stage: 'email' | 'code'): NodeUIState.TextInput {
    const question = stage === 'email' ? this.prompt(node, state) || 'Email address' : `Enter the ${OTP_LENGTH}-digit code we sent you`;
    return {
      ...NodeUIState.textInput(node.id, question, node.data?.answerVariable || '', stage === 'email' ? 'email' : 'number', {
        placeholder: stage === 'email' ? 'name@example.com' : '123456',
      }),
      awaitInput: true,
      ...({ stage, allowSkip: !!node.data?.allowSkip, skipLabel: String(node.data?.skipLabel || '').trim() || 'Skip' } as any),
    };
  }

  private finish(node: Record<string, any>, state: ChatState, verified: boolean, email: string, reason?: string): NodeResult {
    const text = otpReplyText(verified, email);
    pushAnswer(state, { id: node.id, shape: 'user-otp', verified, ...(verified ? { email } : {}), channel: 'email', ...(reason ? { reason } : {}), at: new Date().toISOString() });
    userSay(state, text, node.id);
    const k = String(node.data?.answerVariable ?? '').trim();
    if (k) {
      if (verified) state.setAnswerVariable(node.id, email);
      state.saveVariableByName(`${k}_verified`, verified);
    }
    state.deleteVariable(this.key(node));
    return verified ? NodeResult.port('source') : NodeResult.port('source-failed', 'source');
  }

  private async send(node: Record<string, any>, state: ChatState, to: string): Promise<NodeResult> {
    const ctx = ctxOf(node, state);
    if (!isEmailAddress(to)) return NodeResult.invalid(otpErrorText('invalid_email'), this.ui(node, state, 'email'), true);
    const target = to.trim().toLowerCase();
    const r = await richPost(ctx, 'otp/send', { nodeId: String(node.id), sessionId: sessionOf(state), email: target });
    if (r.ok || r.code === 'resend_wait') {
      state.setVariable(this.key(node), { stage: 'code', email: target });
      botSay(state, `We sent a ${OTP_LENGTH}-digit code to ${String(r.data?.sentTo || target)}`, node.id, this.nodeType);
      if (r.code === 'resend_wait') return NodeResult.invalid(otpErrorText('resend_wait', { retryAfter: r.data?.retryAfter }), this.ui(node, state, 'code'), true);
      return NodeResult.displayUI(this.ui(node, state, 'code'));
    }
    if (otpEndsStep(r.code)) {
      return this.finish(node, state, false, '', r.code === 'locked' ? 'locked' : r.code === 'sms_unavailable' ? 'sms_unavailable' : 'send_failed');
    }
    return NodeResult.invalid(otpErrorText(r.code), this.ui(node, state, 'email'), true);
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    state.deleteVariable(this.key(node));
    if (otpChannel(node.data) === 'sms') return this.finish(node, state, false, '', 'sms_unavailable');
    const ui = this.ui(node, state, 'email');
    botSay(state, ui.question, node.id, this.nodeType);
    const preset = otpPresetEmail(node.data, lookup(state));
    if (preset) return this.send(node, state, preset);
    return NodeResult.displayUI(ui);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const st = state.getVariable(this.key(node)) || { stage: 'email' };
    const action = response?.action;
    if (action === 'skip') {
      if (!node.data?.allowSkip) return NodeResult.displayUI(this.ui(node, state, st.stage));
      return this.finish(node, state, false, '', 'skipped');
    }
    if (action === 'send' || action === 'resend' || (!action && st.stage === 'email')) {
      return this.send(node, state, action === 'resend' ? st.email || '' : String(response?.email ?? typedText(response)));
    }
    // verify
    const code = String(response?.code ?? typedText(response)).replace(/\D/g, '');
    if (code.length !== OTP_LENGTH) return NodeResult.invalid(otpErrorText('invalid_code'), this.ui(node, state, 'code'), true);
    const ctx = ctxOf(node, state);
    const r = await richPost(ctx, 'otp/verify', { nodeId: String(node.id), sessionId: sessionOf(state), code });
    const res = r.ok ? r.data : { verified: false, code: r.code };
    if (res?.verified) return this.finish(node, state, true, String(res.email || st.email || '').toLowerCase());
    if (res?.code === 'locked') return this.finish(node, state, false, '', 'locked');
    return NodeResult.invalid(otpErrorText(res?.code, { attemptsLeft: res?.attemptsLeft }), this.ui(node, state, 'code'), true);
  }
}

// ========================================
// ADDRESS
// ========================================

/**
 * address-node: search (POST geo/search, results to pick and confirm) or
 * typed by hand (street required). Answers: {action: "search", q},
 * {action: "pick", index} (confirms), {action: "manual", line1, city,
 * region, postal, country}, or the location picker's {address} (manual,
 * the address as the street line). Saves the formatted address and
 * <var>_line1 / _city / _region / _postal / _country / _country_code /
 * _lat / _lng.
 */
export class AddressNodeHandler extends RichHandler {
  readonly nodeType = 'address-node';

  private ui(node: Record<string, any>, state: ChatState, results: AddressValue[] = []): NodeUIState.LocationPicker {
    return {
      type: 'locationPicker',
      nodeId: node.id,
      question: this.prompt(node, state),
      variableName: node.data?.answerVariable,
      allowManualEntry: node.data?.allowManual !== false,
      showMap: node.data?.showMap !== false,
      awaitInput: true,
      ...({ results } as any),
    };
  }

  private finish(node: Record<string, any>, state: ChatState, value: AddressValue, source: string): NodeResult {
    pushAnswer(state, { id: node.id, shape: 'user-address', value, display: value.formatted, source, at: new Date().toISOString() });
    userSay(state, value.formatted, node.id);
    const k = String(node.data?.answerVariable ?? '').trim();
    if (k) saveVars(state, node, addressVariables(k, value));
    state.deleteVariable(`_addr_${node.id}`);
    return NodeResult.port('source');
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const ui = this.ui(node, state);
    botSay(state, ui.question, node.id, this.nodeType);
    return NodeResult.displayUI(ui);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const action = response?.action;
    if (action === 'search') {
      const q = String(response.q ?? '').trim();
      if (q.length < 3) return NodeResult.displayUI(this.ui(node, state));
      const r = await richPost(ctxOf(node, state), 'geo/search', { nodeId: String(node.id), q });
      const found = r.ok ? (Array.isArray(r.data?.results) ? r.data.results : []).map(normalizeAddress).filter((a: AddressValue) => a.formatted).slice(0, 5) : [];
      state.setVariable(`_addr_${node.id}`, found);
      if (!r.ok) return NodeResult.invalid(addressErrorText(r.code), this.ui(node, state), true);
      if (!found.length) return NodeResult.invalid(addressErrorText('no_results'), this.ui(node, state), true);
      return NodeResult.displayUI(this.ui(node, state, found));
    }
    if (action === 'pick') {
      const results: AddressValue[] = state.getVariable(`_addr_${node.id}`) || [];
      const picked = results[Number(response.index)];
      if (!picked) return NodeResult.displayUI(this.ui(node, state, results));
      return this.finish(node, state, picked, 'search');
    }
    const fields =
      action === 'manual' ? response : { line1: typeof response === 'string' ? response : response?.address ?? '' };
    const value = node.data?.allowManual === false ? null : manualAddress(fields);
    if (!value) return NodeResult.invalid('Enter the street address.', this.ui(node, state), true);
    return this.finish(node, state, value, 'manual');
  }
}

// ========================================
// MATRIX
// ========================================

/**
 * matrix-node: rows x columns, one column per row (single) or several
 * (multiple). requireAll: every row; else at least one. Saves {row: column}
 * (or {row: [columns]}). No rows, or fewer than two columns: straight on by
 * "source". Answers: {cells: {rowId: colId | [colIds]}}, or the form's
 * {formData: {rowId: colId | [colIds]}}.
 */
export class MatrixNodeHandler extends RichHandler {
  readonly nodeType = 'matrix-node';

  private ui(node: Record<string, any>, state: ChatState): NodeUIState.MultipleQuestions {
    const data = node.data || {};
    const cols = matrixColumns(data);
    const mode = matrixMode(data);
    return {
      type: 'multipleQuestions',
      nodeId: node.id,
      title: this.prompt(node, state),
      questions: matrixRows(data).map((r) => ({
        id: r.id,
        question: r.text,
        type: mode === 'multiple' ? 'multiselect' : 'select',
        variableName: r.id,
        required: matrixRequireAll(data),
        options: cols.map((c) => ({ label: c.text, value: c.id })),
      })),
      submitLabel: String(data.submitLabel || '').trim() || 'Submit',
      awaitInput: true,
      ...({ mode } as any),
    };
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = node.data || {};
    if (!matrixRows(data).length || matrixColumns(data).length < 2) return NodeResult.port('source');
    const ui = this.ui(node, state);
    botSay(state, ui.title || '', node.id, this.nodeType);
    return NodeResult.displayUI(ui);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = node.data || {};
    const rows = matrixRows(data);
    const cols = matrixColumns(data);
    const mode = matrixMode(data);
    const cells: Record<string, any> = response?.cells || response?.formData || {};
    let sel: MatrixSelection = {};
    for (const [rowId, picked] of Object.entries(cells)) {
      for (const colId of ([] as any[]).concat(picked ?? [])) sel = matrixToggle(sel, rowId, String(colId), mode, true);
    }
    const problem = matrixError(sel, rows, matrixRequireAll(data));
    if (problem) return NodeResult.invalid(problem, this.ui(node, state), true);
    const value = matrixValue(sel, rows, cols, mode);
    const display = matrixDisplay(value);
    answer(state, node, { shape: 'user-matrix', value, rows: matrixRowAnswers(sel, rows, cols, mode), mode, display, at: new Date().toISOString() }, display, value);
    return NodeResult.port('source');
  }
}

// ========================================
// AI EXTRACT / AI ROUTE / KB ANSWER
// ========================================

/** The text an AI or KB step reads without asking (source last_message / variable), else null. */
const presetText = (node: Record<string, any>, state: ChatState): string | null => {
  const data = node.data || {};
  const transcript = state.getTranscript().map((e) => ({ by: e.type, message: e.text }));
  const variable = aiSourceOf(data) === 'variable' ? lookup(state)(String(data.sourceVariable || '').trim()) : undefined;
  return aiPresetText(data, lastUserMessage(transcript), variable);
};

/** Thinking dots for at least AI_MIN_THINK_MS around the server call. */
const think = async <T>(ctx: FlowContext, nodeId: string, work: () => Promise<T>): Promise<T> => {
  const started = Date.now();
  const result = await work();
  const wait = AI_MIN_THINK_MS - (Date.now() - started);
  if (wait > 0) await ctx.typing(wait);
  void nodeId;
  return result;
};

/**
 * ai-extract-node: the visitor's reply (or the last message / a variable)
 * goes to POST ai/extract {nodeId, text}; every field is saved by name,
 * <var> = all values, <var>_missing = what is missing. ok -> "source";
 * missing or failed -> "source-missing" (or "source" when only that is
 * wired). Answer: the typed reply.
 */
export class AiExtractNodeHandler extends RichHandler {
  readonly nodeType = 'ai-extract-node';

  private ui(node: Record<string, any>, state: ChatState): NodeUIState.TextInput {
    return { ...NodeUIState.textInput(node.id, this.prompt(node, state, `<p>${'How can we help?'}</p>`), node.data?.answerVariable || '', 'text'), awaitInput: true };
  }

  private async run(node: Record<string, any>, state: ChatState, text: string, asked: boolean): Promise<NodeResult> {
    const data = node.data || {};
    const ctx = ctxOf(node, state);
    const input = String(text || '').trim().slice(0, AI_MAX_INPUT);
    const r = await think(ctx, node.id, () => richPost(ctx, 'ai/extract', { nodeId: String(node.id), text: input }, AI_CLIENT_TIMEOUT_MS));
    const ex = aiExtractResultOf(data, r.ok ? r.data : null, r.ok ? undefined : r.code);
    pushAnswer(state, { id: node.id, shape: 'user-ai-extract', asked, input, values: ex.values, missing: ex.missing, ok: ex.ok, ...(ex.error ? { error: ex.error } : {}), at: new Date().toISOString() });
    saveVars(state, node, aiExtractVariables(data, ex));
    if (asked) userSay(state, input, node.id);
    return ex.ok ? NodeResult.port('source') : NodeResult.port('source-missing', 'source');
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const preset = presetText(node, state);
    if (preset) return this.run(node, state, preset, false);
    const ui = this.ui(node, state);
    botSay(state, ui.question, node.id, this.nodeType);
    return NodeResult.displayUI(ui);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const text = typedText(response);
    if (!text) return NodeResult.displayUI(this.ui(node, state));
    return this.run(node, state, text, true);
  }
}

/**
 * ai-route-node: POST ai/route {nodeId, text} -> an intent. Leaves by
 * "source-" + the intent id when that edge is drawn; no match, a failure
 * or an intent with no edge -> "source-fallback" (no further fallback: no
 * edge there ends the chat). Saves <var> (the intent name, "" on no match)
 * and <var>_confidence.
 */
export class AiRouteNodeHandler extends RichHandler {
  readonly nodeType = 'ai-route-node';

  private ui(node: Record<string, any>, state: ChatState): NodeUIState.TextInput {
    return { ...NodeUIState.textInput(node.id, this.prompt(node, state, '<p>How can we help?</p>'), node.data?.answerVariable || '', 'text'), awaitInput: true };
  }

  private async run(node: Record<string, any>, state: ChatState, text: string, asked: boolean): Promise<NodeResult> {
    const data = node.data || {};
    const ctx = ctxOf(node, state);
    const input = String(text || '').trim().slice(0, AI_MAX_INPUT);
    const r = await think(ctx, node.id, () => richPost(ctx, 'ai/route', { nodeId: String(node.id), text: input }, AI_CLIENT_TIMEOUT_MS));
    const rt = aiRouteResultOf(r.ok ? r.data : null, r.ok ? undefined : r.code);
    pushAnswer(state, {
      id: node.id,
      shape: 'user-ai-route',
      asked,
      input,
      intentId: rt.intentId,
      intent: rt.intent,
      confidence: rt.confidence,
      fallback: rt.fallback,
      ...(rt.error ? { error: rt.error } : {}),
      at: new Date().toISOString(),
    });
    saveVars(state, node, aiRouteVariables(data, rt));
    if (asked) userSay(state, input, node.id);
    if (!rt.fallback && rt.intentId && ctx.wired(`source-${rt.intentId}`)) return NodeResult.port(`source-${rt.intentId}`);
    return NodeResult.port('source-fallback');
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const preset = presetText(node, state);
    if (preset) return this.run(node, state, preset, false);
    const ui = this.ui(node, state);
    botSay(state, ui.question, node.id, this.nodeType);
    return NodeResult.displayUI(ui);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const text = typedText(response);
    if (!text) return NodeResult.displayUI(this.ui(node, state));
    return this.run(node, state, text, true);
  }
}

/**
 * kb-answer-node: POST kb/answer {nodeId, question}; the answer is shown
 * with its sources and saved (<var>, <var>_found, <var>_sources). Found ->
 * "source"; not found or failed -> notFoundMessage and "source-notfound"
 * (or "source" when only that is wired).
 */
export class KbAnswerNodeHandler extends RichHandler {
  readonly nodeType = 'kb-answer-node';

  private ui(node: Record<string, any>, state: ChatState): NodeUIState.TextInput {
    return {
      ...NodeUIState.textInput(node.id, this.prompt(node, state, `<p>${t('kb.askPrompt')}</p>`), node.data?.answerVariable || '', 'text'),
      awaitInput: true,
    };
  }

  private async run(node: Record<string, any>, state: ChatState, text: string, asked: boolean): Promise<NodeResult> {
    const data = node.data || {};
    const ctx = ctxOf(node, state);
    const input = String(text || '').trim().slice(0, 1000);
    const res = await think(ctx, node.id, () => richPost(ctx, 'kb/answer', { nodeId: String(node.id), question: input }, KB_CLIENT_TIMEOUT_MS));
    const r = kbResultOf(data, res.ok ? res.data : null, res.ok ? undefined : res.code);
    const shown = r.found ? r.answer : plainText(kbNotFoundHtml(data));
    const sources = r.found && r.sources.length ? `\n\n${r.sources.map((s: any) => `• ${s.title}${s.url ? ` (${s.url})` : ''}`).join('\n')}` : '';
    botSay(state, `${shown}${sources}`, node.id, this.nodeType, r.found ? { sources: r.sources } : undefined);
    pushAnswer(state, {
      id: node.id,
      shape: 'kb-answer',
      asked,
      input,
      found: r.found,
      ...(r.found ? { answer: r.answer } : {}),
      sources: r.sources,
      ...(r.error ? { error: r.error } : {}),
      at: new Date().toISOString(),
    });
    if (asked) userSay(state, input, node.id);
    saveVars(state, node, kbVariables(data, r));
    return r.found ? NodeResult.port('source') : NodeResult.port('source-notfound', 'source');
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const preset = presetText(node, state);
    if (preset) return this.run(node, state, preset, false);
    const ui = this.ui(node, state);
    botSay(state, ui.question, node.id, this.nodeType);
    return NodeResult.displayUI(ui);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const text = typedText(response);
    if (!text) return NodeResult.displayUI(this.ui(node, state));
    return this.run(node, state, text, true);
  }
}

// ========================================
// SIGNATURE
// ========================================

const xmlEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A typed name drawn as a signature image (SVG), sized to the name. */
export const typedSignatureSvg = (name: string): { dataUrl: string; width: number; height: number } => {
  const clean = cleanSignatureName(name);
  const width = Math.max(96, Math.round(clean.length * 16 + 64));
  const height = 114;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><text x="50%" y="62%" text-anchor="middle" font-family="Segoe Script, Bradley Hand, Snell Roundhand, cursive" font-style="italic" font-size="40" fill="#111827">${xmlEscape(
    clean
  )}</text></svg>`;
  return { dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, width, height };
};

/**
 * signature-node: a typed name (allowTyped) or a drawing the UI exports as
 * an image, uploaded to POST media; saves the URL and <var>_at / _method /
 * _name. Answers: {action: "sign", method: "typed", name, fullName?},
 * {action: "sign", method: "drawn", dataUrl, width, height} (strokes 0:
 * nothing drawn), or a typed name.
 */
export class SignatureNodeHandler extends RichHandler {
  readonly nodeType = 'signature-node';

  private ui(node: Record<string, any>, state: ChatState): NodeUIState.TextInput {
    return {
      ...NodeUIState.textInput(node.id, this.prompt(node, state) || 'Type your full name to sign', node.data?.answerVariable || '', 'text', {
        placeholder: 'Your full name',
      }),
      awaitInput: true,
    };
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const ui = this.ui(node, state);
    botSay(state, ui.question, node.id, this.nodeType);
    return NodeResult.displayUI(ui);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const cfg = signatureConfig(node.data);
    const typed = typeof response === 'string' || (response && response.method === 'typed');
    const method: 'typed' | 'drawn' = typed ? 'typed' : 'drawn';
    const name = typed ? cleanSignatureName(typeof response === 'string' ? response : response.name) : '';
    const fullName = cleanSignatureName(response?.fullName ?? (cfg.requireName ? name : ''));
    if (cfg.requireName && !isSignatureName(fullName)) return NodeResult.invalid('Enter your full name.', this.ui(node, state), true);
    if (method === 'drawn' && !response?.dataUrl) {
      return NodeResult.invalid(
        cfg.allowTyped ? 'Draw your signature in the box - or type your name instead.' : 'Draw your signature in the box.',
        this.ui(node, state),
        true
      );
    }
    if (method === 'typed' && (!cfg.allowTyped || !isSignatureName(name))) return NodeResult.invalid('Type your full name to sign.', this.ui(node, state), true);
    const image = method === 'typed' ? typedSignatureSvg(name) : { dataUrl: response.dataUrl, width: Number(response.width) || 0, height: Number(response.height) || 0 };
    const up = await ctxOf(node, state).upload({
      dataUrl: image.dataUrl,
      name: `signature-${Date.now()}.${method === 'typed' ? 'svg' : 'png'}`,
      type: method === 'typed' ? 'image/svg+xml' : 'image/png',
    });
    if (!up.ok || !up.url) return NodeResult.invalid("We couldn't save your signature. Please try again.", this.ui(node, state), true);
    const at = new Date().toISOString();
    const shownName = fullName || name;
    pushAnswer(state, { id: node.id, shape: 'user-signature', url: up.url, at, method, ...(shownName ? { name: shownName } : {}), width: image.width, height: image.height });
    userSay(state, `Signed: ${up.url}`, node.id);
    const k = String(node.data?.answerVariable ?? '').trim();
    if (k) {
      state.setAnswerVariable(node.id, up.url);
      Object.entries(signatureVariables(k, { url: up.url, at, name: shownName, method })).forEach(([vk, vv]) => vk !== k && state.saveVariableByName(vk, vv));
    }
    return NodeResult.port('source');
  }
}

// ========================================
// PAYMENT
// ========================================

interface PaymentSession {
  paymentId: string;
  amount: number | null;
  currency: string;
  amountText: string;
  deadline: number;
  waiting: boolean;
  done: boolean;
  timers: Array<ReturnType<typeof setInterval>>;
  off: () => void;
}

/**
 * payment-node: POST pay/start makes a Stripe Checkout on the server. The
 * visitor opens it ("Pay now"); while they are away the status is peeked
 * every 5 s (POST pay/status) and the socket's "payment-status" counts too.
 * Paid -> "source"; failed or cancelled -> "source-failed" (never the paid
 * path); timed out -> "source-timeout", else "source-failed". Answers:
 * {action: "open"} (the button carries the Checkout URL to open),
 * {action: "check"}, {action: "cancel"}.
 */
export class PaymentNodeHandler extends RichHandler {
  readonly nodeType = 'payment-node';
  private sessions = new Map<string, PaymentSession>();

  private ui(node: Record<string, any>, state: ChatState, s?: PaymentSession, url?: string): NodeUIState.Buttons {
    const data = node.data || {};
    const label = plainText(data.buttonLabel) || t('pay.payNow');
    const buttons: NodeUIState.Buttons['buttons'] = [{ id: 'open', label: s?.amountText ? `${label} · ${s.amountText}` : label, value: url || '', style: 'primary' }];
    if (s?.waiting) buttons.push({ id: 'check', label: t('pay.ivePaid'), style: 'outline' });
    buttons.push({ id: 'cancel', label: t('common.cancel'), style: 'outline' });
    return { ...NodeUIState.buttons(node.id, this.prompt(node, state), buttons), awaitInput: true, ...({ checkoutUrl: url } as any) };
  }

  private stop(s: PaymentSession) {
    s.timers.forEach((x) => clearInterval(x));
    s.timers = [];
    s.off();
  }

  private finish(node: Record<string, any>, state: ChatState, s: PaymentSession, outcome: PaymentOutcome, r: any = {}): NodeResult {
    s.done = true;
    this.stop(s);
    this.sessions.delete(String(node.id));
    const status = String(r.status || (outcome === 'paid' ? 'paid' : outcome === 'timeout' ? 'timeout' : 'cancelled'));
    const receiptUrl = isReceiptUrl(r.receiptUrl) ? String(r.receiptUrl) : '';
    if (Number.isFinite(Number(r.amount)) && r.amount !== null && r.amount !== undefined) s.amount = Number(r.amount);
    if (r.currency) s.currency = String(r.currency).toLowerCase();
    const shownAmount = s.amount !== null ? paymentAmountText(s.amount, s.currency) : s.amountText;
    const text = paymentReplyText(outcome, shownAmount);
    pushAnswer(state, {
      id: node.id,
      shape: 'user-payment',
      outcome,
      status,
      amount: s.amount,
      currency: s.currency,
      amountText: shownAmount,
      ...(receiptUrl ? { receiptUrl } : {}),
      ...(s.paymentId ? { paymentId: s.paymentId } : {}),
      at: new Date().toISOString(),
    });
    userSay(state, text, node.id);
    saveVars(state, node, paymentVariables(String(node.data?.answerVariable ?? '').trim(), { status, amount: s.amount, currency: s.currency, receiptUrl, paymentId: s.paymentId }));
    if (outcome === 'timeout') return NodeResult.port('source-timeout', 'source-failed');
    return NodeResult.port(paymentHandleOf(outcome));
  }

  private ask(ctx: FlowContext, node: Record<string, any>, state: ChatState, s: PaymentSession, action: 'peek' | 'check' | 'timeout' | 'cancel') {
    return richPost(ctx, 'pay/status', { nodeId: String(node.id), sessionId: sessionOf(state), paymentId: s.paymentId, action });
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = node.data || {};
    const ctx = ctxOf(node, state);
    const prompt = this.prompt(node, state);
    if (prompt) botSay(state, prompt, node.id, this.nodeType);
    const s: PaymentSession = {
      paymentId: '',
      amount: null,
      currency: String(data.currency || 'usd').toLowerCase(),
      amountText: '',
      deadline: Date.now() + paymentTimeoutMs(data),
      waiting: false,
      done: false,
      timers: [],
      off: () => {},
    };
    const old = this.sessions.get(String(node.id));
    if (old) this.stop(old);
    this.sessions.set(String(node.id), s);
    const v = String(data.amountVariable || '').trim();
    const res = await richPost(ctx, 'pay/start', {
      nodeId: String(node.id),
      sessionId: sessionOf(state),
      step: String(ctx.stepIndex ?? ''),
      ...(data.amountMode === 'variable' && v ? { variables: { [v]: lookup(state)(v) } } : {}),
    });
    if (res.ok && res.data?.paymentId) {
      const outcome = paymentOutcomeOf(res.data.status);
      if (outcome) return this.finish(node, state, s, outcome, res.data);
      s.paymentId = String(res.data.paymentId);
      if (Number.isFinite(Number(res.data.amount))) s.amount = Number(res.data.amount);
      if (res.data.currency) s.currency = String(res.data.currency).toLowerCase();
      s.amountText = s.amount !== null ? paymentAmountText(s.amount, s.currency) : '';
      if (res.data.expiresAt && Number.isFinite(Date.parse(res.data.expiresAt))) s.deadline = Date.parse(res.data.expiresAt);
      const url = isCheckoutUrl(res.data.url) ? String(res.data.url) : '';
      state.setVariable(`_pay_${node.id}`, url);
      // The server's word, from the socket.
      s.off = ctx.on('payment-status', (r: any) => {
        if (!s.done && r && r.paymentId === s.paymentId && String(r.nodeId || node.id) === String(node.id) && paymentOutcomeOf(r.status)) {
          ctx.respond({ action: '__status', status: r });
        }
      });
      // The countdown: at the deadline, ask the server once more, then time out.
      let asked = false;
      s.timers.push(
        setInterval(() => {
          if (s.done || asked || Date.now() < s.deadline) return;
          asked = true;
          void this.ask(ctx, node, state, s, 'timeout').then((r) => {
            if (s.done) return;
            if (r.ok && paymentOutcomeOf(r.data?.status)) ctx.respond({ action: '__status', status: r.data });
            else if (r.ok)
              setTimeout(() => {
                if (s.done) return;
                void this.ask(ctx, node, state, s, 'timeout').then((r2) => {
                  if (s.done) return;
                  ctx.respond({ action: '__status', status: r2.ok && paymentOutcomeOf(r2.data?.status) ? r2.data : { status: 'timeout' } });
                });
              }, 6000);
            else ctx.respond({ action: '__status', status: { status: 'timeout' } });
          });
        }, 1000)
      );
      return NodeResult.displayUI(this.ui(node, state, s, url));
    }
    const code = res.code;
    if (code === 'not_configured' || code === 'invalid_amount' || code === 'node_not_found') {
      botSay(state, paymentErrorText(code), node.id, this.nodeType);
      await ctx.delay(1600);
      return this.finish(node, state, s, 'failed', { status: 'failed' });
    }
    return NodeResult.invalid(paymentErrorText(code), { ...this.ui(node, state, s), errorMessage: paymentErrorText(code) }, true);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const ctx = ctxOf(node, state);
    const s = this.sessions.get(String(node.id));
    if (!s || s.done) return this.handle(node, state);
    const url = state.getVariable(`_pay_${node.id}`) || '';
    const action = response?.action ?? pickedId(response);
    if (action === '__status') {
      const outcome = paymentOutcomeOf(response.status?.status) || 'timeout';
      return this.finish(node, state, s, outcome, response.status);
    }
    if (action === 'open') {
      if (!s.waiting) {
        s.waiting = true;
        s.timers.push(
          setInterval(() => {
            if (s.done) return;
            void this.ask(ctx, node, state, s, 'peek').then((r) => {
              if (!s.done && r.ok && paymentOutcomeOf(r.data?.status)) ctx.respond({ action: '__status', status: r.data });
            });
          }, PAYMENT_PEEK_MS)
        );
      }
      return NodeResult.displayUI(this.ui(node, state, s, url));
    }
    if (action === 'check') {
      const r = await this.ask(ctx, node, state, s, 'check');
      if (r.ok && paymentOutcomeOf(r.data?.status)) return this.finish(node, state, s, paymentOutcomeOf(r.data.status)!, r.data);
      return NodeResult.invalid(r.ok ? t('pay.notYet') : paymentErrorText(r.code), this.ui(node, state, s, url), true);
    }
    if (action === 'cancel') {
      const r = await this.ask(ctx, node, state, s, 'cancel');
      return this.finish(node, state, s, 'failed', { status: 'cancelled', ...(r.ok ? r.data : {}) });
    }
    return NodeResult.displayUI(this.ui(node, state, s, url));
  }
}

// ========================================
// REGISTRATION
// ========================================

export const richHandlers: NodeHandler[] = [
  new DynamicChoicesHandler(),
  new HiddenFieldsHandler(),
  new ConsentHandler(),
  new ProductCardHandler(),
  new SliderNodeHandler(),
  new DateTimeNodeHandler(),
  new RankingNodeHandler(),
  new OtpNodeHandler(),
  new AddressNodeHandler(),
  new MatrixNodeHandler(),
  new AiExtractNodeHandler(),
  new AiRouteNodeHandler(),
  new KbAnswerNodeHandler(),
  new SignatureNodeHandler(),
  new PaymentNodeHandler(),
];

export function registerRichHandlers(registry: NodeHandlerRegistry): void {
  registry.registerAll(richHandlers);
}

export default richHandlers;
