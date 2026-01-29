/**
 * NodeHandler.ts
 *
 * Base interfaces and types for node handlers in the Conferbot React Native SDK.
 * Defines the NodeResult type, NodeUIState, and base handler interface.
 */

import { ChatState } from '../state/ChatState';

// ========================================
// NODE RESULT TYPES
// ========================================

/**
 * Result of processing a node
 */
export type NodeResult =
  | NodeResult.DisplayUI
  | NodeResult.Proceed
  | NodeResult.DelayedProceed
  | NodeResult.JumpTo
  | NodeResult.Error;

export namespace NodeResult {
  /** Display UI to the user */
  export interface DisplayUI {
    type: 'displayUI';
    uiState: NodeUIState;
  }

  /** Proceed to next node */
  export interface Proceed {
    type: 'proceed';
    nextNodeId: string | null;
    data?: Record<string, any>;
  }

  /** Proceed after a delay */
  export interface DelayedProceed {
    type: 'delayedProceed';
    nextNodeId: string | null;
    delayMs: number;
    data?: Record<string, any>;
  }

  /** Jump to a specific node */
  export interface JumpTo {
    type: 'jumpTo';
    targetNodeId: string;
    data?: Record<string, any>;
  }

  /** Error during processing */
  export interface Error {
    type: 'error';
    message: string;
    recoverable: boolean;
    details?: any;
  }

  // Factory functions
  export function displayUI(uiState: NodeUIState): DisplayUI {
    return { type: 'displayUI', uiState };
  }

  export function proceed(nextNodeId: string | null, data?: Record<string, any>): Proceed {
    return { type: 'proceed', nextNodeId, data };
  }

  export function delayedProceed(nextNodeId: string | null, delayMs: number, data?: Record<string, any>): DelayedProceed {
    return { type: 'delayedProceed', nextNodeId, delayMs, data };
  }

  export function jumpTo(targetNodeId: string, data?: Record<string, any>): JumpTo {
    return { type: 'jumpTo', targetNodeId, data };
  }

  export function error(message: string, recoverable: boolean = true, details?: any): Error {
    return { type: 'error', message, recoverable, details };
  }
}

// ========================================
// UI STATE TYPES
// ========================================

/**
 * UI state to be rendered by the chat widget
 */
export type NodeUIState =
  | NodeUIState.Message
  | NodeUIState.Image
  | NodeUIState.Video
  | NodeUIState.Audio
  | NodeUIState.File
  | NodeUIState.HTML
  | NodeUIState.TextInput
  | NodeUIState.Buttons
  | NodeUIState.Cards
  | NodeUIState.Carousel
  | NodeUIState.PictureChoice
  | NodeUIState.Dropdown
  | NodeUIState.Rating
  | NodeUIState.OpinionScale
  | NodeUIState.Calendar
  | NodeUIState.MultipleQuestions
  | NodeUIState.FileUpload
  | NodeUIState.LocationPicker
  | NodeUIState.Slider
  | NodeUIState.Quiz
  | NodeUIState.HumanHandover
  | NodeUIState.GPTResponse
  | NodeUIState.Loading
  | NodeUIState.Custom;

export namespace NodeUIState {
  /** Base properties for all UI states */
  interface BaseUIState {
    nodeId: string;
    typing?: boolean;
  }

  /** Simple text message */
  export interface Message extends BaseUIState {
    type: 'message';
    text: string;
    showAvatar?: boolean;
  }

  /** Image display */
  export interface Image extends BaseUIState {
    type: 'image';
    url: string;
    alt?: string;
    caption?: string;
  }

  /** Video display */
  export interface Video extends BaseUIState {
    type: 'video';
    url: string;
    poster?: string;
    autoplay?: boolean;
  }

  /** Audio display */
  export interface Audio extends BaseUIState {
    type: 'audio';
    url: string;
    autoplay?: boolean;
  }

  /** File download */
  export interface File extends BaseUIState {
    type: 'file';
    url: string;
    filename: string;
    size?: number;
    mimeType?: string;
  }

  /** HTML content */
  export interface HTML extends BaseUIState {
    type: 'html';
    content: string;
  }

  /** Text input field */
  export interface TextInput extends BaseUIState {
    type: 'textInput';
    question: string;
    placeholder?: string;
    variableName: string;
    inputType: 'text' | 'email' | 'phone' | 'number' | 'url' | 'date' | 'address';
    validation?: {
      required?: boolean;
      pattern?: string;
      minLength?: number;
      maxLength?: number;
      min?: number;
      max?: number;
    };
    errorMessage?: string;
  }

  /** Button selection */
  export interface Buttons extends BaseUIState {
    type: 'buttons';
    question: string;
    buttons: Array<{
      id: string;
      label: string;
      value?: any;
      icon?: string;
      style?: 'primary' | 'secondary' | 'outline';
    }>;
    variableName?: string;
    multiSelect?: boolean;
  }

