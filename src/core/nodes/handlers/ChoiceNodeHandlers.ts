/**
 * ChoiceNodeHandlers.ts
 *
 * The choice steps: n-choices, image-choice, yes-or-no, rating-choice,
 * opinion-scale, n-select-option, n-check-options and carousel. Fields,
 * ports, saved values and records follow the flow-node spec and the web
 * widget (ts/chat/displayStep.ts, handlers/flowOperations.ts,
 * handlers/askQuestions.ts):
 *
 * - n-choices / image-choice / yes-or-no / carousel leave by
 *   "source-" + the picked item's id; rating by source-<value-1>; opinion
 *   scale by source-<value-from>. No edge there ends the chat.
 * - n-select-option and n-check-options have no ports: the first edge,
 *   600 ms after the pick.
 * - Labels are shown with the answers filled in; what is saved is the
 *   option's own text, HTML stripped.
 */

import { BaseNodeHandler, NodeResult, NodeUIState, NodeHandler } from '../NodeHandler';
import { ChatState } from '../../state/ChatState';
import { NodeHandlerRegistry } from '../NodeHandlerRegistry';
import { DisplayNodes } from '../NodeTypes';
import { inListOrder } from '../../flow/text';
import { linkHref } from '../../flow/inputs';
import { botSay, notBlank, pickedId, pushAnswer, savedText, shownLabel, shownText, userSay } from './flowKit';

// ========================================
// N CHOICES
// ========================================

/** n-choices-node: choicePrompt, choices [{id, choiceText}] (blank ones hidden). */
export class ButtonsHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.N_CHOICES;

  private choices(node: Record<string, any>): any[] {
    return (Array.isArray(node.data?.choices) ? node.data.choices : []).filter((c: any) => String(c?.choiceText ?? '').trim() !== '');
  }

  private ui(node: Record<string, any>, state: ChatState): NodeUIState.Buttons {
    const buttons = this.choices(node).map((c: any) => ({ id: String(c.id), label: shownLabel(state, c.choiceText), value: savedText(c.choiceText) }));
    return NodeUIState.buttons(this.getNodeId(node), shownText(state, node.data?.choicePrompt), buttons, node.data?.answerVariable);
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const ui = this.ui(node, state);
    botSay(state, ui.question, ui.nodeId, this.nodeType);
    return NodeResult.displayUI(ui);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const nodeId = this.getNodeId(node);
    const id = pickedId(response);
    const choice = this.choices(node).find((c: any) => String(c.id) === id);
    if (!choice) return NodeResult.displayUI(this.ui(node, state));
    const text = savedText(choice.choiceText);
    pushAnswer(state, { id: nodeId, shape: 'user-selected-choice', choices: node.data, selectedChoice: text });
    userSay(state, text, nodeId);
    state.setAnswerVariable(nodeId, text);
    return NodeResult.port(`source-${choice.id}`);
  }
}

// ========================================
// IMAGE CHOICE
// ========================================

/** image-choice-node: questionText, images [{id, image, label}] (both non-blank to show). */
export class PictureChoiceHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.IMAGE_CHOICE;

  private images(node: Record<string, any>): any[] {
    return (Array.isArray(node.data?.images) ? node.data.images : []).filter(
      (i: any) => String(i?.image ?? '').trim() !== '' && String(i?.label ?? '').trim() !== ''
    );
  }

  private ui(node: Record<string, any>, state: ChatState): NodeUIState.PictureChoice {
    return {
      type: 'pictureChoice',
      nodeId: this.getNodeId(node),
      question: shownText(state, node.data?.questionText),
      choices: this.images(node).map((i: any) => ({ id: String(i.id), imageUrl: i.image, label: shownLabel(state, i.label), value: savedText(i.label) })),
      variableName: node.data?.answerVariable,
    };
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const ui = this.ui(node, state);
    botSay(state, ui.question, ui.nodeId, this.nodeType);
    return NodeResult.displayUI(ui);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const nodeId = this.getNodeId(node);
    const id = pickedId(response);
    const image = this.images(node).find((i: any) => String(i.id) === id);
    if (!image) return NodeResult.displayUI(this.ui(node, state));
    const label = savedText(image.label);
    pushAnswer(state, { id: nodeId, shape: 'user-selected-image-choice', images: node.data, selectedImageLabel: label, selectedImage: image.image });
    userSay(state, label, nodeId);
    state.setAnswerVariable(nodeId, label);
    return NodeResult.port(`source-${image.id}`);
  }
}

// ========================================
// YES OR NO
// ========================================

const YES_NO_DEFAULT = [
  { id: '1', label: 'Yes' },
  { id: '2', label: 'No' },
];

