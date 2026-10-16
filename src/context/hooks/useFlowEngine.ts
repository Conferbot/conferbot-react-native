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
import { Linking } from 'react-native';
import { redactText } from '../../core/privacy/redact';
import { scoreText } from '../../core/delight';

/** Steps whose own card takes the answer and leaves no bubble of the visitor's (the web shows one). */
const ECHOED_STEPS = new Set([
  'calendar-node',
  'rating-choice-node',
  'opinion-scale-choice-node',
  'user-rating-node',
  'slider-node',
  'datetime-node',
  'image-choice-node',
]);

/**
 * What an answer row says it answered (core/delight.ts reads it): the
 * question's step and type, and its text as a score where it is one
 * ("4/5"), so the bot's tapback reads it as the web reads its bubble.
 */
const answerOfFor = (ui: any, response: any, text: string) => {
  if (!ui?.nodeId || !ui?.stepType) return undefined;
  const value = Number(typeof response === 'object' && response !== null ? response.value ?? response.rating : response);
  const max = ui.type === 'rating' ? Number(ui.maxRating) : ui.type === 'opinionScale' ? Number(ui.max) : 0;
  return { nodeId: String(ui.nodeId), type: ui.stepType, text: scoreText(ui.stepType, value, max) || text };
};

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
  /** The flow reached its end: the conversation is over (the post-chat redirect). */
  onConversationEnd?: () => void;
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
  onConversationEnd,
}: UseFlowEngineParams) {
  const [currentUIState, setCurrentUIState] = useState<NodeUIState | null>(null);
  const [isNodeProcessing, setIsNodeProcessing] = useState(false);

  const workspaceIdRef = useRef<string | null>(null);
  // Track last user choice to filter duplicate bot messages from message-nodes
  // that just echo ${selection} back. The transcript listener skips bot messages
  // matching this value.
  const lastUserChoiceRef = useRef<string | null>(null);
  // An answer the step's own card took (a date, a rating, a slider...):
  // its text, as the step wrote it, is the visitor's bubble (web: every
  // answer shows as the visitor's message).
  const pendingEchoRef = useRef<{ nodeId: string; answerOf: any } | null>(null);

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

      // Set visitorId on chat state — use persisted visitor ID (survives restarts).
      // Load async from storage, then update chatState when available.
      const syncVisitorId = user?.id || socketClient.current?.getUserId();
      chatStateRef.current.setVariable('_visitorId', syncVisitorId || sessionId);

      // Async: replace with persisted visitor ID from device storage
      if (!syncVisitorId && storageService.current?.isReady()) {
        storageService.current.getOrCreateVisitorId().then((persistedId) => {
          if (chatStateRef.current && persistedId) {
            chatStateRef.current.setVariable('_visitorId', persistedId);
          }
        });
      }

      // The bot's messages, as the flow writes them, onto the screen. On
      // every path that starts the flow (a new chat, a restored one).
      let shownTranscript = chatStateRef.current.getTranscript().length;
      chatStateRef.current.addListener((state) => {
        const transcript = state.getTranscript();
        // Gone back to an earlier question ("Edit"): the conversation from there.
        if (transcript.length < shownTranscript) shownTranscript = transcript.length;
        if (transcript.length <= shownTranscript) return;
        const newEntries = transcript.slice(shownTranscript);
        shownTranscript = transcript.length;
        const items: RecordItem[] = [];
        for (const entry of newEntries) {
          if (entry.type === 'bot' && entry.text) {
            items.push({
              _id: `bot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              type: 'bot-message',
              shape: 'bot-text-message',
              text: entry.text,
              // The step that said it ("Edit" folds a question's rows away).
              ...(entry.nodeId ? { nodeId: entry.nodeId } : {}),
              time: entry.timestamp || new Date().toISOString(),
            } as any);
          }
          const echo = pendingEchoRef.current;
          if (entry.type === 'user' && entry.text && echo && entry.nodeId === echo.nodeId) {
            pendingEchoRef.current = null;
            items.push({
              _id: `user_answer_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              type: 'user-message',
              text: state.redactSensitive === false ? entry.text : redactText(entry.text).text,
              answerOf: echo.answerOf,
              time: entry.timestamp || new Date().toISOString(),
            } as any);
          }
          // Standalone bot image (e.g. welcome node image/GIF), below the
          // text bubble like the web widget
          if (entry.type === 'bot' && entry.data?.imageUrl) {
            items.push({
              _id: `bot_img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              type: 'bot-message',
              shape: 'bot-image-message',
              url: entry.data.imageUrl,
              mediaNodeId: entry.data.mediaNodeId,
              time: entry.timestamp || new Date().toISOString(),
            } as any);
          }
          // A video step shows its link here (no player to wait for): the
          // flow moves on now rather than at the 4 s cap.
          if (entry.type === 'bot' && entry.data?.videoUrl && entry.data?.mediaNodeId) {
            const id = entry.data.mediaNodeId;
            setTimeout(() => flowEngine.current?.mediaSettled(id), 0);
          }
        }
        if (items.length > 0) setRecord((prev) => deduplicateMessages(trimMessages([...prev, ...items])));
      });

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
            onConversationEnd?.();
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

    // Freeze choice buttons (disabled, selected one highlighted)
    // Then add the user's selection as a user message bubble
    // (matches web widget's _handleChoiceSelection → _displayUserInputMessage)
    const currentState = flowEngine.current.getState();
    const ui: any = currentState.currentUIState;
    // A button that opens a page (a navigate link, the payment's Checkout)
    // opens it; the step keeps waiting, so nothing is frozen.
    const pressed = ui?.type === 'buttons' ? (ui.buttons || []).find((b: any) => b.id === response?.buttonId) : null;
    const link = typeof pressed?.value === 'string' && /^https?:\/\//i.test(pressed.value) ? pressed.value : null;
    if (link) Linking.openURL(link).catch(() => undefined);
    pendingEchoRef.current = null;
    if (ui?.type === 'buttons' && ui.awaitInput) {
      // Steps that stay on screen until they finish (navigate, consent,
      // payment, ranking): no frozen copy, the step answers for itself.
    } else if (currentState.currentUIState && currentState.currentUIState.type === 'buttons') {
      const choiceUI = currentState.currentUIState as any;
      const selectedLabel = response?.label || response?.text || response?.value || String(response);
      setRecord((prev) => [
        ...prev,
        // Frozen choice buttons
        {
          _id: `choice_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          type: 'bot-message',
          shape: 'bot-choice-buttons',
          ...(choiceUI.nodeId ? { nodeId: String(choiceUI.nodeId) } : {}),
          choiceUI: {
            ...choiceUI,
            isSubmitted: true,
            selectedButtonId: response?.buttonId,
            selectedButtonIds: response?.buttonIds,
          },
          time: new Date().toISOString(),
        } as any,
        // User's selection shown as a right-aligned user bubble
        {
          _id: `user_choice_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          type: 'user-message',
          text: selectedLabel,
          answerOf: answerOfFor(ui, response, String(selectedLabel)),
          time: new Date().toISOString(),
        } as any,
      ]);
    } else if (
      currentState.currentUIState &&
      currentState.currentUIState.type === 'textInput' &&
      // A step card's answer (OTP send / verify, a signature): the step says what the visitor did.
      !(typeof response === 'object' && response !== null && 'action' in response)
    ) {
      // Text answers from the bottom bar echo as a right-aligned user bubble
      // (matches web widget's _displayUserInputMessage)
      const answerText =
        typeof response === 'object' && response !== null && 'value' in response
          ? String(response.value)
          : String(response);
      setRecord((prev) => [
        ...prev,
        {
          _id: `user_input_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          type: 'user-message',
          // Card numbers, ids and passwords hidden in the bubble too (web
          // privacy startBubbleMasking), unless the owner turned it off.
          text: chatStateRef.current?.redactSensitive === false ? answerText : redactText(answerText).text,
          answerOf: answerOfFor(ui, response, answerText),
          time: new Date().toISOString(),
        } as any,
      ]);
    } else if (ui && ui.type !== 'buttons' && ui.type !== 'textInput' && ui.nodeId && ECHOED_STEPS.has(ui.stepType)) {
      // The step's card answered (a date, a rating, a scale...): the step's
      // own words for it become the visitor's bubble.
      pendingEchoRef.current = { nodeId: String(ui.nodeId), answerOf: answerOfFor(ui, response, '') };
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
