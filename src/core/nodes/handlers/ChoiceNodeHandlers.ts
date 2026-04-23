/**
 * ChoiceNodeHandlers.ts
 *
 * Choice/Selection Node Handlers for the Conferbot React Native SDK.
 * Handles all nodes that present choices to the user: buttons, cards, carousel,
 * picture choice, dropdown, rating, and opinion scale.
 */

import {
  BaseNodeHandler,
  NodeResult,
  NodeUIState,
  NodeHandler,
} from '../NodeHandler';
import { ChatState } from '../../state/ChatState';
import { NodeHandlerRegistry } from '../NodeHandlerRegistry';
import { DisplayNodes } from '../NodeTypes';

/** Strip HTML tags from text */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// ========================================
// BUTTON OPTION INTERFACE
// ========================================

interface ButtonOption {
  id: string;
  label: string;
  value?: any;
  icon?: string;
  style?: 'primary' | 'secondary' | 'outline';
  nextNodeId?: string;
}

interface CardOption {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  buttons?: Array<{
    id: string;
    label: string;
    value?: any;
    url?: string;
    nextNodeId?: string;
  }>;
}

interface PictureOption {
  id: string;
  imageUrl: string;
  label?: string;
  value?: any;
  nextNodeId?: string;
}

interface DropdownOption {
  id: string;
  label: string;
  value?: any;
}

// ========================================
// BUTTONS HANDLER
// ========================================

/**
 * Handles 'buttons' nodes - displays button choices
 */
export class ButtonsHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.N_CHOICES;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Buttons node has no data');
    }

    const nodeId = this.getNodeId(node);

    // Get question text (server sends 'choicePrompt' field)
    let question = this.getString(data, 'choicePrompt') ||
                   this.getString(data, 'question') ||
                   this.getString(data, 'text') ||
                   this.getString(data, 'message') ||
                   'Please select an option';

    question = stripHtml(question);
    question = this.resolveText(question, state);

    // Get variable name
    const variableName = this.getString(data, 'variableName') ||
                         this.getString(data, 'variable') ||
                         'selection';

    // Get buttons array — check each field until we find a non-empty array
    // (can't use || because empty arrays are truthy in JS)
    let buttonsData = this.getArray<any>(data, 'buttons');
    if (!buttonsData.length) buttonsData = this.getArray<any>(data, 'options');
    if (!buttonsData.length) buttonsData = this.getArray<any>(data, 'choices');

    if (buttonsData.length === 0) {
      return this.createError('Buttons node has no button options');
    }

    // Map buttons to standard format
    const buttons: NodeUIState.Buttons['buttons'] = buttonsData.map((btn: any, index: number) => {
      const id = btn.id || btn._id || `btn_${index}`;
      let label = btn.choiceLabel || btn.choiceText || btn.label || btn.text || btn.title || `Option ${index + 1}`;
      // Strip HTML from choice labels
      label = stripHtml(label);
      label = this.resolveText(label, state);

      return {
        id,
        label,
        value: btn.value ?? btn.label ?? label,
        icon: btn.icon || btn.emoji,
        style: btn.style || btn.variant || 'primary',
      };
    });

    // Multi-select option
    const multiSelect = this.getBoolean(data, 'multiSelect') ||
                        this.getBoolean(data, 'multiple', false);

    // Add question to transcript so it persists in the message list
    // (the ButtonGroup UI will only show choice pills, not the question)
    state.addBotMessage(question, nodeId, this.nodeType);

    // Create UI state
    const uiState: NodeUIState.Buttons = {
      type: 'buttons',
      nodeId,
      question,
      buttons,
      variableName,
      multiSelect,
    };

    return NodeResult.displayUI(uiState);
  }

  async handleResponse(
    response: any,
    node: Record<string, any>,
    state: ChatState
  ): Promise<NodeResult> {
    const data = this.getNodeData(node);
    const nodeId = this.getNodeId(node);

    const variableName = this.getString(data || {}, 'variableName') ||
                         this.getString(data || {}, 'variable') ||
                         'selection';

    // Validate response
    if (response === undefined || response === null) {
      return NodeResult.error('Please select an option', true);
    }

    // Get the selected button(s) data
    let buttonsData = this.getArray<any>(data || {}, 'buttons');
    if (!buttonsData.length) buttonsData = this.getArray<any>(data || {}, 'options');
    if (!buttonsData.length) buttonsData = this.getArray<any>(data || {}, 'choices');

    // Handle multi-select — ButtonGroup sends { buttonId, value, label, variableName }
    let selectedIds: any[];
    if (response?.buttonId) {
      selectedIds = [response.buttonId];
    } else if (response?.buttonIds) {
      selectedIds = response.buttonIds;
    } else if (Array.isArray(response)) {
      selectedIds = response;
    } else {
      selectedIds = [response];
    }

    const selectedButtons = buttonsData.filter((btn: any) =>
      selectedIds.includes(btn.id) ||
      selectedIds.includes(btn._id) ||
      selectedIds.includes(btn.value) ||
      selectedIds.includes(btn.label) ||
      selectedIds.includes(btn.choiceLabel) ||
      selectedIds.includes(btn.choiceText)
    );

    // Get values and labels (strip HTML from server data)
    const values = selectedButtons.map((btn: any) => btn.value ?? btn.choiceLabel ?? btn.choiceText ?? btn.label);
    const labels = selectedButtons.map((btn: any) => {
      const raw = btn.choiceLabel || btn.choiceText || btn.label || btn.text || '';
      return stripHtml(raw);
    });
    const finalValue = Array.isArray(response) ? values : values[0];

    // Store answer
    state.setAnswer(nodeId, variableName, finalValue, nodeId);

    // Add to transcript (HTML-stripped label)
    state.addUserMessage(labels.join(', '), nodeId);

    // Check for specific next node from button
    const selectedButton = selectedButtons[0];
    if (selectedButton?.nextNodeId) {
      return NodeResult.jumpTo(selectedButton.nextNodeId, { [variableName]: finalValue });
    }

    // Port-based routing using the choice button's ID (edges use source-{choiceId} format)
    if (selectedButton?.id) {
      return this.proceedToPort(selectedButton.id, { [variableName]: finalValue });
    }

    return this.proceed(node, { [variableName]: finalValue });
  }
}

