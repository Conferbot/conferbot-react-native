/**
 * AskNodeHandlers.ts
 *
 * Ask Question Node Handlers for the Conferbot React Native SDK.
 * Handles all ask-* nodes that collect user input with validation.
 * These nodes require user interaction before proceeding.
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
// VALIDATION PATTERNS
// ========================================

const ValidationPatterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/,
  url: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
  name: /^[a-zA-Z\s'-]{2,100}$/,
  number: /^-?\d*\.?\d+$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
};

// ========================================
// BASE ASK HANDLER
// ========================================

/**
 * Base class for all ask node handlers with common functionality
 */
abstract class BaseAskHandler extends BaseNodeHandler {
  abstract readonly inputType: NodeUIState.TextInput['inputType'];
  abstract readonly validationPattern?: RegExp;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError(`${this.nodeType} node has no data`);
    }

    const nodeId = this.getNodeId(node);

    // Get question text
    let question = this.getString(data, 'question') ||
                   this.getString(data, 'text') ||
                   this.getString(data, 'message') ||
                   this.getDefaultQuestion();

    // Resolve variables in question
    question = this.resolveText(question, state);

    // Get variable name for storing the answer
    const variableName = this.getString(data, 'variableName') ||
                         this.getString(data, 'variable') ||
                         this.getString(data, 'name') ||
                         this.getDefaultVariableName();

    // Get placeholder text
    let placeholder = this.getString(data, 'placeholder', '');
    placeholder = placeholder ? this.resolveText(placeholder, state) : this.getDefaultPlaceholder();

    // Get error message
    let errorMessage = this.getString(data, 'errorMessage') ||
                       this.getString(data, 'validationMessage', '');
    errorMessage = errorMessage ? this.resolveText(errorMessage, state) : this.getDefaultErrorMessage();

    // Build validation rules
    const validation = this.buildValidation(data);

    // Add question to transcript
    state.addBotMessage(question, nodeId, this.nodeType);

    // Create UI state
    const uiState: NodeUIState.TextInput = {
      type: 'textInput',
      nodeId,
      question,
      placeholder,
      variableName,
      inputType: this.inputType,
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

    // Get variable name
    const variableName = this.getString(data || {}, 'variableName') ||
                         this.getString(data || {}, 'variable') ||
                         this.getString(data || {}, 'name') ||
                         this.getDefaultVariableName();

    // Validate response
    const validationResult = this.validateResponse(response, data || {});
    if (!validationResult.valid) {
      return NodeResult.error(
        validationResult.message || this.getDefaultErrorMessage(),
        true
      );
    }

    // Process the response value
    const processedValue = this.processValue(response);

    // Store the answer
    state.setAnswer(nodeId, variableName, processedValue, nodeId);

    // Add user response to transcript
    state.addUserMessage(String(processedValue), nodeId);

    // Update user metadata if applicable
    this.updateUserMetadata(state, processedValue);

    // Proceed to next node
    return this.proceed(node, { [variableName]: processedValue });
  }

  /**
   * Validates the user's response
   */
  protected validateResponse(
    response: any,
    data: Record<string, any>
  ): { valid: boolean; message?: string } {
    // Check if response is empty
    if (response === undefined || response === null || response === '') {
      const required = this.getBoolean(data, 'required', true);
      if (required) {
        return { valid: false, message: 'This field is required' };
      }
      return { valid: true };
    }

    const responseStr = String(response);

    // Check min length
    const minLength = this.getNumber(data, 'minLength', 0);
    if (minLength > 0 && responseStr.length < minLength) {
      return { valid: false, message: `Minimum ${minLength} characters required` };
    }

    // Check max length
    const maxLength = this.getNumber(data, 'maxLength', 0);
    if (maxLength > 0 && responseStr.length > maxLength) {
      return { valid: false, message: `Maximum ${maxLength} characters allowed` };
    }

    // Check pattern
    if (this.validationPattern && !this.validationPattern.test(responseStr)) {
      return { valid: false, message: this.getDefaultErrorMessage() };
    }

    // Custom pattern from node data
    const customPattern = this.getString(data, 'pattern', '');
    if (customPattern) {
      try {
        const regex = new RegExp(customPattern);
        if (!regex.test(responseStr)) {
          return { valid: false, message: this.getDefaultErrorMessage() };
        }
      } catch {
        // Invalid regex, skip validation
      }
    }

    return { valid: true };
  }

  /**
   * Builds validation rules for the UI state
   */
  protected buildValidation(data: Record<string, any>): NodeUIState.TextInput['validation'] {
    const validation: NodeUIState.TextInput['validation'] = {
      required: this.getBoolean(data, 'required', true),
    };

    const minLength = this.getNumber(data, 'minLength', 0);
    if (minLength > 0) validation.minLength = minLength;

    const maxLength = this.getNumber(data, 'maxLength', 0);
    if (maxLength > 0) validation.maxLength = maxLength;

    const min = this.getNumber(data, 'min', 0);
    if (min !== 0) validation.min = min;

    const max = this.getNumber(data, 'max', 0);
    if (max !== 0) validation.max = max;

    if (this.validationPattern) {
      validation.pattern = this.validationPattern.source;
    }

    const customPattern = this.getString(data, 'pattern', '');
    if (customPattern) {
      validation.pattern = customPattern;
    }

    return validation;
  }

  /**
   * Processes the value before storing (can be overridden)
   */
  protected processValue(value: any): any {
    return value;
  }

  /**
   * Updates user metadata if applicable (can be overridden)
   */
  protected updateUserMetadata(state: ChatState, value: any): void {
    // Default: no metadata update
  }

  /**
   * Gets the default question text
   */
  protected abstract getDefaultQuestion(): string;

  /**
   * Gets the default variable name
   */
  protected abstract getDefaultVariableName(): string;

  /**
   * Gets the default placeholder text
   */
  protected abstract getDefaultPlaceholder(): string;

  /**
   * Gets the default error message
   */
  protected abstract getDefaultErrorMessage(): string;
}

