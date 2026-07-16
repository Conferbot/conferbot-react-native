/**
 * NodeFlowEngine.ts
 *
 * Core engine for orchestrating chatbot node flow in the React Native SDK.
 * Handles node processing, flow navigation, and state management.
 */

import { ChatState } from './state/ChatState';
import { NodeHandlerRegistry, FallbackNodeHandler } from './nodes/NodeHandlerRegistry';
import { NodeResult, NodeUIState, NodeHandler } from './nodes/NodeHandler';
import { BaseNode, NodeEdge, FlowDefinition, requiresUserInteraction } from './nodes/NodeTypes';

// ========================================
// TYPES
// ========================================

/** Flow engine configuration */
export interface NodeFlowEngineConfig {
  /** Typing delay in ms before showing bot messages */
  typingDelay?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Maximum nodes to process in one cycle (prevents infinite loops) */
  maxNodesPerCycle?: number;
  /** Timeout in ms for processing a single node (HIGH FIX 1) */
  nodeProcessingTimeout?: number;
  /** Callback when UI needs to update */
  onUIStateChange?: (uiState: NodeUIState | null) => void;
  /** Callback when waiting for user input */
  onWaitingForInput?: (nodeId: string, uiState: NodeUIState) => void;
  /** Callback when flow completes */
  onFlowComplete?: (reason?: string) => void;
  /** Callback on error */
  onError?: (error: Error, nodeId?: string) => void;
  /** Socket client for emitting events */
  socketClient?: any;
}

/** Engine state */
export interface EngineState {
  isProcessing: boolean;
  isWaitingForInput: boolean;
  currentNodeId: string | null;
  currentUIState: NodeUIState | null;
  error: Error | null;
}

// ========================================
// NODE FLOW ENGINE
// ========================================

/**
 * NodeFlowEngine orchestrates the chatbot conversation flow.
 * It processes nodes, handles transitions, and manages state.
 */
export class NodeFlowEngine {
  private chatState: ChatState;
  private registry: NodeHandlerRegistry;
  private config: Required<NodeFlowEngineConfig>;

  // Flow definition
  private nodes: Map<string, BaseNode> = new Map();
  private edges: NodeEdge[] = [];
  private startNodeId: string | null = null;

  // Engine state
  private _isProcessing: boolean = false;
  private _isWaitingForInput: boolean = false;
  private _currentNodeId: string | null = null;
  private _currentUIState: NodeUIState | null = null;
  private _error: Error | null = null;

  // Listeners
  private stateListeners: Set<(state: EngineState) => void> = new Set();

  // Processing control
  private processingPromise: Promise<void> | null = null;
  private nodesProcessedInCycle: number = 0;

  // Cycle detection (HIGH FIX 2)
  private visitedNodes: Set<string> = new Set();
  private readonly MAX_NODE_VISITS = 100;

  constructor(
    chatState: ChatState,
    registry?: NodeHandlerRegistry,
    config?: NodeFlowEngineConfig
  ) {
    this.chatState = chatState;
    this.registry = registry || NodeHandlerRegistry.getInstance();

    // Set default configuration
    this.config = {
      typingDelay: config?.typingDelay ?? 500,
      debug: config?.debug ?? false,
      maxNodesPerCycle: config?.maxNodesPerCycle ?? 100,
      nodeProcessingTimeout: config?.nodeProcessingTimeout ?? 30000,
      onUIStateChange: config?.onUIStateChange ?? (() => {}),
      onWaitingForInput: config?.onWaitingForInput ?? (() => {}),
      onFlowComplete: config?.onFlowComplete ?? (() => {}),
      onError: config?.onError ?? (() => {}),
      socketClient: config?.socketClient ?? null,
    };

    // Set fallback handler
    this.registry.setFallbackHandler(new FallbackNodeHandler());
  }

  // ========================================
  // FLOW SETUP
  // ========================================

