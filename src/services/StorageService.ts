/**
 * StorageService.ts
 *
 * Persistence layer for Conferbot React Native SDK using AsyncStorage.
 * Handles saving and restoring chat sessions, messages, user data, and flow state.
 */

import type { RecordItem, ConferBotUser } from '../types';
import type { AnswerVariable, UserMetadata } from '../core/state/ChatState';

// ========================================
// TYPES
// ========================================

/** Configuration for storage behavior */
export interface StorageConfig {
  /** Maximum number of messages to persist (default: 100) */
  maxMessages?: number;
  /** Storage key prefix for namespacing (default: '@conferbot') */
  keyPrefix?: string;
  /** Enable storage (can be disabled for testing) */
  enabled?: boolean;
  /** Session expiry time in milliseconds (default: 7 days) */
  sessionExpiryMs?: number;
}

/** Session data structure for persistence */
export interface PersistedSessionData {
  /** Unique chat session identifier */
  chatSessionId: string;
  /** Visitor identifier for returning user recognition */
  visitorId: string;
  /** Bot identifier this session belongs to */
  botId: string;
  /** Timestamp when session was created */
  createdAt: string;
  /** Timestamp when session was last updated */
  updatedAt: string;
  /** Whether the session is still active */
  isActive: boolean;
  /** Current node ID in the flow (for resumption) */
  currentNodeId?: string;
  /** List of visited node IDs */
  visitedNodes?: string[];
  /** Flow completion status */
  isFlowComplete?: boolean;
  /** Flow completion reason */
  flowCompletionReason?: string;
}

/** User data structure for persistence */
export interface PersistedUserData {
  /** User identifier */
  userId?: string;
  /** User display name */
  name?: string;
  /** User email address */
  email?: string;
  /** User phone number */
  phone?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
  /** Timestamp when data was last updated */
  updatedAt: string;
}

/** Answer variables structure for persistence */
export interface PersistedAnswerVariables {
  /** Array of answer variables */
  variables: AnswerVariable[];
  /** Timestamp when data was last updated */
  updatedAt: string;
}

/** Full persisted state structure */
export interface PersistedState {
  session: PersistedSessionData | null;
  user: PersistedUserData | null;
  messages: RecordItem[];
  answerVariables: PersistedAnswerVariables | null;
  version: number;
}

// ========================================
// STORAGE KEYS
// ========================================

const STORAGE_VERSION = 1;

enum StorageKeys {
  SESSION = 'session',
  USER = 'user',
  MESSAGES = 'messages',
  ANSWER_VARIABLES = 'answerVariables',
  VERSION = 'version',
}

// ========================================
// ASYNC STORAGE INTERFACE
// ========================================

/**
 * AsyncStorage interface to allow dependency injection.
 * This matches the @react-native-async-storage/async-storage API.
 */
export interface AsyncStorageInterface {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  multiGet(keys: string[]): Promise<readonly [string, string | null][]>;
  multiSet(keyValuePairs: [string, string][]): Promise<void>;
  multiRemove(keys: string[]): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
}

// ========================================
// STORAGE SERVICE CLASS
// ========================================

/**
 * StorageService manages persistence for the Conferbot SDK.
 * Uses AsyncStorage for React Native storage operations.
 */
export class StorageService {
  private storage: AsyncStorageInterface | null = null;
  private config: Required<StorageConfig>;
  private initialized: boolean = false;
  private botId: string;