// ========================================
// ASK NAME HANDLER
// ========================================

/**
 * Handles 'ask-name' nodes - collects user's name
 */
export class AskNameHandler extends BaseAskHandler {
  readonly nodeType = DisplayNodes.ASK_NAME;
  readonly inputType: NodeUIState.TextInput['inputType'] = 'text';
  readonly validationPattern = ValidationPatterns.name;

  protected getDefaultQuestion(): string {
    return 'What is your name?';
  }

  protected getDefaultVariableName(): string {
    return 'name';
  }

  protected getDefaultPlaceholder(): string {
    return 'Enter your name';
  }

  protected getDefaultErrorMessage(): string {
    return 'Please enter a valid name';
  }

  protected updateUserMetadata(state: ChatState, value: any): void {
    state.setUserName(String(value));
  }
}

// ========================================
// ASK EMAIL HANDLER
// ========================================

/**
 * Handles 'ask-email' nodes - collects user's email
 */
export class AskEmailHandler extends BaseAskHandler {
  readonly nodeType = DisplayNodes.ASK_EMAIL;
  readonly inputType: NodeUIState.TextInput['inputType'] = 'email';
  readonly validationPattern = ValidationPatterns.email;

  protected getDefaultQuestion(): string {
    return 'What is your email address?';
  }

  protected getDefaultVariableName(): string {
    return 'email';
  }

  protected getDefaultPlaceholder(): string {
    return 'Enter your email';
  }

  protected getDefaultErrorMessage(): string {
    return 'Please enter a valid email address';
  }

  protected processValue(value: any): any {
    return String(value).toLowerCase().trim();
  }

  protected updateUserMetadata(state: ChatState, value: any): void {
    state.setUserEmail(String(value));
  }
}