/** yes-or-no-choice-node: questionText, options [{id, label}] (default Yes "1" / No "2"). */
export class YesOrNoChoiceHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.YES_OR_NO_CHOICE;

  private options(node: Record<string, any>): any[] {
    return Array.isArray(node.data?.options) && node.data.options.length ? node.data.options : YES_NO_DEFAULT;
  }

  private ui(node: Record<string, any>, state: ChatState): NodeUIState.Buttons {
    const buttons = this.options(node).map((o: any) => ({ id: String(o.id), label: shownLabel(state, o.label), value: savedText(o.label) }));
    return NodeUIState.buttons(this.getNodeId(node), shownText(state, node.data?.questionText), buttons, node.data?.answerVariable);
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const ui = this.ui(node, state);
    botSay(state, ui.question, ui.nodeId, this.nodeType);
    return NodeResult.displayUI(ui);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const nodeId = this.getNodeId(node);
    const id = pickedId(response);
    const option = this.options(node).find((o: any) => String(o.id) === id);
    if (!option) return NodeResult.displayUI(this.ui(node, state));
    const text = savedText(option.label);
    pushAnswer(state, { id: nodeId, shape: 'user-selected-yes-or-no-choice', options: node.data, selectedYesOrNoChoice: text });
    userSay(state, text, nodeId);
    state.setAnswerVariable(nodeId, text);
    return NodeResult.port(`source-${option.id}`);
  }
}

// ========================================
// RATING
// ========================================

/** What the faces have always recorded (web nodeKit FACE_VALUES). */
export const FACE_VALUES = ['😡', '😐', '😊', '😀', '😁'];
const FACE_LABELS = ['Very unhappy', 'Unhappy', 'Neutral', 'Happy', 'Very happy'];

export const ratingCount = (ratingType: any): number =>
  ratingType === 'smiley' ? 5 : Math.max(1, Math.min(10, Number(ratingType) || 5));

/** What each score means (web nodeKit ratingWords, English). */
export const ratingWords = (ratingType: any, n: number): string[] => {
  if (ratingType === 'smiley') return FACE_LABELS;
  if (n === 3) return ['Bad', 'Okay', 'Great'];
  if (n === 5) return ['Terrible', 'Bad', 'Okay', 'Good', 'Amazing'];
  return Array.from({ length: n }, (_, i) => `${i + 1} out of ${n}`);
};

/** The value a rating button records: stars, or the face. */
export const ratingValue = (ratingType: any, i: number): string => (ratingType === 'smiley' ? FACE_VALUES[i - 1] || '😊' : '⭐'.repeat(i));

/**
 * rating-choice-node: ratingType 1..10 stars or "smiley" (five faces).
 * Saves the NUMBER; leaves by source-<value-1>.
 */
export class RatingHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.RATING_CHOICE;

  private ui(node: Record<string, any>, state: ChatState): NodeUIState.Rating {
    const ratingType = node.data?.ratingType;
    return {
      type: 'rating',
      nodeId: this.getNodeId(node),
      question: shownText(state, node.data?.questionText),
      maxRating: ratingCount(ratingType),
      variableName: node.data?.answerVariable,
      style: ratingType === 'smiley' ? 'thumbs' : ratingCount(ratingType) > 5 ? 'numbers' : 'stars',
      ...({ ratingType, faces: ratingType === 'smiley' ? FACE_VALUES : undefined, labels: ratingWords(ratingType, ratingCount(ratingType)) } as any),
    };
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const ui = this.ui(node, state);
    botSay(state, ui.question, ui.nodeId, this.nodeType);
    return NodeResult.displayUI(ui);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const nodeId = this.getNodeId(node);
    const ratingType = node.data?.ratingType;
    const n = ratingCount(ratingType);
    const value = Number(typeof response === 'object' && response !== null ? response.value ?? response.rating : response);
    if (!Number.isInteger(value) || value < 1 || value > n) return NodeResult.displayUI(this.ui(node, state));
    const selected = ratingValue(ratingType, value);
    pushAnswer(state, {
      id: nodeId,
      shape: 'user-selected-rating-choice',
      options: node.data,
      selectedRatingChoice: selected,
      value,
      label: ratingWords(ratingType, n)[value - 1] || '',
      ratingType,
    });
    userSay(state, selected, nodeId);
    state.setAnswerVariable(nodeId, value);
    return NodeResult.port(`source-${value - 1}`);
  }
}

// ========================================
// OPINION SCALE
// ========================================

/** A scale's range; blank is 0 to 10 (web nodeKit scaleRange). */
export const scaleRange = (rawFrom: any, rawTo: any): { from: number; to: number } => {
  const blank = (v: any) => v === '' || v === null || v === undefined || !Number.isFinite(Number(v));
  const from = blank(rawFrom) ? 0 : Number(rawFrom);
  const to = blank(rawTo) || Number(rawTo) < from ? Math.max(from, 10) : Number(rawTo);
  return { from, to };
};