  /** Default configuration values */
  private static readonly DEFAULT_CONFIG: Required<StorageConfig> = {
    maxMessages: 100,
    keyPrefix: '@conferbot',
    enabled: true,
    sessionExpiryMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  constructor(botId: string, config?: StorageConfig) {
    this.botId = botId;
    this.config = {
      ...StorageService.DEFAULT_CONFIG,
      ...config,
    };
  }

  // ========================================
  // INITIALIZATION
  // ========================================

  /**
   * Initializes the storage service with AsyncStorage.
   * Must be called before any storage operations.
   *
   * @param asyncStorage - AsyncStorage instance from @react-native-async-storage/async-storage
   */
  async initialize(asyncStorage: AsyncStorageInterface): Promise<void> {
    if (!this.config.enabled) {
      if (__DEV__) {
        console.log('[StorageService] Storage is disabled');
      }
      return;
    }

    this.storage = asyncStorage;
    this.initialized = true;

    // Check for storage version migration
    await this.migrateIfNeeded();

    if (__DEV__) {
      console.log('[StorageService] Initialized successfully');
    }
  }

  /**
   * Checks if storage service is ready for operations.
   */
  isReady(): boolean {
    return this.initialized && this.storage !== null && this.config.enabled;
  }

  // ========================================
  // KEY GENERATION
  // ========================================

  /**
   * Generates a storage key with prefix and bot ID.
   */
  private getKey(key: StorageKeys): string {
    return `${this.config.keyPrefix}:${this.botId}:${key}`;
  }

  /**
   * Gets all storage keys for this bot.
   */
  private getAllKeys(): string[] {
    return Object.values(StorageKeys).map((key) => this.getKey(key));
  }

  // ========================================
  // SESSION MANAGEMENT
  // ========================================

  /**
   * Saves session data to storage.
   *
   * @param sessionData - Session data to persist
   */
  async saveSession(sessionData: Partial<PersistedSessionData>): Promise<void> {
    if (!this.isReady()) return;

    try {
      const existing = await this.loadSession();
      const now = new Date().toISOString();

      const data: PersistedSessionData = {
        chatSessionId: sessionData.chatSessionId || existing?.chatSessionId || '',
        visitorId: sessionData.visitorId || existing?.visitorId || this.generateVisitorId(),
        botId: this.botId,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        isActive: sessionData.isActive ?? existing?.isActive ?? true,
        currentNodeId: sessionData.currentNodeId ?? existing?.currentNodeId,
        visitedNodes: sessionData.visitedNodes ?? existing?.visitedNodes,
        isFlowComplete: sessionData.isFlowComplete ?? existing?.isFlowComplete,
        flowCompletionReason: sessionData.flowCompletionReason ?? existing?.flowCompletionReason,
      };

      if (!this.storage) {
        this.handleError('saveSession', new Error('Storage not initialized'));
        return;
      }
      await this.storage.setItem(this.getKey(StorageKeys.SESSION), JSON.stringify(data));

      if (__DEV__) {
        console.log('[StorageService] Session saved:', data.chatSessionId);
      }
    } catch (error) {
      this.handleError('saveSession', error);
    }
  }

  /**
   * Loads session data from storage.
   *
   * @returns Session data or null if not found/expired
   */
  async loadSession(): Promise<PersistedSessionData | null> {
    if (!this.isReady()) return null;

    try {
      if (!this.storage) return null;
      const data = await this.storage.getItem(this.getKey(StorageKeys.SESSION));

      if (!data) return null;

      const session: PersistedSessionData = JSON.parse(data);

      // Check if session has expired
      if (this.isSessionExpired(session)) {
        if (__DEV__) {
          console.log('[StorageService] Session expired, clearing');
        }
        await this.clearSession();
        return null;
      }

      // Verify bot ID matches
      if (session.botId !== this.botId) {
        if (__DEV__) {
          console.log('[StorageService] Session bot ID mismatch, clearing');
        }
        await this.clearSession();
        return null;
      }

      return session;
    } catch (error) {
      this.handleError('loadSession', error);
      return null;
    }
  }

  /**
   * Clears session data from storage.
   */
  async clearSession(): Promise<void> {
    if (!this.isReady()) return;

    try {
      if (!this.storage) return;
      await this.storage.removeItem(this.getKey(StorageKeys.SESSION));

      if (__DEV__) {
        console.log('[StorageService] Session cleared');
      }
    } catch (error) {
      this.handleError('clearSession', error);
    }
  }

  /**
   * Checks if a session has expired.
   */
  private isSessionExpired(session: PersistedSessionData): boolean {
    const updatedAt = new Date(session.updatedAt).getTime();
    const now = Date.now();
    return now - updatedAt > this.config.sessionExpiryMs;
  }

  /**
   * Generates a unique visitor ID.
   */
  private generateVisitorId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `v_${timestamp}_${randomPart}`;
  }

  // ========================================
  // MESSAGE MANAGEMENT
  // ========================================

  /**
   * Saves messages to storage with limit enforcement.
   *
   * @param messages - Array of messages to persist
   */
  async saveMessages(messages: RecordItem[]): Promise<void> {
    if (!this.isReady()) return;

    try {
      // Limit messages to configured max
      const limitedMessages = messages.slice(-this.config.maxMessages);

      if (!this.storage) return;
      await this.storage.setItem(
        this.getKey(StorageKeys.MESSAGES),
        JSON.stringify(limitedMessages)
      );

      if (__DEV__) {
        console.log('[StorageService] Messages saved:', limitedMessages.length);
      }
    } catch (error) {
      this.handleError('saveMessages', error);
    }
  }

