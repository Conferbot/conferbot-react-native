/**
 * ChatState.ts
 *
 * Central state management for the Conferbot React Native SDK.
 * Manages conversation flow state including answer variables, user metadata,
 * transcript, and session records.
 */

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
  [key: string]: any;
}

// ========================================
// CHAT STATE CLASS
// ========================================

/**
 * ChatState manages all conversation state for a chat session.
 * This includes answer variables, user metadata, transcript, and flow variables.
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

  // Listeners for state changes
  private _listeners: Set<(state: ChatState) => void> = new Set();

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
   * Adds a record entry in server-compatible format
   */
  addRecord(entry: RecordEntry): void {
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

    return {
      totalMessages: this._transcript.length,
      botMessages: botMessageCount,
      userMessages: userMessageCount,
      goalsReached,
      answersCollected: this._answerVariables.size,
      variablesSet: this._variables.size,
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

    return state;
  }

  /**
   * Resets the state for a new conversation
   */
  reset(): void {
    this._answerVariables.clear();
    this._variables.clear();
    this._userMetadata = {};
    this._transcript = [];
    this._record = [];
    this._currentNodeId = null;
    this._visitedNodes.clear();
    this._isFlowComplete = false;
    this._flowCompletionReason = undefined;
    this.notifyListeners();
  }
}

export default ChatState;
