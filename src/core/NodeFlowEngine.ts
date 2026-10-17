/**
 * NodeFlowEngine.ts
 *
 * Runs a bot flow the way the web widget does. The reference is the shared
 * flow-node spec (scripts/parity/flows/nodes.spec.json, "engine"), made by
 * running conferbot-widget's own code; __tests__/parity/flows.test.ts runs
 * every fixture through this engine.
 *
 * - start: the FIRST welcome-node in nodes[].
 * - next: a step that does not branch leaves by the FIRST edge from it,
 *   whatever its handle. No edge, or a target that does not exist: the chat
 *   ends.
 * - port: a branching step leaves by an exact handle. No such edge: the chat
 *   ends - never another edge. A wired edge to a missing node stops the chat
 *   where it is (the web throws). Rich steps may name a fallback handle,
 *   taken when only it is wired (web goPort).
 * - unknown step types (and a welcome-node reached mid-flow) show nothing
 *   and continue along their first edge on the next tick.
 * - jump: to the target node; a missing target ends the chat.
 * - end: a sub-flow call returns to its caller; otherwise the chat is over
 *   ("chat-flow-completed").
 * - pacing: typing dots before each displayed step for paceFor(), unless a
 *   fixed typingDelay is configured.
 */

import { ChatState } from './state/ChatState';
import { NodeHandlerRegistry, FallbackNodeHandler } from './nodes/NodeHandlerRegistry';
import { NodeResult, NodeUIState, NodeHandler } from './nodes/NodeHandler';
import { BaseNode, NodeEdge, FlowDefinition, requiresUserInteraction } from './nodes/NodeTypes';
import { getApiOrigin } from '../config/constants';
import { FlowContext, postBotApi, uploadBotMedia } from './flow/context';
import { visitorTimeZone } from './flow/calendar';
import { MAX_QUESTION_POINTS, waitsForAnswer } from './delight';
import {
  bubbleText,
  plainText,
  followsAutoAdvanceStep,
  isEmptyContentStep,
  paceFor,
  renderedTextFor,
} from './flow/text';
import {
  FlowControlState,
  LOOP_TYPE,
  RUN_ERROR_HANDLE,
  RUN_SUBFLOW_TYPE,
  SUBFLOW_RETURN_TYPE,
  SUBFLOW_TYPE,
  callSubflow,
  emptyFlowControl,
  loopTrailText,
  returnFromSubflow,
  stepLoop,
  subflowName,
} from './flow/flowControl';

// ========================================
// TYPES
// ========================================

/** What the engine did, step by step (the flow-node spec's `expect`). */
export type FlowTraceEvent =
  | { kind: 'enter'; node: string; type: string; via: string }
  | { kind: 'shown'; node: string }
  | { kind: 'port'; node: string; handle: string; wired: boolean }
  | { kind: 'unsupported'; node: string; type: string }
  | { kind: 'error'; node: string; message: string }
  | { kind: 'end' }
  | { kind: 'crash'; node: string; reason: string };

/** Flow engine configuration */
export interface NodeFlowEngineConfig {
  /**
   * A fixed typing delay (ms) before each displayed step. Unset: the web
   * widget's pacing (nodeLogic paceFor), by the length of what is said.
   */
  typingDelay?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Steps run without the visitor before the engine stops (a runaway loop guard) */
  maxNodesPerCycle?: number;
  /** Timeout in ms for processing a single node */
  nodeProcessingTimeout?: number;
  /** How long an image or video step waits for its media at most (ms, web: 4000) */
  mediaAdvanceMs?: number;
  /** The bot server origin for /api/v1/bot/:id/* (default: the configured endpoint) */
  apiOrigin?: string;
  /** The bot's customizations (redactSensitive, chatLeaveMessage...) */
  customizations?: Record<string, any>;
  /** The page the chat runs on, when the host app has one (hidden-fields) */
  page?: { url?: string; referrer?: string };
  /** The bot's bookings (the bot data's calendarBookings): a calendar's taken slots */
  calendarBookings?: any[];
  /** The visitor's IANA time zone (default: the device's) */
  visitorTimeZone?: string;
  /** The random source (random-flow) */
  random?: () => number;
  /** Callback when UI needs to update */
  onUIStateChange?: (uiState: NodeUIState | null) => void;
  /** Callback when waiting for user input */
  onWaitingForInput?: (nodeId: string, uiState: NodeUIState) => void;
  /** Callback when flow completes */
  onFlowComplete?: (reason?: string) => void;
  /** Callback on error */
  onError?: (error: Error, nodeId?: string) => void;
  /** A refused answer (the step keeps waiting) */
  onValidationError?: (nodeId: string, message: string) => void;
  /** Every step entered, port taken, step passed and the end */
  onTrace?: (event: FlowTraceEvent) => void;
  /** Socket client for emitting events */
  socketClient?: any;
}

/**
 * A question the visitor may go back to (web index.ts _noteQuestionPoint):
 * kept each time a step that waits for an answer is entered, before it is
 * drawn, with a copy of the conversation's state as it was.
 */
export interface QuestionPoint {
  /** Unique per point (a step asked twice has two). */
  id: number;
  nodeId: string;
  type: string;
  /** Steps entered before this question. */
  stepsLen: number;
  /** The record's length before the question. */
  recordLen: number;
  snap: Record<string, any>;
  flowControl: any;
}

