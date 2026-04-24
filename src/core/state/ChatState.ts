/**
 * ChatState.ts
 *
 * Central state management for the Conferbot React Native SDK.
 * Manages conversation flow state including answer variables, user metadata,
 * transcript, session records, message status tracking, and message reactions.
 */

import { Platform } from 'react-native';
import {
  MessageStatus,
  MessageStatusEntry,
  isStatusMoreAdvanced,
} from '../../types/messageStatus';

import type { Reaction, ReactionEmoji } from '../../types';

// ========================================
// TYPES
// ========================================

/** Answer variable stored during conversation */
export interface AnswerVariable {
  questionId: string;
  variableName: string;
  value: any;
  nodeId?: string;
  timestamp: string;
}

/** User metadata collected during conversation */
export interface UserMetadata {
  name?: string;
  email?: string;
  phone?: string;
  [key: string]: any;
}

/** Transcript entry for conversation history */
export interface TranscriptEntry {
  type: 'bot' | 'user' | 'system' | 'goal';
  text?: string;
  nodeId?: string;
  nodeType?: string;
  timestamp: string;
  data?: Record<string, any>;
}

/** Record entry matching embed-server format */
export interface RecordEntry {
  _id: string | number;
  type: string;
  time: Date | string;
  text?: string;
  reactions?: Reaction[];
  [key: string]: any;
}

// ========================================
// CHAT STATE CLASS
// ========================================

/**
 * ChatState manages all conversation state for a chat session.
 * This includes answer variables, user metadata, transcript, flow variables,
 * message delivery status tracking, and message reactions.
 */
export class ChatState {
  // Session identification
  private _sessionId: string;
  private _botId: string;

  // Answer variables (from user inputs)
  private _answerVariables: Map<string, AnswerVariable> = new Map();

  // General variables (for flow logic)
  private _variables: Map<string, any> = new Map();

  // User metadata (name, email, phone, etc.)
  private _userMetadata: UserMetadata = {};

  // Transcript (conversation history)
  private _transcript: TranscriptEntry[] = [];

  // Record (server-compatible format)
  private _record: RecordEntry[] = [];

  // Current node tracking
  private _currentNodeId: string | null = null;
  private _visitedNodes: Set<string> = new Set();

  // Flow completion state
  private _isFlowComplete: boolean = false;
  private _flowCompletionReason?: string;

  // Message status tracking (for read receipts)
  private _messageStatuses: Map<string | number, MessageStatusEntry> = new Map();

  // Message reactions (messageId -> reactions array)
  private _reactions: Map<string, Reaction[]> = new Map();

  // Listeners for state changes
  private _listeners: Set<(state: ChatState) => void> = new Set();

  // Message status change listeners
  private _statusListeners: Set<
    (messageId: string | number, status: MessageStatusEntry) => void
  > = new Set();

  // Reaction change listeners
  private _reactionListeners: Set<(messageId: string, reactions: Reaction[]) => void> = new Set();

  constructor(sessionId: string, botId: string) {
    this._sessionId = sessionId;
    this._botId = botId;
  }

  // ========================================
  // GETTERS
  // ========================================

  get sessionId(): string {
    return this._sessionId;
  }

  get botId(): string {
    return this._botId;
  }

  get currentNodeId(): string | null {
    return this._currentNodeId;
  }

  get isFlowComplete(): boolean {
    return this._isFlowComplete;
  }

  get flowCompletionReason(): string | undefined {
    return this._flowCompletionReason;
  }

  // User metadata shortcuts
  get userName(): string | undefined {
    return this._userMetadata.name;
  }

  get userEmail(): string | undefined {
    return this._userMetadata.email;
  }

  get userPhone(): string | undefined {
    return this._userMetadata.phone;
  }

  // ========================================
  // MESSAGE STATUS TRACKING (READ RECEIPTS)
  // ========================================

  /**
   * Gets the status for a specific message
   */
  getMessageStatus(messageId: string | number): MessageStatusEntry | undefined {
    return this._messageStatuses.get(messageId);
  }

  /**
   * Gets all message statuses as a Map
   */
  getAllMessageStatuses(): Map<string | number, MessageStatusEntry> {
    return new Map(this._messageStatuses);
  }

