/**
 * AdvancedInputHandlers.ts
 *
 * Advanced Input Node Handlers for the Conferbot React Native SDK.
 * Handles complex input nodes: calendar, multiple questions.
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
// CALENDAR HANDLER
// ========================================

/**
 * Handles 'calendar' nodes - date/time picker with optional time slots
 */
export class CalendarHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.CALENDAR;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Calendar node has no data');
    }

    const nodeId = this.getNodeId(node);

    // Get question
    let question = this.getString(data, 'question') ||
                   this.getString(data, 'text') ||
                   this.getString(data, 'message') ||
                   'Please select a date';

    question = this.resolveText(question, state);

    // Get variable name
    const variableName = this.getString(data, 'variableName') ||
                         this.getString(data, 'variable') ||
                         'selectedDate';

    // Mode: date, time, datetime, dateRange
    let mode: NodeUIState.Calendar['mode'] = 'date';
    const modeValue = this.getString(data, 'mode') ||
                      this.getString(data, 'type', 'date');

    if (['date', 'time', 'datetime', 'dateRange'].includes(modeValue)) {
      mode = modeValue as NodeUIState.Calendar['mode'];
    }

    // Date constraints
    const minDate = this.getString(data, 'minDate', '');
    const maxDate = this.getString(data, 'maxDate', '');

    // Time slots (for appointment scheduling)
    const availableSlots = this.getArray<any>(data, 'availableSlots', []);
    const showTimeSlots = this.getBoolean(data, 'showTimeSlots') ||
                          availableSlots.length > 0;

    // Process available slots
    const processedSlots: NodeUIState.Calendar['availableSlots'] = availableSlots.map((slot: any) => ({
      date: slot.date || slot.day,
      times: Array.isArray(slot.times) ? slot.times : (slot.time ? [slot.time] : []),
    }));

    // Add to transcript
    state.addBotMessage(question, nodeId, this.nodeType);

    // Create UI state
    const uiState: NodeUIState.Calendar = {
      type: 'calendar',
      nodeId,
      question,
      variableName,
      mode,
      minDate: minDate || undefined,
      maxDate: maxDate || undefined,
      availableSlots: processedSlots.length > 0 ? processedSlots : undefined,
      showTimeSlots,
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
                         'selectedDate';

    if (!response) {
      const required = this.getBoolean(data || {}, 'required', true);
      if (required) {
        return NodeResult.error('Please select a date', true);
      }
    }

    // Parse and validate the response
    let dateValue: any;
    let displayText: string;

    if (typeof response === 'object') {
      // Could be { date, time } or { startDate, endDate } for ranges
      if (response.startDate && response.endDate) {
        dateValue = {
          startDate: response.startDate,
          endDate: response.endDate,
        };
        displayText = `${this.formatDate(response.startDate)} - ${this.formatDate(response.endDate)}`;
      } else {
        dateValue = {
          date: response.date || response.selectedDate,
          time: response.time || response.selectedTime,
        };
        displayText = response.time
          ? `${this.formatDate(response.date)} at ${response.time}`
          : this.formatDate(response.date);
      }
    } else {
      // Simple date string
      dateValue = response;
      displayText = this.formatDate(response);
    }

    // Validate date constraints
    const minDate = this.getString(data || {}, 'minDate', '');
    const maxDate = this.getString(data || {}, 'maxDate', '');

    const dateToCheck = typeof dateValue === 'object'
      ? (dateValue.date || dateValue.startDate)
      : dateValue;

    if (minDate && dateToCheck) {
      const min = new Date(minDate);
      const selected = new Date(dateToCheck);
      if (!isNaN(min.getTime()) && !isNaN(selected.getTime()) && selected < min) {
        return NodeResult.error(`Please select a date on or after ${minDate}`, true);
      }
    }

    if (maxDate && dateToCheck) {
      const max = new Date(maxDate);
      const selected = new Date(dateToCheck);
      if (!isNaN(max.getTime()) && !isNaN(selected.getTime()) && selected > max) {
        return NodeResult.error(`Please select a date on or before ${maxDate}`, true);
      }
    }

    state.setAnswer(nodeId, variableName, dateValue, nodeId);
    state.addUserMessage(displayText, nodeId);

    return this.proceed(node, { [variableName]: dateValue });
  }

  /**
   * Formats a date for display
   */
  private formatDate(dateStr: any): string {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return String(dateStr);
      return date.toLocaleDateString();
    } catch {
      return String(dateStr);
    }
  }
}