/** Engine state */
export interface EngineState {
  isProcessing: boolean;
  isWaitingForInput: boolean;
  currentNodeId: string | null;
  currentUIState: NodeUIState | null;
  error: Error | null;
}

/** Steps that draw something, after the typing dots (web nodeTypeCategories DISPLAY_NODE_TYPES). */
export const DISPLAY_NODE_TYPES = new Set<string>([
  'two-choices-node',
  'three-choices-node',
  'select-option-node',
  'user-rating-node',
  'quiz-node',
  'user-input-node',
  'user-range-node',
  'welcome-node',
  'message-node',
  'image-node',
  'video-node',
  'audio-node',
  'file-node',
  'ask-name-node',
  'ask-email-node',
  'ask-phone-number-node',
  'ask-number-node',
  'ask-url-node',
  'ask-file-node',
  'ask-location-node',
  'ask-custom-question-node',
  'ask-multiple-questions-node',
  'calendar-node',
  'n-select-option-node',
  'n-check-options-node',
  'n-choices-node',
  'image-choice-node',
  'carousel-node',
  'rating-choice-node',
  'yes-or-no-choice-node',
  'opinion-scale-choice-node',
  'user-redirect-node',
  'html-node',
  'navigate-node',
  'dynamic-choices-node',
  'consent-node',
  'product-card-node',
  'slider-node',
  'datetime-node',
  'ranking-node',
  'otp-node',
  'address-node',
  'matrix-node',
  'ai-extract-node',
  'ai-route-node',
  'kb-answer-node',
  'signature-node',
  'payment-node',
]);

/** Question steps that register data.answerVariable when shown (web _nodeCategorizeHelper). */
const REGISTERS_ANSWER = new Set<string>([
  'ask-name-node',
  'ask-email-node',
  'ask-phone-number-node',
  'ask-number-node',
  'ask-url-node',
  'ask-location-node',
  'ask-custom-question-node',
  'ask-file-node',
  'calendar-node',
  'n-select-option-node',
  'n-check-options-node',
  'n-choices-node',
  'image-choice-node',
  'rating-choice-node',
  'yes-or-no-choice-node',
  'opinion-scale-choice-node',
  'carousel-node',
  // rich steps (richNodesView categorizeRichNode)
  'dynamic-choices-node',
  'consent-node',
  'product-card-node',
  'slider-node',
  'datetime-node',
  'ranking-node',
  'otp-node',
  'address-node',
  'matrix-node',
  'ai-extract-node',
  'ai-route-node',
  'kb-answer-node',
  'signature-node',
  'payment-node',
]);

/** Steps whose media decides when the flow moves on (load, or the cap). */
const MEDIA_TYPES = new Set(['image-node', 'video-node']);

const FLOW_CONTROL = new Set([LOOP_TYPE, SUBFLOW_TYPE, RUN_SUBFLOW_TYPE, SUBFLOW_RETURN_TYPE]);

// ========================================
// NODE FLOW ENGINE
// ========================================

export class NodeFlowEngine {
  private chatState: ChatState;
  private registry: NodeHandlerRegistry;
  private config: Required<Omit<NodeFlowEngineConfig, 'typingDelay' | 'page' | 'random' | 'apiOrigin' | 'visitorTimeZone' | 'calendarBookings'>> &
    Pick<NodeFlowEngineConfig, 'typingDelay' | 'page' | 'random' | 'apiOrigin' | 'visitorTimeZone' | 'calendarBookings'>;

  // Flow definition
  private nodes: Map<string, BaseNode> = new Map();
  private nodeList: BaseNode[] = [];
  private edges: NodeEdge[] = [];
  private startNodeId: string | null = null;

  // Engine state
  private _isProcessing: boolean = false;
  private _isWaitingForInput: boolean = false;
  private _currentNodeId: string | null = null;
  private _currentUIState: NodeUIState | null = null;
  private _error: Error | null = null;
  private _ended: boolean = false;

  /** Every step entered, in order (pacing reads the one before). */
  private steps: BaseNode[] = [];
  /** Bumped whenever the flow moves: a stale timer or reply does nothing. */
  private moveToken: number = 0;
  /** Steps whose "shown" was already reported for this visit. */
  private shownToken: number = -1;
  /** Media that finished loading: the step moves on before the cap. */
  private mediaWaiters: Map<string, () => void> = new Map();
  private flowControl: FlowControlState = emptyFlowControl();
  /** Questions asked, newest last, for "Edit" (only the recent past). */
  private points: QuestionPoint[] = [];
  private pointSeq: number = 0;

  // Listeners
  private stateListeners: Set<(state: EngineState) => void> = new Set();
  private nodesProcessedInCycle: number = 0;