  /**
   * Sets the initial status for a queued offline message (PENDING)
   */
  setMessagePending(messageId: string | number, queuedMessageId?: string): void {
    const now = new Date().toISOString();
    const entry: MessageStatusEntry = {
      status: MessageStatus.PENDING,
      updatedAt: now,
      queuedAt: now,
      retryCount: 0,
      queuedMessageId,
    };
    this._messageStatuses.set(messageId, entry);
    this.notifyStatusListeners(messageId, entry);
    this.notifyListeners();
  }

  /**
   * Sets the status for a new message (SENDING)
   */
  setMessageSending(messageId: string | number): void {
    const existing = this._messageStatuses.get(messageId);
    const now = new Date().toISOString();
    const entry: MessageStatusEntry = {
      status: MessageStatus.SENDING,
      updatedAt: now,
      queuedAt: existing?.queuedAt,
      sentAt: now,
      retryCount: existing?.retryCount ?? 0,
      queuedMessageId: existing?.queuedMessageId,
    };
    this._messageStatuses.set(messageId, entry);
    this.notifyStatusListeners(messageId, entry);
    this.notifyListeners();
  }

  /**
   * Updates a message status to SENT (server acknowledged)
   */
  setMessageSent(messageId: string | number): void {
    const existing = this._messageStatuses.get(messageId);
    const now = new Date().toISOString();

    // Only update if current status is PENDING or SENDING
    if (
      !existing ||
      existing.status === MessageStatus.PENDING ||
      existing.status === MessageStatus.SENDING
    ) {
      const entry: MessageStatusEntry = {
        status: MessageStatus.SENT,
        updatedAt: now,
        queuedAt: existing?.queuedAt,
        sentAt: existing?.sentAt || now,
        retryCount: existing?.retryCount,
        queuedMessageId: existing?.queuedMessageId,
      };
      this._messageStatuses.set(messageId, entry);
      this.notifyStatusListeners(messageId, entry);
      this.notifyListeners();
    }
  }

  /**
   * Updates a message status to DELIVERED
   */
  setMessageDelivered(messageId: string | number, deliveredAt?: string): void {
    const existing = this._messageStatuses.get(messageId);
    const now = deliveredAt || new Date().toISOString();

    // Only update if current status is less advanced than DELIVERED
    if (
      !existing ||
      !isStatusMoreAdvanced(existing.status, MessageStatus.DELIVERED)
    ) {
      const entry: MessageStatusEntry = {
        status: MessageStatus.DELIVERED,
        updatedAt: now,
        queuedAt: existing?.queuedAt,
        sentAt: existing?.sentAt,
        deliveredAt: now,
        retryCount: existing?.retryCount,
        queuedMessageId: existing?.queuedMessageId,
      };
      this._messageStatuses.set(messageId, entry);
      this.notifyStatusListeners(messageId, entry);
      this.notifyListeners();
    }
  }

  /**
   * Updates a message status to READ
   */
  setMessageRead(
    messageId: string | number,
    readAt?: string,
    readBy?: 'agent' | 'bot'
  ): void {
    const existing = this._messageStatuses.get(messageId);
    const now = readAt || new Date().toISOString();

    // Only update if current status is less advanced than READ
    if (
      !existing ||
      !isStatusMoreAdvanced(existing.status, MessageStatus.READ)
    ) {
      const entry: MessageStatusEntry = {
        status: MessageStatus.READ,
        updatedAt: now,
        queuedAt: existing?.queuedAt,
        sentAt: existing?.sentAt,
        deliveredAt: existing?.deliveredAt || now,
        readAt: now,
        readBy,
        retryCount: existing?.retryCount,
        queuedMessageId: existing?.queuedMessageId,
      };
      this._messageStatuses.set(messageId, entry);
      this.notifyStatusListeners(messageId, entry);
      this.notifyListeners();
    }
  }

  /**
   * Sets a message status to FAILED
   */
  setMessageFailed(messageId: string | number, error?: string): void {
    const existing = this._messageStatuses.get(messageId);
    const now = new Date().toISOString();

    const entry: MessageStatusEntry = {
      status: MessageStatus.FAILED,
      updatedAt: now,
      queuedAt: existing?.queuedAt,
      sentAt: existing?.sentAt,
      retryCount: (existing?.retryCount ?? 0) + 1,
      error,
      queuedMessageId: existing?.queuedMessageId,
    };
    this._messageStatuses.set(messageId, entry);
    this.notifyStatusListeners(messageId, entry);
    this.notifyListeners();
  }

