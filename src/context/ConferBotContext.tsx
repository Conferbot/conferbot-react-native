import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import ConferBotAPI from '../services/api';
import ConferBotSocket from '../services/socket';
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

// ********** Context Creation ********** //
// Create ConferBot context
const ConferBotContext = createContext<ConferBotContextType | null>(null);

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

  // ********** Service References ********** //
  const apiClient = useRef<ConferBotAPI | null>(null);
  const socketClient = useRef<ConferBotSocket | null>(null);

  // ********** Initialization ********** //
  // Initialize SDK on mount
  useEffect(() => {
    const initializeSDK = async () => {
      try {
        // Create API client (for future REST endpoints)
        apiClient.current = new ConferBotAPI(apiKey, botId);

        // Create Socket client
        socketClient.current = new ConferBotSocket({
          apiKey,
          botId,
          userId: user?.id,
          autoConnect: config?.autoConnect !== false,
        });

        // Set up socket event listeners BEFORE connecting
        // This ensures we catch the fetched-chatbot-data event
        setupSocketListeners();

        // Connect socket if autoConnect is enabled
        // Socket connection automatically fetches chatbot data via 'get-chatbot-data' event
        if (config?.autoConnect !== false) {
          await socketClient.current.connect(user?.id);
          setIsConnected(true);
        }

        setIsInitialized(true);

        if (__DEV__) {
          console.log('[ConferBot] SDK initialized successfully');
        }
      } catch (error) {
        console.error('[ConferBot] Initialization error:', error);
        // Still mark as initialized but not connected
        setIsInitialized(true);
        setIsConnected(false);
      }
    };

    initializeSDK();

    // Cleanup on unmount
    return () => {
      socketClient.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, botId]);

  // ********** Socket Event Listeners ********** //
  // Set up socket event listeners
  const setupSocketListeners = useCallback(() => {
    if (!socketClient.current) return;

    // Chatbot data fetched (triggered on connection)
    socketClient.current.on(SocketEvents.FETCHED_CHATBOT_DATA, (data: any) => {
      if (__DEV__) {
        console.log('[ConferBot] Chatbot data received:', data);
      }
      if (data.chatbotData) {
        // Map the chatbot data to our ChatbotConfig interface
        setChatbotConfig({
          id: data.chatbotData._id || data.chatbotData.id,
          name: data.chatbotData.name || 'Conferbot',
          description: data.chatbotData.description,
          avatar: data.chatbotData.avatar,
          welcomeMessage: data.chatbotData.welcomeMessage,
          customizations: data.chatbotData.customizations,
          features: data.chatbotData.features,
        });
      }
    });

    // Bot response received (contains record update)
    socketClient.current.on(SocketEvents.BOT_RESPONSE, (data: any) => {
      if (data.record) {
        setRecord(data.record);
      }
      if (!isOpen) {
        setUnreadCount((prev) => prev + 1);
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
        setRecord(data.record);
      }
    });

    // Visitor disconnected
    socketClient.current.on(SocketEvents.VISITOR_DISCONNECTED, () => {
      setChatSessionId(undefined);
      setCurrentAgent(undefined);
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
          setChatSessionId(response.data.chatSessionId);

          // Load session history (record)
          const historyResponse = await apiClient.current.getSessionHistory(response.data.chatSessionId);
          if (historyResponse.success && historyResponse.data && historyResponse.data.record) {
            setRecord(historyResponse.data.record);
          }

          // Join chat room via socket
          if (socketClient.current && socketClient.current.isConnected()) {
            socketClient.current.joinChatRoomVisitor(response.data.chatSessionId);
          }
        }
      } catch (error) {
        console.error('[ConferBot] Failed to initialize session:', error);
      }
    }
  }, [chatSessionId, user?.id]);

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
  const contextValue: ConferBotContextType = {
    // State
    isInitialized,
    isConnected,
    isOpen,
    chatSessionId,
    unreadCount,
    currentAgent,
    record,
    chatbotConfig,

    // Actions
    openChat,
    closeChat,
    sendMessage,
    registerPushToken,
    on,
    off,
  };

  return <ConferBotContext.Provider value={contextValue}>{children}</ConferBotContext.Provider>;
};

// ********** Custom Hook ********** //
// useConferBot hook for consuming context
export const useConferBot = (): ConferBotContextType => {
  const context = useContext(ConferBotContext);

  if (!context) {
    throw new Error('useConferBot must be used within a ConferBotProvider');
  }

  return context;
};

export default ConferBotContext;
