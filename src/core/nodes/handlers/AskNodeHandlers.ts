/**
 * AskNodeHandlers.ts
 *
 * The question steps answered in the composer (ask-name, ask-email,
 * ask-phone-number, ask-number, ask-url, ask-location,
 * ask-custom-question) and the file step (ask-file). Field names, checks,
 * records and saved values follow the flow-node spec and the web widget's
 * ts/chat/handlers/askQuestions.ts:
 *
 * - the prompt is data.questionText;
 * - the answer fills the variable the step registered when it was shown
 *   (data.answerVariable) - a step without one stores nothing;
 * - phone numbers are saved normalised, numbers as numbers, bare links as
 *   https;
 * - a refused answer says why and the step keeps waiting.
 */

import { BaseNodeHandler, NodeResult, NodeUIState, NodeHandler } from '../NodeHandler';
import { ChatState } from '../../state/ChatState';
import { NodeHandlerRegistry } from '../NodeHandlerRegistry';
import { DisplayNodes } from '../NodeTypes';
import { ctxOf } from '../../flow/context';
import { nameGreetingHtml, fillVariables } from '../../flow/text';
import {
  EN,
  fileTypesWords,
  fileUploadProblem,
  isOptionalUpload,
  isValidEmail,
  isValidLink,
  isValidPhone,
  linkHref,
  normalizePhone,
  numberProblem,
  ownerTextOr,
  parseNumberInput,
  phoneErrorText,
  suggestEmailFix,
  DEFAULT_MAX_FILE_MB,
} from '../../flow/inputs';
import { botSay, pushAnswer, shownText, typedText, userSay } from './flowKit';
import { t } from '../../i18n';

type InputType = NodeUIState.TextInput['inputType'];

/** A composer question: shows questionText, takes typed text. */
abstract class BaseAskHandler extends BaseNodeHandler {
  protected abstract readonly inputType: InputType;
  protected abstract readonly shape: string;
  // The composer's hints in the active language (web i18n composer.*).
  protected get placeholder(): string {
    return t('composer.answer');
  }

  protected ui(node: Record<string, any>, state: ChatState): NodeUIState.TextInput {
    return NodeUIState.textInput(this.getNodeId(node), shownText(state, node.data?.questionText), String(node.data?.answerVariable || ''), this.inputType, {
      placeholder: this.placeholder,
    });
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const ui = this.ui(node, state);
    botSay(state, ui.question, ui.nodeId, this.nodeType);
    return NodeResult.displayUI(ui);
  }

  /** The refusal message, or null when the answer is fine. */
  protected problem(_value: string, _node: Record<string, any>, _state: ChatState): string | null {
    return null;
  }

  /** What is saved and recorded for the answer. */
  protected saved(value: string): { variable: any; text: string } {
    return { variable: value, text: value };
  }

  /** After the answer is saved: by default, on along the first edge. */
  protected async after(_value: string, _node: Record<string, any>, _state: ChatState): Promise<NodeResult> {
    return NodeResult.next();
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const value = typedText(response);
    const nodeId = this.getNodeId(node);
    if (!value) return NodeResult.displayUI(this.ui(node, state));
    const problem = this.problem(value, node, state);
    if (problem) return NodeResult.invalid(problem, this.ui(node, state));
    const { variable, text } = this.saved(value);
    pushAnswer(state, { id: nodeId, shape: this.shape, text });
    userSay(state, text, nodeId);
    state.setAnswerVariable(nodeId, variable);
    return this.after(value, node, state);
  }
}

// ========================================
// ASK NAME
// ========================================

/**
 * ask-name-node: any text. The full answer is saved; nameGreetResponse
 * greets by the first name after 2000 ms of typing (none set: the default
 * greeting; cleared in the builder: no greeting).
 */
export class AskNameHandler extends BaseAskHandler {
  readonly nodeType = DisplayNodes.ASK_NAME;
  protected readonly inputType: InputType = 'text';
  protected readonly shape = 'user-ask-name-response';
  protected get placeholder(): string {
    return t('composer.name');
  }

