/**
 * SpecialNodeHandlers.ts
 *
 * Special Flow Node handlers for the Conferbot React Native SDK.
 * Handles goal tracking and conversation completion flows.
 */

import { BaseNodeHandler, NodeResult, NodeUIState } from '../NodeHandler';
import { ChatState } from '../../state/ChatState';
import { NodeHandlerRegistry } from '../NodeHandlerRegistry';

// ========================================
// FLOW COMPLETION STATE
// ========================================

/**
 * Enum representing the completion state of a conversation flow
 */
export enum FlowCompletionState {
  /** Flow is still in progress */
  InProgress = 'inProgress',
  /** Flow completed successfully */
  Completed = 'completed',
  /** A goal was reached during the flow */
  GoalReached = 'goalReached',
  /** Flow was cancelled by user or system */
  Cancelled = 'cancelled',
}

// ========================================
// FLOW COMPLETION DELEGATE PROTOCOL
// ========================================

/**
 * Delegate interface for handling flow completion events
 */
export interface FlowCompletionDelegate {
  /**
   * Called when the flow completes
   * @param state The completion state
   * @param reason Optional reason for completion
   */
  flowDidComplete(state: FlowCompletionState, reason?: string): void;

  /**
   * Called when a goal is reached during the flow
   * @param goalName The name of the goal reached
   * @param goalValue Optional value associated with the goal
   * @param conversionData Optional conversion tracking data
   */
  goalReached(
    goalName: string,
    goalValue?: any,
    conversionData?: Record<string, any>
  ): void;
}

// ========================================
// SOCKET EVENT NAMES
// ========================================

/**
 * Socket event names for special flow nodes
 */
export const SpecialNodeSocketEvents = {
  /** Emitted when a conversion goal is reached */
  GOAL_REACHED: 'goal_reached',
  /** Emitted when the conversation ends */
  CONVERSATION_ENDED: 'conversation_ended',
} as const;

export type SpecialNodeSocketEvent =
  typeof SpecialNodeSocketEvents[keyof typeof SpecialNodeSocketEvents];

// ========================================
// GOAL REACHED EVENT PAYLOAD
// ========================================

/**
 * Conversion data for analytics tracking
 */
export interface ConversionData {
  revenue?: number;
  currency?: string;
  orderId?: string;
  [key: string]: any;
}

/**
 * Payload for the goal_reached socket event
 */
export interface GoalReachedPayload {
  goalName: string;
  goalValue?: any;
  timestamp: string;
  sessionId: string;
  conversionData?: ConversionData;
  userName?: string;
  userEmail?: string;
}

// ========================================
// CONVERSATION ENDED EVENT PAYLOAD
// ========================================

/**
 * Summary of the conversation transcript
 */
export interface TranscriptSummary {
  totalMessages: number;
  botMessages: number;
  userMessages: number;
  goalsReached: any[];
  answersCollected: number;
  variablesSet: number;
}

/**
 * Collected data from the conversation
 */
export interface CollectedData {
  answers: Record<string, any>;
  metadata: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

/**
 * Payload for the conversation_ended socket event
 */
export interface ConversationEndedPayload {
  sessionId: string;
  timestamp: string;
  completionStatus: string;
  transcriptSummary: TranscriptSummary;
  collectedData: CollectedData;
  goalsReachedCount: number;
}

// ========================================
// SOCKET EMITTER INTERFACE
// ========================================

/**
 * Interface for emitting socket events
 * This should be implemented by the socket service
 */
export interface SocketEmitter {
  emit(event: string, payload: Record<string, any>): void;
}

// Global socket emitter reference (set by SDK initialization)
let globalSocketEmitter: SocketEmitter | null = null;

/**
 * Sets the global socket emitter for special node handlers
 * @param emitter The socket emitter instance
 */
export function setSocketEmitter(emitter: SocketEmitter | null): void {
  globalSocketEmitter = emitter;
}

/**
 * Gets the global socket emitter
 */
export function getSocketEmitter(): SocketEmitter | null {
  return globalSocketEmitter;
}

// ========================================
// GOAL HANDLER
// ========================================

/**
 * GoalHandler processes goal nodes for conversion analytics.
 *
 * Goals mark important conversion points in the conversation flow
 * and emit analytics events for tracking user behavior.
 *
 * Node type: 'goal'
 *
 * Expected node data:
 * - goalName: string - Name/identifier of the goal
 * - goalValue?: any - Optional value associated with the goal
 * - conversionData?: object - Conversion tracking data (revenue, currency, orderId)
 *
 * Behavior:
 * - Emits 'goal_reached' socket event
 * - Adds goal to transcript
 * - Stores goal_[name] variable in state
 * - Increments _goalsReachedCount variable
 * - DOES NOT stop flow - proceeds to next node
 */
export class GoalHandler extends BaseNodeHandler {
  readonly nodeType = 'goal';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const nodeId = this.getNodeId(node);
    const data = this.getNodeData(node);

