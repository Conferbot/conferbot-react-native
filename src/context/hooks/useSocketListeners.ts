// @ts-nocheck
import { useCallback, useRef } from 'react';
import type { RecordItem } from '../../types';
import { SocketEvents } from '../../types';
import type { NodeFlowEngine, ChatState, NodeUIState, FlowDefinition } from '../../core';
import type ConferBotSocket from '../../services/socket';
import type { Agent, Reaction } from '../../types';
import { stripHtml, deduplicateMessages, trimMessages } from '../types';
import { parseAgentBot, type AgentBot } from '../../core/agentBot';
import { htmlToMarkdown } from '../../utils/chatMarkdown';
import { agentTranslationOf } from '../../core/liveChat';
import { endedSinceLastLive, liveEventId } from '../../core/liveEvents';
import type { HandoverLifecycle } from './useHandoverLifecycle';

interface UseSocketListenersParams {
  socketClient: React.MutableRefObject<ConferBotSocket | null>;
  flowEngine: React.MutableRefObject<NodeFlowEngine | null>;
  chatStateRef: React.MutableRefObject<ChatState | null>;
  workspaceIdRef: React.MutableRefObject<string | null>;
  chatSessionId: string | undefined;
  isOpen: boolean;
  // State setters
  setRecord: React.Dispatch<React.SetStateAction<RecordItem[]>>;
  setChatSessionId: React.Dispatch<React.SetStateAction<string | undefined>>;
  setCurrentAgent: React.Dispatch<React.SetStateAction<Agent | undefined>>;
  setIsLiveChatMode: React.Dispatch<React.SetStateAction<boolean>>;
  setAgentTyping: React.Dispatch<React.SetStateAction<boolean>>;
  setCurrentUIState: React.Dispatch<React.SetStateAction<NodeUIState | null>>;
  setIsNodeProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  setIsConnected: React.Dispatch<React.SetStateAction<boolean>>;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  setServerCustomizations: React.Dispatch<React.SetStateAction<Record<string, any> | null>>;
  setReactions: React.Dispatch<React.SetStateAction<Map<string, Reaction[]>>>;
  // Persistence
  persistMessages: (messages: RecordItem[]) => Promise<void>;
  persistSession: (sessionData: any) => Promise<void>;
  // Flow engine
  initializeFlowEngine: (sessionId: string, persistedState?: any) => void;
  // Last user choice ref — to skip duplicate bot messages from message-nodes echoing ${selection}
  lastUserChoiceRef: React.MutableRefObject<string | null>;
  // AI agent bots (useAgentBot)
  setAgentBot: (bot: AgentBot | null) => void;
  /** The bot's data beyond the flow (post-chat rating settings, name). */
  onChatbotData: (chatbotData: any) => void;
  onAgentBotReady: (sessionId: string, bot: AgentBot, nodes: any[]) => void;
  onAgentAccepted: (data: any) => boolean;
  onAgentMessage: (data: any) => Record<string, unknown>;
  setupAgentListeners: () => void;
  /** The handover's lines, signals and restore (useHandoverLifecycle). */
  handover: HandoverLifecycle;
}