  protected async after(value: string, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const nodeId = this.getNodeId(node);
    state.setUserName(value);
    const greeting = nameGreetingHtml(node.data?.nameGreetResponse, value);
    if (!greeting) return NodeResult.next();
    await ctxOf(node, state).typing(2000);
    state.addRecord({
      _id: nodeId,
      id: nodeId,
      shape: 'ask-name-response-greet',
      type: 'ask-name-response-greet',
      text: greeting,
      renderedText: fillVariables(greeting, (k) => state.lookupVariable(k)),
      time: new Date().toISOString(),
    });
    botSay(state, shownText(state, greeting), nodeId, this.nodeType);
    return NodeResult.next();
  }
}

// ========================================
// ASK EMAIL
// ========================================

/**
 * ask-email-node: the widget's e-mail check (incorrectEmailResponse, else
 * the default). A likely domain typo is refused once with the fix offered;
 * the same address sent again is kept as typed.
 */
export class AskEmailHandler extends BaseAskHandler {
  readonly nodeType = DisplayNodes.ASK_EMAIL;
  protected readonly inputType: InputType = 'email';
  protected readonly shape = 'user-ask-email-response';
  protected get placeholder(): string {
    return t('composer.email');
  }

  protected problem(value: string, node: Record<string, any>, state: ChatState): string | null {
    if (!isValidEmail(value)) {
      return ownerTextOr(node.data?.incorrectEmailResponse, EN.emailInvalid, ['Please enter a valid email']);
    }
    const fix = suggestEmailFix(value);
    const typed = value.trim().toLowerCase();
    if (fix && state.getVariable('_lastEmailTypo') !== typed) {
      state.setVariable('_lastEmailTypo', typed);
      return EN.emailTypo(fix);
    }
    state.setVariable('_lastEmailTypo', '');
    return null;
  }

  protected async after(value: string): Promise<NodeResult> {
    return NodeResult.next({ email: value });
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const result = await super.handleResponse(response, node, state);
    if (result.type === 'proceed') state.setUserEmail(typedText(response));
    return result;
  }
}

// ========================================
// ASK PHONE
// ========================================

/** ask-phone-number-node: 6-15 digits once normalised; saved normalised. */
export class AskPhoneHandler extends BaseAskHandler {
  readonly nodeType = DisplayNodes.ASK_PHONE;
  protected readonly inputType: InputType = 'phone';
  protected readonly shape = 'user-ask-phone-number-response';
  protected get placeholder(): string {
    return t('composer.phone');
  }

  protected problem(value: string, node: Record<string, any>): string | null {
    return isValidPhone(value) ? null : phoneErrorText(node.data);
  }

  protected saved(value: string) {
    const phone = normalizePhone(value);
    return { variable: phone, text: phone };
  }

  protected async after(value: string, _node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    state.setUserPhone(normalizePhone(value));
    return NodeResult.next();
  }
}

// ========================================
// ASK NUMBER
// ========================================

/**
 * ask-number-node: "1,200" is 1200, "3,5" is 3.5; enableConditions bounds;
 * invalidNumberResponse ({min}/{max} filled). Saved as a NUMBER.
 */
export class AskNumberHandler extends BaseAskHandler {
  readonly nodeType = DisplayNodes.ASK_NUMBER;
  protected readonly inputType: InputType = 'number';
  protected readonly shape = 'user-ask-number-response';
  protected get placeholder(): string {
    return t('composer.number');
  }

  protected problem(value: string, node: Record<string, any>): string | null {
    return numberProblem(value, node.data);
  }

  protected saved(value: string) {
    const n = parseNumberInput(value);
    return { variable: n ?? value, text: n === null ? value : String(n) };
  }
}

// ========================================
// ASK URL
// ========================================

/** ask-url-node: a link people would type; a bare host is saved with https://. */
export class AskUrlHandler extends BaseAskHandler {
  readonly nodeType = DisplayNodes.ASK_URL;
  protected readonly inputType: InputType = 'url';
  protected readonly shape = 'user-ask-url-response';

  protected problem(value: string): string | null {
    return isValidLink(value) ? null : EN.link;
  }

  protected saved(value: string) {
    const url = linkHref(value) || value.trim();
    return { variable: url, text: url };
  }
}

// ========================================
// ASK LOCATION / CUSTOM QUESTION
// ========================================