  /**
   * Updates message status with flexible parameters
   */
  updateMessageStatus(
    messageId: string | number,
    status: MessageStatus,
    options?: {
      timestamp?: string;
      readBy?: 'agent' | 'bot';
      error?: string;
      queuedMessageId?: string;
    }
  ): void {
    switch (status) {
      case MessageStatus.PENDING:
        this.setMessagePending(messageId, options?.queuedMessageId);
        break;
      case MessageStatus.SENDING:
        this.setMessageSending(messageId);
        break;
      case MessageStatus.SENT:
        this.setMessageSent(messageId);
        break;
      case MessageStatus.DELIVERED:
        this.setMessageDelivered(messageId, options?.timestamp);
        break;
      case MessageStatus.READ:
        this.setMessageRead(messageId, options?.timestamp, options?.readBy);
        break;
      case MessageStatus.FAILED:
        this.setMessageFailed(messageId, options?.error);
        break;
    }
  }

  /**
   * Batch update multiple messages to a status
   */
  batchUpdateMessageStatus(
    messageIds: (string | number)[],
    status: MessageStatus,
    options?: {
      timestamp?: string;
      readBy?: 'agent' | 'bot';
      error?: string;
    }
  ): void {
    for (const messageId of messageIds) {
      this.updateMessageStatus(messageId, status, options);
    }
  }

  /**
   * Gets all user message IDs that have a specific status or lower
   */
  getMessageIdsWithStatusOrLower(
    maxStatus: MessageStatus
  ): (string | number)[] {
    const statusOrder: Record<MessageStatus, number> = {
      [MessageStatus.FAILED]: -1,
      [MessageStatus.PENDING]: 0,
      [MessageStatus.SENDING]: 1,
      [MessageStatus.SENT]: 2,
      [MessageStatus.DELIVERED]: 3,
      [MessageStatus.READ]: 4,
    };
    const maxOrder = statusOrder[maxStatus];

    const result: (string | number)[] = [];
    this._messageStatuses.forEach((entry, messageId) => {
      if (statusOrder[entry.status] <= maxOrder) {
        result.push(messageId);
      }
    });

    return result;
  }

  /**
   * Gets unread message IDs (status is SENT or DELIVERED)
   */
  getUnreadMessageIds(): (string | number)[] {
    const result: (string | number)[] = [];
    this._messageStatuses.forEach((entry, messageId) => {
      if (
        entry.status === MessageStatus.SENT ||
        entry.status === MessageStatus.DELIVERED
      ) {
        result.push(messageId);
      }
    });
    return result;
  }

  /**
   * Gets pending/failed message IDs (for offline queue retry)
   */
  getPendingMessageIds(): (string | number)[] {
    const result: (string | number)[] = [];
    this._messageStatuses.forEach((entry, messageId) => {
      if (
        entry.status === MessageStatus.PENDING ||
        entry.status === MessageStatus.FAILED
      ) {
        result.push(messageId);
      }
    });
    return result;
  }

  /**
   * Gets failed message IDs
   */
  getFailedMessageIds(): (string | number)[] {
    const result: (string | number)[] = [];
    this._messageStatuses.forEach((entry, messageId) => {
      if (entry.status === MessageStatus.FAILED) {
        result.push(messageId);
      }
    });
    return result;
  }

  /**
   * Adds a listener for message status changes
   */
  addStatusListener(
    listener: (messageId: string | number, status: MessageStatusEntry) => void
  ): () => void {
    this._statusListeners.add(listener);
    return () => this._statusListeners.delete(listener);
  }

  /**
   * Notifies all status listeners of a change
   */
  private notifyStatusListeners(
    messageId: string | number,
    status: MessageStatusEntry
  ): void {
    this._statusListeners.forEach((listener) => {
      try {
        listener(messageId, status);
      } catch (error) {
        console.error('[ChatState] Status listener error:', error);
      }
    });
  }

  // ========================================
  // MESSAGE REACTIONS
  // ========================================