export function useSocketListeners({
  socketClient,
  flowEngine,
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
  onChatbotData,
  onAgentBotReady,
  onAgentAccepted,
  onAgentMessage,
  setupAgentListeners,
  handover,
}: UseSocketListenersParams) {
  // The session whose flow has been started: fetched-chatbot-data comes
  // again on every reconnect, and must not restart the conversation.
  const flowStartedFor = useRef<string | null>(null);
  // The bot's customizations, for listeners set up before they arrive.
  const customizationsRef = useRef<any>(null);
  // The session as of the latest render. The listeners are set up once, so
  // the chatSessionId they closed over goes stale (after a restart it is
  // the old conversation's).
  const sessionRef = useRef(chatSessionId);
  sessionRef.current = chatSessionId;

  const setupSocketListeners = useCallback(() => {
    if (!socketClient.current) return;
    setupAgentListeners();

    // *** FETCHED CHATBOT DATA *** //
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
        workspaceIdRef.current = chatbotData.workspaceId;
      }

      // Store integration webhooks (Zapier) for the zapier-node handler
      // Entries: { nodeId, botId, webhookURL, active }
      const integrationWebhooks = Array.isArray(chatbotData.integrationWebhooks)
        ? chatbotData.integrationWebhooks
        : null;
      if (integrationWebhooks && chatStateRef.current) {
        chatStateRef.current.setVariable('_integrationWebhooks', integrationWebhooks);
      }

      // Parse server customizations
      const customizations = chatbotData.customizations;
      if (customizations) {
        setServerCustomizations(customizations);
        customizationsRef.current = customizations;
        if (__DEV__) {
          console.log('[ConferBot] Server customizations loaded:', Object.keys(customizations).length, 'keys');
        }
      }

      // No-flow AI agent bot (Agent Studio)? null for every flow bot.
      const agentBot = parseAgentBot(chatbotData);
      setAgentBot(agentBot);
      onChatbotData(chatbotData);

      // Parse elements (nodes and edges)
      const elements = Array.isArray(chatbotData.elements) && chatbotData.elements.length > 0
        ? chatbotData.elements
        : agentBot ? [{ nodes: [], edges: [] }] : null;
      if (elements && Array.isArray(elements) && elements.length > 0) {
        const firstElement = elements[0];
        const nodes = firstElement.nodes || [];
        const edges = firstElement.edges || [];

        if (__DEV__) {
          console.log('[ConferBot] Loaded', nodes.length, 'nodes and', edges.length, 'edges');
        }

        if (nodes.length > 0 || agentBot) {
          // Use socket's stored chatSessionId (always current) instead of stale closure value
          const currentSessionId = socketClient.current?.chatSessionId || sessionRef.current;
          if (__DEV__) {
            console.log('[ConferBot] flowEngine.current:', !!flowEngine.current, 'chatSessionId:', currentSessionId);
          }
          if (!flowEngine.current) {
            const sessionId = currentSessionId || Math.random().toString(36).substring(2, 15);
            if (!currentSessionId) {
              setChatSessionId(sessionId);
            }
            if (__DEV__) {
              console.log('[ConferBot] Initializing flow engine for session:', sessionId);
            }
            initializeFlowEngine(sessionId);

            // Join chat room with new session — also re-join after a brief delay
            // to handle any race conditions with server-side room setup
            if (socketClient.current?.isConnected()) {
              socketClient.current.joinChatRoomVisitor(sessionId);
              // Safety re-join: ensures room membership even if first join was lost
              setTimeout(() => {
                if (socketClient.current?.isConnected()) {
                  socketClient.current.joinChatRoomVisitor(sessionId);
                }
              }, 1000);
            }

          }

          // Start flow engine with parsed data
          if (__DEV__) {
            console.log('[ConferBot] After init, flowEngine.current:', !!flowEngine.current, 'chatStateRef.current:', !!chatStateRef.current);
          }
          const startedSessionId = socketClient.current?.chatSessionId || chatStateRef.current?.sessionId || sessionRef.current;

          // An agent bot opens into the agent chat (useAgentBot), never the
          // shell flow.
          if (agentBot && chatStateRef.current) {
            if (resolvedBotNameOf(customizations)) {
              chatStateRef.current.setVariable('_botName', resolvedBotNameOf(customizations));
            }
            setIsNodeProcessing(false);
            onAgentBotReady(startedSessionId, agentBot, nodes);
            // Restored after a restart: a person (or the wait for one) is
            // picked back up from the server (live-chat-state).
            if (startedSessionId && handover.restoredSessionRef.current === startedSessionId) {
              handover.restoredSessionRef.current = null;
              handover.resumeRestored({ sessionId: startedSessionId, nodes, agentBot: true });
            }
            return;
          }

          // Already running for this session (a reconnect): back in the
          // room, nothing restarted.
          if (startedSessionId && flowStartedFor.current === startedSessionId) {
            if (socketClient.current?.isConnected()) socketClient.current.joinChatRoomVisitor(startedSessionId);
            return;
          }

          if (flowEngine.current) {
            flowStartedFor.current = startedSessionId || null;
            // Set metadata on chatState
            if (chatStateRef.current) {
              if (workspaceIdRef.current) {
                chatStateRef.current.setVariable('_workspaceId', workspaceIdRef.current);
              }
              if (integrationWebhooks) {
                chatStateRef.current.setVariable('_integrationWebhooks', integrationWebhooks);
              }
              const resolvedBotName = resolvedBotNameOf(customizations);
              if (resolvedBotName) {
                chatStateRef.current.setVariable('_botName', resolvedBotName);
              }
            }

            setIsNodeProcessing(true);
            // The engine starts at the first welcome-node, as the web widget does.
            const flowDefinition: FlowDefinition = { nodes, edges };
            const engine = flowEngine.current;
            // redactSensitive, chatLeaveMessage...: the steps read them.
            engine.setCustomizations?.(customizations);
            engine.loadFlow(flowDefinition);
            const startFlow = () =>
              engine.start().catch((error) => {
                console.error('[ConferBot] Failed to start flow:', error);
                setIsNodeProcessing(false);
              });
            // Restored after a restart: a live chat, or a handover still in
            // the queue, is picked back up from the server (live-chat-state)
            // instead of the flow running again.
            if (startedSessionId && handover.restoredSessionRef.current === startedSessionId) {
              handover.restoredSessionRef.current = null;
              handover
                .resumeRestored({ sessionId: startedSessionId, nodes, agentBot: false })
                .then((step) => {
                  if (step === 'start') startFlow();
                  else setIsNodeProcessing(false);
                })
                .catch(() => startFlow());
              return;
            }
            startFlow();
          }
        }
      }
    });

    // *** BOT RESPONSE *** //
    socketClient.current.on(SocketEvents.BOT_RESPONSE, (data: any) => {
      // Only render records for our own session - without this, records
      // broadcast for other sessions (or the shared no-session record when
      // a client emits without a chatSessionId) leak into the transcript
      const ownSessionId = socketClient.current?.chatSessionId || sessionRef.current;
      if (ownSessionId && data.chatSessionId !== ownSessionId) {
        return;
      }
      if (data.record) {
        setRecord(deduplicateMessages(trimMessages(data.record)));
        persistMessages(data.record);
      }
      if (!isOpen) {
        setUnreadCount((prev) => prev + 1);
      }

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

    // *** AGENT ACCEPTED *** //
    socketClient.current.on(SocketEvents.AGENT_ACCEPTED, (data: any) => {
      // The wait is over: the Connecting line settles (joined, or
      // unavailable when the AI takes the chat back), the waiting signal
      // stops (core/handoverState.ts acceptedPlan).
      const plan = handover.onAccepted(data);
      // An agent bot's own AI agent taking the chat it already greeted:
      // nothing to announce.
      if (onAgentAccepted(data)) {
        setCurrentUIState(null);
        setIsNodeProcessing(false);
        return;
      }
      if (data.agentDetails) {
        const agentName = data.agentDetails.name || 'Agent';

        setCurrentAgent({
          id: data.agentDetails._id,
          name: agentName,
          email: data.agentDetails.email,
          avatar: data.agentDetails.avatar,
          isAIAgent: data.agentDetails.isAIAgent === true,
        });

        setIsLiveChatMode(true);

        // "<name> joined the chat" - not again for the same person (a
        // repeat after a reconnect), with "They can see your conversation
        // so far" after an AI handover.
        if (plan.announce) handover.addJoin(data.agentDetails, plan);

        setCurrentUIState(null);
        setIsNodeProcessing(false);

        if (__DEV__) {
          console.log('[ConferBot] Agent accepted:', agentName);
        }
      }
    });

    // *** AGENT MESSAGE *** //
    socketClient.current.on(SocketEvents.AGENT_MESSAGE, (data: any) => {
      const ownSessionId = socketClient.current?.chatSessionId || sessionRef.current;
      if (data?.chatSessionId && ownSessionId && data.chatSessionId !== ownSessionId) return;
      const agentDetails = data.agentDetails || {};
      const messageId = data.agentMessageId || `agent-msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      // An AI reply's sources, buttons and cards (core/agentBot.ts).
      const extras = onAgentMessage(data);

      let newRecord: RecordItem;

      if (!data.isFileInput && !data.isAudioInput) {
        newRecord = {
          _id: messageId,
          type: 'agent-message',
          shape: 'agent-message',
          text: htmlToMarkdown(data.message),
          agentDetails,
          ...extras,
          // Sent in the visitor's language: the original kept for "See original".
          ...(agentTranslationOf(data) ? { translation: agentTranslationOf(data) } : {}),
          time: new Date().toISOString(),
        } as any;
      } else if (data.isFileInput) {
        const url = data.message;
        const fileName = url?.substring(url.lastIndexOf('/') + 1).replace(/%20/g, ' ') || 'file';
        newRecord = {
          _id: messageId,
          type: 'agent-message-file',
          shape: 'agent-message-file',
          file: url,
          fileName,
          agentDetails,
          time: new Date().toISOString(),
        } as any;
      } else if (data.isAudioInput) {
        const url = data.message;
        const fileName = url?.substring(url.lastIndexOf('/') + 1).replace(/%20/g, ' ') || 'audio';
        newRecord = {
          _id: messageId,
          type: 'agent-message-audio',
          shape: 'agent-message-audio',
          url,
          fileName,
          agentDetails,
          time: new Date().toISOString(),
        } as any;
      } else {
        return;
      }

      setRecord((prev) => deduplicateMessages(trimMessages([...prev, newRecord])));

      if (chatStateRef.current) {
        chatStateRef.current.addRecord({
          id: messageId,
          shape: newRecord.shape || newRecord.type,
          time: new Date().toISOString(),
          text: data.message,
          agentDetails,
          ...(newRecord.shape === 'agent-message' ? recordedExtras(extras) : {}),
        });
      }

      setAgentTyping(false);

      if (!isOpen) {
        setUnreadCount((prev) => prev + 1);
      }

      if (__DEV__) {
        console.log('[ConferBot] Agent message received:', data.isFileInput ? 'file' : data.isAudioInput ? 'audio' : 'text');
      }
    });

    // *** AGENT TYPING STATUS *** //
    socketClient.current.on(SocketEvents.AGENT_TYPING_STATUS, (data: any) => {
      setAgentTyping(!!data.isTyping);
    });

    // *** VISITOR INPUT TOGGLED *** //
    socketClient.current.on(SocketEvents.VISITOR_INPUT_TOGGLED, (data: any) => {
      if (__DEV__) {
        console.log('[ConferBot] Visitor input toggled:', data.isInputEnabled);
      }
    });

    // *** AGENT LEFT *** //
    socketClient.current.on(SocketEvents.AGENT_LEFT, (data: any) => {
      // An AI handing the visitor to the team is not leaving them: the
      // Connecting line, not "<name> left" (core/handoverState.ts
      // agentLeftKind); an AI pausing an idle visitor draws nothing.
      const kind = handover.onAgentLeft(data);
      if (kind === 'left') setCurrentAgent(undefined);

      if (__DEV__) {
        console.log('[ConferBot] Agent left:', kind, data?.agentDetails?.name || '');
      }
    });

    // *** CHAT ENDED *** //
    socketClient.current.on(SocketEvents.CHAT_ENDED, (data: any) => {
      const ownSessionId = socketClient.current?.chatSessionId || sessionRef.current;
      if (data?.chatSessionId && ownSessionId && data.chatSessionId !== ownSessionId) return;
      // The same end again (an agent's double click, an AI close racing a
      // person's): one "Chat ended" line, not two (web endedSinceLastLive).
      if (endedSinceLastLive(chatStateRef.current?.getRecord() || handover.recordRef.current)) return;
      const endedId = liveEventId('agent-chat-ended');
      const endedRecord: RecordItem = {
        _id: endedId,
        type: 'agent-chat-ended',
        text: 'Chat has ended',
        time: new Date().toISOString(),
      } as any;

      setRecord((prev) => deduplicateMessages(trimMessages([...prev, endedRecord])));

      if (chatStateRef.current) {
        // Its own id: under the session id a second live chat's end merged
        // into the first one's entry (web agentListeners.ts).
        chatStateRef.current.addRecord({
          id: endedId,
          type: 'agent-chat-ended',
          time: new Date().toISOString(),
        });
      }

      setCurrentAgent(undefined);
      setIsLiveChatMode(false);
      setAgentTyping(false);

      flowEngine.current?.reset();
      setCurrentUIState(null);
      setIsNodeProcessing(false);

      persistSession({ isActive: false });

      if (__DEV__) {
        console.log('[ConferBot] Chat ended');
      }
    });

    // *** NO AGENTS AVAILABLE *** //
    socketClient.current.on(SocketEvents.NO_AGENTS_AVAILABLE, () => {
      setIsLiveChatMode(false);
      setCurrentUIState(null);
      setIsNodeProcessing(false);

      // A flow at its handover step, as the web widget does it: the step
      // itself says the owner's fallback and, with "leave a message" off,
      // carries the flow on (HumanHandoverHandler); otherwise "Leave a
      // message" carries it on once sent or skipped.
      const engine = flowEngine.current;
      if (engine?.isAtHandover()) return;

      const noAgentsRecord: RecordItem = {
        _id: `no-agents-${Date.now()}`,
        type: 'system-message',
        text: 'No agents are available at the moment.',
        time: new Date().toISOString(),
      } as any;

      setRecord((prev) => deduplicateMessages(trimMessages([...prev, noAgentsRecord])));

      if (__DEV__) {
        console.log('[ConferBot] No agents available');
      }
    });

    // *** VISITOR DISCONNECTED *** //
    socketClient.current.on(SocketEvents.VISITOR_DISCONNECTED, () => {
      setChatSessionId(undefined);
      setCurrentAgent(undefined);
      setIsLiveChatMode(false);
      setAgentTyping(false);
      flowEngine.current?.reset();
      setCurrentUIState(null);
      setIsNodeProcessing(false);
    });

    // *** CONNECTION ERROR *** //
    socketClient.current.on(SocketEvents.CONNECTION_ERROR, () => {
      setIsConnected(false);
    });

    // *** MESSAGE REACTION UPDATE *** //
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
  }, [isOpen, persistMessages, persistSession, initializeFlowEngine, chatSessionId, setAgentBot, onAgentBotReady, onAgentAccepted, onAgentMessage, setupAgentListeners, handover]);

  return { setupSocketListeners };
}

const resolvedBotNameOf = (customizations: any): string =>
  customizations?.botName || customizations?.logoText || '';

// What the record keeps of an AI reply's extras: not the moment's offers
// (an action awaiting confirmation), as the web widget does.
const recordedExtras = (extras: Record<string, unknown>) => {
  const { actionRequest, isAIReply, ...kept } = extras as any;
  return kept;
};
