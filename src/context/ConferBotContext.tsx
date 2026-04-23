// @ts-nocheck
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Platform } from 'react-native';
import ConferBotAPI from '../services/api';
import ConferBotSocket from '../services/socket';
import { StorageService } from '../services/StorageService';
import type {
  AsyncStorageInterface,
  StorageConfig,
  PersistedSessionData,
  PersistedState,
} from '../services/StorageService';
import {
  NodeFlowEngine,
  ChatState,
  NodeHandlerRegistry,
  registerAllHandlers,
  NodeUIState,
  FlowDefinition,
} from '../core';
import { useReadReceipts } from '../hooks/useReadReceipts';
import type {
  ConferBotConfig,
  ConferBotUser,
  ConferBotCustomization,
  ConferBotContext as ConferBotContextType,
  Agent,
  MessageAttachment,
  ChatbotConfig,
  RecordItem,
  Reaction,
  ReactionEmoji,
  ReadReceiptConfig,
  MessageStatusEntry,
} from '../types';
import { SocketEvents, MessageStatus } from '../types';

// ********** Message Size Limit ********** //
const MAX_MESSAGES = 500;

// ********** Extended Context Types ********** //
interface ExtendedConferBotContext extends ConferBotContextType {
  currentUIState: NodeUIState | null;
  isNodeProcessing: boolean;
  flowEngine: NodeFlowEngine | null;
  chatState: ChatState | null;
  submitNodeResponse: (response: any, portName?: string) => void;
  // Server customizations
  serverCustomizations: Record<string, any> | null;
  serverThemeOverride: Record<string, any> | null;
  botName: string | null;
  botAvatarUrl: string | null;
  // Persistence methods (already in ConferBotContextType, but explicitly listed here)
  isRestoring: boolean;
  hasPersistedSession: boolean;
  clearPersistedData: () => Promise<void>;
  resetConversation: () => Promise<void>;
  // Read receipt methods
  messageStatuses: Map<string | number, MessageStatusEntry>;
  readReceiptsEnabled: boolean;
  getMessageStatus: (messageId: string | number) => MessageStatus | undefined;
  markMessageAsRead: (messageId: string | number) => void;
  markVisibleMessagesAsRead: (messageIds: (string | number)[]) => void;
  // Knowledge Base methods
  rateKBArticle: (articleId: string, helpful: boolean, rating: number, feedback?: string) => void;
}

// ********** Extended Config Types ********** //
interface ExtendedConferBotConfig extends ConferBotConfig {
  /** Enable session persistence (default: true) */
  enablePersistence?: boolean;
  /** Persistence configuration */
  persistenceConfig?: StorageConfig;
  /** AsyncStorage instance for persistence */
  asyncStorage?: AsyncStorageInterface;
  /** Enable read receipts (default: true) */
  enableReadReceipts?: boolean;
  /** Read receipts configuration */
  readReceiptConfig?: ReadReceiptConfig;
}

// ********** Context Creation ********** //
// Create ConferBot context
const ConferBotContext = createContext<ExtendedConferBotContext | null>(null);

// ********** Provider Props ********** //
interface ConferBotProviderProps {
  apiKey: string;
  botId: string;
  config?: ExtendedConferBotConfig;
  customization?: ConferBotCustomization;
  user?: ConferBotUser;
  children: React.ReactNode;
}