// ========================================
// CARDS HANDLER
// ========================================

/**
 * Handles 'cards' nodes - displays card selections
 */
export class CardsHandler extends BaseNodeHandler {
  readonly nodeType = 'cards-node';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Cards node has no data');
    }

    const nodeId = this.getNodeId(node);

    // Get optional question
    let question = this.getString(data, 'question') ||
                   this.getString(data, 'text', '');

    if (question) {
      question = this.resolveText(question, state);
      state.addBotMessage(question, nodeId, this.nodeType);
    }

    // Get variable name
    const variableName = this.getString(data, 'variableName') ||
                         this.getString(data, 'variable') ||
                         'cardSelection';

    // Get cards array
    const cardsData = this.getArray<any>(data, 'cards', []) ||
                      this.getArray<any>(data, 'items', []);

    if (cardsData.length === 0) {
      return this.createError('Cards node has no card options');
    }

    // Map cards to standard format
    const cards: NodeUIState.Cards['cards'] = cardsData.map((card: any, index: number) => {
      const id = card.id || card._id || `card_${index}`;
      let title = card.title || card.name || `Card ${index + 1}`;
      title = this.resolveText(title, state);

      let description = card.description || card.subtitle || card.text || '';
      description = description ? this.resolveText(description, state) : '';

      // Map card buttons
      const cardButtons = this.getArray<any>(card, 'buttons', []).map((btn: any, btnIndex: number) => ({
        id: btn.id || `${id}_btn_${btnIndex}`,
        label: this.resolveText(btn.label || btn.text || 'Select', state),
        value: btn.value,
        url: btn.url || btn.href,
      }));

      return {
        id,
        title,
        description: description || undefined,
        imageUrl: card.imageUrl || card.image || card.img,
        buttons: cardButtons.length > 0 ? cardButtons : undefined,
      };
    });

    // Create UI state
    const uiState: NodeUIState.Cards = {
      type: 'cards',
      nodeId,
      question: question || undefined,
      cards,
      variableName,
    };

    return NodeResult.displayUI(uiState);
  }

  async handleResponse(
    response: any,
    node: Record<string, any>,
    state: ChatState
  ): Promise<NodeResult> {
    const data = this.getNodeData(node);
    const nodeId = this.getNodeId(node);

    const variableName = this.getString(data || {}, 'variableName') ||
                         this.getString(data || {}, 'variable') ||
                         'cardSelection';

    if (!response) {
      return NodeResult.error('Please select a card', true);
    }

    // Parse response - could be card id, button id, or complex object
    let selectedValue: any;
    let selectedLabel: string;
    let nextNodeId: string | null = null;

    if (typeof response === 'object') {
      selectedValue = response.value ?? response.id;
      selectedLabel = response.label || response.title || String(selectedValue);
      nextNodeId = response.nextNodeId;
    } else {
      selectedValue = response;
      selectedLabel = String(response);
    }

    // Store answer
    state.setAnswer(nodeId, variableName, selectedValue, nodeId);
    state.addUserMessage(selectedLabel, nodeId);

    if (nextNodeId) {
      return NodeResult.jumpTo(nextNodeId, { [variableName]: selectedValue });
    }

    return this.proceed(node, { [variableName]: selectedValue });
  }
}