  /**
   * Loads messages from storage.
   *
   * @returns Array of messages or empty array if not found
   */
  async loadMessages(): Promise<RecordItem[]> {
    if (!this.isReady()) return [];

    try {
      if (!this.storage) return [];
      const data = await this.storage.getItem(this.getKey(StorageKeys.MESSAGES));

      if (!data) return [];

      const messages: RecordItem[] = JSON.parse(data);

      if (__DEV__) {
        console.log('[StorageService] Messages loaded:', messages.length);
      }

      return messages;
    } catch (error) {
      this.handleError('loadMessages', error);
      return [];
    }
  }

  /**
   * Appends new messages to existing storage.
   *
   * @param newMessages - New messages to append
   */
  async appendMessages(newMessages: RecordItem[]): Promise<void> {
    if (!this.isReady()) return;

    try {
      const existing = await this.loadMessages();
      const combined = [...existing, ...newMessages];
      await this.saveMessages(combined);
    } catch (error) {
      this.handleError('appendMessages', error);
    }
  }

  /**
   * Clears messages from storage.
   */
  async clearMessages(): Promise<void> {
    if (!this.isReady()) return;

    try {
      if (!this.storage) return;
      await this.storage.removeItem(this.getKey(StorageKeys.MESSAGES));

      if (__DEV__) {
        console.log('[StorageService] Messages cleared');
      }
    } catch (error) {
      this.handleError('clearMessages', error);
    }
  }

  // ========================================
  // USER DATA MANAGEMENT
  // ========================================

  /**
   * Saves user data to storage.
   *
   * @param userData - User data to persist
   */
  async saveUser(userData: Partial<PersistedUserData>): Promise<void> {
    if (!this.isReady()) return;

    try {
      const existing = await this.loadUser();

      const data: PersistedUserData = {
        userId: userData.userId ?? existing?.userId,
        name: userData.name ?? existing?.name,
        email: userData.email ?? existing?.email,
        phone: userData.phone ?? existing?.phone,
        metadata: {
          ...(existing?.metadata || {}),
          ...(userData.metadata || {}),
        },
        updatedAt: new Date().toISOString(),
      };

      if (!this.storage) {
        this.handleError('saveUser', new Error('Storage not initialized'));
        return;
      }
      await this.storage.setItem(this.getKey(StorageKeys.USER), JSON.stringify(data));

      if (__DEV__) {
        console.log('[StorageService] User saved:', data.userId || data.email || 'anonymous');
      }
    } catch (error) {
      this.handleError('saveUser', error);
    }
  }

  /**
   * Loads user data from storage.
   *
   * @returns User data or null if not found
   */
  async loadUser(): Promise<PersistedUserData | null> {
    if (!this.isReady()) return null;

    try {
      if (!this.storage) return null;
      const data = await this.storage.getItem(this.getKey(StorageKeys.USER));

      if (!data) return null;

      return JSON.parse(data);
    } catch (error) {
      this.handleError('loadUser', error);
      return null;
    }
  }

  /**
   * Clears user data from storage.
   */
  async clearUser(): Promise<void> {
    if (!this.isReady()) return;

    try {
      if (!this.storage) return;
      await this.storage.removeItem(this.getKey(StorageKeys.USER));

      if (__DEV__) {
        console.log('[StorageService] User data cleared');
      }
    } catch (error) {
      this.handleError('clearUser', error);
    }
  }

  /**
   * Converts persisted user data to ConferBotUser format.
   */
  toConferBotUser(persistedUser: PersistedUserData): ConferBotUser | undefined {
    if (!persistedUser.userId) return undefined;

    return {
      id: persistedUser.userId,
      name: persistedUser.name,
      email: persistedUser.email,
      phone: persistedUser.phone,
      metadata: persistedUser.metadata,
    };
  }

  /**
   * Converts persisted user data to UserMetadata format.
   */
  toUserMetadata(persistedUser: PersistedUserData): UserMetadata {
    return {
      name: persistedUser.name,
      email: persistedUser.email,
      phone: persistedUser.phone,
      ...persistedUser.metadata,
    };
  }

  // ========================================
  // ANSWER VARIABLES MANAGEMENT
  // ========================================

  /**
   * Saves answer variables to storage.
   *
   * @param variables - Answer variables to persist
   */
  async saveAnswerVariables(variables: AnswerVariable[]): Promise<void> {
    if (!this.isReady()) return;

    try {
      const data: PersistedAnswerVariables = {
        variables,
        updatedAt: new Date().toISOString(),
      };

      if (!this.storage) {
        this.handleError('saveAnswerVariables', new Error('Storage not initialized'));
        return;
      }
      await this.storage.setItem(
        this.getKey(StorageKeys.ANSWER_VARIABLES),
        JSON.stringify(data)
      );

      if (__DEV__) {
        console.log('[StorageService] Answer variables saved:', variables.length);
      }
    } catch (error) {
      this.handleError('saveAnswerVariables', error);
    }
  }