  /**
   * Adds a reaction to a message
   * @param messageId - The message ID to add reaction to
   * @param emoji - The emoji reaction
   * @param userId - The user ID adding the reaction
   * @param userName - Optional user name
   */
  addReaction(
    messageId: string,
    emoji: ReactionEmoji,
    userId: string,
    userName?: string
  ): void {
    const reactions = this._reactions.get(messageId) || [];

    // Check if user already reacted with this emoji
    const existingIndex = reactions.findIndex(
      (r) => r.userId === userId && r.emoji === emoji
    );

    if (existingIndex === -1) {
      // Add new reaction
      const newReaction: Reaction = {
        emoji,
        userId,
        userName,
        timestamp: new Date().toISOString(),
      };
      reactions.push(newReaction);
      this._reactions.set(messageId, reactions);
      this.notifyReactionListeners(messageId, reactions);
      this.notifyListeners();
    }
  }

  /**
   * Removes a reaction from a message
   * @param messageId - The message ID to remove reaction from
   * @param emoji - The emoji reaction to remove
   * @param userId - The user ID removing the reaction
   */
  removeReaction(messageId: string, emoji: ReactionEmoji, userId: string): void {
    const reactions = this._reactions.get(messageId);
    if (!reactions) return;

    const filteredReactions = reactions.filter(
      (r) => !(r.userId === userId && r.emoji === emoji)
    );

    if (filteredReactions.length === 0) {
      this._reactions.delete(messageId);
    } else {
      this._reactions.set(messageId, filteredReactions);
    }

    this.notifyReactionListeners(messageId, filteredReactions);
    this.notifyListeners();
  }

  /**
   * Toggle a reaction (add if not present, remove if present)
   * @param messageId - The message ID
   * @param emoji - The emoji reaction
   * @param userId - The user ID
   * @param userName - Optional user name
   * @returns 'added' | 'removed' indicating the action taken
   */
  toggleReaction(
    messageId: string,
    emoji: ReactionEmoji,
    userId: string,
    userName?: string
  ): 'added' | 'removed' {
    const reactions = this._reactions.get(messageId) || [];
    const existingIndex = reactions.findIndex(
      (r) => r.userId === userId && r.emoji === emoji
    );

    if (existingIndex === -1) {
      this.addReaction(messageId, emoji, userId, userName);
      return 'added';
    } else {
      this.removeReaction(messageId, emoji, userId);
      return 'removed';
    }
  }

  /**
   * Gets all reactions for a message
   * @param messageId - The message ID
   * @returns Array of reactions
   */
  getReactions(messageId: string): Reaction[] {
    return this._reactions.get(messageId) || [];
  }

  /**
   * Gets all reactions as a Map
   * @returns Map of messageId to reactions array
   */
  getAllReactions(): Map<string, Reaction[]> {
    return new Map(this._reactions);
  }

  /**
   * Sets all reactions for a message (used for sync from server)
   * @param messageId - The message ID
   * @param reactions - Array of reactions
   */
  setReactions(messageId: string, reactions: Reaction[]): void {
    if (reactions.length === 0) {
      this._reactions.delete(messageId);
    } else {
      this._reactions.set(messageId, reactions);
    }
    this.notifyReactionListeners(messageId, reactions);
    this.notifyListeners();
  }

  /**
   * Checks if a user has reacted to a message with a specific emoji
   * @param messageId - The message ID
   * @param emoji - The emoji to check
   * @param userId - The user ID to check
   * @returns true if user has reacted
   */
  hasUserReacted(messageId: string, emoji: ReactionEmoji, userId: string): boolean {
    const reactions = this._reactions.get(messageId) || [];
    return reactions.some((r) => r.userId === userId && r.emoji === emoji);
  }

  /**
   * Add a reaction change listener
   * @param listener - Callback function
   * @returns Unsubscribe function
   */
  addReactionListener(
    listener: (messageId: string, reactions: Reaction[]) => void
  ): () => void {
    this._reactionListeners.add(listener);
    return () => this._reactionListeners.delete(listener);
  }

  /**
   * Notify all reaction listeners
   */
  private notifyReactionListeners(messageId: string, reactions: Reaction[]): void {
    this._reactionListeners.forEach((listener) => {
      try {
        listener(messageId, reactions);
      } catch (error) {
        console.error('[ChatState] Reaction listener error:', error);
      }
    });
  }

  // ========================================
  // ANSWER VARIABLES
  // ========================================

