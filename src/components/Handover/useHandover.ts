/**
 * useHandover.ts
 *
 * React hook for managing handover state and socket communication.
 * Provides a clean interface for components to interact with the handover system.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  HandoverState,
  HandoverStage,
  PreChatFormData,
  SurveyResponse,
  AgentInfo,
  QueueInfo,
  PreChatFormConfig,
  PostChatSurveyConfig,
} from './types';

// ========================================
// TYPES
// ========================================

interface SocketClient {
  emitToServer(event: string, payload: any): void;
  on(event: string, callback: (data: any) => void): void;
  off(event: string, callback?: (data: any) => void): void;
}

interface UseHandoverOptions {
  /** Socket client for real-time communication */
  socketClient?: SocketClient | null;
  /** Session ID for the chat */
  sessionId: string;
  /** Bot ID */
  botId: string;
  /** Node ID for the handover node */
  nodeId: string;
  /** Pre-chat form configuration */
  preChatConfig?: PreChatFormConfig;
  /** Post-chat survey configuration */
  surveyConfig?: PostChatSurveyConfig;
  /** Department to connect to */
  department?: string;
  /** Priority of the request */
  priority?: string;
  /** Timeout in seconds */
  timeout?: number;
  /** Callback when handover completes/ends */
  onComplete?: (data: { ended: boolean; surveySubmitted?: boolean }) => void;
  /** Callback when agent sends a message */
  onAgentMessage?: (message: string, agent?: AgentInfo) => void;
  /** Callback when stage changes */
  onStageChange?: (stage: HandoverStage, prevStage: HandoverStage) => void;
}

interface UseHandoverReturn {
  /** Current handover state */
  state: HandoverState;
  /** Whether handover is active */
  isActive: boolean;
  /** Submit pre-chat form data */
  submitPreChat: (data: PreChatFormData, department?: string) => void;
  /** Cancel the handover request */
  cancel: () => void;
  /** Retry connection */
  retry: () => void;
  /** Send a message to the agent */
  sendMessage: (message: string, attachments?: any[]) => void;
  /** Notify agent that user is typing */
  setTyping: (isTyping: boolean) => void;
  /** End the chat session */
  endChat: (reason?: string) => void;
  /** Submit survey response */
  submitSurvey: (response: SurveyResponse) => void;
  /** Skip the survey */
  skipSurvey: () => void;
  /** Continue after handover (back to bot) */
  continue: () => void;
  /** Reset the handover state */
  reset: () => void;
}

// ========================================
// INITIAL STATE
// ========================================

const initialState: HandoverState = {
  stage: 'pre_chat',
  waitMessage: 'Please wait while we connect you with an agent...',
  connectedMessage: 'You are now connected with an agent.',
  endedMessage: 'The conversation has ended. Thank you for chatting with us!',
  noAgentsMessage: 'Sorry, no agents are available at the moment.',
  timeoutMessage: 'Connection timed out. Please try again later.',
};

// ========================================
// HOOK IMPLEMENTATION
// ========================================