// ========================================
// CAROUSEL HANDLER
// ========================================

/**
 * Handles 'carousel' nodes - displays a horizontal carousel of cards
 */
export class CarouselHandler extends BaseNodeHandler {
  readonly nodeType = 'carousel-node';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Carousel node has no data');
    }

    const nodeId = this.getNodeId(node);

    // Get variable name
    const variableName = this.getString(data, 'variableName') ||
                         this.getString(data, 'variable') ||
                         'carouselSelection';

    // Get cards array
    const cardsData = this.getArray<any>(data, 'cards', []) ||
                      this.getArray<any>(data, 'items', []) ||
                      this.getArray<any>(data, 'slides', []);

    if (cardsData.length === 0) {
      return this.createError('Carousel node has no cards');
    }

    // Map cards
    const cards: NodeUIState.Carousel['cards'] = cardsData.map((card: any, index: number) => {
      const id = card.id || card._id || `slide_${index}`;
      let title = card.title || card.name || `Slide ${index + 1}`;
      title = this.resolveText(title, state);

      let description = card.description || card.subtitle || '';
      description = description ? this.resolveText(description, state) : '';

      const cardButtons = this.getArray<any>(card, 'buttons', []).map((btn: any, btnIndex: number) => ({
        id: btn.id || `${id}_btn_${btnIndex}`,
        label: this.resolveText(btn.label || btn.text || 'Select', state),
        value: btn.value,
        url: btn.url || btn.href,
      }));

      return {
        id,
        title,
        description: description || undefined,
        imageUrl: card.imageUrl || card.image || card.img,
        buttons: cardButtons.length > 0 ? cardButtons : undefined,
      };
    });

    // Add to transcript
    state.addBotMessage('[Carousel]', nodeId, this.nodeType);

    // Create UI state
    const uiState: NodeUIState.Carousel = {
      type: 'carousel',
      nodeId,
      cards,
      variableName,
    };

    return NodeResult.displayUI(uiState);
  }

  async handleResponse(
    response: any,
    node: Record<string, any>,
    state: ChatState
  ): Promise<NodeResult> {
    const data = this.getNodeData(node);
    const nodeId = this.getNodeId(node);

    const variableName = this.getString(data || {}, 'variableName') ||
                         this.getString(data || {}, 'variable') ||
                         'carouselSelection';

    if (!response) {
      return NodeResult.error('Please make a selection', true);
    }

    let selectedValue: any;
    let selectedLabel: string;

    if (typeof response === 'object') {
      selectedValue = response.value ?? response.id;
      selectedLabel = response.label || response.title || String(selectedValue);
    } else {
      selectedValue = response;
      selectedLabel = String(response);
    }

    state.setAnswer(nodeId, variableName, selectedValue, nodeId);
    state.addUserMessage(selectedLabel, nodeId);

    return this.proceed(node, { [variableName]: selectedValue });
  }
}

// ========================================
// PICTURE CHOICE HANDLER
// ========================================

/**
 * Handles 'picturechoice' nodes - displays image-based choices
 */