  /**
   * Sets an answer variable from user input
   */
  setAnswer(
    questionId: string,
    variableName: string,
    value: any,
    nodeId?: string
  ): void {
    const answer: AnswerVariable = {
      questionId,
      variableName,
      value,
      nodeId,
      timestamp: new Date().toISOString(),
    };
    this._answerVariables.set(variableName, answer);
    this.notifyListeners();
  }

  /**
   * Gets an answer variable by name
   */
  getAnswer(variableName: string): any {
    return this._answerVariables.get(variableName)?.value;
  }

  /**
   * Gets all answer variables as a plain object
   */
  getAllAnswers(): Record<string, any> {
    const answers: Record<string, any> = {};
    this._answerVariables.forEach((answer, key) => {
      answers[key] = answer.value;
    });
    return answers;
  }

  /**
   * Gets all answer variables with full metadata
   */
  getAnswerVariables(): AnswerVariable[] {
    return Array.from(this._answerVariables.values());
  }

  // ========================================
  // GENERAL VARIABLES
  // ========================================

  /**
   * Sets a general variable for flow logic
   */
  setVariable(name: string, value: any): void {
    this._variables.set(name, value);
    this.notifyListeners();
  }

  /**
   * Gets a general variable
   */
  getVariable(name: string): any {
    return this._variables.get(name);
  }

  /**
   * Gets all variables as a plain object
   */
  getAllVariables(): Record<string, any> {
    const variables: Record<string, any> = {};
    this._variables.forEach((value, key) => {
      variables[key] = value;
    });
    return variables;
  }

  /**
   * Deletes a variable
   */
  deleteVariable(name: string): boolean {
    const result = this._variables.delete(name);
    this.notifyListeners();
    return result;
  }

  // ========================================
  // USER METADATA
  // ========================================

  /**
   * Sets user metadata
   */
  setUserMetadata(metadata: Partial<UserMetadata>): void {
    this._userMetadata = { ...this._userMetadata, ...metadata };
    this.notifyListeners();
  }

  /**
   * Gets user metadata
   */
  getUserMetadata(): UserMetadata {
    return { ...this._userMetadata };
  }

  /**
   * Sets user name
   */
  setUserName(name: string): void {
    this._userMetadata.name = name;
    this.notifyListeners();
  }

  /**
   * Sets user email
   */
  setUserEmail(email: string): void {
    this._userMetadata.email = email;
    this.notifyListeners();
  }

  /**
   * Sets user phone
   */
  setUserPhone(phone: string): void {
    this._userMetadata.phone = phone;
    this.notifyListeners();
  }

  // ========================================
  // TRANSCRIPT
  // ========================================

  /**
   * Adds a bot message to the transcript
   */
  addBotMessage(text: string, nodeId?: string, nodeType?: string): void {
    this._transcript.push({
      type: 'bot',
      text,
      nodeId,
      nodeType,
      timestamp: new Date().toISOString(),
    });
    this.notifyListeners();
  }

  /**
   * Adds a user message to the transcript
   */
  addUserMessage(text: string, nodeId?: string): void {
    this._transcript.push({
      type: 'user',
      text,
      nodeId,
      timestamp: new Date().toISOString(),
    });
    this.notifyListeners();
  }

  /**
   * Adds a system message to the transcript
   */
  addSystemMessage(text: string, data?: Record<string, any>): void {
    this._transcript.push({
      type: 'system',
      text,
      timestamp: new Date().toISOString(),
      data,
    });
    this.notifyListeners();
  }

  /**
   * Adds a goal entry to the transcript
   */
  addGoalToTranscript(goalName: string, goalValue?: any): void {
    this._transcript.push({
      type: 'goal',
      timestamp: new Date().toISOString(),
      data: { goalName, goalValue },
    });
    this.notifyListeners();
  }

  /**
   * Adds a custom entry to the transcript
   */
  addToTranscript(entry: TranscriptEntry): void {
    this._transcript.push(entry);
    this.notifyListeners();
  }

  /**
   * Gets the full transcript
   */
  getTranscript(): TranscriptEntry[] {
    return [...this._transcript];
  }

  // ========================================
  // RECORD (SERVER FORMAT)
  // ========================================

