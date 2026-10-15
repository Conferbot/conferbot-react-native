/**
 * LegacyNodeHandlers.ts
 *
 * The v1 steps still found in live bots: two-choices, three-choices,
 * select-option, user-input, user-range, user-rating and quiz. Fields and
 * behaviour follow the flow-node spec and the web widget
 * (ts/chat/handlers/_legacy.ts, flowOperations.ts, displayStep.ts).
 * Legacy steps never register an answer variable.
 */

import { BaseNodeHandler, NodeResult, NodeUIState, NodeHandler } from '../NodeHandler';
import { ChatState } from '../../state/ChatState';
import { NodeHandlerRegistry } from '../NodeHandlerRegistry';
import { DisplayNodes } from '../NodeTypes';
import { ctxOf } from '../../flow/context';
import { nameGreetingHtml } from '../../flow/text';
import { EN, isValidEmail, ownerTextOr, parseNumberInput } from '../../flow/inputs';
import { botSay, pickedId, pushAnswer, savedText, shownLabel, shownText, typedText, userSay } from './flowKit';

/** Numbered options (choiceText1.., option1..) as buttons, ids "1".."n". */
const numberedButtons = (state: ChatState, data: any, key: string, count: number, hidden: (n: number) => boolean) => {
  const buttons: NodeUIState.Buttons['buttons'] = [];
  for (let n = 1; n <= count; n++) {
    if (hidden(n)) continue;
    buttons.push({ id: String(n), label: shownLabel(state, data?.[`${key}${n}`]), value: savedText(data?.[`${key}${n}`]) });
  }
  return buttons;
};

// ========================================
// TWO / THREE CHOICES
// ========================================

/** two-choices-node: choiceText1 -> source-1, choiceText2 -> source-2 (disableSecondChoice hides it). */
export class TwoChoicesNodeHandler extends BaseNodeHandler {
  readonly nodeType: string = DisplayNodes.TWO_CHOICES;
  protected readonly count: number = 2;

  protected hidden(data: any, n: number): boolean {
    return n === 2 && !!data?.disableSecondChoice;
  }

  private ui(node: Record<string, any>, state: ChatState): NodeUIState.Buttons {
    const data = node.data || {};
    return NodeUIState.buttons(
      this.getNodeId(node),
      shownText(state, data.choicePrompt),
      numberedButtons(state, data, 'choiceText', this.count, (n) => this.hidden(data, n))
    );
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const ui = this.ui(node, state);
    botSay(state, ui.question, ui.nodeId, this.nodeType);
    return NodeResult.displayUI(ui);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const nodeId = this.getNodeId(node);
    const n = Number(pickedId(response) ?? (Number(response?.index) + 1));
    if (!Number.isInteger(n) || n < 1 || n > this.count || this.hidden(node.data, n)) return NodeResult.displayUI(this.ui(node, state));
    const text = savedText(node.data?.[`choiceText${n}`]);
    pushAnswer(state, { id: nodeId, shape: 'user-selected-choice', choices: node.data, selectedChoice: text });
    userSay(state, text, nodeId);
    return NodeResult.port(`source-${n}`);
  }
}

/** three-choices-node: choiceText1..3 -> source-1..3. */
export class ThreeChoicesNodeHandler extends TwoChoicesNodeHandler {
  readonly nodeType: string = DisplayNodes.THREE_CHOICES;
  protected readonly count: number = 3;

  protected hidden(): boolean {
    return false;
  }
}

// ========================================
// SELECT OPTION
// ========================================

/** select-option-node: option1..option5 (disableOption3..5); the first edge 600 ms after the pick. */
export class SelectOptionNodeHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.SELECT_OPTION;

  private hidden(data: any, n: number): boolean {
    return n >= 3 && !!data?.[`disableOption${n}`];
  }

  private ui(node: Record<string, any>, state: ChatState): NodeUIState.Buttons {
    const data = node.data || {};
    return NodeUIState.buttons(this.getNodeId(node), shownText(state, data.selectPrompt), numberedButtons(state, data, 'option', 5, (n) => this.hidden(data, n)));
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const ui = this.ui(node, state);
    botSay(state, ui.question, ui.nodeId, this.nodeType);
    return NodeResult.displayUI(ui);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const nodeId = this.getNodeId(node);
    const n = Number(pickedId(response));
    if (!Number.isInteger(n) || n < 1 || n > 5 || this.hidden(node.data, n)) return NodeResult.displayUI(this.ui(node, state));
    const text = savedText(node.data?.[`option${n}`]);
    pushAnswer(state, { id: nodeId, shape: 'user-selected-option', options: node.data, selectedOption: text });
    userSay(state, text, nodeId);
    return NodeResult.delayedProceed(null, 600);
  }
}