// ========================================
// ASK PHONE HANDLER
// ========================================

/**
 * Handles 'ask-phone' nodes - collects user's phone number
 */
export class AskPhoneHandler extends BaseAskHandler {
  readonly nodeType = DisplayNodes.ASK_PHONE;
  readonly inputType: NodeUIState.TextInput['inputType'] = 'phone';
  readonly validationPattern = ValidationPatterns.phone;

  protected getDefaultQuestion(): string {
    return 'What is your phone number?';
  }

  protected getDefaultVariableName(): string {
    return 'phone';
  }

  protected getDefaultPlaceholder(): string {
    return 'Enter your phone number';
  }

  protected getDefaultErrorMessage(): string {
    return 'Please enter a valid phone number';
  }

  protected processValue(value: any): any {
    // Remove extra spaces but keep formatting
    return String(value).trim();
  }

  protected updateUserMetadata(state: ChatState, value: any): void {
    state.setUserPhone(String(value));
  }
}

// ========================================
// ASK NUMBER HANDLER
// ========================================

/**
 * Handles 'ask-number' nodes - collects a numeric value
 */
export class AskNumberHandler extends BaseAskHandler {
  readonly nodeType = DisplayNodes.ASK_NUMBER;
  readonly inputType: NodeUIState.TextInput['inputType'] = 'number';
  readonly validationPattern = ValidationPatterns.number;

  protected getDefaultQuestion(): string {
    return 'Please enter a number';
  }

  protected getDefaultVariableName(): string {
    return 'number';
  }

  protected getDefaultPlaceholder(): string {
    return 'Enter a number';
  }

  protected getDefaultErrorMessage(): string {
    return 'Please enter a valid number';
  }

  protected validateResponse(
    response: any,
    data: Record<string, any>
  ): { valid: boolean; message?: string } {
    // First run base validation
    const baseResult = super.validateResponse(response, data);
    if (!baseResult.valid) return baseResult;

    if (response === undefined || response === null || response === '') {
      return { valid: true }; // Empty is handled by base
    }

    const num = parseFloat(String(response));
    if (isNaN(num)) {
      return { valid: false, message: 'Please enter a valid number' };
    }

    // Check min value
    const min = this.getNumber(data, 'min', Number.MIN_SAFE_INTEGER);
    if (data.min !== undefined && num < min) {
      return { valid: false, message: `Value must be at least ${min}` };
    }

    // Check max value
    const max = this.getNumber(data, 'max', Number.MAX_SAFE_INTEGER);
    if (data.max !== undefined && num > max) {
      return { valid: false, message: `Value must be at most ${max}` };
    }

    return { valid: true };
  }

  protected processValue(value: any): any {
    const num = parseFloat(String(value));
    return isNaN(num) ? 0 : num;
  }
}

// ========================================
// ASK URL HANDLER
// ========================================

/**
 * Handles 'ask-url' nodes - collects a URL
 */
export class AskUrlHandler extends BaseAskHandler {
  readonly nodeType = DisplayNodes.ASK_URL;
  readonly inputType: NodeUIState.TextInput['inputType'] = 'url';
  readonly validationPattern = ValidationPatterns.url;

  protected getDefaultQuestion(): string {
    return 'Please enter a URL';
  }

  protected getDefaultVariableName(): string {
    return 'url';
  }

  protected getDefaultPlaceholder(): string {
    return 'https://example.com';
  }

  protected getDefaultErrorMessage(): string {
    return 'Please enter a valid URL';
  }

  protected processValue(value: any): any {
    let url = String(value).trim();
    // Add https:// if no protocol specified
    if (url && !url.match(/^https?:\/\//i)) {
      url = 'https://' + url;
    }
    return url;
  }
}

// ========================================
// ASK DATE HANDLER
// ========================================

/**
 * Handles 'ask-date' nodes - collects a date
 */
export class AskDateHandler extends BaseAskHandler {
  readonly nodeType = DisplayNodes.ASK_DATE;
  readonly inputType: NodeUIState.TextInput['inputType'] = 'date';
  readonly validationPattern = ValidationPatterns.date;