  /**
   * Loads answer variables from storage.
   *
   * @returns Array of answer variables or empty array if not found
   */
  async loadAnswerVariables(): Promise<AnswerVariable[]> {
    if (!this.isReady()) return [];

    try {
      if (!this.storage) return [];
      const data = await this.storage.getItem(this.getKey(StorageKeys.ANSWER_VARIABLES));

      if (!data) return [];

      const parsed: PersistedAnswerVariables = JSON.parse(data);

      if (__DEV__) {
        console.log('[StorageService] Answer variables loaded:', parsed.variables.length);
      }

      return parsed.variables;
    } catch (error) {
      this.handleError('loadAnswerVariables', error);
      return [];
    }
  }

  /**
   * Clears answer variables from storage.
   */
  async clearAnswerVariables(): Promise<void> {
    if (!this.isReady()) return;

    try {
      if (!this.storage) return;
      await this.storage.removeItem(this.getKey(StorageKeys.ANSWER_VARIABLES));

      if (__DEV__) {
        console.log('[StorageService] Answer variables cleared');
      }
    } catch (error) {
      this.handleError('clearAnswerVariables', error);
    }
  }

  // ========================================
  // BULK OPERATIONS
  // ========================================

  /**
   * Loads all persisted state at once.
   *
   * @returns Complete persisted state
   */
  async loadAll(): Promise<PersistedState> {
    if (!this.isReady()) {
      return {
        session: null,
        user: null,
        messages: [],
        answerVariables: null,
        version: STORAGE_VERSION,
      };
    }

    try {
      const keys = [
        this.getKey(StorageKeys.SESSION),
        this.getKey(StorageKeys.USER),
        this.getKey(StorageKeys.MESSAGES),
        this.getKey(StorageKeys.ANSWER_VARIABLES),
      ];

      if (!this.storage) {
        return { session: null, user: null, messages: [], answerVariables: null, version: STORAGE_VERSION };
      }
      const results = await this.storage.multiGet(keys);

      const parseOrNull = <T>(data: string | null): T | null => {
        if (!data) return null;
        try {
          return JSON.parse(data);
        } catch {
          return null;
        }
      };

      const session = parseOrNull<PersistedSessionData>(results[0]?.[1] ?? null);
      const user = parseOrNull<PersistedUserData>(results[1]?.[1] ?? null);
      const messages = parseOrNull<RecordItem[]>(results[2]?.[1] ?? null) || [];
      const answerVariables = parseOrNull<PersistedAnswerVariables>(results[3]?.[1] ?? null);

      // Validate session
      const validSession = session && !this.isSessionExpired(session) && session.botId === this.botId
        ? session
        : null;

      if (__DEV__) {
        console.log('[StorageService] Loaded all state:', {
          hasSession: !!validSession,
          hasUser: !!user,
          messageCount: messages.length,
          hasAnswerVariables: !!answerVariables,
        });
      }

      return {
        session: validSession,
        user,
        messages,
        answerVariables,
        version: STORAGE_VERSION,
      };
    } catch (error) {
      this.handleError('loadAll', error);
      return {
        session: null,
        user: null,
        messages: [],
        answerVariables: null,
        version: STORAGE_VERSION,
      };
    }
  }

  /**
   * Saves all state at once.
   *
   * @param state - State to persist
   */
  async saveAll(state: Partial<PersistedState>): Promise<void> {
    if (!this.isReady()) return;

    try {
      const keyValuePairs: [string, string][] = [];

      if (state.session) {
        keyValuePairs.push([
          this.getKey(StorageKeys.SESSION),
          JSON.stringify(state.session),
        ]);
      }

      if (state.user) {
        keyValuePairs.push([
          this.getKey(StorageKeys.USER),
          JSON.stringify(state.user),
        ]);
      }

      if (state.messages) {
        const limitedMessages = state.messages.slice(-this.config.maxMessages);
        keyValuePairs.push([
          this.getKey(StorageKeys.MESSAGES),
          JSON.stringify(limitedMessages),
        ]);
      }

      if (state.answerVariables) {
        keyValuePairs.push([
          this.getKey(StorageKeys.ANSWER_VARIABLES),
          JSON.stringify(state.answerVariables),
        ]);
      }

      if (keyValuePairs.length > 0) {
        if (!this.storage) {
          this.handleError('saveAll', new Error('Storage not initialized'));
          return;
        }
        await this.storage.multiSet(keyValuePairs);
      }

      if (__DEV__) {
        console.log('[StorageService] Saved all state');
      }
    } catch (error) {
      this.handleError('saveAll', error);
    }
  }

