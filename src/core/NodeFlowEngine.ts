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
   * Processes a node and handles the result
   */
  async processNode(nodeId: string): Promise<void> {
    // Prevent infinite loops
    this.nodesProcessedInCycle++;
    if (this.nodesProcessedInCycle > this.config.maxNodesPerCycle) {
      this.handleError(new Error(`Max nodes per cycle exceeded (${this.config.maxNodesPerCycle})`));
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

      // Handle the node
      const result = await handler.handle(nodeWithContext, this.chatState);

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

    // Resolve actual next node ID
    const resolvedNextId = this.resolveNextNode(node.id, nextNodeId);

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

    // Find matching edge
    for (const edge of this.edges) {
      if (edge.source === currentNodeId) {
        // If port specified, match source handle
        if (portName) {
          if (edge.sourceHandle === portName || edge.data?.port === portName) {
            return edge.target;
          }
        } else {
          // Default edge (no port requirement)
          if (!edge.sourceHandle || edge.sourceHandle === 'default' || edge.sourceHandle === 'out') {
            return edge.target;
          }
        }
      }
    }

    // Try to find any edge from this node as fallback
    if (portName) {
      for (const edge of this.edges) {
        if (edge.source === currentNodeId) {
          return edge.target;
        }
      }
    }

    return null;
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
    this.chatState.reset();
    this.notifyStateListeners();
  }
}

export default NodeFlowEngine;
