// @ts-nocheck
/**
 * AI agent bots (Agent Studio, no flow): the chat opens on the agent's
 * greeting and suggested questions, and the agent answers from the first
 * message. Underneath it is the handover socket path, started silently
 * (silentStart) so the server records the Response / Ticket / AI
 * conversation as for any AI handover - the web widget's
 * _startAgentBotChat (conferbot-widget index.ts). See core/agentBot.ts.
 */
import { useCallback, useRef, useState } from 'react';
import type { RecordItem } from '../../types';
import type ConferBotSocket from '../../services/socket';
import type { ChatState } from '../../core';
import {
  agentDetailsOf,
  agentHandoverData,
  agentShellNodes,
  aiReplyExtrasOf,
  followUpsOf,
  isAgentAIActive,
  isAIAgentDetails,
  safeRich,
  replyTimeoutNotice,
  AWAIT_REPLY_MS,
  DEFAULT_AGENT_GREETING,
  type AgentBot,
} from '../../core/agentBot';
import { buildHandoverPayload } from '../../core/handoverPayload';
import { withFeedback } from '../../core/answerFeedback';
import { handoverPhase } from '../../core/handoverState';
import { deduplicateMessages, trimMessages } from '../types';
import { htmlToMarkdown } from '../../utils/chatMarkdown';


interface UseAgentBotParams {
  socketClient: React.MutableRefObject<ConferBotSocket | null>;
  chatStateRef: React.MutableRefObject<ChatState | null>;
  setRecord: React.Dispatch<React.SetStateAction<RecordItem[]>>;
  setCurrentAgent: (agent: any) => void;
  setIsLiveChatMode: (on: boolean) => void;
  setAgentTyping: (on: boolean) => void;
  /** True while the silent handover has not been accepted: live sends wait. */
  agentPendingRef: React.MutableRefObject<boolean>;
}

export interface AgentStream {
  id: string;
  text: string;
  agentDetails: any;
}