  /**
   * Clears all persisted data for this bot.
   */
  async clearAll(): Promise<void> {
    if (!this.isReady()) return;

    try {
      const keys = this.getAllKeys();
      if (!this.storage) return;
      await this.storage.multiRemove(keys);

      if (__DEV__) {
        console.log('[StorageService] All data cleared');
      }
    } catch (error) {
      this.handleError('clearAll', error);
    }
  }

  /**
   * Resets session but keeps user data (for new conversation).
   */
  async resetConversation(): Promise<void> {
    if (!this.isReady()) return;

    try {
      // Preserve visitor ID across resets — same device = same visitor
      const existingSession = await this.loadSession();
      const preservedVisitorId = existingSession?.visitorId;

      await Promise.all([
        this.clearSession(),
        this.clearMessages(),
        this.clearAnswerVariables(),
      ]);

      // Re-save the visitor ID so it persists across conversations
      if (preservedVisitorId) {
        await this.saveSession({ visitorId: preservedVisitorId });
      }

      if (__DEV__) {
        console.log('[StorageService] Conversation reset (visitor ID preserved:', preservedVisitorId, ')');
      }
    } catch (error) {
      this.handleError('resetConversation', error);
    }
  }

  // ========================================
  // MIGRATION
  // ========================================

  /**
   * Checks for storage version and migrates if needed.
   */
  private async migrateIfNeeded(): Promise<void> {
    try {
      if (!this.storage) return;
      const versionData = await this.storage.getItem(this.getKey(StorageKeys.VERSION));
      const storedVersion = versionData ? parseInt(versionData, 10) : 0;

      if (storedVersion < STORAGE_VERSION) {
        await this.migrate(storedVersion, STORAGE_VERSION);
        await this.storage.setItem(
          this.getKey(StorageKeys.VERSION),
          STORAGE_VERSION.toString()
        );
      }
    } catch (error) {
      this.handleError('migrateIfNeeded', error);
    }
  }

  /**
   * Performs migration from one version to another.
   */
  private async migrate(fromVersion: number, toVersion: number): Promise<void> {
    if (__DEV__) {
      console.log(`[StorageService] Migrating from v${fromVersion} to v${toVersion}`);
    }

    // Version 0 -> 1: Initial version, clear any legacy data
    if (fromVersion === 0 && toVersion >= 1) {
      // Clear any malformed data from previous implementations
      if (!this.storage) return;
      const allKeys = await this.storage.getAllKeys();
      const legacyKeys = allKeys.filter(
        (key) => key.startsWith('@conferbot') && !key.includes(`:${this.botId}:`)
      );

      if (legacyKeys.length > 0) {
        await this.storage.multiRemove(legacyKeys as string[]);
        if (__DEV__) {
          console.log('[StorageService] Cleared legacy keys:', legacyKeys.length);
        }
      }
    }

    // Add future migrations here as needed
  }

  // ========================================
  // UTILITIES
  // ========================================

  /**
   * Gets the visitor ID, creating one if it doesn't exist.
   */
  async getOrCreateVisitorId(): Promise<string> {
    const session = await this.loadSession();
    if (session?.visitorId) {
      return session.visitorId;
    }

    const visitorId = this.generateVisitorId();
    await this.saveSession({ visitorId });
    return visitorId;
  }

  /**
   * Updates the session's updatedAt timestamp (for keeping session alive).
   */
  async touchSession(): Promise<void> {
    const session = await this.loadSession();
    if (session) {
      await this.saveSession({ ...session, updatedAt: new Date().toISOString() });
    }
  }

  /**
   * Gets storage statistics.
   */
  async getStorageStats(): Promise<{
    hasSession: boolean;
    hasUser: boolean;
    messageCount: number;
    answerVariableCount: number;
  }> {
    const state = await this.loadAll();
    return {
      hasSession: !!state.session,
      hasUser: !!state.user,
      messageCount: state.messages.length,
      answerVariableCount: state.answerVariables?.variables.length || 0,
    };
  }

  // ========================================
  // ERROR HANDLING
  // ========================================

  /**
   * Handles storage errors gracefully.
   */
  private handleError(operation: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Log error in development
    if (__DEV__) {
      console.error(`[StorageService] ${operation} failed:`, errorMessage);
    }

    // In production, we silently fail to prevent app crashes
    // The SDK will continue to work without persistence
  }
}

export default StorageService;