    if (!data) {
      console.warn(`[GoalHandler] Node ${nodeId} has no data`);
      return this.proceed(node);
    }

    // Extract goal information
    const goalName = this.getString(data, 'goalName', 'unnamed_goal');
    const goalValue = data.goalValue;

    // Extract conversion data
    const conversionData = this.extractConversionData(data);

    // Get current timestamp
    const timestamp = new Date().toISOString();

    // Build goal reached payload
    const payload: GoalReachedPayload = {
      goalName,
      timestamp,
      sessionId: state.sessionId,
    };

    // Add optional fields if present
    if (goalValue !== undefined) {
      payload.goalValue = goalValue;
    }

    if (conversionData && Object.keys(conversionData).length > 0) {
      payload.conversionData = conversionData;
    }

    if (state.userName) {
      payload.userName = state.userName;
    }

    if (state.userEmail) {
      payload.userEmail = state.userEmail;
    }

    // Emit socket event
    this.emitGoalReached(payload);

    // Add goal to transcript
    state.addGoalToTranscript(goalName, goalValue);

    // Store goal variable in state (goal_[name] = true)
    const goalVariableName = `goal_${this.sanitizeVariableName(goalName)}`;
    state.setVariable(goalVariableName, {
      reached: true,
      timestamp,
      value: goalValue,
      conversionData,
    });

    // Increment goals reached counter
    const currentCount = state.getVariable('_goalsReachedCount') ?? 0;
    state.setVariable('_goalsReachedCount', currentCount + 1);

    // Store in list of reached goals
    const goalsReachedList: string[] = state.getVariable('_goalsReachedList') ?? [];
    goalsReachedList.push(goalName);
    state.setVariable('_goalsReachedList', goalsReachedList);

    console.log(
      `[GoalHandler] Goal reached: ${goalName}`,
      goalValue !== undefined ? `(value: ${goalValue})` : ''
    );

    // Continue to next node (goals don't stop the flow)
    return this.proceed(node, {
      goalReached: true,
      goalName,
      goalValue,
    });
  }

  /**
   * Extracts conversion data from node data
   */
  private extractConversionData(data: Record<string, any>): ConversionData | undefined {
    const conversionData: ConversionData = {};

    // Check for direct conversionData object
    if (data.conversionData && typeof data.conversionData === 'object') {
      return { ...data.conversionData };
    }

    // Check for individual conversion fields
    if (data.revenue !== undefined) {
      conversionData.revenue = this.getNumber(data, 'revenue');
    }

    if (data.currency) {
      conversionData.currency = this.getString(data, 'currency');
    }

    if (data.orderId) {
      conversionData.orderId = this.getString(data, 'orderId');
    }

    // Return undefined if empty
    return Object.keys(conversionData).length > 0 ? conversionData : undefined;
  }

  /**
   * Sanitizes a goal name for use as a variable name
   */
  private sanitizeVariableName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Emits the goal_reached socket event
   */
  private emitGoalReached(payload: GoalReachedPayload): void {
    const emitter = getSocketEmitter();
    if (emitter) {
      try {
        emitter.emit(SpecialNodeSocketEvents.GOAL_REACHED, payload);
      } catch (error) {
        console.error('[GoalHandler] Failed to emit goal_reached event:', error);
      }
    } else {
      console.warn('[GoalHandler] No socket emitter configured, goal event not sent');
    }
  }
}

// ========================================
// END CONVERSATION HANDLER
// ========================================

/**
 * EndConversationHandler terminates the conversation flow.
 *
 * This handler marks the conversation as complete and sends
 * a summary of all collected data and interactions.
 *
 * Node type: 'end_conversation'
 *
 * Expected node data:
 * - endMessage?: string - Optional final message to display
 * - completionStatus?: string - Status of completion (default: 'completed')
 *
 * Behavior:
 * - Generates transcript summary
 * - Emits 'conversation_ended' socket event
 * - Marks conversation complete in state
 * - If endMessage: displays message then signals flow complete
 * - If no message: returns proceed(null, { flowComplete: true })
 */