export class PictureChoiceHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.IMAGE_CHOICE;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Picture Choice node has no data');
    }

    const nodeId = this.getNodeId(node);

    // Get question
    let question = this.getString(data, 'question') ||
                   this.getString(data, 'text') ||
                   'Select an image';

    question = this.resolveText(question, state);

    // Get variable name
    const variableName = this.getString(data, 'variableName') ||
                         this.getString(data, 'variable') ||
                         'pictureChoice';

    // Get choices
    const choicesData = this.getArray<any>(data, 'choices', []) ||
                        this.getArray<any>(data, 'options', []) ||
                        this.getArray<any>(data, 'images', []);

    if (choicesData.length === 0) {
      return this.createError('Picture Choice node has no choices');
    }

    // Map choices
    const choices: NodeUIState.PictureChoice['choices'] = choicesData.map((choice: any, index: number) => {
      const id = choice.id || choice._id || `pic_${index}`;
      const imageUrl = choice.imageUrl || choice.image || choice.src || choice.url || '';
      let label = choice.label || choice.text || choice.title || '';
      label = label ? this.resolveText(label, state) : '';

      return {
        id,
        imageUrl,
        label: label || undefined,
        value: choice.value ?? choice.label ?? id,
      };
    });

    // Options
    const multiSelect = this.getBoolean(data, 'multiSelect') ||
                        this.getBoolean(data, 'multiple', false);
    const columns = this.getNumber(data, 'columns', 2);

    // Add to transcript
    state.addBotMessage(question, nodeId, this.nodeType);

    // Create UI state
    const uiState: NodeUIState.PictureChoice = {
      type: 'pictureChoice',
      nodeId,
      question,
      choices,
      variableName,
      multiSelect,
      columns,
    };

    return NodeResult.displayUI(uiState);
  }

  async handleResponse(
    response: any,
    node: Record<string, any>,
    state: ChatState
  ): Promise<NodeResult> {
    const data = this.getNodeData(node);
    const nodeId = this.getNodeId(node);

    const variableName = this.getString(data || {}, 'variableName') ||
                         this.getString(data || {}, 'variable') ||
                         'pictureChoice';

    if (!response) {
      return NodeResult.error('Please select an image', true);
    }

    // Handle multi-select
    const selectedIds = Array.isArray(response) ? response : [response];
    const choicesData = this.getArray<any>(data || {}, 'choices', []) ||
                        this.getArray<any>(data || {}, 'options', []);

    const selectedChoices = choicesData.filter((c: any) =>
      selectedIds.includes(c.id) ||
      selectedIds.includes(c.value) ||
      selectedIds.includes(c.label)
    );

    const values = selectedChoices.map((c: any) => c.value ?? c.label ?? c.id);
    const labels = selectedChoices.map((c: any) => c.label || c.id);
    const finalValue = Array.isArray(response) ? values : values[0];

    state.setAnswer(nodeId, variableName, finalValue, nodeId);
    state.addUserMessage(labels.join(', ') || '[Image selected]', nodeId);

    // Check for specific routing
    const firstChoice = selectedChoices[0];
    if (firstChoice?.nextNodeId) {
      return NodeResult.jumpTo(firstChoice.nextNodeId, { [variableName]: finalValue });
    }

    return this.proceed(node, { [variableName]: finalValue });
  }
}

// ========================================
// DROPDOWN HANDLER
// ========================================

/**
 * Handles 'dropdown' nodes - displays dropdown selection
 */