  /**
   * Loads a flow definition
   */
  loadFlow(flow: FlowDefinition): void {
    this.nodes.clear();
    this.edges = flow.edges || [];

    // Index nodes by ID
    for (const node of flow.nodes) {
      this.nodes.set(node.id, node);
    }

    // Determine start node
    this.startNodeId = flow.startNodeId || this.findStartNode();

    this.log('Flow loaded', { nodeCount: this.nodes.size, startNodeId: this.startNodeId });
  }

  /**
   * Finds the start node (node with no incoming edges)
   */
  private findStartNode(): string | null {
    const targetIds = new Set(this.edges.map((e) => e.target));
    for (const [id] of this.nodes) {
      if (!targetIds.has(id)) {
        return id;
      }
    }
    // Fallback to first node
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

    this.nodesProcessedInCycle = 0;
    this.resetFlow();
    await this.processNode(this.startNodeId);
  }

  /**
   * Resumes flow from a specific node
   */
  async resumeFrom(nodeId: string): Promise<void> {
    this.nodesProcessedInCycle = 0;
    await this.processNode(nodeId);
  }

  /**
   * Processes a node handler with a timeout wrapper (HIGH FIX 1)
   */
  private async processNodeWithTimeout(
    handler: NodeHandler,
    nodeWithContext: Record<string, any>,
    timeoutMs: number = 30000
  ): Promise<NodeResult> {
    return Promise.race([
      handler.handle(nodeWithContext, this.chatState),
      new Promise<NodeResult>((_, reject) =>
        setTimeout(() => reject(new Error(`Node processing timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]).catch((error) => {
      console.warn('[ConferBot] Node timeout:', error.message);
      return { type: 'error', message: 'Node processing timed out', recoverable: true } as NodeResult;
    });
  }

  /**
   * Checks for flow cycle detection (HIGH FIX 2)
   */
  private checkCycleDetection(nodeId: string): boolean {
    if (this.visitedNodes.size >= this.MAX_NODE_VISITS) {
      console.error('[ConferBot] Flow cycle detected after', this.MAX_NODE_VISITS, 'nodes');
      return true; // cycle detected
    }
    this.visitedNodes.add(nodeId);
    return false;
  }

  /**
   * Resets visited node tracking when starting a new flow (HIGH FIX 2)
   */
  public resetFlow(): void {
    this.visitedNodes.clear();
  }

  /**
   * Finds an edge for a given node and port with validation logging (HIGH FIX 5)
   */
  private findEdge(nodeId: string, port: string): NodeEdge | null {
    const edge = this.edges.find(
      (e) => e.source === nodeId && (
        e.sourceHandle === port ||
        e.sourceHandle === `source-${port}` ||
        e.data?.port === port
      )
    );
    if (!edge) {
      console.warn(`[ConferBot] No edge found for port: ${port} on node: ${nodeId}`);
    }
    return edge || null;
  }

  /**
   * Processes a node and handles the result
   */
  async processNode(nodeId: string): Promise<void> {
    // Prevent infinite loops
    this.nodesProcessedInCycle++;
    if (this.nodesProcessedInCycle > this.config.maxNodesPerCycle) {
      this.handleError(new Error(`Max nodes per cycle exceeded (${this.config.maxNodesPerCycle})`));
      return;
    }

    // Cycle detection (HIGH FIX 2)
    if (this.checkCycleDetection(nodeId)) {
      this.handleError(new Error(`Flow cycle detected after ${this.MAX_NODE_VISITS} visited nodes`));
      return;
    }

    const node = this.nodes.get(nodeId);
    if (!node) {
      this.handleError(new Error(`Node not found: ${nodeId}`));
      return;
    }

    this.log('Processing node', { nodeId, type: node.type });

    // Update state
    this._isProcessing = true;
    this._currentNodeId = nodeId;
    this._error = null;
    this.chatState.setCurrentNode(nodeId);
    this.notifyStateListeners();

    try {
      // Get handler
      const handler = this.registry.getHandler(node.type);
      if (!handler) {
        this.handleError(new Error(`No handler for node type: ${node.type}`));
        return;
      }

      // Prepare node data with socket client
      const nodeWithContext = {
        ...node,
        data: {
          ...node.data,
          socketClient: this.config.socketClient,
        },
      };

      // Handle the node with timeout (HIGH FIX 1)
      const result = await this.processNodeWithTimeout(
        handler,
        nodeWithContext,
        this.config.nodeProcessingTimeout
      );

      // Process result
      await this.handleNodeResult(result, node, handler);
    } catch (error) {
      this.handleError(error as Error, nodeId);
    }
  }

  /**
   * Handles the result of processing a node
   */
  private async handleNodeResult(
    result: NodeResult,
    node: BaseNode,
    handler: NodeHandler
  ): Promise<void> {
    this.log('Node result', { type: result.type, nodeId: node.id });

    switch (result.type) {
      case 'displayUI':
        await this.handleDisplayUI(result.uiState, node, handler);
        break;

      case 'proceed':
        await this.handleProceed(result.nextNodeId, result.data, node);
        break;

      case 'delayedProceed':
        await this.handleDelayedProceed(result.nextNodeId, result.delayMs, result.data, node);
        break;

      case 'jumpTo':
        await this.handleJumpTo(result.targetNodeId, result.data);
        break;

      case 'error':
        this.handleError(new Error(result.message), node.id);
        break;
    }
  }

  /**
   * Handles display UI result
   */
  private async handleDisplayUI(
    uiState: NodeUIState,
    node: BaseNode,
    handler: NodeHandler
  ): Promise<void> {
    this._currentUIState = uiState;
    this._isProcessing = false;

    // Push node to record (matching web widget format)
    // Web widget pushes the entire node object {...node, time} into record,
    // so the admin dashboard expects record entries with full node data
    this.chatState.addRecord({
      _id: node.id,
      id: node.id,
      type: node.type,
      data: {
        ...node.data,
      },
      time: new Date().toISOString(),
    });

    // Add typing delay if needed
    if (uiState.typing && this.config.typingDelay > 0) {
      this.config.onUIStateChange?.(NodeUIState.loading(node.id, 'Typing...'));
      await this.delay(this.config.typingDelay);
    }

    // Show the UI state
    this.config.onUIStateChange?.(uiState);
    this.notifyStateListeners();

    // Check if this node requires user input
    if (requiresUserInteraction(node.type)) {
      this._isWaitingForInput = true;
      this.config.onWaitingForInput?.(node.id, uiState);
      this.notifyStateListeners();
    } else {
      // Auto-continue for non-interactive display nodes
      this.sendResponseToServer();
      const nextNodeId = this.resolveNextNode(node.id, null);
      if (nextNodeId) {
        await this.delay(this.config.typingDelay);
        await this.processNode(nextNodeId);
      }
    }
  }

  /**
   * Handles proceed result
   */
  private async handleProceed(
    nextNodeId: string | null,
    data: Record<string, any> | undefined,
    node: BaseNode
  ): Promise<void> {
    this._isProcessing = false;

    // Check for flow completion
    if (data?.flowComplete) {
      this.handleFlowComplete(data.completionStatus || 'completed');
      return;
    }

    // Send state to server before proceeding
    this.sendResponseToServer();

    // Support __targetPort from legacy choice nodes (two-choices, three-choices)
    const effectiveNextNodeId = nextNodeId || (data?.__targetPort ? `__port:${data.__targetPort}` : null);

    // Resolve actual next node ID
    const resolvedNextId = this.resolveNextNode(node.id, effectiveNextNodeId);

    if (resolvedNextId) {
      await this.processNode(resolvedNextId);
    } else {
      // No next node - flow ends
      this.handleFlowComplete('no_next_node');
    }
  }

  /**
   * Handles delayed proceed result
   */
  private async handleDelayedProceed(
    nextNodeId: string | null,
    delayMs: number,
    data: Record<string, any> | undefined,
    node: BaseNode
  ): Promise<void> {
    this.log('Delayed proceed', { delayMs, nextNodeId });

    // Show loading state during delay
    this.config.onUIStateChange?.(NodeUIState.loading(node.id, 'Please wait...'));

    await this.delay(delayMs);
    await this.handleProceed(nextNodeId, data, node);
  }

  /**
   * Handles jump to result
   */
  private async handleJumpTo(
    targetNodeId: string,
    data: Record<string, any> | undefined
  ): Promise<void> {
    this.log('Jumping to node', { targetNodeId });

    if (!this.nodes.has(targetNodeId)) {
      this.handleError(new Error(`Jump target not found: ${targetNodeId}`));
      return;
    }

    this.sendResponseToServer();
    await this.processNode(targetNodeId);
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
    this.notifyStateListeners();

    try {
      // Push user response to record (matching web widget format)
      // Web widget uses different shapes per node type
      const responseText = typeof response === 'string'
        ? response
        : response?.text || response?.label || response?.selectedChoice || response?.value || String(response);

      const choiceNodeTypes = [
        'n-choices-node', 'two-choices-node', 'three-choices-node',
        'yes-or-no-choice-node', 'image-choice-node',
      ];
      const selectNodeTypes = ['n-select-option-node', 'select-option-node'];
      const checkNodeTypes = ['n-check-options-node'];

      // Store last choice so message-nodes echoing ${selection} get skipped
      if (choiceNodeTypes.includes(node.type) || selectNodeTypes.includes(node.type) || checkNodeTypes.includes(node.type)) {
        this.chatState.setVariable('_lastUserChoice', responseText);
        this.log('Set _lastUserChoice', { responseText, nodeType: node.type });
      } else {
        this.log('NOT setting _lastUserChoice', { nodeType: node.type, notInTypes: true });
      }

      if (choiceNodeTypes.includes(node.type)) {
        // Choice nodes: shape=user-selected-choice, include choices data
        this.chatState.addRecord({
          _id: node.id,
          id: node.id,
          shape: 'user-selected-choice',
          type: node.type,
          choices: node.data,
          selectedChoice: responseText,
          time: new Date().toISOString(),
        });
      } else if (selectNodeTypes.includes(node.type)) {
        // Select nodes: shape=user-selected-option, include options data
        this.chatState.addRecord({
          _id: node.id,
          id: node.id,
          shape: 'user-selected-option',
          type: node.type,
          options: node.data,
          selectedOption: responseText,
          time: new Date().toISOString(),
        });
      } else if (checkNodeTypes.includes(node.type)) {
        // Check nodes: shape=user-selected-check-options
        this.chatState.addRecord({
          _id: node.id,
          id: node.id,
          shape: 'user-selected-check-options',
          type: node.type,
          options: node.data,
          selectedOptions: responseText,
          time: new Date().toISOString(),
        });
      } else {
        // Text input and other nodes: shape=user-input-response
        this.chatState.addRecord({
          _id: node.id,
          id: node.id,
          shape: 'user-input-response',
          type: node.data?.type || node.type,
          text: responseText,
          time: new Date().toISOString(),
        });
      }

      // Send response to server after user interaction
      this.sendResponseToServer();

      // Handle response if handler supports it
      if (handler.handleResponse) {
        const nodeWithContext = {
          ...node,
          data: {
            ...node.data,
            socketClient: this.config.socketClient,
          },
        };

        const result = await handler.handleResponse(response, nodeWithContext, this.chatState);
        await this.handleNodeResult(result, node, handler);
      } else {
        // Default: proceed to next node based on port
        const nextNodeId = this.resolveNextNode(node.id, portName ? `__port:${portName}` : null);
        if (nextNodeId) {
          await this.processNode(nextNodeId);
        } else {
          this.handleFlowComplete('response_no_next');
        }
      }
    } catch (error) {
      this.handleError(error as Error, this._currentNodeId);
    }
  }

  // ========================================
  // EDGE RESOLUTION
  // ========================================

  /**
   * Resolves the next node ID from edges
   */
  private resolveNextNode(currentNodeId: string, nextNodeId: string | null): string | null {
    // If explicit next node provided
    if (nextNodeId && !nextNodeId.startsWith('__port:')) {
      return nextNodeId;
    }

    // Extract port name if specified
    let portName: string | null = null;
    if (nextNodeId && nextNodeId.startsWith('__port:')) {
      portName = nextNodeId.substring(7);
    }

    // Use findEdge for port-based resolution with validation (HIGH FIX 5)
    if (portName) {
      const edge = this.findEdge(currentNodeId, portName);
      if (edge) {
        return edge.target;
      }
    }

    // Find matching edge for default case
    for (const edge of this.edges) {
      if (edge.source === currentNodeId) {
        if (!portName) {
          // Default edge (no port requirement)
          if (!edge.sourceHandle || edge.sourceHandle === 'default' || edge.sourceHandle === 'out' || edge.sourceHandle === 'source') {
            return edge.target;
          }
        }
      }
    }

    // Try to find any edge from this node as fallback
    if (portName) {
      for (const edge of this.edges) {
        if (edge.source === currentNodeId) {
          console.warn(`[ConferBot] Falling back to first available edge for node: ${currentNodeId}`);
          return edge.target;
        }
      }
    }

    return null;
  }

  // ========================================
  // SERVER COMMUNICATION
  // ========================================

  /**
   * Sends current chat state to server via socket.
   * Matches web widget's `response-record` event and Android/Flutter SDK behavior.
   */
  private sendResponseToServer(): void {
    if (!this.config.socketClient) return;

    const responseData = this.chatState.buildResponseData();

    // Never emit without a session id - the server would file the record
    // under a shared no-session document that leaks across devices
    if (!responseData.chatSessionId) {
      if (__DEV__) {
        console.warn('[ConferBot] Skipping response-record - no chatSessionId yet');
      }
      return;
    }

    if (__DEV__) {
      console.log('[ConferBot] Sending record to server, entries:', responseData.record?.length);
      for (const r of (responseData.record || [])) {
        console.log('[ConferBot]   record:', r.id || r._id, 'type:', r.type, 'shape:', r.shape);
      }
    }

    this.config.socketClient.sendResponseRecord(responseData);
  }

  // ========================================
  // ERROR HANDLING
  // ========================================

  /**
   * Handles errors during flow execution
   */
  private handleError(error: Error, nodeId?: string): void {
    console.error('[NodeFlowEngine] Error:', error.message, { nodeId });

    this._error = error;
    this._isProcessing = false;
    this.notifyStateListeners();

    this.config.onError?.(error, nodeId ?? undefined);
  }

  /**
   * Handles flow completion
   */
  private handleFlowComplete(reason: string): void {
    this.log('Flow complete', { reason });

    this._isProcessing = false;
    this._isWaitingForInput = false;
    this._currentUIState = null;
    this.chatState.markConversationComplete(reason);

    // Send final state to server
    this.sendResponseToServer();

    this.notifyStateListeners();
    this.config.onFlowComplete?.(reason);
  }

  // ========================================
  // STATE MANAGEMENT
  // ========================================

  /**
   * Gets the current engine state
   */
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

  /**
   * Notifies all state listeners
   */
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

  /**
   * Delays execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Logs debug messages
   */
  private log(message: string, data?: Record<string, any>): void {
    if (this.config.debug) {
      console.log(`[NodeFlowEngine] ${message}`, data || '');
    }
  }

  /**
   * Resets the engine state
   */
  reset(): void {
    this._isProcessing = false;
    this._isWaitingForInput = false;
    this._currentNodeId = null;
    this._currentUIState = null;
    this._error = null;
    this.nodesProcessedInCycle = 0;
    this.visitedNodes.clear();
    this.chatState.reset();
    this.notifyStateListeners();
  }
}

export default NodeFlowEngine;
