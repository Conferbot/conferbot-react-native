// @ts-nocheck
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Platform, useColorScheme } from 'react-native';
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
import type { NodeFlowEngine } from '../core';
import { ChatState } from '../core';
import { deduplicateMessages, trimMessages } from './types';
import type { ExtendedConferBotContext, ConferBotProviderProps } from './types';

// Hooks
import { usePersistence } from './hooks/usePersistence';
import { useReactions } from './hooks/useReactions';
import { useFlowEngine } from './hooks/useFlowEngine';
import { useSocketListeners } from './hooks/useSocketListeners';
import { useLiveChat } from './hooks/useLiveChat';
import { useThemeOverride } from './hooks/useThemeOverride';
import { resolveCustomizations } from '../core/customizations';
import { setWidgetLanguage } from '../core/i18n';
import { resolveWidgetTheme, withThemePalette } from '../core/widgetTheme';
import { useAgentBot } from './hooks/useAgentBot';
import { useLiveChatExtras } from './hooks/useLiveChatExtras';
import { useHandoverLifecycle } from './hooks/useHandoverLifecycle';
import { useRequestsPortal } from './hooks/useRequestsPortal';
import { useHomeScreen } from './hooks/useHomeScreen';
import { personalizeCustomizations, visitorVars } from '../core/personalize';
import { asyncStorageFor } from '../utils/deviceStorage';
import { useWaitingExtras, isScreenOnlyEntry, type WaitingExtras } from './hooks/useWaitingExtras';
import { useChatSounds } from './hooks/useChatSounds';
import { useDelight } from './hooks/useDelight';
import { useChatFontLoader } from '../hooks/useChatFont';
import { createDraftSender, draftPreviewOn, isSensitiveField } from '../core/typingPreview';
import { handoverPhase } from '../core/handoverState';
import { usePostChatRedirect } from './hooks/usePostChatRedirect';

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
  if (!apiKey.startsWith('conf_') && !/^[a-f0-9]{32}$/i.test(apiKey)) {
    console.warn(
      '[ConferBot] API key looks unusual. Any non-empty key is accepted - the bot ID is the operative credential.'
    );
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
  // The owner's post-chat redirect (the bot's redirectUrl, core/postChatRedirect.ts).
  const [redirectUrl, setRedirectUrl] = useState<string>('');
  // Late-bound: the conversation's end reaches the redirect, set up below.
  const conversationEndRef = useRef<() => void>(() => {});
  const onConversationEnd = useCallback(() => conversationEndRef.current(), []);

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
    onConversationEnd,
  });

  // ********** Reactions Hook ********** //
  const {
    reactions, setReactions,
    addReaction, removeReaction, getReactions,
  } = useReactions({ chatSessionId, user, socketClient });

  // ********** Live Chat Hook ********** //
  const readReceiptsEnabled = config?.enableReadReceipts !== false;
  // AI agent bot: its silent handover is not accepted yet (live sends wait).
  const agentPendingRef = useRef(false);
  // Late-bound: the agent hook needs the live chat setters and the live
  // chat hook calls back into the agent hook.
  const agentHooks = useRef<{ engage: () => void; sent: () => void }>({ engage: () => {}, sent: () => {} });
  const onBeforeLiveSend = useCallback(() => agentHooks.current.engage(), []);
  const onLiveSent = useCallback(() => agentHooks.current.sent(), []);
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
    agentPendingRef,
    onBeforeLiveSend,
    onLiveSent,
  });

  // ********** AI Agent Bot Hook ********** //
  const {
    agentBot, agentBotRef, setAgentBot,
    agentStream, suggestions, awaitingReply,
    startAgentBotChat, engageAgent,
    onAgentAccepted, onAgentMessage, noteVisitorMessage,
    sendAnswerFeedback, decideAction, trackGoal,
    setupAgentListeners, resetAgent,
  } = useAgentBot({
    socketClient,
    chatStateRef,
    setRecord,
    setCurrentAgent,
    setIsLiveChatMode,
    setAgentTyping,
    agentPendingRef,
  });
  agentHooks.current = { engage: engageAgent, sent: noteVisitorMessage };

  // ********** Live Chat Extras Hook ********** //
  // Queue, nobody available, receipts, locks, file requests, follow-up
  // email, post-chat rating (core/liveChat.ts).
  const liveChatExtras = useLiveChatExtras({
    socketClient,
    chatStateRef,
    record,
    setRecord,
    isOpen,
    waitingForPerson: currentUIState?.type === 'humanHandover' && !isLiveChatMode,
    // Nobody came and the visitor left a message (or skipped it): the flow
    // carries on from the handover step, as the web widget does.
    continueFlow: () => {
      if (flowEngineRef.current?.isAtHandover()) flowEngineRef.current.submitResponse({ action: 'continue' });
    },
    // The waiting step's max wait, and the bot's workspace for handover-timeout.
    handoverWait: () => {
      return { data: flowEngineRef.current?.handoverNodeData(), workspaceId: workspaceIdRef.current || '' };
    },
    // "Email me this chat" (core/emailTranscript.ts).
    postTranscriptEmail: (sessionId: string, email: string) =>
      apiClient.current ? apiClient.current.sendTranscriptEmail(sessionId, email) : Promise.resolve({ ok: false }),
    // The server's help pick rides on queue-status (useWaitingExtras).
    onQueueStatus: (data: any) => waitingRef.current?.onQueueStatus(data),
  });

  // ********** Handover Lifecycle Hook ********** //
  // The Connecting line and its outcome, the 20s waiting signal, leaving
  // the queue, and a live chat picked back up after a restart
  // (core/handoverState.ts, core/handoverWaiting.ts).
  // Late-bound: the waiting extras need the handover's signals, and the
  // handover says where a wait for a person begins and ends.
  const waitingRef = useRef<WaitingExtras | null>(null);
  const waitHooks = useRef({
    start: () => waitingRef.current?.waitHooks.start(),
    end: () => waitingRef.current?.waitHooks.end(),
  }).current;
  const handover = useHandoverLifecycle({
    socketClient,
    chatStateRef,
    flowEngine: flowEngineRef,
    record,
    setRecord,
    isOpen,
    setIsLiveChatMode,
    setCurrentAgent,
    setCurrentUIState,
    setIsNodeProcessing,
    waitingForPerson: currentUIState?.type === 'humanHandover' && !isLiveChatMode,
    waitHooks,
    // An agent bot's inactivity close only pauses it (no flow to go on with).
    isAgentBot: () => !!agentBotRef.current,
    // The escalation's handover-timeout names the bot's workspace.
    workspaceId: () => workspaceIdRef.current || '',
    // A restored wait's countdown goes on from the server's seconds left.
    onRestoredWait: liveChatExtras.resumeWaitWith,
  });


  // The agent chat is greeted when the visitor opens the chat, never at
  // connect (fetched-chatbot-data arrives at every app start).
  const agentStartRef = useRef<{ sessionId: string; bot: any; nodes: any[] } | null>(null);
  const [agentStartTick, setAgentStartTick] = useState(0);
  const onAgentBotReady = useCallback((sessionId: string, bot: any, nodes: any[]) => {
    agentStartRef.current = { sessionId, bot, nodes };
    setAgentStartTick((n) => n + 1);
  }, []);
  useEffect(() => {
    const pending = agentStartRef.current;
    if (!isOpen || !pending || !chatStateRef.current) return;
    agentStartRef.current = null;
    // A restored session already has its conversation: rejoin only.
    const resumed = (chatStateRef.current.getRecord() || []).some(
      (r: any) => r?.type === 'human-handover-node' || r?.shape === 'user-live-message'
    ) || record.some((r: any) => String(r?._id || '').startsWith('agent-greeting-') || r?.shape === 'user-live-message');
    startAgentBotChat(pending.sessionId, pending.bot, pending.nodes, resumed);
  }, [isOpen, agentStartTick]);

  // The app's user travels with every record, as the web widget's visitorContext.
  useEffect(() => {
    ChatState.visitorContext = user
      ? {
          ...(user.metadata || {}),
          id: user.id,
          ...(user.name ? { name: user.name } : {}),
          ...(user.email ? { email: user.email } : {}),
          ...(user.phone ? { phone: user.phone } : {}),
          ...(user.hash ? { hash: user.hash } : {}),
        }
      : null;
  }, [user?.id, user?.name, user?.email, user?.phone, user?.hash, user?.metadata]);

  // ********** Theme Override Hook ********** //
  // The widget theme (core/widgetTheme): with themeColors "theme" its palette
  // replaces the owner's colours; "auto" follows the phone's light/dark.
  const prefersDark = useColorScheme() === 'dark';
  // "Hi {{first_name|there}}": the app's user and a name the chat asked
  // for fill the owner's texts (core/personalize.ts, web ownerLayout.ts).
  const themedCustomizations = useMemo(
    () =>
      personalizeCustomizations(
        withThemePalette(serverCustomizations, prefersDark),
        visitorVars(
          user ? { ...(user.metadata || {}), ...(user.name ? { name: user.name } : {}) } : null,
          chatStateRef.current?.getUserMetadata?.()?.name
        )
      ),
    [serverCustomizations, prefersDark, user?.name, user?.metadata]
  );
  const widgetTheme = useMemo(
    () => resolveWidgetTheme(themedCustomizations, prefersDark),
    [themedCustomizations, prefersDark]
  );
  const { serverThemeOverride } = useThemeOverride(themedCustomizations, widgetTheme);
  // The SDK's own words: the app's choice, else the owner's widgetLanguage,
  // "auto" (and every bot that never chose) the phone's languages, set
  // before the chat is drawn (core/i18n; web index.ts setWidgetLanguage).
  const languageSetting = config?.widgetLanguage ?? serverCustomizations?.widgetLanguage;
  const widgetLanguage = useMemo(() => setWidgetLanguage(languageSetting), [languageSetting]);
  // The bot's settings as the web widget applies them (core/customizations).
  const customizations = useMemo(
    () => resolveCustomizations(themedCustomizations, '', widgetTheme),
    [themedCustomizations, widgetTheme]
  );


  // ********** Home Screen Hook ********** //
  // The home screen, the view the open chat shows, "Welcome back", the
  // help centre's data (core/home.ts; web ts/home/).
  const requestsRef = useRef<{ refreshRequests: (force?: boolean) => Promise<void> } | null>(null);
  const sendRef = useRef<(text: string) => Promise<any>>(() => Promise.resolve());
  const home = useHomeScreen({
    botId,
    socketClient,
    customizations: themedCustomizations,
    chatSessionId,
    record,
    visitorName: () => chatStateRef.current?.getUserMetadata?.()?.name,
    storage: config?.enablePersistence === false ? null : asyncStorageFor(config),
    send: (text: string) => sendRef.current(text),
    onHomeShown: () => {
      requestsRef.current?.refreshRequests();
    },
  });

  // ********** The chat's font ********** //
  // The owner's font, else the theme's, fetched and registered at run time
  // with expo-font when the app has it (core/ownerFont.ts).
  const chatFont = useChatFontLoader(themedCustomizations, widgetTheme);

  // ********** Sounds ********** //
  // A message arriving, the chat opening and closing, the visitor sending
  // (core/messageSound.ts; web ts/chat/messageSound.ts).
  const sounds = useChatSounds({
    customizations: themedCustomizations,
    record,
    isOpen,
    isRestoring,
    storage: config?.enablePersistence === false ? null : asyncStorageFor(config),
  });

  // ********** Human touches ********** //
  // The bot's tapback, the celebration, the waiting nudge and "Edit" on
  // the latest answer (core/delight.ts; web ts/chat/delight/).
  const delight = useDelight({
    customizations: themedCustomizations,
    record,
    setRecord,
    flowEngine: flowEngineRef,
    currentUIState,
    isNodeProcessing,
    chatVisible: isOpen && home.view === 'chat',
    locked: isLiveChatMode || handoverPhase(chatStateRef.current?.getRecord?.() || []) !== 'none',
  });

  // ********** Typing preview ********** //
  // While a person chats with the visitor, the agent sees the draft
  // (core/typingPreview.ts; web index.ts updateVisitorDraft).
  const draftSender = useRef(
    createDraftSender((draft) => {
      const sid = socketClient.current?.chatSessionId || chatStateRef.current?.sessionId;
      if (sid && socketClient.current?.isConnected()) socketClient.current.emitToServer('visitor-draft', { chatSessionId: sid, draft });
    })
  ).current;
  const chattingWithPerson = isLiveChatMode && !!currentAgent && currentAgent.isAIAgent !== true;
  const updateVisitorDraft = useCallback(
    (text: string, field?: { secureTextEntry?: boolean; textContentType?: string; autoComplete?: string }) => {
      delight.setComposerValue(text);
      if (draftPreviewOn(themedCustomizations, chattingWithPerson) && !isSensitiveField(field)) draftSender.update(text);
      else draftSender.clear();
    },
    [themedCustomizations, chattingWithPerson]
  );

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
    // The home screen and the help centre are not the conversation (web
    // index.ts: the home screen must not count agent messages as seen).
    isChatVisible: isOpen && home.view === 'chat',
  });

  // ********** While You Wait Hook ********** //
  // The help card 6s into a wait (or the server's queue-help pick, "That
  // solved it"), the games offer 2.5s after the waiting signal, a help
  // article opened in the app (core/waitArticles.ts, core/waitingGames.ts).
  const waiting = useWaitingExtras({
    socketClient,
    record,
    setRecord,
    customizations: themedCustomizations,
    onWidgetSignal: handover.onWidgetSignal,
    leftQueueHelped: handover.leftQueueHelped,
    fetchArticle: (id: string) => (apiClient.current ? apiClient.current.getKBArticle(id) : Promise.resolve(null)),
  });
  waitingRef.current = waiting;

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
    setAgentBot,
    onChatbotData: (chatbotData: any, knowledgeBaseData?: any) => {
      liveChatExtras.setChatbotData(chatbotData);
      setRedirectUrl(typeof chatbotData?.redirectUrl === 'string' ? chatbotData.redirectUrl : '');
      waiting.setKnowledgeBase(knowledgeBaseData);
      home.setKnowledgeBase(knowledgeBaseData);
      setChatbotConfig((prev) => ({ ...(prev || {}), id: botId, name: chatbotData?.name, csatConfig: chatbotData?.csatConfig } as any));
    },
    onAgentBotReady,
    onAgentAccepted,
    onAgentMessage,
    setupAgentListeners: () => {
      setupAgentListeners();
      liveChatExtras.setupLiveChatListeners();
      handover.setupHandoverListeners();
      waiting.setupWaitingListeners();
    },
    handover,
    onConversationEnd,
  });

  // ********** Post-chat redirect ********** //
  // The conversation ended and the rating is done (or there is none): the
  // app's onPostChatRedirect, else "Taking you to example.com in 10s" with
  // Cancel, then the system browser (core/postChatRedirect.ts; web
  // ts/chat/postChatRedirect.ts).
  const postChatRedirect = usePostChatRedirect({
    redirectUrl,
    chatSessionId,
    chatVisible: isOpen && home.view === 'chat',
    blocked: !!liveChatExtras.blocked,
    live: isLiveChatMode || handoverPhase(record) !== 'none',
    ratingPending: !!liveChatExtras.csatConfig && liveChatExtras.csatOpen && !liveChatExtras.csatSent,
    disabled: config?.disablePostChatRedirect === true,
    onPostChatRedirect: config?.onPostChatRedirect,
    store: config?.enablePersistence === false ? null : asyncStorageFor(config),
  });
  conversationEndRef.current = postChatRedirect.conversationEnded;

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
    resetAgent();
    postChatRedirect.resetRedirect();
    liveChatExtras.resetLiveChatExtras();
    handover.resetHandover();
    waiting.resetWaiting();

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
        // The listeners' fetched-chatbot-data uses the socket's session.
        if (socketClient.current) socketClient.current.chatSessionId = sessionId;
        // Its live chat (if any) is picked back up once the bot data arrives.
        handover.restoredSessionRef.current = sessionId;

        // The device's own messages first: they are what was on screen (the
        // server's record is in its own shapes and has no AI replies).
        const serverRecord = historyResponse.data?.record || [];
        if (persistedState.messages.length > 0) {
          setRecord(deduplicateMessages(trimMessages(persistedState.messages)));
        } else if (serverRecord.length > 0) {
          setRecord(deduplicateMessages(trimMessages(serverRecord)));
          await persistMessages(serverRecord);
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

        // The visitor as the records name it (useFlowEngine): the server
        // refuses a blocked one at the handshake.
        const handshakeVisitorId =
          user?.id ||
          persistedState?.user?.userId ||
          (storageService.current?.isReady() ? await storageService.current.getOrCreateVisitorId().catch(() => undefined) : undefined);

        socketClient.current = new ConferBotSocket({
          apiKey,
          botId,
          userId: user?.id || persistedState?.user?.userId,
          visitorId: handshakeVisitorId || undefined,
          autoConnect: config?.autoConnect !== false,
        });

        setupSocketListeners();

        // Restore before connecting: fetched-chatbot-data arrives on connect
        // and would otherwise start a new session over the saved one.
        if (persistedState?.session) {
          const restored = await restoreSession(persistedState);
          if (!restored) {
            setIsRestoring(false);
          }
        }

        if (config?.autoConnect !== false) {
          await socketClient.current.connect(user?.id || persistedState?.user?.userId);
          setIsConnected(true);
        }

        if (user) {
          await persistUserData(user);
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

  // ********** Keep the conversation on the device ********** //
  // The session, whichever path created it (openChat, or the socket's
  // fetched-chatbot-data), and the messages as they change.
  useEffect(() => {
    if (!chatSessionId || !storageService.current?.isReady()) return;
    persistSession({ chatSessionId, isActive: true });
    setHasPersistedSession(true);
  }, [chatSessionId]);
  useEffect(() => {
    if (!chatSessionId || !record.length || !storageService.current?.isReady()) return;
    // The while-you-wait cards are on screen only: never kept on the device.
    const t = setTimeout(() => persistMessages(record.filter((r) => !isScreenOnlyEntry(r))), 400);
    return () => clearTimeout(t);
  }, [record, chatSessionId]);

  // ********** Chat Actions ********** //
  const openChat = useCallback(async () => {
    setIsOpen(true);
    setUnreadCount(0);

    if (!chatSessionId && apiClient.current) {
      const visitorId = storageService.current?.isReady()
        ? await storageService.current.getOrCreateVisitorId()
        : user?.id;

      let sessionId: string | undefined;
      try {
        const response = await apiClient.current.initSession(visitorId);
        if (response.success && response.data) {
          sessionId = response.data.chatSessionId;
        }
      } catch (error) {
        console.error('[ConferBot] Failed to initialize session:', error);
      }

      // Local session fallback when the mobile REST API is unavailable -
      // the socket flow works without it (same behavior as the other SDKs).
      // Without this the session id stays undefined and every device ends
      // up merged into one shared server record.
      if (!sessionId) {
        sessionId = `mobile_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      }

      setChatSessionId(sessionId);

      await persistSession({
        chatSessionId: sessionId,
        visitorId: visitorId || undefined,
        isActive: true,
      });
      setHasPersistedSession(true);

      initializeFlowEngine(sessionId);

      try {
        const historyResponse = await apiClient.current.getSessionHistory(sessionId);
        if (historyResponse.success && historyResponse.data && historyResponse.data.record) {
          setRecord(deduplicateMessages(trimMessages(historyResponse.data.record)));
          await persistMessages(historyResponse.data.record);
        }
      } catch (error) {
        // History is best-effort for restored sessions; a fresh local
        // session has none.
      }

      if (socketClient.current && socketClient.current.isConnected()) {
        socketClient.current.joinChatRoomVisitor(sessionId);
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

  // ********** Your requests ********** //
  // The visitor's conversations with the team (core/requests.ts,
  // core/requestsPortal.ts; web ts/home/requests/).
  const requests = useRequestsPortal({
    botId,
    socketClient,
    isConnected,
    isOpen,
    chatSessionId,
    record,
    user,
    // The id the records carry (useFlowEngine `_visitorId`), else the handshake's.
    visitorId: () => (chatStateRef.current?.getVariable('_visitorId') as string | undefined) || socketClient.current?.getVisitorId(),
    storage: config?.enablePersistence === false ? null : asyncStorageFor(config),
    // A request that is the chat on screen: the conversation.
    openChat: () => {
      openChat();
      home.showChat();
    },
  });
  requestsRef.current = requests;

  // What the visitor types in a live or agent chat is what they came for,
  // for "Welcome back" (web special.ts _handleHumanHandoverInputSubmit).
  const sendAndRemember = useCallback(
    (text: string) => {
      if (isLiveChatMode || agentBot) home.rememberText(text);
      return sendMessage(text);
    },
    [isLiveChatMode, agentBot, sendMessage, home.rememberText]
  );
  sendRef.current = sendAndRemember;

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
    serverCustomizations: themedCustomizations,
    serverThemeOverride,
    customizations,
    widgetTheme,
    widgetLanguage,
    botName: serverCustomizations?.botName || serverCustomizations?.logoText || null,
    botAvatarUrl: serverCustomizations ? customizations.avatar : null,
    isRestoring,
    hasPersistedSession,
    messageStatuses,
    readReceiptsEnabled: readReceiptsIsEnabled,
    openChat,
    closeChat,
    sendMessage: sendAndRemember,
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
    // AI agent bots (Agent Studio)
    agentBot,
    agentStream,
    suggestions,
    awaitingReply,
    engageAgent,
    sendAnswerFeedback,
    decideAction,
    trackGoal,
    // Live chat extras
    botId,
    queue: liveChatExtras.queue,
    waitEndsAt: liveChatExtras.waitEndsAt,
    handoverWaiting: liveChatExtras.waiting,
    noAgentsAvailable: liveChatExtras.noAgents,
    lockedBy: liveChatExtras.lockedBy,
    visitorInputEnabled: liveChatExtras.inputEnabled,
    agentConnectionLost: liveChatExtras.agentLost,
    fileRequestedBy: liveChatExtras.fileRequestedBy,
    receiptMarks: liveChatExtras.receiptMarks,
    leadCardOpen: liveChatExtras.leadCardOpen,
    csatConfig: liveChatExtras.csatConfig,
    csatOpen: liveChatExtras.csatOpen,
    leftMessageTo: liveChatExtras.leftMessageTo,
    leadEmail: liveChatExtras.leadEmail,
    csatSent: liveChatExtras.csatSent,
    leaveMessage: liveChatExtras.leaveMessage,
    shareEmailForReply: liveChatExtras.shareEmailForReply,
    captureLeadEmail: liveChatExtras.captureLeadEmail,
    submitRating: liveChatExtras.submitRating,
    sendLiveFile: liveChatExtras.sendLiveFile,
    skipLeaveMessage: liveChatExtras.skipLeaveMessage,
    dismissCsat: liveChatExtras.dismissCsat,
    dismissFileRequest: liveChatExtras.dismissFileRequest,
    visitorBlocked: liveChatExtras.blocked,
    emailTranscriptOpen: liveChatExtras.mailOpen,
    emailTranscriptSentTo: liveChatExtras.mailSentTo,
    openEmailTranscript: liveChatExtras.openEmailTranscript,
    closeEmailTranscript: liveChatExtras.closeEmailTranscript,
    emailTranscript: liveChatExtras.emailTranscript,
    // Handover lifecycle
    leaveQueue: handover.leaveQueue,
    onWidgetSignal: handover.onWidgetSignal,
    // While you wait
    waitHelp: waiting.helpCard,
    openHelpItem: waiting.openHelpItem,
    solveWait: waiting.solveWait,
    gamesCard: waiting.gamesCard,
    openedArticle: waiting.article,
    openArticle: waiting.openArticle,
    closeArticle: waiting.closeArticle,
    interceptPlay: waiting.interceptPlay,
    // Your requests
    requestsPortal: requests.portal,
    requestsOpen: requests.requestsOpen,
    requests: requests.requests,
    requestsUnread: requests.requestsUnread,
    openRequests: requests.openRequests,
    closeRequests: requests.closeRequests,
    refreshRequests: requests.refreshRequests,
    requestsSeen: requests.requestsSeen,
    // Home screen
    homeView: home.view,
    showHome: home.showHome,
    showChat: home.showChat,
    showHelp: home.showHelp,
    helpCategoryId: home.helpCategoryId,
    homeMemory: home.memory,
    knowledgeBase: home.knowledgeBase,
    searchArticleText: home.searchArticleText,
    // The chat's font (core/ownerFont.ts)
    chatFont,
    // Sounds (core/messageSound.ts)
    soundOn: sounds.soundOn,
    hasSounds: sounds.hasSounds,
    toggleSound: sounds.toggleSound,
    playSendSound: sounds.playSendSound,
    // Human touches (core/delight.ts)
    answerTouches: delight.touches,
    changeAnswerRowId: delight.changeRowId,
    changeAnswer: delight.changeAnswer,
    stallHint: delight.stallHint,
    noteChatActivity: delight.noteActivity,
    clearAnswerTouch: delight.clearTouch,
    // Typing preview (core/typingPreview.ts)
    updateVisitorDraft,
    clearVisitorDraft: () => draftSender.clear(),
    // Post-chat redirect (core/postChatRedirect.ts)
    postChatRedirect: postChatRedirect.line,
    cancelPostChatRedirect: postChatRedirect.cancel,
    continuePostChatRedirect: postChatRedirect.continueNow,
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