export function useHandover(options: UseHandoverOptions): UseHandoverReturn {
  const {
    socketClient,
    sessionId,
    botId,
    nodeId,
    preChatConfig,
    surveyConfig,
    department,
    priority = 'normal',
    timeout = 300, // 5 minutes default
    onComplete,
    onAgentMessage,
    onStageChange,
  } = options;

  const [state, setState] = useState<HandoverState>({
    ...initialState,
    preChatConfig,
    surveyConfig,
    selectedDepartment: department,
  });

  const isActive = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  // Update stage with callback
  const setStage = useCallback((newStage: HandoverStage) => {
    setState((prev) => {
      if (prev.stage !== newStage) {
        onStageChange?.(newStage, prev.stage);
      }
      return { ...prev, stage: newStage };
    });
  }, [onStageChange]);

  // Setup socket listeners.
  // The embed-server emits kebab-case events scoped to the chat room
  // (agent-accepted, agent-message, agent-typing-status, chat-ended,
  // no-agents-available), matching the web widget. These are bridged to the
  // handover stage callbacks below. Events are room-scoped server-side, but we
  // still filter defensively when a session ID is present in the payload.
  useEffect(() => {
    if (!socketClient) return;

    const isForThisSession = (data: any): boolean => {
      const eventSession = data?.chatSessionId || data?.sessionId;
      return !eventSession || eventSession === sessionId;
    };

    // agent-accepted: an agent (human or AI) joined the chat.
    // Server payload: { agentDetails } (see embed-server ticketController /
    // omnichannelAIHandler). Marks the handover as connected.
    const handleAgentAccepted = (data: any) => {
      if (!isForThisSession(data)) return;
      // Clear timeout on successful connection
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (data?.conversationId) {
        conversationIdRef.current = data.conversationId;
      }
      setState((prev) => ({
        ...prev,
        stage: 'connected',
        agent: data?.agentDetails || data?.agent || prev.agent,
        conversationId: data?.conversationId || prev.conversationId,
        connectedAt: new Date().toISOString(),
      }));
    };

    // agent-typing-status: agent typing indicator
    const handleAgentTyping = (data: any) => {
      if (!isForThisSession(data)) return;
      setState((prev) => ({
        ...prev,
        isAgentTyping: data?.isTyping ?? data?.typingStatus ?? false,
      }));
    };

    // agent-message: message from the connected agent.
    // Server payload: { message, agentDetails, chatSessionId }
    const handleAgentMessage = (data: any) => {
      if (!isForThisSession(data)) return;
      onAgentMessage?.(data?.message, data?.agentDetails || state.agent);
    };

    // chat-ended: the agent or server ended the conversation
    const handleEnded = (data: any) => {
      if (!isForThisSession(data)) return;
      isActive.current = false;
      setState((prev) => ({
        ...prev,
        stage: data?.showSurvey || prev.surveyConfig?.enabled ? 'post_chat' : 'ended',
        surveyConfig: data?.surveyConfig || prev.surveyConfig,
        endedAt: new Date().toISOString(),
      }));
    };

    // no-agents-available: server could not find an agent
    const handleNoAgents = (data: any) => {
      if (!isForThisSession(data)) return;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      isActive.current = false;
      setState((prev) => ({
        ...prev,
        stage: 'no_agents',
        noAgentsMessage: data?.message || prev.noAgentsMessage,
      }));
    };

    // Register listeners for the real server events (kebab-case, matching
    // web widget / embed-server). Timeout is handled by the local timer in
    // submitPreChat, matching the web widget's client-side maxWaitTimer.
    socketClient.on('agent-accepted', handleAgentAccepted);
    socketClient.on('agent-typing-status', handleAgentTyping);
    socketClient.on('agent-message', handleAgentMessage);
    socketClient.on('chat-ended', handleEnded);
    socketClient.on('no-agents-available', handleNoAgents);

    // Cleanup
    return () => {
      socketClient.off('agent-accepted', handleAgentAccepted);
      socketClient.off('agent-typing-status', handleAgentTyping);
      socketClient.off('agent-message', handleAgentMessage);
      socketClient.off('chat-ended', handleEnded);
      socketClient.off('no-agents-available', handleNoAgents);
    };
  }, [socketClient, sessionId, state.agent, onAgentMessage]);

  // Submit pre-chat form
  const submitPreChat = useCallback(
    (data: PreChatFormData, selectedDepartment?: string) => {
      setState((prev) => ({
        ...prev,
        preChatData: data,
        selectedDepartment: selectedDepartment || prev.selectedDepartment,
        stage: 'waiting',
        requestedAt: new Date().toISOString(),
      }));

      isActive.current = true;

      // Set timeout
      timeoutRef.current = setTimeout(() => {
        if (isActive.current) {
          setState((prev) => ({
            ...prev,
            stage: 'timeout',
          }));
          isActive.current = false;
        }
      }, timeout * 1000);

      // Emit socket event
      socketClient?.emitToServer('handover:request', {
        sessionId,
        botId,
        nodeId,
        preChatData: data,
        department: selectedDepartment || department,
        priority,
      });
    },
    [socketClient, sessionId, botId, nodeId, department, priority, timeout]
  );

  // Cancel handover
  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    isActive.current = false;

    socketClient?.emitToServer('handover:cancel', {
      sessionId,
      conversationId: conversationIdRef.current,
    });

    onComplete?.({ ended: true });
  }, [socketClient, sessionId, onComplete]);

  // Retry connection
  const retry = useCallback(() => {
    setState((prev) => ({
      ...prev,
      stage: prev.preChatData ? 'waiting' : 'pre_chat',
    }));

    if (state.preChatData) {
      submitPreChat(state.preChatData, state.selectedDepartment);
    }
  }, [state.preChatData, state.selectedDepartment, submitPreChat]);

  // Send message
  const sendMessage = useCallback(
    (message: string, attachments?: any[]) => {
      if (!conversationIdRef.current) return;

      socketClient?.emitToServer('handover:message', {
        sessionId,
        conversationId: conversationIdRef.current,
        message,
        attachments,
      });
    },
    [socketClient, sessionId]
  );

  // Set typing state
  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (!conversationIdRef.current) return;

      socketClient?.emitToServer('handover:typing', {
        sessionId,
        conversationId: conversationIdRef.current,
        isTyping,
      });
    },
    [socketClient, sessionId]
  );

  // End chat
  const endChat = useCallback(
    (reason?: string) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      socketClient?.emitToServer('handover:end', {
        sessionId,
        conversationId: conversationIdRef.current,
        reason,
      });

      isActive.current = false;
      setState((prev) => ({
        ...prev,
        stage: prev.surveyConfig?.enabled ? 'post_chat' : 'ended',
        endedAt: new Date().toISOString(),
      }));
    },
    [socketClient, sessionId]
  );

  // Submit survey
  const submitSurvey = useCallback(
    (response: SurveyResponse) => {
      socketClient?.emitToServer('handover:survey', {
        sessionId,
        conversationId: conversationIdRef.current,
        response: {
          ...response,
          sessionId,
          agentId: state.agent?.id,
        },
      });

      setState((prev) => ({
        ...prev,
        surveyResponse: response,
        stage: 'ended',
      }));

      onComplete?.({ ended: true, surveySubmitted: true });
    },
    [socketClient, sessionId, state.agent, onComplete]
  );

  // Skip survey
  const skipSurvey = useCallback(() => {
    setState((prev) => ({
      ...prev,
      stage: 'ended',
    }));

    onComplete?.({ ended: true, surveySubmitted: false });
  }, [onComplete]);

  // Continue (back to bot)
  const continueFlow = useCallback(() => {
    reset();
    onComplete?.({ ended: true });
  }, [onComplete]);

  // Reset state
  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    isActive.current = false;
    conversationIdRef.current = null;
    setState({
      ...initialState,
      preChatConfig,
      surveyConfig,
      selectedDepartment: department,
    });
  }, [preChatConfig, surveyConfig, department]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    state,
    isActive: isActive.current,
    submitPreChat,
    cancel,
    retry,
    sendMessage,
    setTyping,
    endChat,
    submitSurvey,
    skipSurvey,
    continue: continueFlow,
    reset,
  };
}

export default useHandover;