  /** Card selection */
  export interface Cards extends BaseUIState {
    type: 'cards';
    question?: string;
    cards: Array<{
      id: string;
      title: string;
      description?: string;
      imageUrl?: string;
      buttons?: Array<{
        id: string;
        label: string;
        value?: any;
        url?: string;
      }>;
    }>;
    variableName?: string;
  }

  /** Carousel of cards */
  export interface Carousel extends BaseUIState {
    type: 'carousel';
    cards: Array<{
      id: string;
      title: string;
      description?: string;
      imageUrl?: string;
      buttons?: Array<{
        id: string;
        label: string;
        value?: any;
        url?: string;
      }>;
    }>;
    variableName?: string;
  }

  /** Picture choice selection */
  export interface PictureChoice extends BaseUIState {
    type: 'pictureChoice';
    question: string;
    choices: Array<{
      id: string;
      imageUrl: string;
      label?: string;
      value?: any;
    }>;
    variableName?: string;
    multiSelect?: boolean;
    columns?: number;
  }

  /** Dropdown selection */
  export interface Dropdown extends BaseUIState {
    type: 'dropdown';
    question: string;
    options: Array<{
      id: string;
      label: string;
      value?: any;
    }>;
    variableName?: string;
    placeholder?: string;
    searchable?: boolean;
    multiSelect?: boolean;
  }

  /** Rating input */
  export interface Rating extends BaseUIState {
    type: 'rating';
    question: string;
    maxRating: number;
    variableName?: string;
    style: 'stars' | 'hearts' | 'thumbs' | 'numbers';
    allowHalf?: boolean;
  }

  /** Opinion scale */
  export interface OpinionScale extends BaseUIState {
    type: 'opinionScale';
    question: string;
    min: number;
    max: number;
    minLabel?: string;
    maxLabel?: string;
    variableName?: string;
    showNumbers?: boolean;
  }

  /** Calendar date/time picker */
  export interface Calendar extends BaseUIState {
    type: 'calendar';
    question: string;
    variableName?: string;
    mode: 'date' | 'time' | 'datetime' | 'dateRange';
    minDate?: string;
    maxDate?: string;
    availableSlots?: Array<{
      date: string;
      times: string[];
    }>;
    showTimeSlots?: boolean;
  }

  /** Multiple questions form */
  export interface MultipleQuestions extends BaseUIState {
    type: 'multipleQuestions';
    title?: string;
    questions: Array<{
      id: string;
      question: string;
      type: 'text' | 'email' | 'phone' | 'number' | 'date' | 'select' | 'multiselect';
      variableName: string;
      required?: boolean;
      placeholder?: string;
      options?: Array<{ label: string; value: any }>;
      validation?: Record<string, any>;
    }>;
    submitLabel?: string;
  }

  /** File upload */
  export interface FileUpload extends BaseUIState {
    type: 'fileUpload';
    question: string;
    variableName?: string;
    acceptedTypes?: string[];
    maxSize?: number;
    multiple?: boolean;
  }

  /** Location picker */
  export interface LocationPicker extends BaseUIState {
    type: 'locationPicker';
    question: string;
    variableName?: string;
    allowManualEntry?: boolean;
    showMap?: boolean;
  }

  /** Slider/range input */
  export interface Slider extends BaseUIState {
    type: 'slider';
    question: string;
    min: number;
    max: number;
    step?: number;
    defaultValue?: number;
    variableName?: string;
    showValue?: boolean;
    minLabel?: string;
    maxLabel?: string;
  }

  /** Quiz node */
  export interface Quiz extends BaseUIState {
    type: 'quiz';
    question: string;
    options: Array<{
      id: string;
      label: string;
      isCorrect?: boolean;
    }>;
    variableName?: string;
    showCorrectAnswer?: boolean;
    feedback?: {
      correct?: string;
      incorrect?: string;
    };
  }

  /** Human handover state */
  export interface HumanHandover extends BaseUIState {
    type: 'humanHandover';
    stage: 'waiting' | 'connected' | 'ended' | 'noAgents' | 'timeout';
    agentName?: string;
    agentAvatar?: string;
    waitMessage?: string;
    connectedMessage?: string;
    endedMessage?: string;
    noAgentsMessage?: string;
    timeoutMessage?: string;
    showPreChatForm?: boolean;
    preChatFields?: Array<{
      id: string;
      label: string;
      type: 'text' | 'email' | 'phone' | 'select';
      required?: boolean;
      options?: Array<{ label: string; value: any }>;
    }>;
  }

  /** GPT response (streaming or complete) */
  export interface GPTResponse extends BaseUIState {
    type: 'gptResponse';
    text: string;
    isStreaming?: boolean;
    isComplete?: boolean;
  }

