// @ts-nocheck
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import ConferBotAPI from '../services/api';
import ConferBotSocket from '../services/socket';
import { useReadReceipts } from '../hooks/useReadReceipts';
import type {
  Agent,
  ChatbotConfig,
  RecordItem,
  ReadReceiptConfig,
} from '../types';
import { SocketEvents } from '../types';
import type { NodeFlowEngine, ChatState } from '../core';
import { deduplicateMessages, trimMessages } from './types';
import type { ExtendedConferBotContext, ConferBotProviderProps } from './types';

// Hooks
import { usePersistence } from './hooks/usePersistence';
import { useReactions } from './hooks/useReactions';
import { useFlowEngine } from './hooks/useFlowEngine';
import { useSocketListeners } from './hooks/useSocketListeners';
import { useLiveChat } from './hooks/useLiveChat';
import { useThemeOverride } from './hooks/useThemeOverride';

// ********** Context Creation ********** //
const ConferBotContext = createContext<ExtendedConferBotContext | null>(null);

// ********** ConferBot Provider Component ********** //
export const ConferBotProvider: React.FC<ConferBotProviderProps> = ({
  apiKey,
  botId,
  config,
  customization: _customization,
  user,
  children,
}) => {
  // ********** Input Validation ********** //
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('[ConferBot] API key is required');
  }
  if (!botId || botId.trim() === '') {
    throw new Error('[ConferBot] Bot ID is required');
  }
  if (!__DEV__ && !apiKey.startsWith('conf_')) {
    throw new Error('[ConferBot] Invalid API key format. API key must start with "conf_"');
  }

  // ********** Core State ********** //
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | undefined>(undefined);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentAgent, setCurrentAgent] = useState<Agent | undefined>(undefined);
  const [record, setRecord] = useState<RecordItem[]>([]);
  const [chatbotConfig, setChatbotConfig] = useState<ChatbotConfig | undefined>(undefined);
  const [serverCustomizations, setServerCustomizations] = useState<Record<string, any> | null>(null);

  // ********** Service References ********** //
  const apiClient = useRef<ConferBotAPI | null>(null);
  const socketClient = useRef<ConferBotSocket | null>(null);

  // Shared refs that multiple hooks need — owned by the orchestrator
  const flowEngineRef = useRef<NodeFlowEngine | null>(null);
  const chatStateRef = useRef<ChatState | null>(null);

  // ********** Persistence Hook ********** //
  const {
    isRestoring, setIsRestoring,
    hasPersistedSession, setHasPersistedSession,
    storageService, persistenceEnabled,
    initializeStorage,
    persistSession, persistMessages, persistUserData,
    persistAnswerVariables, persistFlowState,
    clearPersistedData,
  } = usePersistence({ botId, config, user, chatStateRef });

  // ********** Flow Engine Hook ********** //
  const {
    currentUIState, setCurrentUIState,
    isNodeProcessing, setIsNodeProcessing,
    workspaceIdRef, lastUserChoiceRef,
    initializeFlowEngine, submitNodeResponse,
  } = useFlowEngine({
    botId,
    user,
    socketClient,
    storageService,
    flowEngine: flowEngineRef,
    chatStateRef,
    setRecord,
    persistAnswerVariables,
    persistFlowState,
  });

  // ********** Reactions Hook ********** //
  const {
    reactions, setReactions,
    addReaction, removeReaction, getReactions,
  } = useReactions({ chatSessionId, user, socketClient });

  // ********** Live Chat Hook ********** //
  const readReceiptsEnabled = config?.enableReadReceipts !== false;
  const {
    isLiveChatMode, setIsLiveChatMode,
    agentTyping, setAgentTyping,
    sendVisitorTyping, sendMessage,
  } = useLiveChat({
    chatSessionId,
    socketClient,
    chatStateRef,
    record,
    setRecord,
    persistMessages,
    readReceiptsEnabled,
  });

  // ********** Read Receipts Hook ********** //
  const readReceiptConfig: ReadReceiptConfig = {
    enabled: readReceiptsEnabled,
    showIndicators: config?.readReceiptConfig?.showIndicators !== false,
    batchDebounceMs: config?.readReceiptConfig?.batchDebounceMs ?? 500,
    autoMarkAsRead: config?.readReceiptConfig?.autoMarkAsRead !== false,
  };

  const {
    messageStatuses,
    getMessageStatus,
    markAsRead,
    markVisibleMessagesAsRead,
    isEnabled: readReceiptsIsEnabled,
  } = useReadReceipts({
    socket: socketClient.current,
    chatState: chatStateRef.current,
    chatSessionId,
    config: readReceiptConfig,
    isChatVisible: isOpen,
  });

  // ********** Theme Override Hook ********** //
  const { serverThemeOverride } = useThemeOverride(serverCustomizations);

  // ********** Socket Listeners Hook ********** //
  const { setupSocketListeners } = useSocketListeners({
    socketClient,
    flowEngine: flowEngineRef,
    chatStateRef,
    workspaceIdRef,
    chatSessionId,
    isOpen,
    setRecord,
    setChatSessionId,
    setCurrentAgent,
    setIsLiveChatMode,
    setAgentTyping,
    setCurrentUIState,
    setIsNodeProcessing,
    setIsConnected,
    setUnreadCount,
    setServerCustomizations,
    setReactions,
    persistMessages,
    persistSession,
    initializeFlowEngine,
    lastUserChoiceRef,
  });

  // ********** Reset Conversation ********** //
  const resetConversation = useCallback(async () => {
    setChatSessionId(undefined);
    setCurrentAgent(undefined);
    setRecord([]);
    setReactions(new Map());
    setCurrentUIState(null);
    setIsNodeProcessing(false);
    setIsLiveChatMode(false);
    setAgentTyping(false);

    flowEngineRef.current?.reset();
    flowEngineRef.current = null;
    chatStateRef.current = null;

    // Clear socket's stored session so FETCHED_CHATBOT_DATA generates a fresh one
    if (socketClient.current) {
      socketClient.current.chatSessionId = undefined;
    }

    if (storageService.current?.isReady()) {
      await storageService.current.resetConversation();
      setHasPersistedSession(false);
    }

    if (socketClient.current?.isConnected()) {
      socketClient.current.getChatbotData();
    }

    if (__DEV__) {
      console.log('[ConferBot] Conversation reset — new session will be created');
    }
  }, []);

  // ********** Restore Session ********** //
  const restoreSession = useCallback(
    async (persistedState) => {
      if (!persistedState.session || !apiClient.current) return false;

      try {
        const sessionId = persistedState.session.chatSessionId;

        const historyResponse = await apiClient.current.getSessionHistory(sessionId);

        if (!historyResponse.success) {
          if (__DEV__) {
            console.log('[ConferBot] Persisted session invalid on server, clearing');
          }
          await storageService.current?.clearAll();
          setHasPersistedSession(false);
          return false;
        }

        setChatSessionId(sessionId);

        const serverRecord = historyResponse.data?.record || [];
        if (serverRecord.length > 0) {
          setRecord(deduplicateMessages(trimMessages(serverRecord)));
          await persistMessages(serverRecord);
        } else if (persistedState.messages.length > 0) {
          setRecord(deduplicateMessages(trimMessages(persistedState.messages)));
        }

        initializeFlowEngine(sessionId, persistedState);

        if (socketClient.current && socketClient.current.isConnected()) {
          socketClient.current.joinChatRoomVisitor(sessionId);
        }

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
  useEffect(() => {
    const initializeSDK = async () => {
      try {
        const persistedState = await initializeStorage();

        apiClient.current = new ConferBotAPI(apiKey, botId);

        socketClient.current = new ConferBotSocket({
          apiKey,
          botId,
          userId: user?.id || persistedState?.user?.userId,
          autoConnect: config?.autoConnect !== false,
        });

        setupSocketListeners();

        if (config?.autoConnect !== false) {
          await socketClient.current.connect(user?.id || persistedState?.user?.userId);
          setIsConnected(true);
        }

        if (user) {
          await persistUserData(user);
        }

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

    return () => {
      if (socketClient.current) {
        socketClient.current.removeAllListeners();
        socketClient.current.disconnect();
        socketClient.current = null;
      }
      if (flowEngineRef.current) {
        flowEngineRef.current.reset();
        flowEngineRef.current = null;
      }
      chatStateRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, botId]);

  // ********** Chat Actions ********** //
  const openChat = useCallback(async () => {
    setIsOpen(true);
    setUnreadCount(0);

    if (!chatSessionId && apiClient.current) {
      try {
        const visitorId = storageService.current?.isReady()
          ? await storageService.current.getOrCreateVisitorId()
          : user?.id;

        const response = await apiClient.current.initSession(visitorId);
        if (response.success && response.data) {
          const sessionId = response.data.chatSessionId;
          setChatSessionId(sessionId);

          await persistSession({
            chatSessionId: sessionId,
            visitorId: visitorId || undefined,
            isActive: true,
          });
          setHasPersistedSession(true);

          initializeFlowEngine(sessionId);

          const historyResponse = await apiClient.current.getSessionHistory(sessionId);
          if (historyResponse.success && historyResponse.data && historyResponse.data.record) {
            setRecord(deduplicateMessages(trimMessages(historyResponse.data.record)));
            await persistMessages(historyResponse.data.record);
          }

          if (socketClient.current && socketClient.current.isConnected()) {
            socketClient.current.joinChatRoomVisitor(sessionId);
          }
        }
      } catch (error) {
        console.error('[ConferBot] Failed to initialize session:', error);
      }
    }
  }, [chatSessionId, user?.id, initializeFlowEngine, persistSession, persistMessages]);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const registerPushToken = useCallback(async (token: string): Promise<void> => {
    if (!apiClient.current) return;
    try {
      const platform = Platform.OS as 'ios' | 'android';
      await apiClient.current.registerPushToken(token, platform);
      if (__DEV__) {
        console.log('[ConferBot] Push token registered:', token);
      }
    } catch (error) {
      console.error('[ConferBot] Failed to register push token:', error);
    }
  }, []);

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

  const on = useCallback(
    (event: SocketEvents, callback: (...args: any[]) => void): (() => void) => {
      if (!socketClient.current) return () => {};
      return socketClient.current.on(event, callback);
    },
    []
  );

  const off = useCallback((event: SocketEvents, callback: (...args: any[]) => void): void => {
    if (!socketClient.current) return;
    socketClient.current.off(event, callback);
  }, []);

  // ********** Context Value ********** //
  const contextValue: ExtendedConferBotContext = {
    isInitialized,
    isConnected,
    isOpen,
    chatSessionId,
    unreadCount,
    currentAgent,
    record,
    chatbotConfig,
    reactions,
    currentUIState,
    isNodeProcessing,
    flowEngine: flowEngineRef.current,
    chatState: chatStateRef.current,
    serverCustomizations,
    serverThemeOverride,
    botName: serverCustomizations?.botName || serverCustomizations?.logoText || null,
    botAvatarUrl: serverCustomizations?.avatar || serverCustomizations?.logo || null,
    isRestoring,
    hasPersistedSession,
    messageStatuses,
    readReceiptsEnabled: readReceiptsIsEnabled,
    openChat,
    closeChat,
    sendMessage,
    registerPushToken,
    on,
    off,
    addReaction,
    removeReaction,
    getReactions,
    submitNodeResponse,
    clearPersistedData,
    resetConversation,
    getMessageStatus,
    markMessageAsRead: markAsRead,
    markVisibleMessagesAsRead,
    rateKBArticle,
    isLiveChatMode,
    agentTyping,
    sendVisitorTyping,
  };

  return <ConferBotContext.Provider value={contextValue}>{children}</ConferBotContext.Provider>;
};

// ********** Custom Hook ********** //
export const useConferBot = (): ExtendedConferBotContext => {
  const context = useContext(ConferBotContext);
  if (!context) {
    throw new Error('useConferBot must be used within a ConferBotProvider');
  }
  return context;
};

export default ConferBotContext;