  constructor(chatState: ChatState, registry?: NodeHandlerRegistry, config?: NodeFlowEngineConfig) {
    this.chatState = chatState;
    this.registry = registry || NodeHandlerRegistry.getInstance();

    this.config = {
      typingDelay: config?.typingDelay,
      debug: config?.debug ?? false,
      maxNodesPerCycle: config?.maxNodesPerCycle ?? 500,
      nodeProcessingTimeout: config?.nodeProcessingTimeout ?? 90000,
      mediaAdvanceMs: config?.mediaAdvanceMs ?? 4000,
      apiOrigin: config?.apiOrigin,
      customizations: config?.customizations ?? {},
      page: config?.page,
      calendarBookings: config?.calendarBookings,
      visitorTimeZone: config?.visitorTimeZone,
      random: config?.random,
      onUIStateChange: config?.onUIStateChange ?? (() => {}),
      onWaitingForInput: config?.onWaitingForInput ?? (() => {}),
      onFlowComplete: config?.onFlowComplete ?? (() => {}),
      onError: config?.onError ?? (() => {}),
      onValidationError: config?.onValidationError ?? (() => {}),
      onTrace: config?.onTrace ?? (() => {}),
      socketClient: config?.socketClient ?? null,
    };

    if (config?.customizations && 'redactSensitive' in config.customizations) {
      this.chatState.setRedactSensitive(config.customizations.redactSensitive !== false);
    }

    // Set fallback handler
    this.registry.setFallbackHandler(new FallbackNodeHandler());
  }

  /** The bot's bookings, from the bot data (a calendar greys out taken slots). */
  setCalendarBookings(bookings: any[] | null | undefined): void {
    this.config.calendarBookings = Array.isArray(bookings) ? bookings : [];
  }

  /** The bot's customizations (redactSensitive, chatLeaveMessage...). */
  setCustomizations(customizations: Record<string, any> | null | undefined): void {
    this.config.customizations = customizations || {};
    this.chatState.setRedactSensitive(this.config.customizations.redactSensitive !== false);
  }

  // ========================================
  // FLOW SETUP
  // ========================================

  /**
   * Loads a flow definition
   */
  loadFlow(flow: FlowDefinition): void {
    this.nodes.clear();
    this.nodeList = Array.isArray(flow.nodes) ? flow.nodes : [];
    this.edges = Array.isArray(flow.edges) ? flow.edges : [];

    for (const node of this.nodeList) {
      if (node && node.id !== undefined && node.id !== null) this.nodes.set(String(node.id), node);
    }

    this.startNodeId = this.findStartNode(flow.startNodeId);
    this.log('Flow loaded', { nodeCount: this.nodes.size, startNodeId: this.startNodeId });
  }

  /**
   * The first welcome-node in nodes[] starts the chat (web index.ts
   * _findAndDisplayNode). A flow without one (a partial flow, a test) starts
   * at the given start node, else at a node no edge leads to.
   */
  private findStartNode(given?: string): string | null {
    const welcome = this.nodeList.find((n) => n?.type === 'welcome-node');
    if (welcome) return String(welcome.id);
    if (given && this.nodes.has(given)) return given;
    const targetIds = new Set(this.edges.map((e) => e.target));
    for (const [id] of this.nodes) {
      if (!targetIds.has(id)) return id;
    }
    const firstNode = this.nodes.keys().next().value;
    return firstNode ?? null;
  }

  // ========================================
  // FLOW EXECUTION
  // ========================================

  /**
   * Starts the flow from the beginning
   */
  async start(): Promise<void> {
    if (!this.startNodeId) {
      this.handleError(new Error('No start node found'));
      return;
    }
    this.resetFlow();
    const node = this.nodes.get(this.startNodeId)!;
    await this.enter(node, 'start');
  }

  /**
   * Resumes flow from a specific node
   */
  async resumeFrom(nodeId: string): Promise<void> {
    this.nodesProcessedInCycle = 0;
    this._ended = false;
    await this.processNode(nodeId);
  }

  /**
   * Resets per-run state when starting a new flow
   */
  public resetFlow(): void {
    this.steps = [];
    this.points = [];
    this._ended = false;
    this.nodesProcessedInCycle = 0;
    this.flowControl = emptyFlowControl();
    this.mediaWaiters.clear();
  }