  /** Loading state */
  export interface Loading extends BaseUIState {
    type: 'loading';
    message?: string;
  }

  /** Custom UI state */
  export interface Custom extends BaseUIState {
    type: 'custom';
    componentName: string;
    props: Record<string, any>;
  }

  // Factory functions
  export function message(nodeId: string, text: string, typing?: boolean): Message {
    return { type: 'message', nodeId, text, typing };
  }

  export function image(nodeId: string, url: string, alt?: string, caption?: string): Image {
    return { type: 'image', nodeId, url, alt, caption };
  }

  export function textInput(
    nodeId: string,
    question: string,
    variableName: string,
    inputType: TextInput['inputType'],
    options?: Partial<TextInput>
  ): TextInput {
    return {
      type: 'textInput',
      nodeId,
      question,
      variableName,
      inputType,
      ...options
    };
  }

  export function buttons(
    nodeId: string,
    question: string,
    buttons: Buttons['buttons'],
    variableName?: string
  ): Buttons {
    return { type: 'buttons', nodeId, question, buttons, variableName };
  }

  export function loading(nodeId: string, message?: string): Loading {
    return { type: 'loading', nodeId, message };
  }
}

// ========================================
// NODE HANDLER INTERFACE
// ========================================

/**
 * Interface for all node handlers
 */
export interface NodeHandler {
  /** The node type this handler processes */
  readonly nodeType: string;

  /**
   * Handles a node and returns the result
   * @param node The node data
   * @param state The current chat state
   * @returns The result of processing the node
   */
  handle(node: Record<string, any>, state: ChatState): Promise<NodeResult>;

  /**
   * Handles user response for interactive nodes
   * @param response The user's response
   * @param node The node data
   * @param state The current chat state
   * @returns The result after processing the response
   */
  handleResponse?(
    response: any,
    node: Record<string, any>,
    state: ChatState
  ): Promise<NodeResult>;
}

// ========================================
// BASE NODE HANDLER
// ========================================

/**
 * Base class for node handlers with common utilities
 */
export abstract class BaseNodeHandler implements NodeHandler {
  abstract readonly nodeType: string;

  abstract handle(node: Record<string, any>, state: ChatState): Promise<NodeResult>;

  /**
   * Gets the node data section
   */
  protected getNodeData(node: Record<string, any>): Record<string, any> | null {
    return node.data ?? node;
  }

  /**
   * Gets the node ID
   */
  protected getNodeId(node: Record<string, any>): string {
    return node.id ?? node._id ?? '';
  }

  /**
   * Gets a string value from node data
   */
  protected getString(data: Record<string, any>, key: string, defaultValue: string = ''): string {
    const value = data[key];
    if (typeof value === 'string') return value;
    if (value !== null && value !== undefined) return String(value);
    return defaultValue;
  }

  /**
   * Gets a number value from node data
   */
  protected getNumber(data: Record<string, any>, key: string, defaultValue: number = 0): number {
    const value = data[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? defaultValue : parsed;
    }
    return defaultValue;
  }

  /**
   * Gets a boolean value from node data
   */
  protected getBoolean(data: Record<string, any>, key: string, defaultValue: boolean = false): boolean {
    const value = data[key];
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === 1) return true;
    if (value === 'false' || value === 0) return false;
    return defaultValue;
  }

  /**
   * Gets an array from node data
   */
  protected getArray<T>(data: Record<string, any>, key: string, defaultValue: T[] = []): T[] {
    const value = data[key];
    return Array.isArray(value) ? value : defaultValue;
  }

  /**
   * Gets next node ID from edges or node data
   */
  protected getNextNodeId(node: Record<string, any>, portName?: string): string | null {
    // Check for direct nextNodeId
    if (node.nextNodeId) return node.nextNodeId;

    // Check data for nextNodeId
    const data = this.getNodeData(node);
    if (data?.nextNodeId) return data.nextNodeId;

    // Check edges (will be resolved by flow engine)
    if (portName) {
      return `__port:${portName}`;
    }

    return null;
  }

  /**
   * Resolves variables in text using state
   */
  protected resolveText(text: string, state: ChatState): string {
    return state.resolveVariables(text);
  }

  /**
   * Creates a proceed result to the next node
   */
  protected proceed(node: Record<string, any>, data?: Record<string, any>): NodeResult {
    return NodeResult.proceed(this.getNextNodeId(node), data);
  }

  /**
   * Creates a proceed result with a specific port
   */
  protected proceedToPort(portName: string, data?: Record<string, any>): NodeResult {
    return NodeResult.proceed(`__port:${portName}`, data);
  }

  /**
   * Creates an error result
   */
  protected createError(message: string, recoverable: boolean = true): NodeResult {
    return NodeResult.error(message, recoverable);
  }
}

export default NodeHandler;
