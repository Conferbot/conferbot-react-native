/**
 * LegacyNodeHandlers.ts
 *
 * Legacy Node Handlers for the Conferbot React Native SDK.
 * Handles older node types that are still supported for backwards compatibility:
 * user-input-node, user-range-node, quiz-node.
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

// ========================================
// USER INPUT NODE HANDLER
// ========================================

/**
 * Handles 'user-input-node' - legacy text input node
 * This is the older version of ask-* nodes with more flexible configuration
 */
export class UserInputNodeHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.USER_INPUT_NODE;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('User Input node has no data');
    }

    const nodeId = this.getNodeId(node);

    // Get question/prompt text
    let question = this.getString(data, 'question') ||
                   this.getString(data, 'prompt') ||
                   this.getString(data, 'text') ||
                   this.getString(data, 'message') ||
                   'Please enter your response';

    question = this.resolveText(question, state);

    // Get variable name
    const variableName = this.getString(data, 'variableName') ||
                         this.getString(data, 'variable') ||
                         this.getString(data, 'name') ||
                         'userInput';

    // Determine input type from configuration
    let inputType: NodeUIState.TextInput['inputType'] = 'text';
    const inputTypeValue = this.getString(data, 'inputType') ||
                           this.getString(data, 'type') ||
                           this.getString(data, 'fieldType', 'text');

    const typeMap: Record<string, NodeUIState.TextInput['inputType']> = {
      text: 'text',
      string: 'text',
      email: 'email',
      phone: 'phone',
      tel: 'phone',
      number: 'number',
      numeric: 'number',
      url: 'url',
      link: 'url',
      date: 'date',
      address: 'address',
    };

    if (typeMap[inputTypeValue.toLowerCase()]) {
      inputType = typeMap[inputTypeValue.toLowerCase()];
    }

    // Get placeholder
    let placeholder = this.getString(data, 'placeholder', '');
    placeholder = placeholder ? this.resolveText(placeholder, state) : '';

    // Get error message
    let errorMessage = this.getString(data, 'errorMessage') ||
                       this.getString(data, 'validationMessage', '');
    errorMessage = errorMessage ? this.resolveText(errorMessage, state) : 'Please enter a valid value';

    // Build validation rules
    const validation: NodeUIState.TextInput['validation'] = {
      required: this.getBoolean(data, 'required', true),
    };

    const minLength = this.getNumber(data, 'minLength', 0);
    if (minLength > 0) validation.minLength = minLength;

    const maxLength = this.getNumber(data, 'maxLength', 0);
    if (maxLength > 0) validation.maxLength = maxLength;

    const min = this.getNumber(data, 'min', 0);
    if (data.min !== undefined) validation.min = min;

    const max = this.getNumber(data, 'max', 0);
    if (data.max !== undefined) validation.max = max;

    const pattern = this.getString(data, 'pattern') ||
                    this.getString(data, 'regex', '');
    if (pattern) validation.pattern = pattern;

    // Add to transcript
    state.addBotMessage(question, nodeId, this.nodeType);

    // Create UI state
    const uiState: NodeUIState.TextInput = {
      type: 'textInput',
      nodeId,
      question,
      placeholder,
      variableName,
      inputType,
      validation,
      errorMessage,
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
                         this.getString(data || {}, 'name') ||
                         'userInput';

    // Validate required
    if ((response === undefined || response === null || response === '') &&
        this.getBoolean(data || {}, 'required', true)) {
      return NodeResult.error('This field is required', true);
    }

    // Type-specific validation and processing
    const inputType = this.getString(data || {}, 'inputType') ||
                      this.getString(data || {}, 'type', 'text');

    let processedValue: any = response;
    const validationResult = this.validateAndProcess(response, inputType.toLowerCase(), data || {});

    if (!validationResult.valid) {
      return NodeResult.error(validationResult.message || 'Invalid value', true);
    }

    processedValue = validationResult.value;

    // Store answer
    state.setAnswer(nodeId, variableName, processedValue, nodeId);
    state.addUserMessage(String(processedValue), nodeId);

    // Update user metadata based on variable name or input type
    this.updateMetadata(state, variableName, inputType.toLowerCase(), processedValue);

    return this.proceed(node, { [variableName]: processedValue });
  }

  private validateAndProcess(
    value: any,
    inputType: string,
    data: Record<string, any>
  ): { valid: boolean; value?: any; message?: string } {
    if (value === undefined || value === null || value === '') {
      return { valid: true, value: '' };
    }

    const strValue = String(value).trim();

    switch (inputType) {
      case 'email':
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(strValue)) {
          return { valid: false, message: 'Please enter a valid email address' };
        }
        return { valid: true, value: strValue.toLowerCase() };

      case 'phone':
      case 'tel':
        const phonePattern = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
        if (!phonePattern.test(strValue)) {
          return { valid: false, message: 'Please enter a valid phone number' };
        }
        return { valid: true, value: strValue };

      case 'number':
      case 'numeric':
        const num = parseFloat(strValue);
        if (isNaN(num)) {
          return { valid: false, message: 'Please enter a valid number' };
        }
        if (data.min !== undefined && num < data.min) {
          return { valid: false, message: `Value must be at least ${data.min}` };
        }
        if (data.max !== undefined && num > data.max) {
          return { valid: false, message: `Value must be at most ${data.max}` };
        }
        return { valid: true, value: num };

      case 'url':
      case 'link':
        let url = strValue;
        if (!url.match(/^https?:\/\//i)) {
          url = 'https://' + url;
        }
        const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
        if (!urlPattern.test(url)) {
          return { valid: false, message: 'Please enter a valid URL' };
        }
        return { valid: true, value: url };

      case 'date':
        const date = new Date(strValue);
        if (isNaN(date.getTime())) {
          return { valid: false, message: 'Please enter a valid date' };
        }
        return { valid: true, value: date.toISOString().split('T')[0] };

      default:
        // Check length constraints
        if (data.minLength && strValue.length < data.minLength) {
          return { valid: false, message: `Minimum ${data.minLength} characters required` };
        }
        if (data.maxLength && strValue.length > data.maxLength) {
          return { valid: false, message: `Maximum ${data.maxLength} characters allowed` };
        }
        // Check custom pattern
        if (data.pattern) {
          try {
            const regex = new RegExp(data.pattern);
            if (!regex.test(strValue)) {
              return { valid: false, message: data.errorMessage || 'Invalid format' };
            }
          } catch {
            // Invalid regex
          }
        }
        return { valid: true, value: strValue };
    }
  }

  private updateMetadata(
    state: ChatState,
    variableName: string,
    inputType: string,
    value: any
  ): void {
    const lowerName = variableName.toLowerCase();

    if (inputType === 'email' || lowerName.includes('email')) {
      state.setUserEmail(String(value));
    } else if (inputType === 'phone' || inputType === 'tel' || lowerName.includes('phone')) {
      state.setUserPhone(String(value));
    } else if (lowerName === 'name' || lowerName === 'firstname' || lowerName === 'fullname') {
      state.setUserName(String(value));
    }
  }
}