/** opinion-scale-choice-node: from..to buttons; saves the NUMBER; leaves by source-<value-from>. */
export class OpinionScaleHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.OPINION_SCALE_CHOICE;

  private ui(node: Record<string, any>, state: ChatState): NodeUIState.OpinionScale {
    const { from, to } = scaleRange(node.data?.from, node.data?.to);
    return {
      type: 'opinionScale',
      nodeId: this.getNodeId(node),
      question: shownText(state, node.data?.questionText),
      min: from,
      max: to,
      minLabel: node.data?.fromLabel,
      maxLabel: node.data?.toLabel,
      variableName: node.data?.answerVariable,
      showNumbers: true,
    };
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const ui = this.ui(node, state);
    botSay(state, ui.question, ui.nodeId, this.nodeType);
    return NodeResult.displayUI(ui);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const nodeId = this.getNodeId(node);
    const { from, to } = scaleRange(node.data?.from, node.data?.to);
    const value = Number(typeof response === 'object' && response !== null ? response.value : response);
    if (!Number.isFinite(value) || value < from || value > to) return NodeResult.displayUI(this.ui(node, state));
    pushAnswer(state, { id: nodeId, shape: 'user-selected-opinion-scale-choice', options: node.data, selectedOpinionScaleChoice: String(value), value });
    userSay(state, String(value), nodeId);
    state.setAnswerVariable(nodeId, value);
    return NodeResult.port(`source-${value - from}`);
  }
}

// ========================================
// N SELECT OPTION
// ========================================

/** n-select-option-node: selectPrompt, options [{id, optionText}]; no ports - first edge after 600 ms. */
export class DropdownHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.N_SELECT_OPTION;

  private options(node: Record<string, any>): any[] {
    return (Array.isArray(node.data?.options) ? node.data.options : []).filter((o: any) => String(o?.optionText ?? '').trim() !== '');
  }

  private ui(node: Record<string, any>, state: ChatState): NodeUIState.Dropdown {
    return {
      type: 'dropdown',
      nodeId: this.getNodeId(node),
      question: shownText(state, node.data?.selectPrompt),
      options: this.options(node).map((o: any) => ({ id: String(o.id), label: shownLabel(state, o.optionText), value: savedText(o.optionText) })),
      variableName: node.data?.answerVariable,
    };
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const ui = this.ui(node, state);
    botSay(state, ui.question, ui.nodeId, this.nodeType);
    return NodeResult.displayUI(ui);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const nodeId = this.getNodeId(node);
    const id = pickedId(response);
    const option = this.options(node).find((o: any) => String(o.id) === id);
    if (!option) return NodeResult.displayUI(this.ui(node, state));
    const text = savedText(option.optionText);
    pushAnswer(state, { id: nodeId, shape: 'user-selected-option', options: node.data, selectedOption: text });
    userSay(state, text, nodeId);
    state.setAnswerVariable(nodeId, text);
    return NodeResult.delayedProceed(null, 600);
  }
}

// ========================================
// N CHECK OPTIONS
// ========================================

/**
 * n-check-options-node: checkOptionsPrompt, options; the ticked texts in LIST
 * order joined ", "; first edge after 600 ms.
 */
export class NCheckOptionsHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.N_CHECK_OPTIONS;

  private options(node: Record<string, any>): any[] {
    return (Array.isArray(node.data?.options) ? node.data.options : []).filter((o: any) => String(o?.optionText ?? '').trim() !== '');
  }

  private ui(node: Record<string, any>, state: ChatState): NodeUIState.Buttons {
    const buttons = this.options(node).map((o: any) => ({ id: String(o.id), label: shownLabel(state, o.optionText), value: savedText(o.optionText) }));
    return { ...NodeUIState.buttons(this.getNodeId(node), shownText(state, node.data?.checkOptionsPrompt), buttons, node.data?.answerVariable), multiSelect: true };
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const ui = this.ui(node, state);
    botSay(state, ui.question, ui.nodeId, this.nodeType);
    return NodeResult.displayUI(ui);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const nodeId = this.getNodeId(node);
    const options = this.options(node);
    const ids: string[] = (Array.isArray(response?.buttonIds) ? response.buttonIds : Array.isArray(response?.optionIds) ? response.optionIds : []).map(String);
    const ticked = inListOrder(ids, options.map((o: any) => String(o.id)))
      .map((id) => options.find((o: any) => String(o.id) === id))
      .filter(Boolean);
    if (!ticked.length) return NodeResult.displayUI(this.ui(node, state));
    const text = ticked.map((o: any) => savedText(o.optionText)).join(', ');
    pushAnswer(state, { id: nodeId, shape: 'user-selected-check-options', options: node.data, selectedCheckOptions: text });
    userSay(state, text, nodeId);
    state.setAnswerVariable(nodeId, text);
    return NodeResult.delayedProceed(null, 600);
  }
}