  /**
   * Adds a record entry in server-compatible format.
   * Matches web widget behavior: if a record with the same id already exists,
   * merge the new data into the existing entry instead of adding a duplicate.
   * This is critical for choice nodes where the bot node is pushed first,
   * then the user selection merges into the same entry.
   */
  addRecord(entry: RecordEntry): void {
    const entryId = (entry as any).id || (entry as any)._id;
    if (entryId) {
      const existingIndex = this._record.findIndex(
        (r: any) => (r.id || r._id) === entryId
      );
      if (existingIndex !== -1) {
        // Merge into existing record (same as web widget's _pushDataToRecord)
        const existing = this._record[existingIndex] as any;
        this._record[existingIndex] = {
          ...existing,
          ...entry,
          data: {
            ...(existing.data || {}),
            ...((entry as any).data || {}),
          },
        } as RecordEntry;
        this.notifyListeners();
        return;
      }
    }
    this._record.push(entry);
    this.notifyListeners();
  }

  /**
   * Gets all record entries
   */
  getRecord(): RecordEntry[] {
    return [...this._record];
  }

  /**
   * Sets the entire record (for restoration)
   */
  setRecord(record: RecordEntry[]): void {
    this._record = [...record];
    this.notifyListeners();
  }

  /**
   * Builds the response data payload for sending to the server via socket.
   * Matches the web widget's `response-record` format.
   */
  buildResponseData(): Record<string, any> {
    return {
      version: 'v2',
      chatSessionId: this._sessionId,
      visitorId: this.getVariable('_visitorId') || this._sessionId,
      botId: this._botId,
      chatDate: new Date().toISOString(),
      deviceInfo: `ReactNative/${Platform.OS}`,
      location: Intl.DateTimeFormat().resolvedOptions().timeZone,
      record: this._record,
      answerVariables: this.getAnswerVariables().map((av) => ({
        nodeId: av.nodeId,
        key: av.variableName,
        value: av.value,
      })),
      workspaceId: this.getVariable('_workspaceId') || '',
      channel: 'mobile',
    };
  }

  // ========================================
  // NODE TRACKING
  // ========================================

  /**
   * Sets the current node ID
   */
  setCurrentNode(nodeId: string): void {
    this._currentNodeId = nodeId;
    this._visitedNodes.add(nodeId);
    this.notifyListeners();
  }

  /**
   * Checks if a node has been visited
   */
  hasVisitedNode(nodeId: string): boolean {
    return this._visitedNodes.has(nodeId);
  }

  /**
   * Gets all visited nodes
   */
  getVisitedNodes(): string[] {
    return Array.from(this._visitedNodes);
  }

  // ========================================
  // FLOW COMPLETION
  // ========================================

  /**
   * Marks the conversation as complete
   */
  markConversationComplete(reason?: string): void {
    this._isFlowComplete = true;
    this._flowCompletionReason = reason;
    this.setVariable('_flowComplete', true);
    this.setVariable('_flowCompletedAt', new Date().toISOString());
    if (reason) {
      this.setVariable('_flowCompletionReason', reason);
    }
    this.notifyListeners();
  }

  /**
   * Generates a summary of the transcript
   */
  generateTranscriptSummary(): Record<string, any> {
    let botMessageCount = 0;
    let userMessageCount = 0;
    const goalsReached: TranscriptEntry[] = [];

    for (const entry of this._transcript) {
      switch (entry.type) {
        case 'bot':
          botMessageCount++;
          break;
        case 'user':
          userMessageCount++;
          break;
        case 'goal':
          goalsReached.push(entry);
          break;
      }
    }

    // Count total reactions
    let totalReactions = 0;
    this._reactions.forEach((reactions) => {
      totalReactions += reactions.length;
    });

    // Count message statuses
    let pendingCount = 0;
    let failedCount = 0;
    this._messageStatuses.forEach((entry) => {
      if (entry.status === MessageStatus.PENDING) pendingCount++;
      if (entry.status === MessageStatus.FAILED) failedCount++;
    });

    return {
      totalMessages: this._transcript.length,
      botMessages: botMessageCount,
      userMessages: userMessageCount,
      goalsReached,
      answersCollected: this._answerVariables.size,
      variablesSet: this._variables.size,
      totalReactions,
      messagesWithReactions: this._reactions.size,
      pendingMessages: pendingCount,
      failedMessages: failedCount,
    };
  }

  // ========================================
  // VARIABLE RESOLUTION
  // ========================================