// ========================================
// USER RANGE NODE HANDLER
// ========================================

/**
 * Handles 'user-range-node' - legacy slider/range input
 */
export class UserRangeNodeHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.USER_RANGE_NODE;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('User Range node has no data');
    }

    const nodeId = this.getNodeId(node);

    // Get question text
    let question = this.getString(data, 'question') ||
                   this.getString(data, 'text') ||
                   this.getString(data, 'message') ||
                   'Please select a value';

    question = this.resolveText(question, state);

    // Get variable name
    const variableName = this.getString(data, 'variableName') ||
                         this.getString(data, 'variable') ||
                         'rangeValue';

    // Range configuration
    const min = this.getNumber(data, 'min', 0);
    const max = this.getNumber(data, 'max', 100);
    const step = this.getNumber(data, 'step', 1);
    const defaultValue = this.getNumber(data, 'defaultValue') ||
                         this.getNumber(data, 'default', Math.floor((min + max) / 2));

    // Labels
    let minLabel = this.getString(data, 'minLabel') ||
                   this.getString(data, 'leftLabel', '');
    let maxLabel = this.getString(data, 'maxLabel') ||
                   this.getString(data, 'rightLabel', '');

    minLabel = minLabel ? this.resolveText(minLabel, state) : '';
    maxLabel = maxLabel ? this.resolveText(maxLabel, state) : '';

    const showValue = this.getBoolean(data, 'showValue', true);

    // Add to transcript
    state.addBotMessage(question, nodeId, this.nodeType);

    // Create UI state (using Slider type)
    const uiState: NodeUIState.Slider = {
      type: 'slider',
      nodeId,
      question,
      min,
      max,
      step,
      defaultValue,
      variableName,
      showValue,
      minLabel: minLabel || undefined,
      maxLabel: maxLabel || undefined,
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
                         'rangeValue';

    // Parse value
    const value = parseFloat(String(response));

    if (isNaN(value)) {
      return NodeResult.error('Please select a valid value', true);
    }

    // Validate range
    const min = this.getNumber(data || {}, 'min', 0);
    const max = this.getNumber(data || {}, 'max', 100);

    if (value < min || value > max) {
      return NodeResult.error(`Please select a value between ${min} and ${max}`, true);
    }

    // Store answer
    state.setAnswer(nodeId, variableName, value, nodeId);
    state.addUserMessage(String(value), nodeId);

    return this.proceed(node, { [variableName]: value });
  }
}

// ========================================
// QUIZ NODE HANDLER
// ========================================

/**
 * Handles 'quiz-node' - displays a quiz question with correct/incorrect feedback
 */