/** ask-location-node: any text. */
export class AskLocationHandler extends BaseAskHandler {
  readonly nodeType = DisplayNodes.ASK_LOCATION;
  protected readonly inputType: InputType = 'text';
  protected readonly shape = 'user-ask-location-response';
  protected get placeholder(): string {
    return t('composer.location');
  }
}

/** ask-custom-question-node: any text. */
export class AskCustomQuestionHandler extends BaseAskHandler {
  readonly nodeType = DisplayNodes.ASK_CUSTOM_QUESTION;
  protected readonly inputType: InputType = 'text';
  protected readonly shape = 'user-ask-custom-question-response';
}

// ========================================
// ASK FILE
// ========================================

/**
 * ask-file-node: an upload card. A file over maxFileSizeMB (default 5) or
 * not in allowedFileTypes is refused on the card; the picked file is
 * uploaded to POST /api/v1/bot/:id/media and its URL saved. A failed upload
 * keeps the step waiting. Optional ("(optional)" in the question, or
 * data.optional) offers Skip: recorded as skipped, no variable.
 *
 * Answers: {file: {uri, name, type, size}} (uploaded here), {url, fileName}
 * (uploaded by the UI already), or {skip: true}.
 */
export class AskFileHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.ASK_FILE;

  private ui(node: Record<string, any>, state: ChatState): NodeUIState.FileUpload {
    const data = node.data || {};
    const types: string[] = Array.isArray(data.allowedFileTypes) ? data.allowedFileTypes : [];
    return {
      type: 'fileUpload',
      nodeId: this.getNodeId(node),
      question: shownText(state, data.questionText),
      variableName: data.answerVariable,
      acceptedTypes: types.length ? types : undefined,
      maxSize: (Number(data.maxFileSizeMB) > 0 ? Number(data.maxFileSizeMB) : DEFAULT_MAX_FILE_MB) * 1024 * 1024,
      optional: isOptionalUpload(data),
      typesInWords: fileTypesWords(types),
    } as NodeUIState.FileUpload;
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const ui = this.ui(node, state);
    botSay(state, ui.question, ui.nodeId, this.nodeType);
    return NodeResult.displayUI(ui);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const nodeId = this.getNodeId(node);
    const data = node.data || {};

    if (response?.skip === true || response?.action === 'skip') {
      if (!isOptionalUpload(data)) return NodeResult.displayUI(this.ui(node, state));
      pushAnswer(state, { id: nodeId, shape: 'user-ask-file-response', skipped: true });
      userSay(state, EN.skipped, nodeId);
      return NodeResult.next();
    }

    let url: string | undefined = typeof response?.url === 'string' && response.url.trim() ? response.url : undefined;
    let fileName: string = response?.fileName || response?.file?.name || response?.files?.[0]?.name || 'file';
    if (!url && Array.isArray(response?.files) && response.files[0]?.url) url = response.files[0].url;

    if (!url) {
      const file = response?.file;
      if (!file) return NodeResult.displayUI(this.ui(node, state));
      const problem = fileUploadProblem(file, data);
      if (problem) return NodeResult.invalid(problem, this.ui(node, state), true);
      const uploaded = await ctxOf(node, state).upload(file);
      if (!uploaded.ok || !uploaded.url) return NodeResult.invalid(EN.uploadRetry, this.ui(node, state), true);
      url = uploaded.url;
      fileName = file.name || fileName;
    }

    pushAnswer(state, { id: nodeId, shape: 'user-ask-file-response', fileName, url });
    userSay(state, url, nodeId);
    state.setAnswerVariable(nodeId, url);
    return NodeResult.next();
  }
}

// ========================================
// REGISTRATION
// ========================================

export const askHandlers: NodeHandler[] = [
  new AskNameHandler(),
  new AskEmailHandler(),
  new AskPhoneHandler(),
  new AskNumberHandler(),
  new AskUrlHandler(),
  new AskFileHandler(),
  new AskLocationHandler(),
  new AskCustomQuestionHandler(),
];

export function registerAskHandlers(registry: NodeHandlerRegistry): void {
  registry.registerAll(askHandlers);
}

export default askHandlers;
