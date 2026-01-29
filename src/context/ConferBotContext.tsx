import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import ConferBotAPI from '../services/api';
import ConferBotSocket from '../services/socket';
import {
  NodeFlowEngine,
  ChatState,
  NodeHandlerRegistry,
  registerAllDisplayHandlers,
  NodeUIState,
  FlowDefinition,
} from '../core';
import type {
  ConferBotConfig,
  ConferBotUser,
  ConferBotCustomization,
  ConferBotContext as ConferBotContextType,
  Agent,
  MessageAttachment,
  ChatbotConfig,
} from '../types';
import { SocketEvents } from '../types';

// ********** Extended Context Types ********** //
interface ExtendedConferBotContext extends ConferBotContextType {
  currentUIState: NodeUIState | null;
  isNodeProcessing: boolean;
  flowEngine: NodeFlowEngine | null;
  chatState: ChatState | null;
  submitNodeResponse: (response: any, portName?: string) => void;
}

// ********** Context Creation ********** //
// Create ConferBot context
const ConferBotContext = createContext<ExtendedConferBotContext | null>(null);

// ********** Provider Props ********** //
interface ConferBotProviderProps {
  apiKey: string;
  botId: string;
  config?: ConferBotConfig;
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
  // ********** State Management ********** //
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | undefined>(undefined);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentAgent, setCurrentAgent] = useState<Agent | undefined>(undefined);
  const [record, setRecord] = useState<any[]>([]);
  const [chatbotConfig, setChatbotConfig] = useState<ChatbotConfig | undefined>(undefined);

  // Node Flow Engine State
  const [currentUIState, setCurrentUIState] = useState<NodeUIState | null>(null);
  const [isNodeProcessing, setIsNodeProcessing] = useState(false);

  // ********** Service References ********** //
  const apiClient = useRef<ConferBotAPI | null>(null);
  const socketClient = useRef<ConferBotSocket | null>(null);

  // Node Flow Engine References
  const flowEngine = useRef<NodeFlowEngine | null>(null);
  const chatStateRef = useRef<ChatState | null>(null);

  // ********** Node Flow Engine Initialization ********** //
  const initializeFlowEngine = useCallback((sessionId: string) => {
    if (!socketClient.current) {
      console.warn('[ConferBot] Cannot initialize flow engine: socket not available');
      return;
    }

    // Initialize handler registry
    const registry = NodeHandlerRegistry.getInstance();
    registerAllDisplayHandlers(registry);

    // Create chat state
    chatStateRef.current = new ChatState(sessionId, botId);

    // Create flow engine
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
  }, [botId]);

  // ********** Initialization ********** //
  // Initialize SDK on mount
  useEffect(() => {
    const initializeSDK = async () => {
      try {
        // Create API client
        apiClient.current = new ConferBotAPI(apiKey, botId);

        // Create Socket client
        socketClient.current = new ConferBotSocket({
          apiKey,
          botId,
          userId: user?.id,
          autoConnect: config?.autoConnect !== false,
        });

        // Fetch chatbot configuration
        const configResponse = await apiClient.current.getChatbotConfig();
        if (configResponse.success && configResponse.data) {
          setChatbotConfig(configResponse.data);
        }

        // Connect socket if autoConnect is enabled
        if (config?.autoConnect !== false) {
          await socketClient.current.connect(user?.id);
          setIsConnected(true);
        }

        // Set up socket event listeners
        setupSocketListeners();

        setIsInitialized(true);

        if (__DEV__) {
          console.log('[ConferBot] SDK initialized successfully');
        }
      } catch (error) {
        console.error('[ConferBot] Initialization error:', error);
      }
    };

    initializeSDK();

    // Cleanup on unmount
    return () => {
      socketClient.current?.disconnect();
      flowEngine.current?.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, botId]);

  // ********** Socket Event Listeners ********** //
  // Set up socket event listeners
  const setupSocketListeners = useCallback(() => {
    if (!socketClient.current) return;

    // Bot response received (contains record update and potentially flow data)
    socketClient.current.on(SocketEvents.BOT_RESPONSE, (data: any) => {
      if (data.record) {
        setRecord(data.record);
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
        setRecord(data.record);
      }
      if (!isOpen) {
        setUnreadCount((prev) => prev + 1);
      }
    });

    // Agent accepted handover
    socketClient.current.on(SocketEvents.AGENT_ACCEPTED, (data: any) => {
      if (data.agent) {
        setCurrentAgent(data.agent);
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
        setRecord(data.record);
      }
      // Reset flow engine on chat end
      flowEngine.current?.reset();
      setCurrentUIState(null);
      setIsNodeProcessing(false);
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
  }, [isOpen]);

  // ********** Chat Actions ********** //
  // Open chat
  const openChat = useCallback(async () => {
    setIsOpen(true);
    setUnreadCount(0);

    // Initialize session if not already created
    if (!chatSessionId && apiClient.current) {
      try {
        const response = await apiClient.current.initSession(user?.id);
        if (response.success && response.data) {
          const sessionId = response.data.chatSessionId;
          setChatSessionId(sessionId);

          // Initialize flow engine with the new session
          initializeFlowEngine(sessionId);

          // Load session history (record)
          const historyResponse = await apiClient.current.getSessionHistory(sessionId);
          if (historyResponse.success && historyResponse.data && historyResponse.data.record) {
            setRecord(historyResponse.data.record);
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
  }, [chatSessionId, user?.id, initializeFlowEngine]);

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
        // Create user message in record format
        const userMessageRecord = {
          _id: chatSessionId,
          type: 'user-input-response',
          text,
          time: new Date(),
        };

        // Add to record immediately (optimistic update)
        setRecord((prev) => [...prev, userMessageRecord]);

        // Send via Socket for real-time (embed-server format)
        if (socketClient.current && socketClient.current.isConnected()) {
          socketClient.current.sendResponseRecord({
            chatSessionId,
            record: [...record, userMessageRecord],
          });
        }

        if (__DEV__) {
          console.log('[ConferBot] Message sent successfully');
        }
      } catch (error) {
        console.error('[ConferBot] Failed to send message:', error);
        throw error;
      }
    },
    [chatSessionId, record]
  );

  // Submit node response (for flow engine interactions)
  const submitNodeResponse = useCallback((response: any, portName?: string) => {
    if (!flowEngine.current) {
      console.warn('[ConferBot] Cannot submit response: flow engine not initialized');
      return;
    }

    setIsNodeProcessing(true);
    flowEngine.current.submitResponse(response, portName).catch((error) => {
      console.error('[ConferBot] Failed to submit node response:', error);
      setIsNodeProcessing(false);
    });
  }, []);

  // Register push token
  const registerPushToken = useCallback(
    async (token: string): Promise<void> => {
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
    },
    []
  );

  // Add event listener
  const on = useCallback(
    (event: SocketEvents, callback: (...args: any[]) => void): (() => void) => {
      if (!socketClient.current) {
        console.warn('[ConferBot] Cannot add event listener: socket not initialized');
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

    // Node Flow Engine State
    currentUIState,
    isNodeProcessing,
    flowEngine: flowEngine.current,
    chatState: chatStateRef.current,

    // Actions
    openChat,
    closeChat,
    sendMessage,
    registerPushToken,
    on,
    off,

    // Node Flow Engine Actions
    submitNodeResponse,
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