  /**
   * Runs a node by id (entered as along an edge)
   */
  async processNode(nodeId: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      this.handleError(new Error(`Node not found: ${nodeId}`));
      return;
    }
    await this.enter(node, 'edge');
  }

  /** The handler registered for a type (not the fallback). */
  private handlerFor(type: string): NodeHandler | null {
    return this.registry.hasHandler(type) ? this.registry.getHandler(type) : null;
  }

  /** Enter a step: record it, pace it, run its handler. */
  private async enter(node: BaseNode, via: string): Promise<void> {
    if (this._ended) return;

    this.nodesProcessedInCycle++;
    if (this.nodesProcessedInCycle > this.config.maxNodesPerCycle) {
      this.handleError(new Error(`Max nodes per cycle exceeded (${this.config.maxNodesPerCycle})`), node.id);
      return;
    }

    // A question: what "Edit" goes back to, before it is drawn.
    if (waitsForAnswer(node.type)) this.notePoint(node);

    const token = ++this.moveToken;
    this._currentNodeId = node.id;
    this._isWaitingForInput = false;
    this._isProcessing = true;
    this._error = null;
    this.chatState.setCurrentNode(node.id);
    this.steps.push(node);
    this.trace({ kind: 'enter', node: node.id, type: node.type, via });
    this.log('Processing node', { nodeId: node.id, type: node.type, via });

    // The step on the record, with its text as the visitor saw it (web _nodeRecord)
    const renderedText = renderedTextFor(node, (k) => this.chatState.lookupVariable(k));
    this.chatState.appendRecord({
      ...(node as any),
      _id: node.id,
      id: node.id,
      type: node.type,
      data: { ...(node.data || {}) },
      ...(renderedText !== undefined ? { renderedText } : {}),
      time: new Date().toISOString(),
    });
    this.notifyStateListeners();

    // A welcome reached again is not a display step there: passed.
    if (node.type === 'welcome-node' && via !== 'start') {
      await this.passUnknown(node, token);
      return;
    }

    if (FLOW_CONTROL.has(node.type)) {
      await this.runFlowControl(node, token);
      return;
    }

    const handler = this.handlerFor(node.type);
    if (!handler) {
      await this.passUnknown(node, token);
      return;
    }

    if (DISPLAY_NODE_TYPES.has(node.type)) {
      // A message with no text or an image with no picture: straight on.
      if (isEmptyContentStep(node)) {
        await this.next(node, token);
        return;
      }
      this.registerAnswerVariables(node);
      const previous = this.steps[this.steps.length - 2];
      const pace =
        this.config.typingDelay !== undefined
          ? this.config.typingDelay
          : paceFor(previous, node, followsAutoAdvanceStep(previous?.type));
      if (pace > 0) {
        this.config.onUIStateChange?.(NodeUIState.loading(node.id, 'Typing...'));
        await this.delay(pace);
        if (token !== this.moveToken || this._ended) return;
      }
      // Drawn now (web: the message sound plays as the step is drawn).
      this.shownToken = token;
      this.trace({ kind: 'shown', node: node.id });
    }

    let result: NodeResult;
    try {
      result = await this.runHandler(handler, node, via, token);
    } catch (error) {
      this.handleError(error as Error, node.id);
      return;
    }
    if (token !== this.moveToken || this._ended) return;
    await this.handleNodeResult(result, node, token);
  }

  private notePoint(node: BaseNode): void {
    this.points.push({
      id: ++this.pointSeq,
      nodeId: String(node.id),
      type: node.type,
      stepsLen: this.steps.length,
      recordLen: this.chatState.getRecord().length,
      snap: JSON.parse(JSON.stringify(this.chatState.toJSON())),
      flowControl: JSON.parse(JSON.stringify(this.flowControl)),
    });
    if (this.points.length > MAX_QUESTION_POINTS) this.points = this.points.slice(-MAX_QUESTION_POINTS);
  }

  /** The questions asked so far that can still be gone back to, oldest first. */
  questionPoints(): readonly QuestionPoint[] {
    return this.points;
  }

  /**
   * The step types run since a question (it excluded); "agent" when a
   * person or the AI agent has been in the conversation since (what they
   * saw stays). Web index.ts typesSince.
   */
  typesSince(point: QuestionPoint): string[] {
    const types = this.steps.slice(point.stepsLen + 1).map((n) => n?.type || '');
    const agent = this.chatState
      .getRecord()
      .slice(point.recordLen)
      .some((r: any) => /^agent/.test(String(r?.type || r?.shape || '')));
    return agent ? [...types, 'agent'] : types;
  }

  /**
   * "Edit": the conversation as it was when the question was asked, and the
   * question asked again exactly as the forward path asks it (web index.ts
   * _rewindToQuestion). False when the point is gone or the chat ended.
   */
  async rewindTo(pointId: number): Promise<boolean> {
    const i = this.points.findIndex((p) => p.id === pointId);
    const point = this.points[i];
    const node = point ? this.nodes.get(point.nodeId) : undefined;
    if (!point || !node || this.chatState.isFlowComplete) return false;
    this.moveToken++;
    this.chatState.restore(point.snap);
    this.steps.length = Math.min(this.steps.length, point.stepsLen);
    this.flowControl = point.flowControl;
    this.points = this.points.slice(0, i);
    this.mediaWaiters.clear();
    this._ended = false;
    this._isWaitingForInput = false;
    this.nodesProcessedInCycle = 0;
    this.sendResponseToServer();
    await this.enter(node, 'rewind');
    return true;
  }

  /** A question step registers {nodeId, key, value: null} when shown. */
  private registerAnswerVariables(node: BaseNode): void {
    const d: any = node.data || {};
    if (node.type === 'ask-multiple-questions-node') {
      (Array.isArray(d.questions) ? d.questions : []).forEach((q: any, i: number) => {
        if (q?.answerVariable) this.chatState.registerAnswerVariable(`${node.id}${i}`, q.answerVariable);
      });
      return;
    }
    if (REGISTERS_ANSWER.has(node.type) && d.answerVariable) {
      this.chatState.registerAnswerVariable(node.id, d.answerVariable);
    }
  }

  /** Runs a step's handler with the engine's context, under the step timeout. */
  private runHandler(handler: NodeHandler, node: BaseNode, via: string, token: number): Promise<NodeResult> {
    const withCtx = this.nodeWithContext(node, via, token);
    const timeoutMs = this.config.nodeProcessingTimeout;
    let timer: ReturnType<typeof setTimeout> | undefined;
    return Promise.race([
      handler.handle(withCtx, this.chatState),
      new Promise<NodeResult>((resolve) => {
        timer = setTimeout(
          () => resolve(NodeResult.error(`Node processing timed out after ${timeoutMs}ms`, true)),
          timeoutMs
        );
      }),
    ]).finally(() => {
      if (timer !== undefined) clearTimeout(timer);
    });
  }

  private nodeWithContext(node: BaseNode, via: string, token: number): Record<string, any> {
    const data: Record<string, any> = { ...(node.data || {}) };
    // Handlers read data.socketClient, but it is not enumerable: a choice
    // step saves its data in the answer (choices: node.data, as the web), and
    // the live socket's cycles there overflowed socket.io's hasBinary on the
    // next response-record (#87). A spread or JSON copy leaves it out.
    Object.defineProperty(data, 'socketClient', {
      value: this.config.socketClient,
      enumerable: false,
      writable: true,
      configurable: true,
    });
    return {
      ...node,
      data,
      ctx: this.contextFor(node, via, token),
    };
  }

  /** What a handler may use: the bot API, the socket, timers, this step's edges. */
  private contextFor(node: BaseNode, via: string, token: number): FlowContext {
    const origin = this.config.apiOrigin || getApiOrigin();
    const state = this.chatState;
    return {
      botId: state.botId,
      sessionId: state.sessionId,
      api: (path, body, options) => postBotApi(origin, state.botId, path, body, options?.timeoutMs),
      upload: (file) =>
        uploadBotMedia(origin, state.botId, state.sessionId, String(state.getVariable('_visitorId') || state.sessionId), file),
      emit: (event, payload) => this.emit(event, payload),
      on: (event, listener) => this.onSocket(event, listener),
      typing: async (ms) => {
        if (ms > 0) {
          this.config.onUIStateChange?.(NodeUIState.loading(node.id, 'Typing...'));
          await this.delay(ms);
        }
      },
      delay: (ms) => this.delay(ms),
      edges: () => this.edges.filter((e) => e.source === node.id),
      edgesOf: (id) => this.edges.filter((e) => e.source === id),
      wired: (handle) => this.edges.some((e) => e.source === node.id && e.sourceHandle === handle),
      via,
      stepIndex: Math.max(0, this.steps.lastIndexOf(node)),
      random: () => (this.config.random ? this.config.random() : Math.random()),
      now: () => new Date(),
      customizations: this.config.customizations || {},
      page: this.config.page,
      calendarBookings: this.config.calendarBookings || [],
      visitorTimeZone: this.config.visitorTimeZone || visitorTimeZone(),
      respond: (response) => {
        if (this._currentNodeId === node.id && this._isWaitingForInput) void this.submitResponse(response);
      },
      shown: () => {
        if (this.shownToken !== token && token === this.moveToken) {
          this.shownToken = token;
          this.trace({ kind: 'shown', node: node.id });
        }
      },
      isStale: () => token !== this.moveToken && this._currentNodeId !== node.id,
      node: (id) => this.nodes.get(id),
    };
  }

  /**
   * Handles the result of processing a node
   */
  private async handleNodeResult(result: NodeResult, node: BaseNode, token: number): Promise<void> {
    this.log('Node result', { type: result.type, nodeId: node.id });
    switch (result.type) {
      case 'displayUI':
        await this.handleDisplayUI(result.uiState, node, token);
        break;
      case 'proceed':
        await this.handleProceed(result.nextNodeId, result.data, node, token);
        break;
      case 'delayedProceed':
        await this.delay(result.delayMs);
        if (token !== this.moveToken || this._ended) return;
        await this.handleProceed(result.nextNodeId, result.data, node, token);
        break;
      case 'jumpTo':
        this.sendResponseToServer();
        await this.jump(result.targetNodeId, token);
        break;
      case 'invalid':
        await this.handleInvalid(result.message, node, token, result.uiState, result.inCard);
        break;
      case 'end':
        await this.end('completed');
        break;
      case 'error':
        this.handleError(new Error(result.message), node.id);
        break;
    }
  }

  /** Whether the step waits for the visitor once drawn. */
  private awaitsInput(node: BaseNode, uiState: NodeUIState): boolean {
    return uiState?.awaitInput === true || requiresUserInteraction(node.type);
  }

  /** The state with its step's type and data, for the step's own view (NodeRenderer). */
  private stamp(uiState: NodeUIState, node: BaseNode | undefined): NodeUIState {
    if (!uiState || !node) return uiState;
    return { ...uiState, stepType: node.type, stepData: (node as any).data || {} };
  }

  private handleDisplayUI = async (uiState: NodeUIState, node: BaseNode, token: number): Promise<void> => {
    uiState = this.stamp(uiState, node);
    this._currentUIState = uiState;
    this._isProcessing = false;
    if (this.shownToken !== token && DISPLAY_NODE_TYPES.has(node.type)) {
      this.shownToken = token;
      this.trace({ kind: 'shown', node: node.id });
    }
    this.config.onUIStateChange?.(uiState);
    this.notifyStateListeners();

    if (this.awaitsInput(node, uiState)) {
      this._isWaitingForInput = true;
      this.config.onWaitingForInput?.(node.id, uiState);
      this.notifyStateListeners();
      return;
    }

    // Shown and moving on by itself
    this.sendResponseToServer();
    if (MEDIA_TYPES.has(node.type)) {
      await this.waitForMedia(node.id, this.config.mediaAdvanceMs);
      if (token !== this.moveToken || this._ended) return;
    }
    await this.next(node, token);
  };

  /** Resolves when the media loads (mediaSettled) or after `capMs`. */
  private waitForMedia(nodeId: string, capMs: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const timers: Array<ReturnType<typeof setTimeout>> = [];
      const done = () => {
        timers.forEach((t) => clearTimeout(t));
        this.mediaWaiters.delete(nodeId);
        resolve();
      };
      this.mediaWaiters.set(nodeId, done);
      timers.push(setTimeout(done, Math.max(0, capMs)));
    });
  }

  /**
   * An image or video step's media loaded (or failed): the flow moves on
   * now instead of at the cap (web: load / loadedmetadata / error).
   */
  mediaSettled(nodeId: string): void {
    this.mediaWaiters.get(nodeId)?.();
  }

  private async handleProceed(
    nextNodeId: string | null,
    data: Record<string, any> | undefined,
    node: BaseNode,
    token: number
  ): Promise<void> {
    this._isProcessing = false;

    if (data?.flowComplete) {
      await this.end(data.completionStatus || 'completed');
      return;
    }

    this.sendResponseToServer();

    // Legacy __targetPort (old two/three-choices callers)
    const effective = nextNodeId || (data?.__targetPort ? `__port:${data.__targetPort}` : null);
    if (effective === null) {
      await this.next(node, token);
    } else if (effective.startsWith('__port:')) {
      await this.port(node, effective.substring(7), data?.fallbackPort, token);
    } else {
      await this.jump(effective, token);
    }
  }

  // ========================================
  // ROUTING
  // ========================================

  /** The FIRST edge from the step, whatever its handle; none ends the chat. */
  private async next(node: BaseNode, token: number): Promise<void> {
    if (this._ended || token !== this.moveToken) return;
    const edge = this.edges.find((e) => e.source === node.id);
    if (edge) this.chatState.appendRecord({ ...(edge as any), _id: edge.id, time: new Date().toISOString() });
    const target = edge ? this.nodes.get(edge.target) : undefined;
    if (edge && target) {
      await this.enter(target, edge.sourceHandle ? `edge:${edge.sourceHandle}` : 'edge');
    } else {
      await this.end('no_next_node');
    }
  }

  /** The edge from exactly this handle; none ends the chat. */
  private async port(node: BaseNode, handle: string, fallback: string | undefined, token: number): Promise<void> {
    if (this._ended || token !== this.moveToken) return;
    const wired = (h: string) => this.edges.some((e) => e.source === node.id && e.sourceHandle === h);
    const h = fallback && !wired(handle) && wired(fallback) ? fallback : handle;
    const edge = this.edges.find((e) => e.source === node.id && e.sourceHandle === h);
    this.trace({ kind: 'port', node: node.id, handle: h, wired: !!edge });
    if (!edge) {
      await this.end('no_next_node');
      return;
    }
    this.chatState.appendRecord({ ...(edge as any), _id: edge.id, time: new Date().toISOString() });
    const target = this.nodes.get(edge.target);
    if (!target) {
      // The web throws on nextNode.type here: the chat stops where it is.
      this.trace({ kind: 'crash', node: node.id, reason: 'edge target missing' });
      this._isProcessing = false;
      this._isWaitingForInput = false;
      this.handleError(new Error(`Edge ${edge.id} leads to a missing node (${edge.target})`), node.id);
      return;
    }
    await this.enter(target, `port:${h}`);
  }

  /** To a node by id; a missing target ends the chat. */
  private async jump(targetNodeId: string, token: number): Promise<void> {
    if (this._ended || token !== this.moveToken) return;
    const target = targetNodeId ? this.nodes.get(String(targetNodeId)) : undefined;
    if (!target) {
      await this.end('jump_target_missing');
      return;
    }
    await this.enter(target, 'jump');
  }

  /** A step type this engine does not run: nothing shown, then its first edge. */
  private async passUnknown(node: BaseNode, token: number): Promise<void> {
    console.warn(`[ConferBot] step "${node.type}" is not supported here; continuing the flow`);
    this.trace({ kind: 'unsupported', node: node.id, type: node.type });
    await this.delay(0);
    if (token !== this.moveToken || this._ended) return;
    await this.next(node, token);
  }

  // ========================================
  // LOOPS AND SUB-FLOWS (web flowControlRun.ts)
  // ========================================

  private flowLookup = (key: string) => this.chatState.lookupVariable(key);

  private setVars(vars: Record<string, any>): void {
    Object.entries(vars).forEach(([k, v]) => this.chatState.saveVariableByName(k, v));
  }

  /** A trail entry on the step's latest record ("Loop 3 of 5"). */
  private trail(node: BaseNode, extra: Record<string, any>): void {
    const record = this.chatState.getRecord();
    for (let i = record.length - 1; i >= 0; i--) {
      const r: any = record[i];
      if (r && r.id === node.id && r.type === node.type && !r.shape) {
        this.chatState.addRecord({ ...r, ...extra });
        return;
      }
    }
  }

  private async runFlowControl(node: BaseNode, token: number): Promise<void> {
    const d: any = node.data || {};
    switch (node.type) {
      case LOOP_TYPE: {
        const step = stepLoop(String(node.id), d, this.flowControl, this.flowLookup);
        this.setVars(step.vars);
        this.trail(node, { loop: { ...step.trail, text: loopTrailText(step.trail) } });
        this.sendResponseToServer();
        await this.delay(0);
        if (token !== this.moveToken || this._ended) return;
        await this.port(node, step.handle, undefined, token);
        return;
      }
      case RUN_SUBFLOW_TYPE: {
        const call = callSubflow(node, this.nodeList, this.flowControl, this.flowLookup);
        if (!call.ok) {
          this.trail(node, { subflow: { name: call.name || '', error: call.error } });
          this.sendResponseToServer();
          await this.delay(0);
          if (token !== this.moveToken || this._ended) return;
          const wiredError = this.edges.some((e) => e.source === node.id && e.sourceHandle === RUN_ERROR_HANDLE);
          await this.port(node, wiredError ? RUN_ERROR_HANDLE : 'source', undefined, token);
          return;
        }
        this.setVars(call.vars);
        this.trail(node, { subflow: { name: call.name, inputs: call.vars, depth: call.frame?.depth, text: `Ran sub-flow ${call.name}` } });
        this.sendResponseToServer();
        await this.delay(0);
        if (token !== this.moveToken || this._ended) return;
        await this.jump(call.startId!, token);
        return;
      }
      case SUBFLOW_TYPE: {
        this.trail(node, { subflow: { name: subflowName(node), entered: true } });
        await this.delay(0);
        if (token !== this.moveToken || this._ended) return;
        await this.port(node, 'source', undefined, token);
        return;
      }
      case SUBFLOW_RETURN_TYPE: {
        if (await this.returnFromSubflowPath(token)) return;
        await this.delay(0);
        if (token !== this.moveToken || this._ended) return;
        await this.next(node, token);
        return;
      }
    }
  }

  /**
   * The end of a path inside a sub-flow: copy the outputs back and carry on
   * from Run sub-flow's "source" edge (or one with no handle). True when it
   * carried on.
   */
  private async returnFromSubflowPath(token: number): Promise<boolean> {
    let ret = returnFromSubflow(this.flowControl, this.flowLookup);
    while (ret) {
      this.setVars(ret.vars);
      const runNodeId = ret.frame.runNodeId;
      const edge = this.edges.find((e) => e.source === runNodeId && (e.sourceHandle === 'source' || !e.sourceHandle));
      if (edge?.target) {
        this.sendResponseToServer();
        await this.delay(0);
        if (token !== this.moveToken || this._ended) return true;
        await this.jump(edge.target, token);
        return true;
      }
      ret = returnFromSubflow(this.flowControl, this.flowLookup);
    }
    return false;
  }

  // ========================================
  // USER INPUT HANDLING
  // ========================================

  /**
   * Submits user response for current interactive node
   */
  async submitResponse(response: any, portName?: string): Promise<void> {
    if (!this._isWaitingForInput || !this._currentNodeId) {
      this.log('Not waiting for input, ignoring response');
      return;
    }
    // Typed text is trimmed; an empty send is ignored (web composer).
    if (typeof response === 'string' && response.trim() === '') return;

    const node = this.nodes.get(this._currentNodeId);
    if (!node) {
      this.handleError(new Error(`Current node not found: ${this._currentNodeId}`));
      return;
    }
    const handler = this.registry.getHandler(node.type);
    if (!handler) {
      this.handleError(new Error(`Handler not found for: ${node.type}`));
      return;
    }

    this._isWaitingForInput = false;
    this._isProcessing = true;
    this.nodesProcessedInCycle = 0;
    this.notifyStateListeners();
    const token = this.moveToken;

    try {
      let result: NodeResult;
      if (handler.handleResponse) {
        const withCtx = this.nodeWithContext(node, 'edge', token);
        result = await handler.handleResponse(response, withCtx, this.chatState);
      } else {
        result = portName ? NodeResult.port(portName) : NodeResult.next();
      }
      if (token !== this.moveToken || this._ended) return;
      this.sendResponseToServer();
      await this.handleNodeResult(result, node, token);
    } catch (error) {
      this.handleError(error as Error, node.id);
    }
  }

  /**
   * A refused answer: say why, keep waiting at the step. A typed answer's
   * reason comes as a bot bubble after 700 ms of typing (web helpers
   * _displayErrorMessage); a card shows its own at once.
   */
  private async handleInvalid(message: string, node: BaseNode, token: number, uiState?: NodeUIState, inCard?: boolean): Promise<void> {
    this.trace({ kind: 'error', node: node.id, message });
    this._isProcessing = false;
    if (message && !inCard) {
      this.config.onUIStateChange?.(NodeUIState.loading(node.id, 'Typing...'));
      await this.delay(700);
      if (token !== this.moveToken || this._ended) return;
      this.chatState.addBotMessage(bubbleText(message), node.id, 'validation-error');
    }
    this.config.onValidationError?.(node.id, message);
    const ui = uiState ? this.stamp(uiState, node) : this._currentUIState;
    if (ui) {
      this._currentUIState = { ...(ui as any), errorMessage: plainText(message) };
      this.config.onUIStateChange?.(this._currentUIState);
    }
    this._isWaitingForInput = true;
    if (this._currentUIState) this.config.onWaitingForInput?.(node.id, this._currentUIState);
    this.notifyStateListeners();
  }

  // ========================================
  // SERVER COMMUNICATION
  // ========================================

  private emit(event: string, payload: any): boolean {
    const client = this.config.socketClient;
    if (!client) return false;
    try {
      if (typeof client.emitToServer === 'function') client.emitToServer(event, payload);
      else if (typeof client.emit === 'function') client.emit(event, payload);
      else return false;
      return true;
    } catch {
      return false;
    }
  }

  private onSocket(event: string, listener: (payload: any) => void): () => void {
    const client = this.config.socketClient;
    if (!client || typeof client.on !== 'function') return () => {};
    const off = client.on(event, listener);
    return typeof off === 'function' ? off : () => client.off?.(event, listener);
  }

  /**
   * Sends current chat state to server via socket.
   * Matches web widget's `response-record` event.
   */
  private sendResponseToServer(): void {
    if (!this.config.socketClient) return;
    const responseData = this.chatState.buildResponseData();
    // Never emit without a session id - the server would file the record
    // under a shared no-session document that leaks across devices
    if (!responseData.chatSessionId) return;
    if (typeof this.config.socketClient.sendResponseRecord === 'function') {
      this.config.socketClient.sendResponseRecord(responseData);
    }
  }

  // ========================================
  // ERROR HANDLING
  // ========================================

  private handleError(error: Error, nodeId?: string): void {
    console.error('[NodeFlowEngine] Error:', error.message, { nodeId });
    this._error = error;
    this._isProcessing = false;
    this.notifyStateListeners();
    this.config.onError?.(error, nodeId ?? undefined);
  }

  /**
   * The end of a path: a sub-flow returns to its caller; otherwise the chat
   * is over (web index.ts: hasChatEnded, record sent, chat-flow-completed).
   */
  private async end(reason: string): Promise<void> {
    if (this._ended) return;
    if (this.flowControl.stack.length && (await this.returnFromSubflowPath(this.moveToken))) return;
    this.handleFlowComplete(reason);
  }

  private handleFlowComplete(reason: string): void {
    if (this._ended) return;
    this.log('Flow complete', { reason });
    this._ended = true;
    this._isProcessing = false;
    this._isWaitingForInput = false;
    this._currentUIState = null;
    this.chatState.markConversationComplete(reason);
    this.sendResponseToServer();
    this.emit('chat-flow-completed', { chatSessionId: this.chatState.sessionId });
    this.trace({ kind: 'end' });
    this.notifyStateListeners();
    this.config.onFlowComplete?.(reason);
  }

  private trace(event: FlowTraceEvent): void {
    try {
      this.config.onTrace?.(event);
    } catch {
      /* a listener's error never stops the flow */
    }
  }

  // ========================================
  // STATE MANAGEMENT
  // ========================================

  /** A node of the loaded flow by id. */
  getNode(nodeId: string): BaseNode | undefined {
    return this.nodes.get(nodeId);
  }

  /** Whether the chat has ended (the flow reached its end). */
  isEnded(): boolean {
    return this._ended;
  }

  /**
   * A restored chat that was waiting on a step (a handover still in the
   * queue): back on that step showing `uiState`, without running the step
   * again - a second run would ask the server for a person a second time.
   * The visitor's answer (Cancel, the flow carrying on) then goes through
   * submitResponse as usual. False when the step is not in the flow.
   */
  waitAt(nodeId: string, uiState: NodeUIState): boolean {
    if (!this.nodes.has(nodeId)) return false;
    this._currentNodeId = nodeId;
    this._isProcessing = false;
    this._isWaitingForInput = true;
    uiState = this.stamp(uiState, this.nodes.get(nodeId));
    this._currentUIState = uiState;
    this.chatState.setCurrentNode(nodeId);
    this.config.onUIStateChange?.(uiState);
    this.notifyStateListeners();
    return true;
  }

  /** Waiting on its handover step (for a person, or after nobody came). */
  isAtHandover(): boolean {
    const node = this._currentNodeId ? this.nodes.get(this._currentNodeId) : undefined;
    return node?.type === 'human-handover-node';
  }

  /** The handover step's data while the flow waits on it (its max wait, assignment). */
  handoverNodeData(): Record<string, any> | undefined {
    const node = this._currentNodeId ? this.nodes.get(this._currentNodeId) : undefined;
    return node?.type === 'human-handover-node' ? (node as any).data : undefined;
  }

  getState(): EngineState {
    return {
      isProcessing: this._isProcessing,
      isWaitingForInput: this._isWaitingForInput,
      currentNodeId: this._currentNodeId,
      currentUIState: this._currentUIState,
      error: this._error,
    };
  }

  /**
   * Gets the chat state
   */
  getChatState(): ChatState {
    return this.chatState;
  }

  /**
   * Adds a state change listener
   */
  addStateListener(listener: (state: EngineState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private notifyStateListeners(): void {
    const state = this.getState();
    this.stateListeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        console.error('[NodeFlowEngine] State listener error:', error);
      }
    });
  }

  // ========================================
  // UTILITIES
  // ========================================

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
  }

  private log(message: string, data?: Record<string, any>): void {
    if (this.config.debug) {
      console.log(`[NodeFlowEngine] ${message}`, data || '');
    }
  }

  /**
   * Resets the engine state
   */
  reset(): void {
    this.moveToken++;
    this._isProcessing = false;
    this._isWaitingForInput = false;
    this._currentNodeId = null;
    this._currentUIState = null;
    this._error = null;
    this.resetFlow();
    this.chatState.reset();
    this.notifyStateListeners();
  }
}

export default NodeFlowEngine;
