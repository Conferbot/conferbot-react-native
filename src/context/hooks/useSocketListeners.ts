// @ts-nocheck
import { useCallback } from 'react';
import type { RecordItem } from '../../types';
import { SocketEvents } from '../../types';
import type { NodeFlowEngine, ChatState, NodeUIState, FlowDefinition } from '../../core';
import type ConferBotSocket from '../../services/socket';
import type { Agent, Reaction } from '../../types';
import { stripHtml, deduplicateMessages, trimMessages } from '../types';

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
}: UseSocketListenersParams) {
  const setupSocketListeners = useCallback(() => {
    if (!socketClient.current) return;

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
          if (__DEV__) {
            console.log('[ConferBot] flowEngine.current:', !!flowEngine.current, 'chatSessionId:', chatSessionId);
          }
          if (!flowEngine.current) {
            const sessionId = chatSessionId || Math.random().toString(36).substring(2, 15);
            if (!chatSessionId) {
              setChatSessionId(sessionId);
            }
            if (__DEV__) {
              console.log('[ConferBot] Initializing flow engine for session:', sessionId);
            }
            initializeFlowEngine(sessionId);

            // Join chat room with new session
            if (socketClient.current?.isConnected()) {
              socketClient.current.joinChatRoomVisitor(sessionId);
            }

            // Add a ChatState listener to sync bot messages to UI record
            if (chatStateRef.current) {
              let lastTranscriptLength = 0;
              chatStateRef.current.addListener((state) => {
                const transcript = state.getTranscript();
                if (transcript.length > lastTranscriptLength) {
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
            // Set metadata on chatState
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

    // *** BOT RESPONSE *** //
    socketClient.current.on(SocketEvents.BOT_RESPONSE, (data: any) => {
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
      if (data.agentDetails) {
        const agentName = data.agentDetails.name || 'Agent';

        setCurrentAgent({
          id: data.agentDetails._id,
          name: agentName,
          email: data.agentDetails.email,
        });

        setIsLiveChatMode(true);

        const joinedRecord: RecordItem = {
          _id: `agent-joined-${Date.now()}`,
          type: 'agent-joined-message',
          text: `${agentName} has joined the chat`,
          name: agentName,
          time: new Date().toISOString(),
        } as any;

        setRecord((prev) => deduplicateMessages(trimMessages([...prev, joinedRecord])));

        if (chatStateRef.current) {
          chatStateRef.current.addRecord({
            id: data.agentDetails._id,
            type: 'agent-joined-message',
            time: new Date().toISOString(),
            name: agentName,
          });
        }

        setCurrentUIState(null);
        setIsNodeProcessing(false);

        if (__DEV__) {
          console.log('[ConferBot] Agent accepted:', agentName);
        }
      }
    });

    // *** AGENT MESSAGE *** //
    socketClient.current.on(SocketEvents.AGENT_MESSAGE, (data: any) => {
      const agentDetails = data.agentDetails || {};
      const messageId = data.agentMessageId || `agent-msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      let newRecord: RecordItem;

      if (!data.isFileInput && !data.isAudioInput) {
        newRecord = {
          _id: messageId,
          type: 'agent-message',
          shape: 'agent-message',
          text: stripHtml(data.message),
          agentDetails,
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
      const agentName = data?.agentDetails?.name || 'Agent';

      const leftRecord: RecordItem = {
        _id: `agent-left-${Date.now()}`,
        type: 'agent-left-chat',
        text: `${agentName} has left the chat`,
        name: agentName,
        time: new Date().toISOString(),
      } as any;

      setRecord((prev) => deduplicateMessages(trimMessages([...prev, leftRecord])));

      if (chatStateRef.current) {
        chatStateRef.current.addRecord({
          id: data?.agentId || `agent-left-${Date.now()}`,
          type: 'agent-left-chat',
          time: new Date().toISOString(),
          name: agentName,
        });
      }

      setCurrentAgent(undefined);

      if (__DEV__) {
        console.log('[ConferBot] Agent left:', agentName);
      }
    });

    // *** CHAT ENDED *** //
    socketClient.current.on(SocketEvents.CHAT_ENDED, (data: any) => {
      const endedRecord: RecordItem = {
        _id: `chat-ended-${Date.now()}`,
        type: 'agent-chat-ended',
        text: 'Chat has ended',
        time: new Date().toISOString(),
      } as any;

      setRecord((prev) => deduplicateMessages(trimMessages([...prev, endedRecord])));

      if (chatStateRef.current) {
        chatStateRef.current.addRecord({
          id: data?.chatSessionId || `chat-ended-${Date.now()}`,
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

      const noAgentsRecord: RecordItem = {
        _id: `no-agents-${Date.now()}`,
        type: 'system-message',
        text: 'No agents are available at the moment. Please try again later.',
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
  }, [isOpen, persistMessages, persistSession, initializeFlowEngine, chatSessionId]);

  return { setupSocketListeners };
}