// ========================================
// USER INPUT
// ========================================

const LEGACY_URL_RE = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;

/**
 * user-input-node: data.type name | email | number | url | date | file |
 * phone | mobile. email / number / url are checked (incorrect*Response);
 * name greets with nameGreet after 1000 ms of typing and moves on at 2000
 * ms; others at 500 ms; a date or a file at once.
 */
export class UserInputNodeHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.USER_INPUT_NODE;

  private ui(node: Record<string, any>, state: ChatState): NodeUIState {
    const data = node.data || {};
    const type = String(data.type || '');
    const nodeId = this.getNodeId(node);
    const question = shownText(state, data.inputPrompt);
    if (type === 'file') return { type: 'fileUpload', nodeId, question, maxSize: 5000000 };
    const inputType: NodeUIState.TextInput['inputType'] =
      type === 'email' ? 'email' : type === 'number' ? 'number' : type === 'url' ? 'url' : type === 'date' ? 'date' : type === 'phone' || type === 'mobile' ? 'phone' : 'text';
    return NodeUIState.textInput(nodeId, question, '', inputType);
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const ui = this.ui(node, state) as any;
    botSay(state, ui.question, ui.nodeId, this.nodeType);
    return NodeResult.displayUI(ui);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = node.data || {};
    const type = data.type;
    const nodeId = this.getNodeId(node);
    const ctx = ctxOf(node, state);

    if (type === 'file') {
      let url: string | undefined = response?.url;
      if (!url && response?.file) {
        if (Number(response.file.size) > 5000000) return NodeResult.invalid('Please upload a file smaller than 5MB', this.ui(node, state));
        const up = await ctx.upload(response.file);
        if (!up.ok) return NodeResult.invalid("Couldn't upload this file. Please try again.", this.ui(node, state));
        url = up.url;
      }
      if (!url) return NodeResult.displayUI(this.ui(node, state));
      pushAnswer(state, { id: nodeId, shape: 'user-input-response', type, url });
      userSay(state, url, nodeId);
      return NodeResult.next();
    }

    const value = typedText(response);
    if (!value) return NodeResult.displayUI(this.ui(node, state));
    if (type === 'email' && !isValidEmail(value)) {
      return NodeResult.invalid(ownerTextOr(data.incorrectEmailResponse, EN.emailInvalid, ['Please enter a valid email']), this.ui(node, state));
    }
    if (type === 'number' && (value.trim() === '' || isNaN(Number(value.trim())))) {
      return NodeResult.invalid(ownerTextOr(data.incorrectNumberResponse, 'Please enter a valid number'), this.ui(node, state));
    }
    if (type === 'url' && !LEGACY_URL_RE.test(value.toLowerCase())) {
      return NodeResult.invalid(ownerTextOr(data.incorrectUrlResponse, 'Please enter a valid url'), this.ui(node, state));
    }
    if (type === 'name') state.setUserName(value);
    if (type === 'email') state.setUserEmail(value);
    if (type === 'phone' || type === 'mobile') state.setUserPhone(value);

    pushAnswer(state, { id: nodeId, shape: 'user-input-response', type, text: value });
    userSay(state, value, nodeId);

    if (type === 'date') return NodeResult.next();
    if (type === 'name') {
      const greeting = nameGreetingHtml(data.nameGreet || undefined, value);
      await ctx.typing(1000);
      if (greeting) botSay(state, shownText(state, greeting), nodeId, this.nodeType);
      return NodeResult.delayedProceed(null, 1000);
    }
    return NodeResult.delayedProceed(null, 500);
  }
}

// ========================================
// USER RANGE
// ========================================

/** user-range-node: a number; below minVal -> source-1, within -> source-2, above maxVal -> source-3. */
export class UserRangeNodeHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.USER_RANGE_NODE;

  private ui(node: Record<string, any>, state: ChatState): NodeUIState.TextInput {
    return NodeUIState.textInput(this.getNodeId(node), shownText(state, node.data?.rangePrompt), '', 'number');
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const ui = this.ui(node, state);
    botSay(state, ui.question, ui.nodeId, this.nodeType);
    return NodeResult.displayUI(ui);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const nodeId = this.getNodeId(node);
    const value = typedText(response);
    const n = parseNumberInput(value);
    if (n === null) return NodeResult.invalid(EN.numberLike, this.ui(node, state));
    pushAnswer(state, { id: nodeId, shape: 'user-input-response-range', type: node.data?.type, text: value });
    userSay(state, value, nodeId);
    const handle = n < Number(node.data?.minVal) ? 'source-1' : n > Number(node.data?.maxVal) ? 'source-3' : 'source-2';
    return NodeResult.port(handle);
  }
}