  protected getDefaultQuestion(): string {
    return 'Please select a date';
  }

  protected getDefaultVariableName(): string {
    return 'date';
  }

  protected getDefaultPlaceholder(): string {
    return 'Select a date';
  }

  protected getDefaultErrorMessage(): string {
    return 'Please enter a valid date';
  }

  protected validateResponse(
    response: any,
    data: Record<string, any>
  ): { valid: boolean; message?: string } {
    const baseResult = super.validateResponse(response, data);
    if (!baseResult.valid) return baseResult;

    if (response === undefined || response === null || response === '') {
      return { valid: true };
    }

    // Try to parse the date
    const date = new Date(response);
    if (isNaN(date.getTime())) {
      return { valid: false, message: 'Please enter a valid date' };
    }

    // Check min date
    const minDate = this.getString(data, 'minDate', '');
    if (minDate) {
      const min = new Date(minDate);
      if (!isNaN(min.getTime()) && date < min) {
        return { valid: false, message: `Date must be on or after ${minDate}` };
      }
    }

    // Check max date
    const maxDate = this.getString(data, 'maxDate', '');
    if (maxDate) {
      const max = new Date(maxDate);
      if (!isNaN(max.getTime()) && date > max) {
        return { valid: false, message: `Date must be on or before ${maxDate}` };
      }
    }

    return { valid: true };
  }

  protected processValue(value: any): any {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return value;
    }
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  }
}

// ========================================
// ASK ADDRESS HANDLER
// ========================================

/**
 * Handles 'ask-address' nodes - collects an address
 */
export class AskAddressHandler extends BaseAskHandler {
  readonly nodeType = DisplayNodes.ASK_ADDRESS;
  readonly inputType: NodeUIState.TextInput['inputType'] = 'address';
  readonly validationPattern = undefined; // Address has no standard pattern

  protected getDefaultQuestion(): string {
    return 'What is your address?';
  }

  protected getDefaultVariableName(): string {
    return 'address';
  }

  protected getDefaultPlaceholder(): string {
    return 'Enter your address';
  }

  protected getDefaultErrorMessage(): string {
    return 'Please enter a valid address';
  }

  protected validateResponse(
    response: any,
    data: Record<string, any>
  ): { valid: boolean; message?: string } {
    // Base validation
    const baseResult = super.validateResponse(response, data);
    if (!baseResult.valid) return baseResult;

    if (response === undefined || response === null || response === '') {
      return { valid: true };
    }

    // Address should be at least 10 characters
    const minLength = this.getNumber(data, 'minLength', 10);
    if (String(response).length < minLength) {
      return { valid: false, message: 'Please enter a complete address' };
    }

    return { valid: true };
  }
}

// ========================================
// ASK FILE HANDLER
// ========================================

/**
 * Handles 'ask-file' nodes - requests file upload from user
 */