// ========================================
// MULTIPLE QUESTIONS HANDLER
// ========================================

/**
 * Question definition for multiple questions form
 */
interface FormQuestion {
  id: string;
  question: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'date' | 'select' | 'multiselect';
  variableName: string;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: any }>;
  validation?: Record<string, any>;
}

/**
 * Handles 'multiplequestions' nodes - multi-field form
 */
export class MultipleQuestionsHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.MULTIPLE_QUESTIONS;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Multiple Questions node has no data');
    }

    const nodeId = this.getNodeId(node);

    // Get form title
    let title = this.getString(data, 'title') ||
                this.getString(data, 'heading', '');

    title = title ? this.resolveText(title, state) : '';

    // Get questions array
    const questionsData = this.getArray<any>(data, 'questions', []) ||
                          this.getArray<any>(data, 'fields', []) ||
                          this.getArray<any>(data, 'inputs', []);

    if (questionsData.length === 0) {
      return this.createError('Multiple Questions node has no questions');
    }

    // Map questions to standard format
    const questions: NodeUIState.MultipleQuestions['questions'] = questionsData.map((q: any, index: number) => {
      const id = q.id || q._id || `field_${index}`;
      let questionText = q.question || q.label || q.text || `Field ${index + 1}`;
      questionText = this.resolveText(questionText, state);

      // Determine field type
      let fieldType: FormQuestion['type'] = 'text';
      const typeValue = (q.type || q.inputType || 'text').toLowerCase();

      const typeMap: Record<string, FormQuestion['type']> = {
        text: 'text',
        string: 'text',
        email: 'email',
        phone: 'phone',
        tel: 'phone',
        number: 'number',
        numeric: 'number',
        date: 'date',
        select: 'select',
        dropdown: 'select',
        multiselect: 'multiselect',
        multi: 'multiselect',
      };

      if (typeMap[typeValue]) {
        fieldType = typeMap[typeValue];
      }

      // Get variable name
      const variableName = q.variableName || q.variable || q.name || id;

      // Get placeholder
      let placeholder = q.placeholder || '';
      placeholder = placeholder ? this.resolveText(placeholder, state) : '';

      // Get options for select/multiselect
      let options: Array<{ label: string; value: any }> | undefined;
      if (fieldType === 'select' || fieldType === 'multiselect') {
        const optionsData = q.options || q.choices || [];
        options = optionsData.map((opt: any, optIndex: number) => {
          if (typeof opt === 'string') {
            return { label: opt, value: opt };
          }
          return {
            label: this.resolveText(opt.label || opt.text || `Option ${optIndex + 1}`, state),
            value: opt.value ?? opt.label,
          };
        });
      }

      // Build validation
      const validation: Record<string, any> = {};
      if (q.minLength) validation.minLength = q.minLength;
      if (q.maxLength) validation.maxLength = q.maxLength;
      if (q.min) validation.min = q.min;
      if (q.max) validation.max = q.max;
      if (q.pattern) validation.pattern = q.pattern;

      return {
        id,
        question: questionText,
        type: fieldType,
        variableName,
        required: q.required !== false,
        placeholder: placeholder || undefined,
        options,
        validation: Object.keys(validation).length > 0 ? validation : undefined,
      };
    });

    // Submit button label
    let submitLabel = this.getString(data, 'submitLabel') ||
                      this.getString(data, 'buttonText') ||
                      'Submit';
    submitLabel = this.resolveText(submitLabel, state);

    // Add to transcript
    const transcriptText = title || 'Please fill out the following form:';
    state.addBotMessage(transcriptText, nodeId, this.nodeType);

    // Create UI state
    const uiState: NodeUIState.MultipleQuestions = {
      type: 'multipleQuestions',
      nodeId,
      title: title || undefined,
      questions,
      submitLabel,
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

    if (!response || typeof response !== 'object') {
      return NodeResult.error('Please fill out all required fields', true);
    }

    // Get questions for validation
    const questionsData = this.getArray<any>(data || {}, 'questions', []) ||
                          this.getArray<any>(data || {}, 'fields', []);

    // Validate each required field
    for (const q of questionsData) {
      const variableName = q.variableName || q.variable || q.name || q.id;
      const value = response[variableName];
      const isRequired = q.required !== false;

      if (isRequired && (value === undefined || value === null || value === '')) {
        const label = q.question || q.label || variableName;
        return NodeResult.error(`Please fill out: ${label}`, true);
      }

      // Type-specific validation
      if (value !== undefined && value !== null && value !== '') {
        const validation = this.validateFieldValue(value, q);
        if (!validation.valid) {
          return NodeResult.error(validation.message || 'Invalid value', true);
        }
      }
    }

    // Store all answers
    const storedData: Record<string, any> = {};

    for (const q of questionsData) {
      const variableName = q.variableName || q.variable || q.name || q.id;
      const value = response[variableName];

      if (value !== undefined) {
        state.setAnswer(nodeId, variableName, value, nodeId);
        storedData[variableName] = value;

        // Update user metadata for known fields
        this.updateUserMetadata(state, variableName, value);
      }
    }

    // Add to transcript (summarized)
    const fieldCount = Object.keys(storedData).length;
    state.addUserMessage(`[Form submitted: ${fieldCount} field(s)]`, nodeId);

    return this.proceed(node, storedData);
  }

  /**
   * Validates a field value based on its type
   */
  private validateFieldValue(
    value: any,
    question: any
  ): { valid: boolean; message?: string } {
    const type = (question.type || 'text').toLowerCase();

    switch (type) {
      case 'email':
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(String(value))) {
          return { valid: false, message: 'Please enter a valid email address' };
        }
        break;

      case 'phone':
        const phonePattern = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
        if (!phonePattern.test(String(value))) {
          return { valid: false, message: 'Please enter a valid phone number' };
        }
        break;

      case 'number':
        const num = parseFloat(String(value));
        if (isNaN(num)) {
          return { valid: false, message: 'Please enter a valid number' };
        }
        if (question.min !== undefined && num < question.min) {
          return { valid: false, message: `Value must be at least ${question.min}` };
        }
        if (question.max !== undefined && num > question.max) {
          return { valid: false, message: `Value must be at most ${question.max}` };
        }
        break;

      case 'date':
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return { valid: false, message: 'Please enter a valid date' };
        }
        break;
    }

    // Check string length constraints
    if (question.minLength && String(value).length < question.minLength) {
      return { valid: false, message: `Minimum ${question.minLength} characters required` };
    }
    if (question.maxLength && String(value).length > question.maxLength) {
      return { valid: false, message: `Maximum ${question.maxLength} characters allowed` };
    }

    // Custom pattern
    if (question.pattern) {
      try {
        const regex = new RegExp(question.pattern);
        if (!regex.test(String(value))) {
          return { valid: false, message: 'Invalid format' };
        }
      } catch {
        // Invalid regex, skip
      }
    }

    return { valid: true };
  }

  /**
   * Updates user metadata for known field types
   */
  private updateUserMetadata(state: ChatState, variableName: string, value: any): void {
    const lowerName = variableName.toLowerCase();

    if (lowerName.includes('name') && !lowerName.includes('last') && !lowerName.includes('company')) {
      state.setUserName(String(value));
    } else if (lowerName.includes('email')) {
      state.setUserEmail(String(value));
    } else if (lowerName.includes('phone') || lowerName.includes('tel') || lowerName.includes('mobile')) {
      state.setUserPhone(String(value));
    }
  }
}

// ========================================
// ADVANCED INPUT HANDLER COLLECTION
// ========================================

/**
 * Array of all advanced input node handlers
 */
export const advancedInputHandlers: NodeHandler[] = [
  new CalendarHandler(),
  new MultipleQuestionsHandler(),
];

/**
 * Registers all advanced input node handlers with the registry
 */
export function registerAdvancedInputHandlers(registry: NodeHandlerRegistry): void {
  registry.registerAll(advancedInputHandlers);
}

export default advancedInputHandlers;