// ========================================
// USER RATING
// ========================================

/** user-rating-node: type number (data.range buttons), star or smiley (five); the first edge. */
export class UserRatingNodeHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.USER_RATING;

  private count(data: any): number {
    return data?.type === 'number' ? Math.max(1, Number(data?.range) || 5) : 5;
  }

  private ui(node: Record<string, any>, state: ChatState): NodeUIState.Rating {
    const data = node.data || {};
    return {
      type: 'rating',
      nodeId: this.getNodeId(node),
      question: shownText(state, data.ratingPrompt),
      maxRating: this.count(data),
      style: data.type === 'number' ? 'numbers' : data.type === 'smiley' ? 'thumbs' : 'stars',
    };
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const ui = this.ui(node, state);
    botSay(state, ui.question, ui.nodeId, this.nodeType);
    return NodeResult.displayUI(ui);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const nodeId = this.getNodeId(node);
    const rating = Number(typeof response === 'object' && response !== null ? response.value ?? response.rating : response);
    if (!Number.isInteger(rating) || rating < 1 || rating > this.count(node.data)) return NodeResult.displayUI(this.ui(node, state));
    pushAnswer(state, { id: nodeId, shape: 'user-selected-rating', type: node.data?.type, rating });
    userSay(state, String(rating), nodeId);
    return NodeResult.next();
  }
}

// ========================================
// QUIZ
// ========================================

/**
 * quiz-node: option1..5 (disableOption3..5), correctAnswer "optionN".
 * Wrong -> source-1, right -> source-2. When source-2 leads to a
 * variable-node, that step is not run: its value is ADDED to the flow
 * variable (the score) and the flow jumps to the step after it.
 */
export class QuizNodeHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.QUIZ_NODE;

  private hidden(data: any, n: number): boolean {
    return n >= 3 && !!data?.[`disableOption${n}`];
  }

  private ui(node: Record<string, any>, state: ChatState): NodeUIState.Buttons {
    const data = node.data || {};
    return NodeUIState.buttons(this.getNodeId(node), shownText(state, data.quizPrompt), numberedButtons(state, data, 'option', 5, (n) => this.hidden(data, n)));
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const ui = this.ui(node, state);
    botSay(state, ui.question, ui.nodeId, this.nodeType);
    return NodeResult.displayUI(ui);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = node.data || {};
    const nodeId = this.getNodeId(node);
    const n = Number(pickedId(response));
    if (!Number.isInteger(n) || n < 1 || n > 5 || this.hidden(data, n)) return NodeResult.displayUI(this.ui(node, state));
    const option = `option${n}`;
    const correctAnswer = data.correctAnswer;
    pushAnswer(state, {
      id: nodeId,
      shape: 'user-selected-quiz-option',
      options: data,
      selectedOption: data[option],
      correctAnswer,
      correct: option === correctAnswer,
    });
    userSay(state, savedText(data[option]), nodeId);
    if (option !== correctAnswer) return NodeResult.port('source-1');

    const ctx = ctxOf(node, state);
    const rightEdge = ctx.edges().find((e) => e.sourceHandle === 'source-2');
    const nextNode = rightEdge ? ctx.node(rightEdge.target) : undefined;
    if (nextNode?.type === 'variable-node') {
      const name = nextNode.data?.name;
      const current = state.getVariable(name);
      const value = current ? Number(current) + Number(nextNode.data?.value) : Number(nextNode.data?.value);
      state.setVariable(name, value);
      const after = ctx.edgesOf(nextNode.id)[0];
      if (after?.target) return NodeResult.jumpTo(after.target);
      return NodeResult.port('source-1');
    }
    return NodeResult.port('source-2');
  }
}

// ========================================
// REGISTRATION
// ========================================

export const legacyHandlers: NodeHandler[] = [
  new UserInputNodeHandler(),
  new UserRangeNodeHandler(),
  new QuizNodeHandler(),
  new TwoChoicesNodeHandler(),
  new ThreeChoicesNodeHandler(),
  new SelectOptionNodeHandler(),
  new UserRatingNodeHandler(),
];

export function registerLegacyHandlers(registry: NodeHandlerRegistry): void {
  registry.registerAll(legacyHandlers);
}

export default legacyHandlers;