// ========================================
// CAROUSEL
// ========================================

export const CAROUSEL_CONTINUE = 'Continue';

/** The cards as the web reads them (nodeKit carouselCards): at most 10, 3 buttons each. */
export const carouselCards = (data: any) =>
  (Array.isArray(data?.cards) ? data.cards : [])
    .map((card: any, ci: number) => ({
      id: String(card?.id ?? `card-${ci}`),
      image: String(card?.image ?? '').trim(),
      title: String(card?.title ?? '').trim(),
      description: String(card?.description ?? '').trim(),
      price: String(card?.price ?? '').trim(),
      buttons: (Array.isArray(card?.buttons) ? card.buttons : [])
        .map((b: any, bi: number) => {
          const action: 'path' | 'link' = b?.action === 'link' ? 'link' : 'path';
          return { id: String(b?.id ?? `${ci}-${bi}`), label: String(b?.label ?? '').trim(), action, href: action === 'link' ? linkHref(b?.url) : '' };
        })
        .filter((b: any) => b.label && (b.action === 'path' || b.href))
        .slice(0, 3),
    }))
    .filter((card: any) => card.title || card.description || card.image)
    .slice(0, 10);

/**
 * carousel-node: a path button leaves by "source-" + its id and saves
 * "Card title - Button label"; link buttons only open their page. With no
 * path button anywhere, Continue leaves by "source" and saves nothing.
 * Answers: {buttonId} (cardId optional) or {action: "continue"}.
 */
export class CarouselHandler extends BaseNodeHandler {
  readonly nodeType = 'carousel-node';

  private ui(node: Record<string, any>, state: ChatState): NodeUIState.Carousel {
    const cards = carouselCards(node.data);
    const hasPath = cards.some((c: any) => c.buttons.some((b: any) => b.action === 'path'));
    return {
      type: 'carousel',
      nodeId: this.getNodeId(node),
      cards: cards.map((c: any) => ({
        id: c.id,
        title: shownLabel(state, c.title),
        description: c.description ? shownLabel(state, c.description) : undefined,
        imageUrl: c.image || undefined,
        buttons: c.buttons.map((b: any) => ({ id: b.id, label: b.label, value: b.label, url: b.href || undefined })),
      })),
      variableName: node.data?.answerVariable,
      ...({ question: shownText(state, node.data?.questionText), showContinue: !hasPath } as any),
    };
  }

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const ui = this.ui(node, state);
    const question = (ui as any).question;
    if (question) botSay(state, question, ui.nodeId, this.nodeType);
    return NodeResult.displayUI(ui);
  }

  async handleResponse(response: any, node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const nodeId = this.getNodeId(node);
    const cards = carouselCards(node.data);
    const buttonId = response?.action === 'continue' ? undefined : pickedId(response);
    let card: any;
    let button: any;
    for (const c of cards) {
      const b = c.buttons.find((x: any) => x.id === buttonId && x.action === 'path');
      if (b && (!response?.cardId || response.cardId === c.id)) {
        card = c;
        button = b;
        break;
      }
    }
    if (buttonId && !button) {
      // A link button: it opens its page and the step keeps waiting.
      return NodeResult.displayUI(this.ui(node, state));
    }
    if (!button && cards.some((c: any) => c.buttons.some((b: any) => b.action === 'path'))) return NodeResult.displayUI(this.ui(node, state));
    const title = card?.title || '';
    const label = button?.label || '';
    const answer = button ? (title && label ? `${title} - ${label}` : title || label) : CAROUSEL_CONTINUE;
    const text = savedText(answer);
    pushAnswer(state, {
      id: nodeId,
      shape: 'user-selected-carousel',
      carousel: node.data,
      selectedChoice: text,
      selectedCardId: card?.id ?? null,
      selectedButtonId: button?.id ?? null,
    });
    userSay(state, text, nodeId);
    if (button) state.setAnswerVariable(nodeId, text);
    return NodeResult.port(button ? `source-${button.id}` : 'source');
  }
}

// ========================================
// REGISTRATION
// ========================================

export const choiceHandlers: NodeHandler[] = [
  new ButtonsHandler(),
  new CarouselHandler(),
  new PictureChoiceHandler(),
  new DropdownHandler(),
  new RatingHandler(),
  new OpinionScaleHandler(),
  new YesOrNoChoiceHandler(),
  new NCheckOptionsHandler(),
];

export function registerChoiceHandlers(registry: NodeHandlerRegistry): void {
  registry.registerAll(choiceHandlers);
}

export { notBlank };
export default choiceHandlers;