// ********** ConferBot Provider Component ********** //
export const ConferBotProvider: React.FC<ConferBotProviderProps> = ({
  apiKey,
  botId,
  config,
  customization: _customization,
  user,
  children,
}) => {
  // ********** Helper: Trim messages to limit ********** //
  const trimMessages = (messages: RecordItem[]): RecordItem[] => {
    if (messages.length > MAX_MESSAGES) {
      return messages.slice(-MAX_MESSAGES);
    }
    return messages;
  };

  // ********** Helper: Deduplicate messages (HIGH FIX 4) ********** //
  const deduplicateMessages = (messages: RecordItem[]): RecordItem[] => {
    const seen = new Set<string | number>();
    return messages.filter(msg => {
      if (!msg._id) return true; // Keep messages without IDs
      if (seen.has(msg._id)) return false; // Skip duplicates
      seen.add(msg._id);
      return true;
    });
  };

  // ********** Input Validation ********** //
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('[ConferBot] API key is required');
  }
  if (!botId || botId.trim() === '') {
    throw new Error('[ConferBot] Bot ID is required');
  }
  // Validate API key format (skip in dev mode for testing)
  if (!__DEV__ && !apiKey.startsWith('conf_')) {
    throw new Error('[ConferBot] Invalid API key format. API key must start with "conf_"');
  }

  // ********** State Management ********** //
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | undefined>(undefined);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentAgent, setCurrentAgent] = useState<Agent | undefined>(undefined);
  const [record, setRecord] = useState<RecordItem[]>([]);
  const [chatbotConfig, setChatbotConfig] = useState<ChatbotConfig | undefined>(undefined);

  // Reactions State
  const [reactions, setReactions] = useState<Map<string, Reaction[]>>(new Map());

  // Node Flow Engine State
  const [currentUIState, setCurrentUIState] = useState<NodeUIState | null>(null);
  const [isNodeProcessing, setIsNodeProcessing] = useState(false);

  // Server customizations (theme colors, bot name, avatar, etc.)
  const [serverCustomizations, setServerCustomizations] = useState<Record<string, any> | null>(null);

  // Persistence State
  const [isRestoring, setIsRestoring] = useState(true);
  const [hasPersistedSession, setHasPersistedSession] = useState(false);

  // ********** Service References ********** //
  const apiClient = useRef<ConferBotAPI | null>(null);
  const socketClient = useRef<ConferBotSocket | null>(null);
  const storageService = useRef<StorageService | null>(null);

  // Node Flow Engine References
  const flowEngine = useRef<NodeFlowEngine | null>(null);
  const chatStateRef = useRef<ChatState | null>(null);
  const workspaceIdRef = useRef<string | null>(null);

  // Track if persistence is enabled
  const persistenceEnabled = config?.enablePersistence !== false && !!config?.asyncStorage;

  // Read receipts configuration
  const readReceiptsEnabled = config?.enableReadReceipts !== false;
  const readReceiptConfig: ReadReceiptConfig = {
    enabled: readReceiptsEnabled,
    showIndicators: config?.readReceiptConfig?.showIndicators !== false,
    batchDebounceMs: config?.readReceiptConfig?.batchDebounceMs ?? 500,
    autoMarkAsRead: config?.readReceiptConfig?.autoMarkAsRead !== false,
  };

  // ********** Read Receipts Hook ********** //
  const {
    messageStatuses,
    getMessageStatus,
    markAsRead,
    batchMarkAsRead,
    markVisibleMessagesAsRead,
    setMessageSending,
    isEnabled: readReceiptsIsEnabled,
  } = useReadReceipts({
    socket: socketClient.current,
    chatState: chatStateRef.current,
    chatSessionId,
    config: readReceiptConfig,
    isChatVisible: isOpen,
  });

  // ********** Storage Service Initialization ********** //
  const initializeStorage = useCallback(async (): Promise<PersistedState | null> => {
    if (!persistenceEnabled || !config?.asyncStorage) {
      setIsRestoring(false);
      return null;
    }

    try {
      storageService.current = new StorageService(botId, config.persistenceConfig);
      await storageService.current.initialize(config.asyncStorage);

      // Load persisted state
      const persistedState = await storageService.current.loadAll();

      if (persistedState.session) {
        setHasPersistedSession(true);
        if (__DEV__) {
          console.log('[ConferBot] Found persisted session:', persistedState.session.chatSessionId);
        }
      }

      return persistedState;
    } catch (error) {
      console.error('[ConferBot] Failed to initialize storage:', error);
      return null;
    }
  }, [botId, config?.asyncStorage, config?.persistenceConfig, persistenceEnabled]);

  // ********** Persistence Helpers ********** //
  const persistSession = useCallback(async (sessionData: Partial<PersistedSessionData>) => {
    if (storageService.current?.isReady()) {
      await storageService.current.saveSession(sessionData);
    }
  }, []);

  const persistMessages = useCallback(async (messages: RecordItem[]) => {
    if (storageService.current?.isReady()) {
      await storageService.current.saveMessages(messages);
    }
  }, []);

  const persistUserData = useCallback(async (userData: ConferBotUser) => {
    if (storageService.current?.isReady()) {
      await storageService.current.saveUser({
        userId: userData.id,
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        metadata: userData.metadata,
      });
    }
  }, []);

  const persistAnswerVariables = useCallback(async () => {
    if (storageService.current?.isReady() && chatStateRef.current) {
      const variables = chatStateRef.current.getAnswerVariables();
      await storageService.current.saveAnswerVariables(variables);
    }
  }, []);

  const persistFlowState = useCallback(async () => {
    if (storageService.current?.isReady() && chatStateRef.current) {
      await storageService.current.saveSession({
        currentNodeId: chatStateRef.current.currentNodeId || undefined,
        visitedNodes: chatStateRef.current.getVisitedNodes(),
        isFlowComplete: chatStateRef.current.isFlowComplete,
        flowCompletionReason: chatStateRef.current.flowCompletionReason,
      });
    }
  }, []);

  // ********** Clear Persistence ********** //
  const clearPersistedData = useCallback(async () => {
    if (storageService.current?.isReady()) {
      await storageService.current.clearAll();
      setHasPersistedSession(false);
      if (__DEV__) {
        console.log('[ConferBot] Persisted data cleared');
      }
    }
  }, []);

  // ********** Reset Conversation (keeps user data) ********** //
  const resetConversation = useCallback(async () => {
    // Clear in-memory state
    setChatSessionId(undefined);
    setCurrentAgent(undefined);
    setRecord([]);
    setReactions(new Map());
    setCurrentUIState(null);
    setIsNodeProcessing(false);
    flowEngine.current?.reset();
    chatStateRef.current = null;

    // Clear persisted conversation data (keeps user data)
    if (storageService.current?.isReady()) {
      await storageService.current.resetConversation();
      setHasPersistedSession(false);
    }

    if (__DEV__) {
      console.log('[ConferBot] Conversation reset');
    }
  }, []);

  // ********** Reaction Actions ********** //
  const addReaction = useCallback(
    (messageId: string, emoji: ReactionEmoji) => {
      if (!chatSessionId || !user) {
        console.warn('[ConferBot] Cannot add reaction: no active session or user');
        return;
      }

      const newReaction: Reaction = {
        emoji,
        userId: user.id,
        userName: user.name,
        timestamp: new Date().toISOString(),
      };

      setReactions((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(messageId) || [];
        // Check if user already reacted with this emoji
        const alreadyReacted = existing.some((r) => r.userId === user.id && r.emoji === emoji);
        if (!alreadyReacted) {
          newMap.set(messageId, [...existing, newReaction]);
        }
        return newMap;
      });

      // Send reaction via socket using the dedicated method
      if (socketClient.current?.isConnected()) {
        socketClient.current.sendMessageReaction(chatSessionId, messageId, emoji, 'add', user.name);
      }
    },
    [chatSessionId, user]
  );

  const removeReaction = useCallback(
    (messageId: string, emoji: ReactionEmoji) => {
      if (!chatSessionId || !user) {
        console.warn('[ConferBot] Cannot remove reaction: no active session or user');
        return;
      }

      setReactions((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(messageId) || [];
        const filtered = existing.filter((r) => !(r.userId === user.id && r.emoji === emoji));
        if (filtered.length > 0) {
          newMap.set(messageId, filtered);
        } else {
          newMap.delete(messageId);
        }
        return newMap;
      });

      // Send reaction removal via socket using the dedicated method
      if (socketClient.current?.isConnected()) {
        socketClient.current.sendMessageReaction(
          chatSessionId,
          messageId,
          emoji,
          'remove',
          user.name
        );
      }
    },
    [chatSessionId, user]
  );

  const getReactions = useCallback(
    (messageId: string): Reaction[] => {
      return reactions.get(messageId) || [];
    },
    [reactions]
  );

  // ********** Node Flow Engine Initialization ********** //
  const initializeFlowEngine = useCallback(
    (sessionId: string, persistedState?: PersistedState | null) => {
      if (!socketClient.current) {
        console.warn('[ConferBot] Cannot initialize flow engine: socket not available');
        return;
      }

      // Initialize handler registry with all handlers (display, ask, choice, logic, integration, special)
      const registry = NodeHandlerRegistry.getInstance();
      registerAllHandlers(registry, {
        socketClient: socketClient.current,
      });

      // Create chat state - either restore from persisted or create new
      if (persistedState?.session && persistedState.answerVariables) {
        // Restore from persisted state
        const restoredStateData = {
          sessionId,
          botId,
          answerVariables: persistedState.answerVariables.variables,
          variables: {},
          userMetadata: persistedState.user
            ? storageService.current?.toUserMetadata(persistedState.user)
            : {},
          transcript: [],
          record: persistedState.messages,
          currentNodeId: persistedState.session.currentNodeId,
          visitedNodes: persistedState.session.visitedNodes || [],
          isFlowComplete: persistedState.session.isFlowComplete || false,
          flowCompletionReason: persistedState.session.flowCompletionReason,
        };

        chatStateRef.current = ChatState.fromJSON(restoredStateData);

        if (__DEV__) {
          console.log('[ConferBot] Restored chat state from persistence');
        }
      } else {
        // Create new chat state
        chatStateRef.current = new ChatState(sessionId, botId);
      }

      // Add listener to persist state changes
      chatStateRef.current.addListener(() => {
        // Debounced persistence of answer variables and flow state
        persistAnswerVariables();
        persistFlowState();
      });

      // Create flow engine (HIGH FIX 6: wrapped in try-catch)
      try {
        flowEngine.current = new NodeFlowEngine(chatStateRef.current, registry, {
          socketClient: socketClient.current,
          onUIStateChange: (uiState) => {
            setCurrentUIState(uiState);
            setIsNodeProcessing(false);
          },
          onWaitingForInput: (_nodeId, _uiState) => {
            setIsNodeProcessing(false);
          },
          onFlowComplete: (reason) => {
            if (__DEV__) {
              console.log('[ConferBot] Flow complete:', reason);
            }
            setIsNodeProcessing(false);
            // Persist flow completion
            persistFlowState();
          },
          onError: (error, nodeId) => {
            console.error('[ConferBot] Flow engine error:', error.message, { nodeId });
            setIsNodeProcessing(false);
          },
          debug: __DEV__,
        });

        if (__DEV__) {
          console.log('[ConferBot] Flow engine initialized for session:', sessionId);
        }
      } catch (error) {
        console.error('[ConferBot] Failed to initialize flow engine:', error);
        flowEngine.current = null;
        setIsNodeProcessing(false);
      }
    },
    [botId, persistAnswerVariables, persistFlowState]
  );

  // ********** Restore Session ********** //
  const restoreSession = useCallback(
    async (persistedState: PersistedState) => {
      if (!persistedState.session || !apiClient.current) return false;

      try {
        const sessionId = persistedState.session.chatSessionId;
        const visitorId = persistedState.session.visitorId;

        // Verify session is still valid on the server
        const historyResponse = await apiClient.current.getSessionHistory(sessionId);

        if (!historyResponse.success) {
          // Session no longer valid on server, clear persisted data
          if (__DEV__) {
            console.log('[ConferBot] Persisted session invalid on server, clearing');
          }
          await storageService.current?.clearAll();
          setHasPersistedSession(false);
          return false;
        }

        // Restore session state
        setChatSessionId(sessionId);

        // Merge persisted messages with server messages (server takes precedence)
        const serverRecord = historyResponse.data?.record || [];
        if (serverRecord.length > 0) {
          setRecord(deduplicateMessages(trimMessages(serverRecord)));
          // Update persisted messages with server data
          await persistMessages(serverRecord);
        } else if (persistedState.messages.length > 0) {
          setRecord(deduplicateMessages(trimMessages(persistedState.messages)));
        }

        // Initialize flow engine with restored state
        initializeFlowEngine(sessionId, persistedState);

        // Join chat room via socket
        if (socketClient.current && socketClient.current.isConnected()) {
          socketClient.current.joinChatRoomVisitor(sessionId);
        }

        // Touch session to update lastAccessed timestamp
        await storageService.current?.touchSession();

        if (__DEV__) {
          console.log('[ConferBot] Session restored successfully:', sessionId);
        }

        return true;
      } catch (error) {
        console.error('[ConferBot] Failed to restore session:', error);
        return false;
      }
    },
    [initializeFlowEngine, persistMessages]
  );

  // ********** Initialization ********** //
  // Initialize SDK on mount
  useEffect(() => {
    const initializeSDK = async () => {
      try {
        // Initialize storage first
        const persistedState = await initializeStorage();

        // Create API client
        apiClient.current = new ConferBotAPI(apiKey, botId);

        // Create Socket client
        socketClient.current = new ConferBotSocket({
          apiKey,
          botId,
          userId: user?.id || persistedState?.user?.userId,
          autoConnect: config?.autoConnect !== false,
        });

        // Set up socket event listeners BEFORE connecting
        // This ensures we catch the fetched-chatbot-data event
        setupSocketListeners();

        // Connect socket if autoConnect is enabled
        // Socket connection automatically fetches chatbot data via 'get-chatbot-data' event
        if (config?.autoConnect !== false) {
          await socketClient.current.connect(user?.id || persistedState?.user?.userId);
          setIsConnected(true);
        }

        // Persist user data if provided
        if (user) {
          await persistUserData(user);
        }

        // Try to restore persisted session
        if (persistedState?.session) {
          const restored = await restoreSession(persistedState);
          if (!restored) {
            setIsRestoring(false);
          }
        }

        setIsRestoring(false);
        setIsInitialized(true);

        if (__DEV__) {
          console.log('[ConferBot] SDK initialized successfully');
        }
      } catch (error) {
        console.error('[ConferBot] Initialization error:', error);
        setIsRestoring(false);
      }
    };

    initializeSDK();

    // Cleanup on unmount
    return () => {
      if (socketClient.current) {
        socketClient.current.removeAllListeners();
        socketClient.current.disconnect();
        socketClient.current = null;
      }
      if (flowEngine.current) {
        flowEngine.current.reset();
        flowEngine.current = null;
      }
      chatStateRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, botId]);

  // ********** Socket Event Listeners ********** //
  // Set up socket event listeners
  const setupSocketListeners = useCallback(() => {
    if (!socketClient.current) return;

    // Chatbot data fetched — contains elements (nodes/edges) and customizations
    socketClient.current.on(SocketEvents.FETCHED_CHATBOT_DATA, (data: any) => {
      if (__DEV__) {
        console.log('[ConferBot] Chatbot data received');
      }

      const chatbotData = data?.chatbotData;
      if (!chatbotData) return;

      // Store workspaceId for handover and other integrations
      if (chatbotData.workspaceId) {
        if (chatStateRef.current) {
          chatStateRef.current.setVariable('_workspaceId', chatbotData.workspaceId);
        }
        // Also store in ref so it's available when chatState initializes later
        workspaceIdRef.current = chatbotData.workspaceId;
      }

      // Parse server customizations
      const customizations = chatbotData.customizations;
      if (customizations) {
        setServerCustomizations(customizations);
        if (__DEV__) {
          console.log('[ConferBot] Server customizations loaded:', Object.keys(customizations).length, 'keys');
          console.log('[ConferBot] botName/logoText:', customizations.botName || customizations.logoText);
          console.log('[ConferBot] avatar:', customizations.avatar);
          console.log('[ConferBot] enableTagline:', customizations.enableTagline, 'tagline:', customizations.tagline);
        }
      }

      // Parse elements (nodes and edges)
      const elements = chatbotData.elements;
      if (elements && Array.isArray(elements) && elements.length > 0) {
        const firstElement = elements[0];
        const nodes = firstElement.nodes || [];
        const edges = firstElement.edges || [];

        if (__DEV__) {
          console.log('[ConferBot] Loaded', nodes.length, 'nodes and', edges.length, 'edges');
        }

        if (nodes.length > 0) {
          // Initialize flow engine if not already initialized (fresh session)
          if (__DEV__) {
            console.log('[ConferBot] flowEngine.current:', !!flowEngine.current, 'chatSessionId:', chatSessionId);
          }
          if (!flowEngine.current) {
            const sessionId = chatSessionId || `session_${Date.now()}`;
            if (!chatSessionId) {
              setChatSessionId(sessionId);
            }
            if (__DEV__) {
              console.log('[ConferBot] Initializing flow engine for session:', sessionId);
            }
            initializeFlowEngine(sessionId);

            // Add a ChatState listener to sync bot messages to record
            if (chatStateRef.current) {
              let lastTranscriptLength = 0;
              chatStateRef.current.addListener((state) => {
                const transcript = state.getTranscript();
                if (transcript.length > lastTranscriptLength) {
                  // Process new transcript entries
                  const newEntries = transcript.slice(lastTranscriptLength);
                  lastTranscriptLength = transcript.length;

                  const newRecordItems: RecordItem[] = [];
                  for (const entry of newEntries) {
                    if (entry.type === 'bot' && entry.text) {
                      newRecordItems.push({
                        _id: `bot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                        type: 'bot-message',
                        shape: 'bot-text-message',
                        text: entry.text,
                        time: entry.timestamp || new Date().toISOString(),
                      } as any);
                    } else if (entry.type === 'user' && entry.text) {
                      newRecordItems.push({
                        _id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                        type: 'user-message',
                        shape: 'user-text-message',
                        text: entry.text,
                        time: entry.timestamp || new Date().toISOString(),
                      } as any);
                    }
                  }

                  if (newRecordItems.length > 0) {
                    setRecord((prev) => deduplicateMessages(trimMessages([...prev, ...newRecordItems])));
                  }
                }
              });
            }
          }

          // Start flow engine with parsed data
          if (__DEV__) {
            console.log('[ConferBot] After init, flowEngine.current:', !!flowEngine.current, 'chatStateRef.current:', !!chatStateRef.current);
          }
          if (flowEngine.current) {
            // Set metadata on chatState for handover and integrations
            if (chatStateRef.current) {
              if (workspaceIdRef.current) {
                chatStateRef.current.setVariable('_workspaceId', workspaceIdRef.current);
              }
              const resolvedBotName = customizations?.botName || customizations?.logoText || '';
              if (resolvedBotName) {
                chatStateRef.current.setVariable('_botName', resolvedBotName);
              }
            }

            setIsNodeProcessing(true);
            const flowDefinition: FlowDefinition = {
              nodes,
              edges,
              startNodeId: nodes[0]?.id || '',
            };
            flowEngine.current.loadFlow(flowDefinition);
            flowEngine.current.start().catch((error) => {
              console.error('[ConferBot] Failed to start flow:', error);
              setIsNodeProcessing(false);
            });
          }
        }
      }
    });

    // Bot response received (contains record update and potentially flow data)
    socketClient.current.on(SocketEvents.BOT_RESPONSE, (data: any) => {
      if (data.record) {
        setRecord(deduplicateMessages(trimMessages(data.record)));
        // Persist messages on bot response
        persistMessages(data.record);
      }
      if (!isOpen) {
        setUnreadCount((prev) => prev + 1);
      }

      // Handle flow processing if flow data is present
      if (data.flow && data.startNode && flowEngine.current) {
        setIsNodeProcessing(true);
        const flowDefinition: FlowDefinition = {
          nodes: data.flow.nodes || [],
          edges: data.flow.edges || [],
          startNodeId: data.startNode,
        };
        flowEngine.current.loadFlow(flowDefinition);
        flowEngine.current.start().catch((error) => {
          console.error('[ConferBot] Failed to start flow:', error);
          setIsNodeProcessing(false);
        });
      }
    });

    // Agent message received
    socketClient.current.on(SocketEvents.AGENT_MESSAGE, (data: any) => {
      if (data.record) {
        setRecord(deduplicateMessages(trimMessages(data.record)));
        // Persist messages on agent message
        persistMessages(data.record);
      }
      if (!isOpen) {
        setUnreadCount((prev) => prev + 1);
      }
    });

    // Agent accepted handover (embed-server sends agentDetails)
    socketClient.current.on(SocketEvents.AGENT_ACCEPTED, (data: any) => {
      if (data.agentDetails) {
        // Map agentDetails to Agent interface
        setCurrentAgent({
          id: data.agentDetails._id,
          name: data.agentDetails.name,
          email: data.agentDetails.email,
        });
      }
    });

    // Agent left
    socketClient.current.on(SocketEvents.AGENT_LEFT, () => {
      setCurrentAgent(undefined);
    });

    // Chat ended
    socketClient.current.on(SocketEvents.CHAT_ENDED, (data: any) => {
      setChatSessionId(undefined);
      setCurrentAgent(undefined);
      if (data.record) {
        setRecord(deduplicateMessages(trimMessages(data.record)));
      }
      // Reset flow engine on chat end
      flowEngine.current?.reset();
      setCurrentUIState(null);
      setIsNodeProcessing(false);
      // Mark session as inactive in storage
      persistSession({ isActive: false });
    });

    // Visitor disconnected
    socketClient.current.on(SocketEvents.VISITOR_DISCONNECTED, () => {
      setChatSessionId(undefined);
      setCurrentAgent(undefined);
      // Reset flow engine on disconnect
      flowEngine.current?.reset();
      setCurrentUIState(null);
      setIsNodeProcessing(false);
    });

    // Connection status
    socketClient.current.on(SocketEvents.CONNECTION_ERROR, () => {
      setIsConnected(false);
    });

    // Reaction updates from server
    socketClient.current.on(SocketEvents.MESSAGE_REACTION_UPDATE, (data: any) => {
      if (data.messageId && Array.isArray(data.reactions)) {
        setReactions((prev) => {
          const newMap = new Map(prev);
          if (data.reactions.length > 0) {
            newMap.set(data.messageId, data.reactions);
          } else {
            newMap.delete(data.messageId);
          }
          return newMap;
        });
      }
    });
  }, [isOpen, persistMessages, persistSession, initializeFlowEngine, chatSessionId]);

  // ********** Chat Actions ********** //
  // Open chat
  const openChat = useCallback(async () => {
    setIsOpen(true);
    setUnreadCount(0);

    // Initialize session if not already created
    if (!chatSessionId && apiClient.current) {
      try {
        // Get or create visitor ID
        const visitorId = storageService.current?.isReady()
          ? await storageService.current.getOrCreateVisitorId()
          : user?.id;

        const response = await apiClient.current.initSession(visitorId);
        if (response.success && response.data) {
          const sessionId = response.data.chatSessionId;
          setChatSessionId(sessionId);

          // Persist session immediately
          await persistSession({
            chatSessionId: sessionId,
            visitorId: visitorId || undefined,
            isActive: true,
          });
          setHasPersistedSession(true);

          // Initialize flow engine with the new session
          initializeFlowEngine(sessionId);

          // Load session history (record)
          const historyResponse = await apiClient.current.getSessionHistory(sessionId);
          if (historyResponse.success && historyResponse.data && historyResponse.data.record) {
            setRecord(deduplicateMessages(trimMessages(historyResponse.data.record)));
            // Persist initial messages
            await persistMessages(historyResponse.data.record);
          }

          // Join chat room via socket
          if (socketClient.current && socketClient.current.isConnected()) {
            socketClient.current.joinChatRoomVisitor(sessionId);
          }
        }
      } catch (error) {
        console.error('[ConferBot] Failed to initialize session:', error);
      }
    }
  }, [chatSessionId, user?.id, initializeFlowEngine, persistSession, persistMessages]);

  // Close chat
  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Send message
  const sendMessage = useCallback(
    async (text: string, _attachments?: MessageAttachment[]): Promise<void> => {
      if (!chatSessionId || !apiClient.current) {
        console.warn('[ConferBot] Cannot send message: no active session');
        return;
      }

      try {
        // Generate a unique message ID
        const messageId = `${chatSessionId}-${Date.now()}`;

        // Create user message in record format
        const userMessageRecord: RecordItem = {
          _id: messageId,
          type: 'user-message',
          text,
          time: new Date(),
        } as RecordItem;

        // Set message status to SENDING if read receipts enabled
        if (readReceiptsEnabled && chatStateRef.current) {
          chatStateRef.current.setMessageSending(messageId);
        }

        // Add to record immediately (optimistic update)
        const updatedRecord = deduplicateMessages(trimMessages([...record, userMessageRecord]));
        setRecord(updatedRecord);

        // Persist messages
        await persistMessages(updatedRecord);

        // Send via Socket for real-time (embed-server format)
        if (socketClient.current && socketClient.current.isConnected()) {
          socketClient.current.sendResponseRecord({
            chatSessionId,
            record: updatedRecord,
          });

          // Mark message as SENT after socket emit (optimistic)
          if (readReceiptsEnabled && chatStateRef.current) {
            // Small delay to simulate network
            setTimeout(() => {
              chatStateRef.current?.setMessageSent(messageId);
            }, 100);
          }
        }

        if (__DEV__) {
          console.log('[ConferBot] Message sent successfully');
        }
      } catch (error) {
        console.error('[ConferBot] Failed to send message:', error);
        throw error;
      }
    },
    [chatSessionId, record, persistMessages, readReceiptsEnabled]
  );

  // Submit node response (for flow engine interactions)
  const submitNodeResponse = useCallback((response: any, portName?: string) => {
    if (!flowEngine.current) {
      console.warn('[ConferBot] Cannot submit response: flow engine not initialized');
      return;
    }

    // Freeze the current choice UI into the record so buttons stay visible (disabled)
    const currentState = flowEngine.current.getState();
    if (currentState.currentUIState && currentState.currentUIState.type === 'buttons') {
      const choiceUI = currentState.currentUIState as any;
      setRecord((prev) => [
        ...prev,
        {
          _id: `choice_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          type: 'bot-message',
          shape: 'bot-choice-buttons',
          choiceUI: {
            ...choiceUI,
            isSubmitted: true,
            selectedButtonId: response?.buttonId,
            selectedButtonIds: response?.buttonIds,
          },
          time: new Date().toISOString(),
        } as any,
      ]);
    }

    setIsNodeProcessing(true);
    flowEngine.current.submitResponse(response, portName).catch((error) => {
      console.error('[ConferBot] Failed to submit node response:', error);
      setIsNodeProcessing(false);
    });
  }, []);

  // Register push token
  const registerPushToken = useCallback(async (token: string): Promise<void> => {
    if (!apiClient.current) return;

    try {
      // Detect platform
      const platform = Platform.OS as 'ios' | 'android';

      await apiClient.current.registerPushToken(token, platform);

      if (__DEV__) {
        console.log('[ConferBot] Push token registered:', token);
      }
    } catch (error) {
      console.error('[ConferBot] Failed to register push token:', error);
    }
  }, []);

  // Rate a Knowledge Base article
  const rateKBArticle = useCallback(
    (articleId: string, helpful: boolean, rating: number, feedback?: string): void => {
      if (!socketClient.current || !socketClient.current.isConnected()) {
        if (__DEV__) {
          console.warn('[ConferBot] Cannot rate article: socket not connected');
        }
        return;
      }

      socketClient.current.rateArticle({
        articleId,
        visitorId: user?.id || socketClient.current.getUserId(),
        sessionId: chatSessionId,
        helpful,
        rating,
        feedback,
      });
    },
    [chatSessionId, user?.id]
  );

  // Add event listener
  const on = useCallback(
    (event: SocketEvents, callback: (...args: any[]) => void): (() => void) => {
      if (!socketClient.current) {
        // Socket not yet initialized — silently skip (will be set up later)
        return () => {};
      }

      return socketClient.current.on(event, callback);
    },
    []
  );

  // Remove event listener
  const off = useCallback((event: SocketEvents, callback: (...args: any[]) => void): void => {
    if (!socketClient.current) return;
    socketClient.current.off(event, callback);
  }, []);

  // ********** Build Server Theme Override ********** //
  const serverThemeOverride = useMemo(() => {
    if (!serverCustomizations) return null;
    const c = serverCustomizations;
    const override: Record<string, any> = { colors: {} };

    if (c.headerBgColor) override.colors.headerBg = c.headerBgColor;
    if (c.headerTextColor) override.colors.headerText = c.headerTextColor;
    if (c.botMsgColor) {
      override.colors.botBubble = c.botMsgColor;
      override.colors.primary = c.botMsgColor;
      override.colors.primaryLight = c.botMsgColor + '33';
    }
    if (c.botTextColor) override.colors.botBubbleText = c.botTextColor;
    if (c.userMsgColor) override.colors.userBubble = c.userMsgColor;
    if (c.userTextColor) override.colors.userBubbleText = c.userTextColor;
    if (c.optionBubbleMsgColor) override.colors.optionBubble = c.optionBubbleMsgColor;
    if (c.optionBubbleTextColor) override.colors.optionBubbleText = c.optionBubbleTextColor;
    if (c.chatBgColor) override.colors.background = c.chatBgColor;

    // Font size
    if (c.fontSize) {
      const size = parseInt(c.fontSize, 10);
      if (!isNaN(size)) {
        override.typography = { fontSize: { md: size } };
      }
    }

    return Object.keys(override.colors).length > 0 ? override : null;
  }, [serverCustomizations]);

  // ********** Context Value ********** //
  const contextValue: ExtendedConferBotContext = {
    // State
    isInitialized,
    isConnected,
    isOpen,
    chatSessionId,
    unreadCount,
    currentAgent,
    record,
    chatbotConfig,

    // Reactions State
    reactions,

    // Node Flow Engine State
    currentUIState,
    isNodeProcessing,
    flowEngine: flowEngine.current,
    chatState: chatStateRef.current,

    // Server customizations
    serverCustomizations,
    serverThemeOverride,
    botName: serverCustomizations?.botName || serverCustomizations?.logoText || null,
    botAvatarUrl: serverCustomizations?.avatar || serverCustomizations?.logo || null,

    // Persistence State
    isRestoring,
    hasPersistedSession,

    // Read Receipt State
    messageStatuses,
    readReceiptsEnabled: readReceiptsIsEnabled,

    // Actions
    openChat,
    closeChat,
    sendMessage,
    registerPushToken,
    on,
    off,

    // Reaction Actions
    addReaction,
    removeReaction,
    getReactions,

    // Node Flow Engine Actions
    submitNodeResponse,

    // Persistence Actions
    clearPersistedData,
    resetConversation,

    // Read Receipt Actions
    getMessageStatus,
    markMessageAsRead: markAsRead,
    markVisibleMessagesAsRead,

    // Knowledge Base Actions
    rateKBArticle,
  };

  return <ConferBotContext.Provider value={contextValue}>{children}</ConferBotContext.Provider>;
};

// ********** Custom Hook ********** //
// useConferBot hook for consuming context
export const useConferBot = (): ExtendedConferBotContext => {
  const context = useContext(ConferBotContext);

  if (!context) {
    throw new Error('useConferBot must be used within a ConferBotProvider');
  }

  return context;
};

export default ConferBotContext;