  /**
   * Resolves variables in a text string
   * Supports {{variableName}} syntax
   */
  resolveVariables(text: string): string {
    if (!text) return text;

    return text.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const trimmedName = varName.trim();

      // Check answer variables first
      const answer = this.getAnswer(trimmedName);
      if (answer !== undefined) {
        return String(answer);
      }

      // Check general variables
      const variable = this.getVariable(trimmedName);
      if (variable !== undefined) {
        return String(variable);
      }

      // Check user metadata
      const metadata = this._userMetadata[trimmedName];
      if (metadata !== undefined) {
        return String(metadata);
      }

      // Return original if not found
      return match;
    });
  }

  // ========================================
  // LISTENERS
  // ========================================

  /**
   * Adds a state change listener
   */
  addListener(listener: (state: ChatState) => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Notifies all listeners of state change
   */
  private notifyListeners(): void {
    this._listeners.forEach((listener) => {
      try {
        listener(this);
      } catch (error) {
        console.error('[ChatState] Listener error:', error);
      }
    });
  }

  // ========================================
  // SERIALIZATION
  // ========================================

  /**
   * Serializes state to JSON-compatible object
   */
  toJSON(): Record<string, any> {
    // Convert message statuses map to object
    const messageStatuses: Record<string, MessageStatusEntry> = {};
    this._messageStatuses.forEach((entry, key) => {
      messageStatuses[String(key)] = entry;
    });

    // Convert reactions Map to array format for serialization
    const reactionsArray: Array<{ messageId: string; reactions: Reaction[] }> = [];
    this._reactions.forEach((reactions, messageId) => {
      reactionsArray.push({ messageId, reactions });
    });

    return {
      sessionId: this._sessionId,
      botId: this._botId,
      answerVariables: this.getAnswerVariables(),
      variables: this.getAllVariables(),
      userMetadata: this._userMetadata,
      transcript: this._transcript,
      record: this._record,
      currentNodeId: this._currentNodeId,
      visitedNodes: Array.from(this._visitedNodes),
      isFlowComplete: this._isFlowComplete,
      flowCompletionReason: this._flowCompletionReason,
      messageStatuses,
      reactions: reactionsArray,
    };
  }

  /**
   * Restores state from serialized data
   */
  static fromJSON(data: Record<string, any>): ChatState {
    const state = new ChatState(data.sessionId, data.botId);

    // Restore answer variables
    if (Array.isArray(data.answerVariables)) {
      for (const answer of data.answerVariables) {
        state._answerVariables.set(answer.variableName, answer);
      }
    }

    // Restore variables
    if (data.variables) {
      for (const [key, value] of Object.entries(data.variables)) {
        state._variables.set(key, value);
      }
    }

    // Restore user metadata
    if (data.userMetadata) {
      state._userMetadata = data.userMetadata;
    }

    // Restore transcript
    if (Array.isArray(data.transcript)) {
      state._transcript = data.transcript;
    }

    // Restore record
    if (Array.isArray(data.record)) {
      state._record = data.record;
    }

    // Restore node tracking
    if (data.currentNodeId) {
      state._currentNodeId = data.currentNodeId;
    }
    if (Array.isArray(data.visitedNodes)) {
      state._visitedNodes = new Set(data.visitedNodes);
    }

    // Restore flow completion state
    if (data.isFlowComplete) {
      state._isFlowComplete = data.isFlowComplete;
      state._flowCompletionReason = data.flowCompletionReason;
    }

    // Restore message statuses
    if (data.messageStatuses) {
      for (const [key, value] of Object.entries(data.messageStatuses)) {
        state._messageStatuses.set(key, value as MessageStatusEntry);
      }
    }

    // Restore reactions
    if (Array.isArray(data.reactions)) {
      for (const { messageId, reactions } of data.reactions) {
        state._reactions.set(messageId, reactions);
      }
    }

    return state;
  }

  /**
   * Resets the state for a new conversation
   */
  reset(): void {
    // Generate a new session ID (same approach as web widget)
    this._sessionId = Math.random().toString(36).substring(2, 15);
    this._answerVariables.clear();
    this._variables.clear();
    this._userMetadata = {};
    this._transcript = [];
    this._record = [];
    this._currentNodeId = null;
    this._visitedNodes.clear();
    this._isFlowComplete = false;
    this._flowCompletionReason = undefined;
    this._messageStatuses.clear();
    this._reactions.clear();
    this.notifyListeners();
  }
}

export default ChatState;