export class DropdownHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.N_SELECT_OPTION;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Dropdown node has no data');
    }

    const nodeId = this.getNodeId(node);

    // Get question
    let question = this.getString(data, 'question') ||
                   this.getString(data, 'text') ||
                   this.getString(data, 'label') ||
                   'Please select an option';

    question = this.resolveText(question, state);

    // Get variable name
    const variableName = this.getString(data, 'variableName') ||
                         this.getString(data, 'variable') ||
                         'dropdown';

    // Get options
    const optionsData = this.getArray<any>(data, 'options', []) ||
                        this.getArray<any>(data, 'choices', []) ||
                        this.getArray<any>(data, 'items', []);

    if (optionsData.length === 0) {
      return this.createError('Dropdown node has no options');
    }

    // Map options
    const options: NodeUIState.Dropdown['options'] = optionsData.map((opt: any, index: number) => {
      const id = opt.id || opt._id || `opt_${index}`;
      let label = opt.label || opt.text || opt.name || `Option ${index + 1}`;
      label = this.resolveText(label, state);

      return {
        id,
        label,
        value: opt.value ?? opt.label ?? label,
      };
    });

    // Options
    let placeholder = this.getString(data, 'placeholder', 'Select an option');
    placeholder = this.resolveText(placeholder, state);

    const searchable = this.getBoolean(data, 'searchable', false);
    const multiSelect = this.getBoolean(data, 'multiSelect') ||
                        this.getBoolean(data, 'multiple', false);

    // Add to transcript
    state.addBotMessage(question, nodeId, this.nodeType);

    // Create UI state
    const uiState: NodeUIState.Dropdown = {
      type: 'dropdown',
      nodeId,
      question,
      options,
      variableName,
      placeholder,
      searchable,
      multiSelect,
    };

    return NodeResult.displayUI(uiState);
  }

  async handleResponse(
    response: any,
    node: Record<string, any>,
    state: ChatState
  ): Promise<NodeResult> {
    const data = this.getNodeData(node);
    const nodeId = this.getNodeId(node);

    const variableName = this.getString(data || {}, 'variableName') ||
                         this.getString(data || {}, 'variable') ||
                         'dropdown';

    if (response === undefined || response === null) {
      const required = this.getBoolean(data || {}, 'required', true);
      if (required) {
        return NodeResult.error('Please select an option', true);
      }
    }

    // Get selected option(s)
    const optionsData = this.getArray<any>(data || {}, 'options', []);
    const selectedIds = Array.isArray(response) ? response : [response];

    const selectedOptions = optionsData.filter((opt: any) =>
      selectedIds.includes(opt.id) ||
      selectedIds.includes(opt.value) ||
      selectedIds.includes(opt.label)
    );

    const values = selectedOptions.length > 0
      ? selectedOptions.map((opt: any) => opt.value ?? opt.label)
      : selectedIds;
    const labels = selectedOptions.length > 0
      ? selectedOptions.map((opt: any) => opt.label)
      : selectedIds.map(String);

    const finalValue = Array.isArray(response) ? values : values[0];

    state.setAnswer(nodeId, variableName, finalValue, nodeId);
    state.addUserMessage(labels.join(', '), nodeId);

    return this.proceed(node, { [variableName]: finalValue });
  }
}

// ========================================
// RATING HANDLER
// ========================================

/**
 * Handles 'rating' nodes - displays star/rating selection
 */
export class RatingHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.RATING_CHOICE;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Rating node has no data');
    }

    const nodeId = this.getNodeId(node);

    // Get question
    let question = this.getString(data, 'question') ||
                   this.getString(data, 'text') ||
                   'How would you rate your experience?';

    question = this.resolveText(question, state);

    // Get variable name
    const variableName = this.getString(data, 'variableName') ||
                         this.getString(data, 'variable') ||
                         'rating';

    // Rating configuration
    const maxRating = this.getNumber(data, 'maxRating') ||
                      this.getNumber(data, 'max') ||
                      this.getNumber(data, 'stars', 5);

    // Style: stars, hearts, thumbs, numbers
    let style: NodeUIState.Rating['style'] = 'stars';
    const styleValue = this.getString(data, 'style') ||
                       this.getString(data, 'type', 'stars');

    if (['stars', 'hearts', 'thumbs', 'numbers'].includes(styleValue)) {
      style = styleValue as NodeUIState.Rating['style'];
    }

    const allowHalf = this.getBoolean(data, 'allowHalf') ||
                      this.getBoolean(data, 'halfRatings', false);

    // Add to transcript
    state.addBotMessage(question, nodeId, this.nodeType);

    // Create UI state
    const uiState: NodeUIState.Rating = {
      type: 'rating',
      nodeId,
      question,
      maxRating,
      variableName,
      style,
      allowHalf,
    };

    return NodeResult.displayUI(uiState);
  }

  async handleResponse(
    response: any,
    node: Record<string, any>,
    state: ChatState
  ): Promise<NodeResult> {
    const data = this.getNodeData(node);
    const nodeId = this.getNodeId(node);

    const variableName = this.getString(data || {}, 'variableName') ||
                         this.getString(data || {}, 'variable') ||
                         'rating';

    if (response === undefined || response === null) {
      const required = this.getBoolean(data || {}, 'required', true);
      if (required) {
        return NodeResult.error('Please provide a rating', true);
      }
    }

    // Parse and validate rating
    const rating = parseFloat(String(response));
    const maxRating = this.getNumber(data || {}, 'maxRating') ||
                      this.getNumber(data || {}, 'max', 5);

    if (isNaN(rating) || rating < 0 || rating > maxRating) {
      return NodeResult.error(`Please select a rating between 0 and ${maxRating}`, true);
    }

    state.setAnswer(nodeId, variableName, rating, nodeId);
    state.addUserMessage(`${rating} / ${maxRating}`, nodeId);

    return this.proceed(node, { [variableName]: rating });
  }
}