export class AskFileHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.ASK_FILE;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Ask File node has no data');
    }

    const nodeId = this.getNodeId(node);

    // Get question text
    let question = this.getString(data, 'question') ||
                   this.getString(data, 'text') ||
                   this.getString(data, 'message') ||
                   'Please upload a file';

    question = this.resolveText(question, state);

    // Get variable name
    const variableName = this.getString(data, 'variableName') ||
                         this.getString(data, 'variable') ||
                         'file';

    // Get file constraints
    const acceptedTypes = this.getArray<string>(data, 'acceptedTypes', []);
    const accept = this.getString(data, 'accept', '');
    const maxSize = this.getNumber(data, 'maxSize', 10 * 1024 * 1024); // 10MB default
    const multiple = this.getBoolean(data, 'multiple', false);

    // Parse accepted types
    let fileTypes: string[] = acceptedTypes;
    if (accept) {
      fileTypes = accept.split(',').map((t: string) => t.trim());
    }

    // Add to transcript
    state.addBotMessage(question, nodeId, this.nodeType);

    // Create UI state
    const uiState: NodeUIState.FileUpload = {
      type: 'fileUpload',
      nodeId,
      question,
      variableName,
      acceptedTypes: fileTypes.length > 0 ? fileTypes : undefined,
      maxSize,
      multiple,
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
                         'file';

    // Validate file(s) uploaded
    if (!response) {
      const required = this.getBoolean(data || {}, 'required', true);
      if (required) {
        return NodeResult.error('Please upload a file', true);
      }
    }

    // Store file info
    state.setAnswer(nodeId, variableName, response, nodeId);

    // Add to transcript
    const fileInfo = Array.isArray(response)
      ? `[Uploaded ${response.length} file(s)]`
      : `[Uploaded file: ${response?.name || 'file'}]`;
    state.addUserMessage(fileInfo, nodeId);

    return this.proceed(node, { [variableName]: response });
  }
}

// ========================================
// ASK LOCATION HANDLER
// ========================================

/**
 * Handles 'ask-location' nodes - requests location from user
 */
export class AskLocationHandler extends BaseNodeHandler {
  readonly nodeType = DisplayNodes.ASK_LOCATION;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Ask Location node has no data');
    }

    const nodeId = this.getNodeId(node);

    // Get question text
    let question = this.getString(data, 'question') ||
                   this.getString(data, 'text') ||
                   this.getString(data, 'message') ||
                   'Please share your location';

    question = this.resolveText(question, state);

    // Get variable name
    const variableName = this.getString(data, 'variableName') ||
                         this.getString(data, 'variable') ||
                         'location';

    // Get options
    const allowManualEntry = this.getBoolean(data, 'allowManualEntry', true);
    const showMap = this.getBoolean(data, 'showMap', true);

    // Add to transcript
    state.addBotMessage(question, nodeId, this.nodeType);

    // Create UI state
    const uiState: NodeUIState.LocationPicker = {
      type: 'locationPicker',
      nodeId,
      question,
      variableName,
      allowManualEntry,
      showMap,
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
                         'location';

    // Validate location
    if (!response) {
      const required = this.getBoolean(data || {}, 'required', true);
      if (required) {
        return NodeResult.error('Please provide your location', true);
      }
    }

    // Normalize location data
    let locationValue: any;
    if (typeof response === 'string') {
      // Manual text entry
      locationValue = { address: response };
    } else if (response?.latitude !== undefined && response?.longitude !== undefined) {
      // Coordinates
      locationValue = {
        latitude: response.latitude,
        longitude: response.longitude,
        address: response.address,
      };
    } else {
      locationValue = response;
    }

    // Store location
    state.setAnswer(nodeId, variableName, locationValue, nodeId);

    // Add to transcript
    const locationText = locationValue?.address ||
                         (locationValue?.latitude
                           ? `(${locationValue.latitude}, ${locationValue.longitude})`
                           : '[Location shared]');
    state.addUserMessage(locationText, nodeId);

    return this.proceed(node, { [variableName]: locationValue });
  }
}

// ========================================
// ASK HANDLER COLLECTION
// ========================================

/**
 * Array of all ask node handlers
 */
export const askHandlers: NodeHandler[] = [
  new AskNameHandler(),
  new AskEmailHandler(),
  new AskPhoneHandler(),
  new AskNumberHandler(),
  new AskUrlHandler(),
  new AskDateHandler(),
  new AskAddressHandler(),
  new AskFileHandler(),
  new AskLocationHandler(),
];

/**
 * Registers all ask node handlers with the registry
 */
export function registerAskHandlers(registry: NodeHandlerRegistry): void {
  registry.registerAll(askHandlers);
}

export default askHandlers;