export function useAgentBot({
  socketClient,
  chatStateRef,
  setRecord,
  setCurrentAgent,
  setIsLiveChatMode,
  setAgentTyping,
  agentPendingRef,
}: UseAgentBotParams) {
  const [agentBot, setAgentBotState] = useState<AgentBot | null>(null);
  const agentBotRef = useRef<AgentBot | null>(null);
  const [agentStream, setAgentStream] = useState<AgentStream | null>(null);
  // One-tap questions: the greeting's starters, then each answer's follow-ups.
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [awaitingReply, setAwaitingReplyState] = useState(false);
  const awaitTimer = useRef<any>(null);
  // The session whose agent chat has been started (a reconnect must not
  // greet again or start a second handover).
  const startedFor = useRef<string | null>(null);

  const setAgentBot = useCallback((bot: AgentBot | null) => {
    agentBotRef.current = bot;
    setAgentBotState(bot);
  }, []);

  const setAwaitingReply = useCallback((on: boolean) => {
    if (awaitTimer.current) clearTimeout(awaitTimer.current);
    awaitTimer.current = on
      ? setTimeout(() => {
          awaitTimer.current = null;
          setAwaitingReplyState(false);
          // Say so, instead of silently dropping the dots (web agentListeners.ts).
          setRecord((prev) => deduplicateMessages(trimMessages([...prev, replyTimeoutNotice() as any])));
        }, AWAIT_REPLY_MS)
      : null;
    setAwaitingReplyState(on);
  }, []);

  const addRecord = useCallback(
    (item: any) => setRecord((prev) => deduplicateMessages(trimMessages([...prev, item]))),
    [setRecord]
  );

  // The shell handover to start once the visitor engages.
  const pendingHandover = useRef<any>(null);

  /**
   * Open the agent chat for this session on screen: the greeting and the
   * starters. Nothing is sent yet - every record sent becomes a Response
   * (a chat on the customer's plan), so only a person starts one (the web
   * widget's engagement gate): see engageAgent.
   * `resumed`: the session already has its conversation (a restore) - only
   * rejoin; nothing is greeted or handed over again.
   */
  const startAgentBotChat = useCallback(
    (sessionId: string, bot: AgentBot, nodes: any[], resumed = false) => {
      const socket = socketClient.current;
      const state = chatStateRef.current;
      if (!socket || !state) return;
      // Already open for this session (a reconnect): back in the room only.
      if (startedFor.current === sessionId) {
        socket.joinChatRoomVisitor(sessionId);
        return;
      }
      startedFor.current = sessionId;

      const agentDetails = agentDetailsOf(bot);
      // A restored chat a person has (the AI handed it on): not the AI.
      if (!(resumed && handoverPhase(state.getRecord()) === 'joined')) {
        setCurrentAgent({ id: agentDetails._id, name: agentDetails.name, avatar: agentDetails.avatar, isAIAgent: true });
      }
      // Visitor messages go the live way from the start; they are held
      // (agentPendingRef) until the agent has accepted.
      setIsLiveChatMode(true);

      if (resumed) {
        pendingHandover.current = null;
        agentPendingRef.current = false;
        socket.joinChatRoomVisitor(sessionId);
        return;
      }

      agentPendingRef.current = true;
      const greeting = bot.greeting || DEFAULT_AGENT_GREETING;
      const { welcome, handover } = agentShellNodes(nodes, bot.agentId);
      const now = new Date().toISOString();

      const welcomeId = welcome?.id || 'agent-welcome';
      state.addRecord({
        _id: welcomeId,
        id: welcomeId,
        type: 'welcome-node',
        time: now,
        data: { ...(welcome?.data || {}), text: greeting, disableImage: true },
        agentDetails,
      } as any);
      addRecord({
        _id: `agent-greeting-${sessionId}`,
        type: 'agent-message',
        shape: 'agent-message',
        text: greeting,
        agentDetails,
        time: now,
      });
      setSuggestions(bot.starters);

      const handoverId = handover?.id || 'agent-handover';
      pendingHandover.current = {
        id: handoverId,
        data: agentHandoverData(handover?.data, bot.agentId),
      };
      socket.joinChatRoomVisitor(sessionId);
    },
    [addRecord, setCurrentAgent, setIsLiveChatMode]
  );

  /**
   * The visitor is engaging (typing, a starter tapped, a message sent):
   * create the Response from the record, then the silent handover. Once.
   */
  const engageAgent = useCallback(() => {
    const step = pendingHandover.current;
    const socket = socketClient.current;
    const state = chatStateRef.current;
    if (!step || !socket || !state || !socket.isConnected()) return;
    pendingHandover.current = null;
    socket.sendResponseRecord(state.buildResponseData());
    state.addRecord({ _id: step.id, id: step.id, type: 'human-handover-node', time: new Date().toISOString(), data: step.data } as any);
    socket.emitToServer('initiate-handover', buildHandoverPayload(state, step.data, { silentStart: true }));
  }, []);

  /**
   * agent-accepted. True when it is this bot's own agent (silent start):
   * nothing is drawn, the held messages go out.
   */
  const onAgentAccepted = useCallback((data: any): boolean => {
    if (!agentBotRef.current || !isAIAgentDetails(data?.agentDetails)) return false;
    const wasPending = agentPendingRef.current;
    agentPendingRef.current = false;
    const d = data.agentDetails;
    setCurrentAgent({ id: d._id, name: d.name, avatar: d.avatar, isAIAgent: true });
    setIsLiveChatMode(true);
    // Anything the visitor said while it connected: one record send has it all.
    const state = chatStateRef.current;
    if (wasPending && state && socketClient.current?.isConnected()) {
      const hasVisitorWords = state.getRecord().some((r: any) => r?.shape === 'user-live-message');
      if (hasVisitorWords) {
        socketClient.current.sendResponseRecord(state.buildResponseData());
        setAwaitingReply(true);
      }
    }
    return true;
  }, [setCurrentAgent, setIsLiveChatMode, setAwaitingReply]);

  /** The record fields an AI reply adds, and its follow-up questions shown. */
  const onAgentMessage = useCallback((data: any): Record<string, unknown> => {
    setAwaitingReply(false);
    setAgentStream(null);
    const extras = aiReplyExtrasOf(data);
    if (isAIAgentDetails(data?.agentDetails)) {
      setSuggestions(data?.isFallback === true ? [] : followUpsOf(data?.followUps));
    } else {
      // A person is answering: the AI's offers are over.
      setSuggestions([]);
    }
    return extras;
  }, [setAwaitingReply]);

  /** The visitor said something: the chips go, the dots wait for the AI. */
  const noteVisitorMessage = useCallback(() => {
    setSuggestions([]);
    if (agentBotRef.current && isAgentAIActive(chatStateRef.current?.getRecord?.() || [])) setAwaitingReply(true);
  }, [setAwaitingReply]);

  const sendAnswerFeedback = useCallback(
    (agentMessageId: string, feedback: { helpful: boolean; reason?: string; comment?: string }) => {
      setRecord((prev) => prev.map((r: any) => (String(r._id) === String(agentMessageId) ? { ...r, feedback } : r)));
      // Kept on the answer's record entry too, as the web does, so the
      // conversation's record says how it was rated.
      const state = chatStateRef.current;
      if (state) {
        const before = state.getRecord();
        const after = withFeedback(before, agentMessageId, feedback);
        if (after !== before) state.setRecord(after);
      }
      const sid = socketClient.current?.chatSessionId || chatStateRef.current?.sessionId;
      socketClient.current?.emitWithAck('ai-answer-feedback', { chatSessionId: sid, agentMessageId, ...feedback }, 10000);
    },
    [setRecord]
  );

  /** The visitor's Confirm / Not now on an action the AI is about to take. */
  const decideAction = useCallback(async (token: string, accept: boolean) => {
    const sid = socketClient.current?.chatSessionId || chatStateRef.current?.sessionId;
    const res = await socketClient.current?.emitWithAck('ai-action-decision', { chatSessionId: sid, token, accept });
    if (res?.ok && accept) setAwaitingReply(true);
    return res && typeof res.ok === 'boolean' ? res : { ok: false };
  }, [setAwaitingReply]);

  const trackGoal = useCallback((goalId: string, conversionEvent: string) => {
    const sid = socketClient.current?.chatSessionId || chatStateRef.current?.sessionId;
    socketClient.current?.emitToServer('track-goal-completion', { chatSessionId: sid, goalId, conversionEvent });
  }, []);

  const setupAgentListeners = useCallback(() => {
    const socket = socketClient.current;
    if (!socket) return;
    const own = (data: any) => {
      const sid = socket.chatSessionId || chatStateRef.current?.sessionId;
      return !data?.chatSessionId || !sid || data.chatSessionId === sid;
    };

    // The reply as it is written: one live bubble, replaced by the finished
    // agent-message.
    socket.on('agent-message-stream', (data: any) => {
      if (!own(data) || typeof data?.text !== 'string' || !data.text.trim() || !data.streamId) return;
      setAwaitingReply(false);
      setAgentTyping(false);
      if (__DEV__) console.log('[ConferBot] AI reply streaming:', data.streamId, data.text.length);
      setAgentStream({ id: data.streamId, text: data.text, agentDetails: data.agentDetails });
    });

    // An article, quick replies or a card from the agent.
    socket.on('agent-message-rich', (data: any) => {
      const entry = data?.entry;
      if (!own(data) || !entry || typeof entry.id !== 'string') return;
      const rich = safeRich(entry.rich);
      if (!rich) return;
      setAwaitingReply(false);
      setAgentStream(null);
      const item = {
        _id: entry.id,
        type: 'agent-message-rich',
        shape: 'agent-message-rich',
        text: typeof entry.text === 'string' ? entry.text : '',
        rich,
        agentDetails: entry.agentDetails,
        time: entry.time || new Date().toISOString(),
      };
      addRecord(item);
      chatStateRef.current?.addRecord({ ...item, id: entry.id, rich: entry.rich } as any);
    });

    // An agent edited or unsent a message: the bubble changes in place.
    const change = (deleted: boolean) => (data: any) => {
      if (!own(data) || !data?.agentMessageId) return;
      setRecord((prev) =>
        prev.map((r: any) =>
          String(r._id) === String(data.agentMessageId)
            ? deleted
              ? { ...r, text: '', deleted: true }
              : { ...r, text: typeof (data.text ?? data.message) === 'string' ? htmlToMarkdown(data.text ?? data.message) : r.text, edited: true }
            : r
        )
      );
    };
    socket.on('agent-message-edited', change(false));
    socket.on('agent-message-deleted', change(true));

    // The AI left or the chat ended: no reply is coming, so no "took too
    // long" notice either (web endAwaitingReply).
    socket.on('agent-left', (data: any) => {
      if (own(data)) setAwaitingReply(false);
    });
    socket.on('chat-ended', (data: any) => {
      if (own(data)) setAwaitingReply(false);
    });
    // Closed for inactivity; a later message from the visitor reopens it.
    socket.on('ai-agent-inactive-close', (data: any) => {
      if (!own(data)) return;
      setAwaitingReply(false);
      setSuggestions([]);
      chatStateRef.current?.addRecord({ id: `ai-close-${Date.now()}`, type: 'ai-agent-inactive-close', time: new Date().toISOString() } as any);
    });
    socket.on('ai-agent-resumed', (data: any) => {
      if (!own(data)) return;
      chatStateRef.current?.addRecord({ id: `ai-resumed-${Date.now()}`, type: 'ai-agent-resumed', time: new Date().toISOString() } as any);
      if (data?.agentDetails) setCurrentAgent({ id: data.agentDetails._id, name: data.agentDetails.name, avatar: data.agentDetails.avatar, isAIAgent: true });
      setIsLiveChatMode(true);
    });
  }, [addRecord, setRecord, setAwaitingReply, setAgentTyping, setCurrentAgent, setIsLiveChatMode]);

  const resetAgent = useCallback(() => {
    startedFor.current = null;
    pendingHandover.current = null;
    agentPendingRef.current = false;
    setAgentStream(null);
    setSuggestions([]);
    setAwaitingReply(false);
  }, [setAwaitingReply]);

  return {
    agentBot,
    agentBotRef,
    setAgentBot,
    agentStream,
    suggestions,
    awaitingReply,
    startAgentBotChat,
    engageAgent,
    onAgentAccepted,
    onAgentMessage,
    noteVisitorMessage,
    sendAnswerFeedback,
    decideAction,
    trackGoal,
    setupAgentListeners,
    resetAgent,
  };
}