// ========================================
// OPINION SCALE HANDLER
// ========================================

/**
 * Handles 'opinionscale' nodes - displays numeric scale selection
 */
export class OpinionScaleHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.OPINION_SCALE_CHOICE;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Opinion Scale node has no data');
    }

    const nodeId = this.getNodeId(node);

    // Get question
    let question = this.getString(data, 'question') ||
                   this.getString(data, 'text') ||
                   'How likely are you to recommend us?';

    question = this.resolveText(question, state);

    // Get variable name
    const variableName = this.getString(data, 'variableName') ||
                         this.getString(data, 'variable') ||
                         'opinionScale';

    // Scale configuration
    const min = this.getNumber(data, 'min', 0);
    const max = this.getNumber(data, 'max', 10);

    // Labels
    let minLabel = this.getString(data, 'minLabel') ||
                   this.getString(data, 'leftLabel', '');
    let maxLabel = this.getString(data, 'maxLabel') ||
                   this.getString(data, 'rightLabel', '');

    minLabel = minLabel ? this.resolveText(minLabel, state) : '';
    maxLabel = maxLabel ? this.resolveText(maxLabel, state) : '';

    const showNumbers = this.getBoolean(data, 'showNumbers', true);

    // Add to transcript
    state.addBotMessage(question, nodeId, this.nodeType);

    // Create UI state
    const uiState: NodeUIState.OpinionScale = {
      type: 'opinionScale',
      nodeId,
      question,
      min,
      max,
      minLabel: minLabel || undefined,
      maxLabel: maxLabel || undefined,
      variableName,
      showNumbers,
    };

    return NodeResult.displayUI(uiState);
  }

  async handleResponse(
    response: any,
    node: Record<string, any>,
    state: ChatState
  ): Promise<NodeResult> {
    const data = this.getNodeData(node);
    const nodeId = this.getNodeId(node);

    const variableName = this.getString(data || {}, 'variableName') ||
                         this.getString(data || {}, 'variable') ||
                         'opinionScale';

    if (response === undefined || response === null) {
      const required = this.getBoolean(data || {}, 'required', true);
      if (required) {
        return NodeResult.error('Please select a value', true);
      }
    }

    // Parse and validate
    const value = parseInt(String(response), 10);
    const min = this.getNumber(data || {}, 'min', 0);
    const max = this.getNumber(data || {}, 'max', 10);

    if (isNaN(value) || value < min || value > max) {
      return NodeResult.error(`Please select a value between ${min} and ${max}`, true);
    }

    state.setAnswer(nodeId, variableName, value, nodeId);
    state.addUserMessage(String(value), nodeId);

    return this.proceed(node, { [variableName]: value });
  }
}

// ========================================
// YES OR NO CHOICE HANDLER
// ========================================

/**
 * Handles 'yes-or-no-choice-node' - binary yes/no choice with 2-port routing
 */