export class QuizNodeHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.QUIZ_NODE;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Quiz node has no data');
    }

    const nodeId = this.getNodeId(node);

    // Get question text
    let question = this.getString(data, 'question') ||
                   this.getString(data, 'text') ||
                   'Quiz question';

    question = this.resolveText(question, state);

    // Get variable name
    const variableName = this.getString(data, 'variableName') ||
                         this.getString(data, 'variable') ||
                         'quizAnswer';

    // Get options
    const optionsData = this.getArray<any>(data, 'options', []) ||
                        this.getArray<any>(data, 'choices', []) ||
                        this.getArray<any>(data, 'answers', []);

    if (optionsData.length === 0) {
      return this.createError('Quiz node has no options');
    }

    // Map options with correct answer flags
    const options: NodeUIState.Quiz['options'] = optionsData.map((opt: any, index: number) => {
      const id = opt.id || opt._id || `opt_${index}`;
      let label = opt.label || opt.text || opt.answer || `Option ${index + 1}`;
      label = this.resolveText(label, state);

      // Determine if this is the correct answer
      const isCorrect = opt.isCorrect === true ||
                        opt.correct === true ||
                        opt.isAnswer === true ||
                        index === this.getNumber(data, 'correctIndex', -1);

      return {
        id,
        label,
        isCorrect,
      };
    });

    // Show correct answer after selection?
    const showCorrectAnswer = this.getBoolean(data, 'showCorrectAnswer') ||
                              this.getBoolean(data, 'showAnswer', true);

    // Feedback messages
    let correctFeedback = this.getString(data, 'correctFeedback') ||
                          this.getString(data, 'correctMessage', '');
    let incorrectFeedback = this.getString(data, 'incorrectFeedback') ||
                            this.getString(data, 'incorrectMessage', '');

    correctFeedback = correctFeedback ? this.resolveText(correctFeedback, state) : 'Correct!';
    incorrectFeedback = incorrectFeedback ? this.resolveText(incorrectFeedback, state) : 'Incorrect.';

    // Add to transcript
    state.addBotMessage(question, nodeId, this.nodeType);

    // Create UI state
    const uiState: NodeUIState.Quiz = {
      type: 'quiz',
      nodeId,
      question,
      options,
      variableName,
      showCorrectAnswer,
      feedback: {
        correct: correctFeedback,
        incorrect: incorrectFeedback,
      },
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
                         'quizAnswer';

    if (!response) {
      return NodeResult.error('Please select an answer', true);
    }

    // Get options to find the selected one
    const optionsData = this.getArray<any>(data || {}, 'options', []) ||
                        this.getArray<any>(data || {}, 'choices', []);

    const selectedOption = optionsData.find((opt: any) =>
      opt.id === response ||
      opt._id === response ||
      opt.label === response ||
      opt.text === response
    );

    // Determine if answer is correct
    const isCorrect = selectedOption?.isCorrect === true ||
                      selectedOption?.correct === true ||
                      response === optionsData.findIndex((opt: any) =>
                        opt.isCorrect === true || opt.correct === true
                      );

    const selectedLabel = selectedOption?.label || selectedOption?.text || String(response);

    // Store answer with correctness info
    const answerData = {
      selected: response,
      label: selectedLabel,
      isCorrect,
    };

    state.setAnswer(nodeId, variableName, answerData, nodeId);
    state.addUserMessage(selectedLabel, nodeId);

    // Store correctness as separate variable
    state.setVariable(`${variableName}_correct`, isCorrect);

    // Track quiz score
    const currentScore = state.getVariable('_quizScore') || 0;
    const currentTotal = state.getVariable('_quizTotal') || 0;
    state.setVariable('_quizScore', isCorrect ? currentScore + 1 : currentScore);
    state.setVariable('_quizTotal', currentTotal + 1);

    // Check for conditional routing based on correct/incorrect
    const correctNextNodeId = this.getString(data || {}, 'correctNextNodeId') ||
                              this.getString(data || {}, 'correctPath', '');
    const incorrectNextNodeId = this.getString(data || {}, 'incorrectNextNodeId') ||
                                this.getString(data || {}, 'incorrectPath', '');

    if (isCorrect && correctNextNodeId) {
      return NodeResult.jumpTo(correctNextNodeId, { [variableName]: answerData, isCorrect });
    }

    if (!isCorrect && incorrectNextNodeId) {
      return NodeResult.jumpTo(incorrectNextNodeId, { [variableName]: answerData, isCorrect });
    }

    // Check for port-based routing
    const portName = isCorrect ? 'correct' : 'incorrect';
    const portNextNodeId = this.getNextNodeId(node, portName);
    if (portNextNodeId && portNextNodeId.startsWith('__port:')) {
      return NodeResult.proceed(portNextNodeId, { [variableName]: answerData, isCorrect });
    }

    return this.proceed(node, { [variableName]: answerData, isCorrect });
  }
}

// ========================================
// LEGACY HANDLER COLLECTION
// ========================================

/**
 * Array of all legacy node handlers
 */
export const legacyHandlers: NodeHandler[] = [
  new UserInputNodeHandler(),
  new UserRangeNodeHandler(),
  new QuizNodeHandler(),
];

/**
 * Registers all legacy node handlers with the registry
 */
export function registerLegacyHandlers(registry: NodeHandlerRegistry): void {
  registry.registerAll(legacyHandlers);
}

export default legacyHandlers;
