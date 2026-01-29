/**
 * NodeHandlerRegistry.ts
 *
 * Central registry for all node handlers in the Conferbot React Native SDK.
 * Maps node types to their handlers and provides lookup functionality.
 */

import { NodeHandler } from './NodeHandler';

/**
 * Registry that maps node types to their handlers
 */
export class NodeHandlerRegistry {
  private static instance: NodeHandlerRegistry | null = null;
  private handlers: Map<string, NodeHandler> = new Map();
  private fallbackHandler: NodeHandler | null = null;

  /**
   * Gets the singleton instance
   */
  static getInstance(): NodeHandlerRegistry {
    if (!NodeHandlerRegistry.instance) {
      NodeHandlerRegistry.instance = new NodeHandlerRegistry();
    }
    return NodeHandlerRegistry.instance;
  }

  /**
   * Resets the singleton instance (for testing)
   */
  static resetInstance(): void {
    NodeHandlerRegistry.instance = null;
  }

  /**
   * Registers a single node handler
   */
  register(handler: NodeHandler): void {
    this.handlers.set(handler.nodeType, handler);
  }

  /**
   * Registers multiple node handlers
   */
  registerAll(handlers: NodeHandler[]): void {
    for (const handler of handlers) {
      this.register(handler);
    }
  }

  /**
   * Sets the fallback handler for unknown node types
   */
  setFallbackHandler(handler: NodeHandler): void {
    this.fallbackHandler = handler;
  }

  /**
   * Gets a handler for a node type
   */
  getHandler(nodeType: string): NodeHandler | null {
    return this.handlers.get(nodeType) || this.fallbackHandler;
  }

  /**
   * Checks if a handler exists for a node type
   */
  hasHandler(nodeType: string): boolean {
    return this.handlers.has(nodeType);
  }

  /**
   * Gets all registered node types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Gets the number of registered handlers
   */
  get size(): number {
    return this.handlers.size;
  }

  /**
   * Unregisters a handler
   */
  unregister(nodeType: string): boolean {
    return this.handlers.delete(nodeType);
  }

  /**
   * Clears all registered handlers
   */
  clear(): void {
    this.handlers.clear();
    this.fallbackHandler = null;
  }
}

/**
 * Fallback handler for unknown node types
 * Logs a warning and proceeds to the next node
 */
export class FallbackNodeHandler implements NodeHandler {
  readonly nodeType = '__fallback__';

  async handle(node: Record<string, any>): Promise<any> {
    const nodeType = node.type || node.nodeType || 'unknown';
    console.warn(`[NodeHandlerRegistry] No handler found for node type: ${nodeType}`);

    // Try to proceed to next node
    const nextNodeId = node.nextNodeId || node.data?.nextNodeId || null;
    return {
      type: 'proceed',
      nextNodeId,
      data: { unhandledNodeType: nodeType },
    };
  }
}

export default NodeHandlerRegistry;