export class YesOrNoChoiceHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.YES_OR_NO_CHOICE;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Yes/No Choice node has no data');
    }

    const nodeId = this.getNodeId(node);

    const variableName = this.getString(data, 'answerVariable') ||
                         this.getString(data, 'variableName') ||
                         this.getString(data, 'variable') ||
                         nodeId;

    // Support custom options or default Yes/No
    const optionsData = this.getArray<any>(data, 'options', []);

    let buttons: NodeUIState.Buttons['buttons'];

    if (optionsData.length > 0) {
      buttons = optionsData.map((opt: any) => ({
        id: opt.id || opt.value || '',
        label: opt.label || opt.text || '',
        value: opt.label || opt.text || opt.id || '',
        style: 'primary' as const,
      }));
    } else {
      buttons = [
        { id: 'yes', label: 'Yes', value: 'Yes', style: 'primary' },
        { id: 'no', label: 'No', value: 'No', style: 'primary' },
      ];
    }

    state.addBotMessage('[Yes/No Choice]', nodeId, this.nodeType);

    const uiState: NodeUIState.Buttons = {
      type: 'buttons',
      nodeId,
      question: '',
      buttons,
      variableName,
      multiSelect: false,
    };

    return NodeResult.displayUI(uiState);
  }

  async handleResponse(
    response: any,
    node: Record<string, any>,
    state: ChatState
  ): Promise<NodeResult> {
    const data = this.getNodeData(node);
    const nodeId = this.getNodeId(node);

    const variableName = this.getString(data || {}, 'answerVariable') ||
                         this.getString(data || {}, 'variableName') ||
                         this.getString(data || {}, 'variable') ||
                         nodeId;

    let optionId: string;
    let label: string;

    if (typeof response === 'object' && response !== null) {
      optionId = response.id || '';
      label = response.text || response.label || optionId;
    } else {
      optionId = String(response);
      label = optionId;
    }

    state.setAnswer(nodeId, variableName, label, nodeId);
    state.addUserMessage(label, nodeId);

    // Port-based routing: source-yes / source-no or source-{id}
    const targetPort = `source-${optionId}`;

    return NodeResult.delayedProceed(null, 600, {
      [variableName]: label,
      __targetPort: targetPort,
    });
  }
}

// ========================================
// N CHECK OPTIONS HANDLER
// ========================================

/**
 * Handles 'n-check-options-node' - multi-checkbox selection, returns comma-separated values
 */
export class NCheckOptionsHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.N_CHECK_OPTIONS;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('N Check Options node has no data');
    }

    const nodeId = this.getNodeId(node);

    const variableName = this.getString(data, 'answerVariable') ||
                         this.getString(data, 'variableName') ||
                         this.getString(data, 'variable') ||
                         nodeId;

    // Get options array
    const optionsData = this.getArray<any>(data, 'options', []);

    if (optionsData.length === 0) {
      return this.createError('N Check Options node has no options');
    }

    // Map options to button format with multi-select
    const buttons: NodeUIState.Buttons['buttons'] = optionsData.map((opt: any, index: number) => {
      const id = opt.id || String(index);
      const text = opt.optionText || opt.text || opt.label || `Option ${index + 1}`;
      return {
        id,
        label: text,
        value: text,
        style: 'primary' as const,
      };
    });

    state.addBotMessage('[Check Options]', nodeId, this.nodeType);

    const uiState: NodeUIState.Buttons = {
      type: 'buttons',
      nodeId,
      question: '',
      buttons,
      variableName,
      multiSelect: true,
    };

    return NodeResult.displayUI(uiState);
  }

  async handleResponse(
    response: any,
    node: Record<string, any>,
    state: ChatState
  ): Promise<NodeResult> {
    const data = this.getNodeData(node);
    const nodeId = this.getNodeId(node);

    const variableName = this.getString(data || {}, 'answerVariable') ||
                         this.getString(data || {}, 'variableName') ||
                         this.getString(data || {}, 'variable') ||
                         nodeId;

    // Response should be list of selected options
    let selectedOptions: string[];
    if (Array.isArray(response)) {
      selectedOptions = response.map(String);
    } else if (typeof response === 'string') {
      selectedOptions = response.split(',').map((s: string) => s.trim());
    } else {
      selectedOptions = [String(response)];
    }

    const combinedText = selectedOptions.join(', ');

    state.setAnswer(nodeId, variableName, combinedText, nodeId);
    state.addUserMessage(combinedText, nodeId);

    return this.proceed(node, {
      [variableName]: combinedText,
    });
  }
}

// ========================================
// CHOICE HANDLER COLLECTION
// ========================================

/**
 * Array of all choice node handlers
 */
export const choiceHandlers: NodeHandler[] = [
  new ButtonsHandler(),
  new CardsHandler(),
  new CarouselHandler(),
  new PictureChoiceHandler(),
  new DropdownHandler(),
  new RatingHandler(),
  new OpinionScaleHandler(),
  new YesOrNoChoiceHandler(),
  new NCheckOptionsHandler(),
];

/**
 * Registers all choice node handlers with the registry
 */
export function registerChoiceHandlers(registry: NodeHandlerRegistry): void {
  registry.registerAll(choiceHandlers);
}

export default choiceHandlers;