export class EndConversationHandler extends BaseNodeHandler {
  readonly nodeType = 'end_conversation';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const nodeId = this.getNodeId(node);
    const data = this.getNodeData(node);

    // Extract end conversation data
    const endMessage = data ? this.getString(data, 'endMessage') : '';
    const completionStatus = data
      ? this.getString(data, 'completionStatus', 'completed')
      : 'completed';

    // Get current timestamp
    const timestamp = new Date().toISOString();

    // Generate transcript summary
    const transcriptSummary = this.generateTranscriptSummary(state);

    // Collect all gathered data
    const collectedData = this.collectGatheredData(state);

    // Get goals reached count
    const goalsReachedCount = state.getVariable('_goalsReachedCount') ?? 0;

    // Build conversation ended payload
    const payload: ConversationEndedPayload = {
      sessionId: state.sessionId,
      timestamp,
      completionStatus,
      transcriptSummary,
      collectedData,
      goalsReachedCount,
    };

    // Emit socket event
    this.emitConversationEnded(payload);

    // Mark conversation as complete in state
    state.markConversationComplete(completionStatus);

    // Store completion metadata
    state.setVariable('_conversationEndedAt', timestamp);
    state.setVariable('_completionStatus', completionStatus);

    console.log(
      `[EndConversationHandler] Conversation ended with status: ${completionStatus}`
    );

    // If there's an end message, display it then signal completion
    if (endMessage && endMessage.trim().length > 0) {
      // Resolve any variables in the end message
      const resolvedMessage = state.resolveVariables(endMessage);

      // Add to transcript
      state.addBotMessage(resolvedMessage, nodeId, this.nodeType);

      // Return UI state to display the message
      // The flow engine should handle the flowComplete flag after displaying
      return NodeResult.displayUI({
        type: 'message',
        nodeId,
        text: resolvedMessage,
        // Custom data to signal this is the final message
      } as NodeUIState.Message & { flowComplete?: boolean });
    }

    // No message to display, just signal flow completion
    return NodeResult.proceed(null, { flowComplete: true });
  }

  /**
   * Generates a summary of the conversation transcript
   */
  private generateTranscriptSummary(state: ChatState): TranscriptSummary {
    const summary = state.generateTranscriptSummary();

    return {
      totalMessages: summary.totalMessages ?? 0,
      botMessages: summary.botMessages ?? 0,
      userMessages: summary.userMessages ?? 0,
      goalsReached: summary.goalsReached ?? [],
      answersCollected: summary.answersCollected ?? 0,
      variablesSet: summary.variablesSet ?? 0,
    };
  }

  /**
   * Collects all data gathered during the conversation
   */
  private collectGatheredData(state: ChatState): CollectedData {
    const answers = state.getAllAnswers();
    const metadata = state.getUserMetadata();

    return {
      answers,
      metadata: {
        name: metadata.name,
        email: metadata.email,
        phone: metadata.phone,
      },
    };
  }

  /**
   * Emits the conversation_ended socket event
   */
  private emitConversationEnded(payload: ConversationEndedPayload): void {
    const emitter = getSocketEmitter();
    if (emitter) {
      try {
        emitter.emit(SpecialNodeSocketEvents.CONVERSATION_ENDED, payload);
      } catch (error) {
        console.error(
          '[EndConversationHandler] Failed to emit conversation_ended event:',
          error
        );
      }
    } else {
      console.warn(
        '[EndConversationHandler] No socket emitter configured, end event not sent'
      );
    }
  }
}

// ========================================
// HANDLER REGISTRATION
// ========================================

/**
 * Creates instances of all special flow handlers
 */
export function createSpecialFlowHandlers(): BaseNodeHandler[] {
  return [new GoalHandler(), new EndConversationHandler()];
}

/**
 * Registers all special flow handlers with the registry
 * @param registry The node handler registry to register with
 */
export function registerSpecialFlowHandlers(registry: NodeHandlerRegistry): void {
  const handlers = createSpecialFlowHandlers();

  for (const handler of handlers) {
    registry.register(handler);
  }

  console.log(
    `[SpecialNodeHandlers] Registered ${handlers.length} special flow handlers:`,
    handlers.map((h) => h.nodeType).join(', ')
  );
}

// ========================================
// EXPORTS
// ========================================

export default {
  GoalHandler,
  EndConversationHandler,
  createSpecialFlowHandlers,
  registerSpecialFlowHandlers,
  FlowCompletionState,
  SpecialNodeSocketEvents,
  setSocketEmitter,
  getSocketEmitter,
};
