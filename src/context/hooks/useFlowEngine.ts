// @ts-nocheck
import { useCallback, useState, useRef } from 'react';
import {
  NodeFlowEngine,
  ChatState,
  NodeHandlerRegistry,
  registerAllHandlers,
  NodeUIState,
  FlowDefinition,
} from '../../core';
import type { RecordItem } from '../../types';
import type { PersistedState } from '../../services/StorageService';
import type { StorageService } from '../../services/StorageService';
import type ConferBotSocket from '../../services/socket';
import type { ConferBotUser } from '../../types';
import { stripHtml, deduplicateMessages, trimMessages } from '../types';

interface UseFlowEngineParams {
  botId: string;
  user?: ConferBotUser;
  socketClient: React.MutableRefObject<ConferBotSocket | null>;
  storageService: React.MutableRefObject<StorageService | null>;
  flowEngine: React.MutableRefObject<NodeFlowEngine | null>;
  chatStateRef: React.MutableRefObject<ChatState | null>;
  setRecord: React.Dispatch<React.SetStateAction<RecordItem[]>>;
  persistAnswerVariables: () => Promise<void>;
  persistFlowState: () => Promise<void>;
}

export function useFlowEngine({
  botId,
  user,
  socketClient,
  storageService,
  flowEngine,
  chatStateRef,
  setRecord,
  persistAnswerVariables,
  persistFlowState,
}: UseFlowEngineParams) {
  const [currentUIState, setCurrentUIState] = useState<NodeUIState | null>(null);
  const [isNodeProcessing, setIsNodeProcessing] = useState(false);

  const workspaceIdRef = useRef<string | null>(null);
  // Track last user choice to filter duplicate bot messages from message-nodes
  // that just echo ${selection} back. The transcript listener skips bot messages
  // matching this value.
  const lastUserChoiceRef = useRef<string | null>(null);

  // ********** Node Flow Engine Initialization ********** //
  const initializeFlowEngine = useCallback(
    (sessionId: string, persistedState?: PersistedState | null) => {
      if (!socketClient.current) {
        console.warn('[ConferBot] Cannot initialize flow engine: socket not available');
        return;
      }

      // Initialize handler registry
      const registry = NodeHandlerRegistry.getInstance();
      registerAllHandlers(registry, {
        socketClient: socketClient.current,
      });

      // Create chat state - either restore from persisted or create new
      if (persistedState?.session && persistedState.answerVariables) {
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
        chatStateRef.current = new ChatState(sessionId, botId);
      }

      // Set visitorId on chat state
      const visitorId = user?.id || socketClient.current?.getUserId() || sessionId;
      chatStateRef.current.setVariable('_visitorId', visitorId);

      // Add listener to persist state changes
      chatStateRef.current.addListener(() => {
        persistAnswerVariables();
        persistFlowState();
      });

      // Create flow engine
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
            setCurrentUIState(null);
            setIsNodeProcessing(false);
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

  // ********** Submit Node Response ********** //
  const submitNodeResponse = useCallback((response: any, portName?: string) => {
    if (!flowEngine.current) {
      console.warn('[ConferBot] Cannot submit response: flow engine not initialized');
      return;
    }

    // Freeze choice buttons (disabled, selected one highlighted).
    // Matches web widget exactly: buttons get disabled, NO separate user message bubble.
    // Web widget's _handleChoiceSelection does NOT call _displayUserInputMessage.
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
  }, [setRecord]);

  return {
    // State
    currentUIState,
    setCurrentUIState,
    isNodeProcessing,
    setIsNodeProcessing,
    // Refs
    workspaceIdRef,
    lastUserChoiceRef,
    // Actions
    initializeFlowEngine,
    submitNodeResponse,
  };
}
